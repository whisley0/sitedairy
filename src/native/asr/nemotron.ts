// On-device Nemotron streaming ASR (FastConformer encoder + RNNT decoder/joint)
// via onnxruntime-react-native. Cache-aware chunked encoder + greedy RNNT decode,
// ported from parakeet-rs (src/nemotron.rs, src/model_nemotron.rs). Tensor names
// and shapes match the ONNX export exactly.
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import { Tokenizer } from './tokenizer';
import { computeLogMel, createMelFilterbank, N_MELS } from './melSpectrogram';

const CHUNK_SIZE = 56;
const PRE_ENCODE_CACHE = 9;
const MAX_SYMBOLS_PER_STEP = 10;
// Dims for nemotron-3.5-asr-streaming-0.6b (from the model's config.json).
const NUM_LAYERS = 24;
const HIDDEN_DIM = 1024;
const LEFT_CONTEXT = 56;
const CONV_CONTEXT = 8;
const LSTM_DIM = 640;
const LSTM_LAYERS = 2;
// Language -> prompt embedding index (subset of nemotron.rs PROMPT_DICTIONARY).
const PROMPT_DICTIONARY: Record<string, number> = {
  auto: 101, en: 0, 'en-US': 0, 'en-GB': 1, es: 3, 'es-ES': 2, fr: 8, 'fr-FR': 8,
  de: 9, 'de-DE': 9, it: 15, pt: 13, 'pt-BR': 12, nl: 16, ru: 11, ar: 7, hi: 6,
  ja: 10, 'ja-JP': 10, ko: 14, 'ko-KR': 14, 'zh-CN': 4, vi: 33, uk: 19, pl: 17,
  tr: 18, sv: 24, cs: 22, da: 25, fi: 26, ro: 20, hu: 23,
};

// Greedy argmax, optionally skipping tokens disallowed by `mask` (0 = blocked).
// The blank id sits at index vocab_size (== mask.length), so it is past the end
// of the mask and therefore always selectable.
function argmax(data: Float32Array, mask?: Uint8Array): number {
  let bestIdx = -1;
  let bestVal = -Infinity;
  for (let i = 0; i < data.length; i++) {
    if (mask && i < mask.length && mask[i] === 0) continue;
    if (data[i] > bestVal) { bestVal = data[i]; bestIdx = i; }
  }
  return bestIdx;
}

export class Nemotron {
  private constructor(
    private encoder: InferenceSession,
    private decoder: InferenceSession,
    private tokenizer: Tokenizer,
    private filterbank: Float32Array[],
    private hasPrompt: boolean,
    private blankId: number,
    // Vocabulary mask restricting output to Chinese (Mandarin + Cantonese) and English.
    private allowedMask: Uint8Array,
  ) {}

  promptIndex = 101; // default "auto" for multilingual

  static async create(
    encoderPath: string,
    decoderPath: string,
    tokenizerBytes: Uint8Array,
    targetLang?: string,
  ): Promise<Nemotron> {
    const tokenizer = Tokenizer.fromBytes(tokenizerBytes);
    const encoder = await InferenceSession.create(encoderPath);
    const decoder = await InferenceSession.create(decoderPath);
    const hasPrompt = encoder.inputNames.includes('prompt_index');
    const model = new Nemotron(
      encoder,
      decoder,
      tokenizer,
      createMelFilterbank(),
      hasPrompt,
      tokenizer.size, // blank_id == vocab_size
      tokenizer.chineseEnglishMask(),
    );
    if (targetLang && PROMPT_DICTIONARY[targetLang] !== undefined) {
      model.promptIndex = PROMPT_DICTIONARY[targetLang];
    }
    return model;
  }

  // Offline (record-then-transcribe) decode over a full 16kHz mono buffer.
  async transcribe(audio: Float32Array): Promise<string> {
    const mel = computeLogMel(audio, this.filterbank);
    const total = mel.nFrames;
    if (total === 0) return '';

    let cacheChannel: Float32Array = new Float32Array(NUM_LAYERS * LEFT_CONTEXT * HIDDEN_DIM);
    let cacheTime: Float32Array = new Float32Array(NUM_LAYERS * HIDDEN_DIM * CONV_CONTEXT);
    let cacheLen = 0;
    let state1: Float32Array = new Float32Array(LSTM_LAYERS * LSTM_DIM);
    let state2: Float32Array = new Float32Array(LSTM_LAYERS * LSTM_DIM);
    let lastToken = this.blankId;
    const tokens: number[] = [];

    const expectedSize = PRE_ENCODE_CACHE + CHUNK_SIZE; // 65
    let bufferIdx = 0;
    let chunkIdx = 0;

    while (bufferIdx < total) {
      const chunkEnd = Math.min(bufferIdx + CHUNK_SIZE, total);
      const mainLen = chunkEnd - bufferIdx;
      const chunkData = new Float32Array(N_MELS * expectedSize);

      if (chunkIdx > 0 && bufferIdx >= PRE_ENCODE_CACHE) {
        const cacheStart = bufferIdx - PRE_ENCODE_CACHE;
        for (let f = 0; f < PRE_ENCODE_CACHE; f++) {
          for (let m = 0; m < N_MELS; m++) {
            chunkData[m * expectedSize + f] = mel.data[m * total + cacheStart + f];
          }
        }
      }
      for (let f = 0; f < mainLen; f++) {
        for (let m = 0; m < N_MELS; m++) {
          chunkData[m * expectedSize + PRE_ENCODE_CACHE + f] = mel.data[m * total + bufferIdx + f];
        }
      }

      const feeds: Record<string, Tensor> = {
        processed_signal: new Tensor('float32', chunkData, [1, N_MELS, expectedSize]),
        processed_signal_length: new Tensor('int64', BigInt64Array.from([BigInt(PRE_ENCODE_CACHE + mainLen)]), [1]),
        cache_last_channel: new Tensor('float32', cacheChannel, [NUM_LAYERS, 1, LEFT_CONTEXT, HIDDEN_DIM]),
        cache_last_time: new Tensor('float32', cacheTime, [NUM_LAYERS, 1, HIDDEN_DIM, CONV_CONTEXT]),
        cache_last_channel_len: new Tensor('int64', BigInt64Array.from([BigInt(cacheLen)]), [1]),
      };
      if (this.hasPrompt) {
        feeds.prompt_index = new Tensor('int64', BigInt64Array.from([BigInt(this.promptIndex)]), [1]);
      }

      const out = await this.encoder.run(feeds);
      const encoded = out.encoded.data as Float32Array;
      const encFrames = Number((out.encoded_len.data as BigInt64Array)[0]);
      cacheChannel = out.cache_last_channel_next.data as Float32Array;
      cacheTime = out.cache_last_time_next.data as Float32Array;
      cacheLen = Number((out.cache_last_channel_len_next.data as BigInt64Array)[0]);

      const dec = await this.decodeFrames(encoded, encFrames, state1, state2, lastToken, tokens);
      state1 = dec.state1;
      state2 = dec.state2;
      lastToken = dec.lastToken;

      bufferIdx += CHUNK_SIZE;
      chunkIdx += 1;
    }

    return this.tokenizer.decode(tokens);
  }

  // Greedy RNNT decode over the encoder frames of one chunk. encoded is
  // row-major [1, HIDDEN_DIM, encTotal]; we slice frame t as [1, HIDDEN_DIM, 1].
  private async decodeFrames(
    encoded: Float32Array,
    encFrames: number,
    state1: Float32Array,
    state2: Float32Array,
    lastToken: number,
    tokens: number[],
  ): Promise<{ state1: Float32Array; state2: Float32Array; lastToken: number }> {
    const encTotal = encoded.length / HIDDEN_DIM;
    for (let t = 0; t < encFrames; t++) {
      const frame = new Float32Array(HIDDEN_DIM);
      for (let h = 0; h < HIDDEN_DIM; h++) frame[h] = encoded[h * encTotal + t];

      for (let s = 0; s < MAX_SYMBOLS_PER_STEP; s++) {
        const out = await this.decoder.run({
          encoder_outputs: new Tensor('float32', frame, [1, HIDDEN_DIM, 1]),
          targets: new Tensor('int32', Int32Array.from([lastToken]), [1, 1]),
          target_length: new Tensor('int32', Int32Array.from([1]), [1]),
          input_states_1: new Tensor('float32', state1, [LSTM_LAYERS, 1, LSTM_DIM]),
          input_states_2: new Tensor('float32', state2, [LSTM_LAYERS, 1, LSTM_DIM]),
        });
        const logits = out.outputs.data as Float32Array;
        const maxIdx = argmax(logits, this.allowedMask);
        if (maxIdx === this.blankId) break;
        tokens.push(maxIdx);
        lastToken = maxIdx;
        state1 = out.output_states_1.data as Float32Array;
        state2 = out.output_states_2.data as Float32Array;
      }
    }
    return { state1, state2, lastToken };
  }
}
