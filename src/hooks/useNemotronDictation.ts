import { useCallback, useEffect, useRef, useState } from 'react';
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioStream,
  type AudioStreamBuffer,
} from 'expo-audio';
import { Nemotron } from '../native/asr/nemotron';
import { resampleLinear, SAMPLE_RATE } from '../native/asr/melSpectrogram';
import {
  downloadModel,
  isModelDownloaded,
  modelPaths,
  readTokenizerBytes,
} from '../native/asr/modelManager';
import { ASR_PRIMARY_LANGUAGE } from '../native/asr/asrConfig';

export type DictationStatus = 'idle' | 'loading-model' | 'recording' | 'transcribing' | 'downloading';

function concat(chunks: Float32Array[]): Float32Array {
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const out = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export function useNemotronDictation() {
  const [status, setStatus] = useState<DictationStatus>('idle');
  const [modelReady, setModelReady] = useState(isModelDownloaded());
  const [error, setError] = useState<string | null>(null);

  const modelRef = useRef<Nemotron | null>(null);
  const buffersRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef<number>(SAMPLE_RATE);
  const peakRef = useRef(0);

  const { stream, isStreaming } = useAudioStream({
    sampleRate: SAMPLE_RATE,
    channels: 1,
    encoding: 'float32',
    onBuffer: (buf: AudioStreamBuffer) => {
      sampleRateRef.current = buf.sampleRate;
      const frame = new Float32Array(buf.data.slice(0));
      buffersRef.current.push(frame);
      for (let i = 0; i < frame.length; i++) {
        const level = Math.abs(frame[i]);
        if (level > peakRef.current) peakRef.current = level;
      }
    },
  });

  useEffect(() => {
    setModelReady(isModelDownloaded());
  }, []);

  useEffect(() => {
    if (!isStreaming && status === 'recording') {
      setStatus('idle');
    }
  }, [isStreaming, status]);

  const clearError = useCallback(() => setError(null), []);

  const ensureModel = useCallback(async (): Promise<Nemotron> => {
    if (modelRef.current) return modelRef.current;
    setStatus('loading-model');
    const { encoderPath, decoderPath } = modelPaths();
    const tokenizer = await readTokenizerBytes();
    modelRef.current = await Nemotron.create(encoderPath, decoderPath, tokenizer, ASR_PRIMARY_LANGUAGE);
    setStatus('idle');
    return modelRef.current;
  }, []);

  const downloadSpeechModel = useCallback(async () => {
    setStatus('downloading');
    setError(null);
    try {
      await downloadModel();
      setModelReady(true);
    } catch (cause) {
      setError(String(cause));
    } finally {
      setStatus('idle');
    }
  }, []);

  const startRecording = useCallback(async (): Promise<boolean> => {
    if (!modelReady) return false;
    setError(null);
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      setError('mic-denied');
      return false;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    buffersRef.current = [];
    sampleRateRef.current = SAMPLE_RATE;
    peakRef.current = 0;
    await stream.start();
    setStatus('recording');
    return true;
  }, [modelReady, stream]);

  const stopRecording = useCallback(async (): Promise<{ text: string | null; error: string | null }> => {
    if (!isStreaming && status !== 'recording') return { text: null, error: null };
    stream.stop();
    setStatus('transcribing');
    try {
      const raw = concat(buffersRef.current);
      if (peakRef.current < 0.01) {
        setError('no-speech');
        return { text: null, error: 'no-speech' };
      }
      const audio = resampleLinear(raw, sampleRateRef.current, SAMPLE_RATE);
      const model = await ensureModel();
      const text = (await model.transcribe(audio)).trim();
      if (!text) {
        setError('no-speech');
        return { text: null, error: 'no-speech' };
      }
      setError(null);
      return { text, error: null };
    } catch (cause) {
      const message = String(cause);
      setError(message);
      return { text: null, error: message };
    } finally {
      setStatus('idle');
    }
  }, [ensureModel, isStreaming, status, stream]);

  const cancelRecording = useCallback(() => {
    if (isStreaming) stream.stop();
    buffersRef.current = [];
    peakRef.current = 0;
    setStatus('idle');
  }, [isStreaming, stream]);

  useEffect(() => () => {
    if (isStreaming) stream.stop();
  }, [isStreaming, stream]);

  const isBusy = status === 'loading-model' || status === 'transcribing' || status === 'downloading';

  return {
    status,
    isRecording: isStreaming || status === 'recording',
    isBusy,
    modelReady,
    error,
    clearError,
    downloadSpeechModel,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
