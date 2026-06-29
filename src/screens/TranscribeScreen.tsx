import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioStream,
  type AudioStreamBuffer,
} from 'expo-audio';
import { SectionHeader, InfoCard } from '../components/CommonComponents';
import { colors } from '../theme/colors';
import { Nemotron } from '../native/asr/nemotron';
import { resampleLinear, SAMPLE_RATE } from '../native/asr/melSpectrogram';
import {
  downloadModel,
  isModelDownloaded,
  modelPaths,
  readTokenizerBytes,
} from '../native/asr/modelManager';

type Status = 'idle' | 'loading-model' | 'recording' | 'transcribing';

function concat(chunks: Float32Array[]): Float32Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Float32Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

export function TranscribeScreen() {
  const [modelReady, setModelReady] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [heard, setHeard] = useState<string | null>(null);

  const modelRef = useRef<Nemotron | null>(null);
  const buffersRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef<number>(SAMPLE_RATE);
  const peakRef = useRef(0);
  const levelAnim = useRef(new Animated.Value(0)).current;

  const { stream, isStreaming } = useAudioStream({
    sampleRate: SAMPLE_RATE,
    channels: 1,
    encoding: 'float32',
    onBuffer: (buf: AudioStreamBuffer) => {
      sampleRateRef.current = buf.sampleRate;
      const f = new Float32Array(buf.data.slice(0));
      buffersRef.current.push(f);
      // Live input level: drives the "I can hear you" meter and doubles as a
      // capture sanity check (peak stays ~0 if the mic delivers only silence).
      let sum = 0;
      let peak = 0;
      for (let i = 0; i < f.length; i++) {
        const a = Math.abs(f[i]);
        if (a > peak) peak = a;
        sum += f[i] * f[i];
      }
      const rms = f.length ? Math.sqrt(sum / f.length) : 0;
      if (peak > peakRef.current) peakRef.current = peak;
      levelAnim.setValue(Math.min(1, Math.max(rms * 6, peak)));
    },
  });

  useEffect(() => { setModelReady(isModelDownloaded()); }, []);

  const handleDownload = async () => {
    setDownloading(true); setError(null);
    try {
      await downloadModel((info) => {
        const pct = info.fileFraction >= 0 ? ` ${Math.round(info.fileFraction * 100)}%` : '';
        setProgress(`${info.file} (${info.index}/${info.total})${pct}`);
      });
      setModelReady(true);
    } catch (e) { setError(`Download failed: ${String(e)}`); }
    setDownloading(false);
  };

  const ensureModel = async (): Promise<Nemotron> => {
    if (modelRef.current) return modelRef.current;
    setStatus('loading-model');
    const { encoderPath, decoderPath } = modelPaths();
    const tokenizer = await readTokenizerBytes();
    // 'auto' lets the model's language-ID prompt distinguish Chinese from English
    // acoustically; a vocabulary mask in Nemotron then restricts the decoded output
    // to Chinese (Mandarin + Cantonese) and English only.
    modelRef.current = await Nemotron.create(encoderPath, decoderPath, tokenizer, 'auto');
    return modelRef.current;
  };

  const startRecording = async () => {
    setError(null);
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) { setError('Microphone permission denied.'); return; }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    buffersRef.current = [];
    sampleRateRef.current = SAMPLE_RATE;
    peakRef.current = 0;
    levelAnim.setValue(0);
    setHeard(null);
    await stream.start();
    setStatus('recording');
  };

  const stopRecording = async () => {
    stream.stop();
    levelAnim.setValue(0);
    setStatus('transcribing');
    try {
      const raw = concat(buffersRef.current);
      const seconds = raw.length / (sampleRateRef.current || SAMPLE_RATE);
      setHeard(`Captured ${seconds.toFixed(1)}s · peak ${Math.round(peakRef.current * 100)}%`);
      if (peakRef.current < 0.01) {
        setError('No audio detected from the mic. Check the microphone permission and that nothing else is using it.');
        setStatus('idle');
        return;
      }
      const audio = resampleLinear(raw, sampleRateRef.current, SAMPLE_RATE);
      const model = await ensureModel();
      const text = (await model.transcribe(audio)).trim();
      if (text) {
        setTranscript((prev) => (prev ? `${prev} ${text}` : text).trim());
      } else {
        setError('Audio was captured, but no speech was recognized.');
      }
    } catch (e) { setError(`Transcription failed: ${String(e)}`); }
    setStatus('idle');
  };

  const busy = status === 'loading-model' || status === 'transcribing' || downloading;
  const statusLabel =
    status === 'loading-model' ? 'Loading model…'
    : status === 'transcribing' ? 'Transcribing…'
    : isStreaming ? 'Listening…' : 'Ready';

  return (
    <View style={styles.container}>
      <SectionHeader title="Transcribe" description="On-device speech-to-text (Nemotron 3.5 ASR)" />
      <ScrollView contentContainerStyle={styles.body}>
        {!modelReady ? (
          <InfoCard title="Model not installed" subtitle="Download the ~0.6B ONNX model to your device (one time).">
            <Pressable style={[styles.primaryBtn, downloading && styles.btnDisabled]} disabled={downloading} onPress={handleDownload}>
              {downloading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Download model</Text>}
            </Pressable>
            {downloading ? <Text style={styles.progress}>{progress}</Text> : null}
          </InfoCard>
        ) : (
          <View style={styles.recordRow}>
            <View style={styles.micWrap}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.pulseRing,
                  {
                    opacity: levelAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] }),
                    transform: [{ scale: levelAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
                  },
                ]}
              />
              <Pressable
                style={[styles.recordBtn, isStreaming && styles.recordBtnActive, busy && styles.btnDisabled]}
                disabled={busy}
                onPress={isStreaming ? stopRecording : startRecording}
              >
                <Ionicons name={isStreaming ? 'stop' : 'mic'} size={36} color="#fff" />
              </Pressable>
            </View>
            <Text style={styles.statusText}>{statusLabel}</Text>
            {isStreaming ? (
              <View style={styles.meterTrack}>
                <Animated.View
                  style={[
                    styles.meterFill,
                    { width: levelAnim.interpolate({ inputRange: [0, 1], outputRange: ['2%', '100%'] }) },
                  ]}
                />
              </View>
            ) : null}
            {heard && !isStreaming ? <Text style={styles.heard}>{heard}</Text> : null}
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.transcriptLabel}>Transcript</Text>
        <View style={styles.transcriptBox}>
          <Text style={styles.transcript}>{transcript || 'Your transcribed speech will appear here.'}</Text>
        </View>
        {transcript ? (
          <Pressable onPress={() => setTranscript('')}><Text style={styles.clear}>Clear</Text></Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: 16, paddingBottom: 48 },
  primaryBtn: {
    marginTop: 12, backgroundColor: colors.primary, borderRadius: 8,
    paddingVertical: 12, alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  progress: { marginTop: 8, color: colors.textMuted, fontSize: 13 },
  recordRow: { alignItems: 'center', paddingVertical: 24 },
  micWrap: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  pulseRing: {
    position: 'absolute', width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.error,
  },
  recordBtn: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', elevation: 3,
  },
  recordBtnActive: { backgroundColor: colors.error },
  meterTrack: {
    width: '80%', height: 8, borderRadius: 4, marginTop: 14,
    backgroundColor: colors.border, overflow: 'hidden',
  },
  meterFill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
  heard: { marginTop: 10, color: colors.textMuted, fontSize: 12 },
  statusText: { marginTop: 12, color: colors.text, fontSize: 15, fontWeight: '600' },
  error: { color: colors.error, fontSize: 13, marginTop: 8 },
  transcriptLabel: { marginTop: 16, marginBottom: 6, color: colors.textMuted, fontWeight: '600' },
  transcriptBox: {
    minHeight: 120, backgroundColor: colors.surface, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border, padding: 12,
  },
  transcript: { color: colors.text, fontSize: 15, lineHeight: 22 },
  clear: { color: colors.primary, fontWeight: '600', marginTop: 10, alignSelf: 'flex-end' },
});
