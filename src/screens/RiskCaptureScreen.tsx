import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SectionHeader, InfoCard } from '../components/CommonComponents';
import { VlmModelPicker, type ModelRowState } from '../components/VlmModelPicker';
import { colors } from '../theme/colors';
import { Classifier, type ClassifierOutput, type HeadName } from '../native/cdv/classifier';
import { LocalVLM, type RiskAssessment } from '../native/llm/localLLM';
import {
  VLM_MODELS,
  downloadModel,
  getModelSpec,
  isModelDownloaded,
  type VlmModelId,
} from '../native/llm/modelManager';

type Status = 'idle' | 'loading-model' | 'classifying' | 'assessing';

interface Signals {
  domain: string;
  subject: string;
  labelHint: string;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const topLabel = (out: ClassifierOutput, head: HeadName) => out[head][0];

function initialRows(): Record<VlmModelId, ModelRowState> {
  const entries = VLM_MODELS.map(
    (m) => [m.id, { ready: isModelDownloaded(m.id), downloading: false, progress: '' }] as const,
  );
  return Object.fromEntries(entries) as Record<VlmModelId, ModelRowState>;
}

export function RiskCaptureScreen() {
  const [rows, setRows] = useState<Record<VlmModelId, ModelRowState>>(initialRows);
  const [selectedId, setSelectedId] = useState<VlmModelId>(
    () => (VLM_MODELS.find((m) => isModelDownloaded(m.id)) ?? VLM_MODELS[0]).id,
  );
  const [status, setStatus] = useState<Status>('idle');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [signals, setSignals] = useState<Signals | null>(null);
  const [assessments, setAssessments] = useState<Partial<Record<VlmModelId, RiskAssessment>>>({});
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [error, setError] = useState<string | null>(null);

  const classifierRef = useRef<Classifier | null>(null);
  const vlmRef = useRef<LocalVLM | null>(null);

  const anyDownloading = Object.values(rows).some((r) => r.downloading);
  const busy = status !== 'idle' || anyDownloading;

  const setRow = (id: VlmModelId, patch: Partial<ModelRowState>) =>
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const handleDownload = async (id: VlmModelId) => {
    setError(null);
    setRow(id, { downloading: true, progress: 'Starting…' });
    try {
      await downloadModel(id, (info) => {
        const frac = info.fileFraction >= 0 ? ` ${pct(info.fileFraction)}` : '';
        setRow(id, { progress: `File ${info.index}/${info.total}${frac}` });
      });
      setRow(id, { ready: true, downloading: false, progress: '' });
      setSelectedId(id);
    } catch (e) {
      setRow(id, { downloading: false, progress: '' });
      setError(`Download failed: ${String(e)}`);
    }
  };

  // One VLM stays resident at a time; switching models releases the previous one.
  const ensureVlm = async (id: VlmModelId): Promise<LocalVLM> => {
    if (vlmRef.current?.modelId === id) return vlmRef.current;
    if (vlmRef.current) {
      await vlmRef.current.release();
      vlmRef.current = null;
    }
    setStatus('loading-model');
    vlmRef.current = await LocalVLM.create(id);
    return vlmRef.current;
  };

  const runAssess = async (id: VlmModelId, sig: Signals, uri: string) => {
    const vlm = await ensureVlm(id);
    setStatus('assessing');
    const risk = await vlm.assess({ ...sig, imageUri: uri });
    setAssessments((prev) => ({ ...prev, [id]: risk }));
  };

  const capture = async () => {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow camera access to capture a site photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;

    const uri = result.assets[0].uri;
    setPhotoUri(uri);
    setSignals(null);
    setAssessments({});

    try {
      if (!classifierRef.current) {
        setStatus('loading-model');
        classifierRef.current = await Classifier.create();
      }
      setStatus('classifying');
      const out = await classifierRef.current.classify(uri);
      const next: Signals = {
        domain: topLabel(out, 'domain').label,
        subject: topLabel(out, 'subject').label,
        labelHint: topLabel(out, 'label_hint').label,
      };
      setSignals(next);
      if (rows[selectedId].ready) await runAssess(selectedId, next, uri);
    } catch (e) {
      setError(`Analysis failed: ${String(e)}`);
    } finally {
      setStatus('idle');
    }
  };

  const assessSelected = async () => {
    if (!signals || !photoUri) return;
    setError(null);
    try {
      await runAssess(selectedId, signals, photoUri);
    } catch (e) {
      setError(`Assessment failed: ${String(e)}`);
    } finally {
      setStatus('idle');
    }
  };

  const statusLabel =
    status === 'loading-model' ? 'Loading model…'
    : status === 'classifying' ? 'Classifying photo…'
    : status === 'assessing' ? 'Assessing risk…' : '';

  const selectedReady = rows[selectedId].ready;
  const anyReady = VLM_MODELS.some((m) => rows[m.id].ready);
  const resultModels = VLM_MODELS.filter((m) => assessments[m.id]);

  return (
    <View style={styles.container}>
      <SectionHeader title="Risk capture" description="On-device photo risk assessment (classifier + vision LLM)" />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sectionLabel}>Vision-language model</Text>
        <VlmModelPicker
          models={VLM_MODELS}
          state={rows}
          selectedId={selectedId}
          disabled={busy}
          onSelect={setSelectedId}
          onDownload={handleDownload}
        />

        <Pressable style={[styles.captureBtn, busy && styles.btnDisabled]} disabled={busy} onPress={capture}>
          <Ionicons name="camera" size={26} color="#fff" />
          <Text style={styles.captureBtnText}>Capture photo</Text>
        </Pressable>
        {!anyReady ? (
          <Text style={styles.hint}>Download a model above to enable risk assessment. Capturing still runs the classifier.</Text>
        ) : null}

        {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" /> : null}
        {busy && statusLabel ? (
          <View style={styles.statusRow}><ActivityIndicator color={colors.primary} /><Text style={styles.statusText}>{statusLabel}</Text></View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {signals ? (
          <InfoCard title="Classifier signals">
            <Text style={styles.signal}>Domain: <Text style={styles.signalVal}>{signals.domain}</Text></Text>
            <Text style={styles.signal}>Subject: <Text style={styles.signalVal}>{signals.subject}</Text></Text>
            <Text style={styles.signal}>Label hint: <Text style={styles.signalVal}>{signals.labelHint}</Text></Text>
          </InfoCard>
        ) : null}

        {signals && selectedReady ? (
          <Pressable style={[styles.assessBtn, busy && styles.btnDisabled]} disabled={busy} onPress={assessSelected}>
            <Ionicons name="sparkles" size={18} color="#fff" />
            <Text style={styles.assessBtnText}>
              {assessments[selectedId] ? 'Re-assess' : 'Assess'} with {getModelSpec(selectedId).name}
            </Text>
          </Pressable>
        ) : null}

        {resultModels.length > 0 ? (
          <View style={styles.langRow}>
            {(['zh', 'en'] as const).map((l) => (
              <Pressable key={l} onPress={() => setLang(l)} style={[styles.langChip, lang === l && styles.langChipActive]}>
                <Text style={[styles.langChipText, lang === l && styles.langChipTextActive]}>{l === 'zh' ? '中文' : 'English'}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {resultModels.map((m) => {
          const a = assessments[m.id]!;
          return (
            <InfoCard key={m.id} title={a.risk} subtitle={`${m.name} · confidence ${pct(a.confidence)}`}>
              <Text style={styles.rationale}>{lang === 'zh' ? a.rationale_zh : a.rationale_en}</Text>
            </InfoCard>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  body: { padding: 16, paddingBottom: 48 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 8 },
  btnDisabled: { opacity: 0.6 },
  hint: { marginTop: 8, color: colors.textMuted, fontSize: 13 },
  captureBtn: {
    flexDirection: 'row', gap: 10, marginTop: 16, backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center', elevation: 2,
  },
  captureBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  assessBtn: {
    flexDirection: 'row', gap: 8, marginTop: 12, backgroundColor: colors.primary, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center',
  },
  assessBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  photo: {
    width: '100%', height: 220, borderRadius: 12, marginTop: 16,
    backgroundColor: colors.border,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  statusText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  error: { color: colors.error, fontSize: 13, marginTop: 12 },
  signal: { color: colors.text, fontSize: 14, marginTop: 4 },
  signalVal: { fontWeight: '700', color: colors.primary },
  langRow: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 8 },
  langChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  langChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langChipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  langChipTextActive: { color: '#fff' },
  rationale: { color: colors.text, fontSize: 15, lineHeight: 22, marginTop: 4 },
});
