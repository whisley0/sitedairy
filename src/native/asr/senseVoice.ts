// On-device SenseVoice Small ASR via sherpa-onnx (offline, multilingual + Cantonese).
import SherpaOnnx from '@siteed/sherpa-onnx.rn';
import { ASR_PRIMARY_LANGUAGE } from './asrConfig';
import { senseVoiceModelDirPath } from './senseVoiceModelManager';

let initialized = false;
let initLanguage: string | null = null;

function cleanTranscript(text: string): string {
  return text.replace(/<\|[^|]*\|>/g, '').replace(/\s+/g, ' ').trim();
}

export async function ensureSenseVoice(language: string = ASR_PRIMARY_LANGUAGE): Promise<void> {
  if (initialized && initLanguage === language) return;

  if (initialized) {
    await SherpaOnnx.ASR.release();
    initialized = false;
    initLanguage = null;
  }

  const result = await SherpaOnnx.ASR.initialize({
    modelDir: senseVoiceModelDirPath(),
    modelType: 'sense_voice',
    streaming: false,
    numThreads: 2,
    language,
    useItn: true,
    modelFiles: {
      model: 'model.int8.onnx',
      tokens: 'tokens.txt',
    },
  });

  if (!result.success) {
    throw new Error(result.error ?? 'SenseVoice ASR failed to initialize');
  }

  initialized = true;
  initLanguage = language;
}

export async function transcribeSenseVoice(
  audio: Float32Array,
  sampleRate: number,
  language: string = ASR_PRIMARY_LANGUAGE,
): Promise<string> {
  await ensureSenseVoice(language);
  // TurboModule ReadableArray expects a plain number[].
  const samples = Array.from(audio);
  const result = await SherpaOnnx.ASR.recognizeFromSamples(sampleRate, samples);
  return cleanTranscript(result.text ?? '');
}

export async function releaseSenseVoice(): Promise<void> {
  if (!initialized) return;
  await SherpaOnnx.ASR.release();
  initialized = false;
  initLanguage = null;
}
