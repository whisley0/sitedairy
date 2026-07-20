import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { InfoCard } from '../components/CommonComponents';
import { PhotoGpsRow } from '../components/PhotoGpsRow';
import { PhotoTagsEditor } from '../components/PhotoTagsEditor';
import { PrimaryActionButton } from '../components/PrimaryActionButton';
import { RiskQueuePhoto } from '../components/RiskQueuePhoto';
import { SimilarPhotosStrip } from '../components/SimilarPhotosStrip';
import { vlmModelTitleKey } from '../components/VlmModelPicker';
import type { RiskQueueItem } from '../data/models';
import { isManualQueueItem, latestAssessmentRecord } from '../data/models';
import { useVlmModelState } from '../hooks/useVlmModelState';
import type { VlmModelId } from '../native/llm/modelManager';
import { riskAssessmentQueue } from '../services/riskAssessmentQueue';
import { formatQueueTime } from '../utils/riskQueueFormat';
import { resolvePhotoTags } from '../utils/photoTags';
import { colors } from '../theme/colors';
import { typographySimplified } from '../theme/typography';

const QUICK_CHECK_ID: VlmModelId = 'smolvlm2-2.2b';
const pct = (n: number) => `${Math.round(n * 100)}%`;

interface RiskAssessmentDetailScreenProps {
  itemId: string;
  onDeleted?: () => void;
  onOpenItem?: (itemId: string) => void;
}

export function RiskAssessmentDetailScreen({
  itemId,
  onDeleted,
  onOpenItem,
}: RiskAssessmentDetailScreenProps) {
  const { t } = useTranslation();
  const [item, setItem] = useState<RiskQueueItem | undefined>(() => riskAssessmentQueue.getItem(itemId));
  const [lang, setLang] = useState<'zh' | 'en'>('en');
  const {
    rows,
    selectModel,
    handleDownload,
    syncReadyFromDisk,
  } = useVlmModelState(QUICK_CHECK_ID);

  const quickCheckLabel = t(vlmModelTitleKey(QUICK_CHECK_ID));
  const quickCheckReady = rows[QUICK_CHECK_ID]?.ready ?? false;
  const quickCheckDownloading = rows[QUICK_CHECK_ID]?.downloading ?? false;
  const quickCheckProgress = rows[QUICK_CHECK_ID]?.progress ?? '';

  useFocusEffect(
    useCallback(() => {
      syncReadyFromDisk();
      selectModel(QUICK_CHECK_ID);
    }, [selectModel, syncReadyFromDisk]),
  );

  const refresh = useCallback(() => {
    setItem(riskAssessmentQueue.getItem(itemId));
  }, [itemId]);

  useEffect(() => riskAssessmentQueue.subscribe(refresh), [refresh]);

  const latestRun = useMemo(() => (item ? latestAssessmentRecord(item) : undefined), [item]);

  const tags = useMemo(() => {
    if (!item) return [];
    return resolvePhotoTags({
      tags: item.tags,
      inspectionType: item.inspectionType ?? latestRun?.inspectionType,
      domain: item.domain ?? latestRun?.domain,
      subject: item.subject ?? latestRun?.subject,
      labelHint: item.labelHint ?? latestRun?.labelHint,
    });
  }, [item, latestRun]);

  const handleTagsChange = (next: string[]) => {
    void riskAssessmentQueue.updateTags(itemId, next);
  };

  const handleReassess = async () => {
    if (!item) return;
    if (item.photoMissing) {
      Alert.alert(t('queue.photoUnavailableTitle'), t('riskDetail.photoUnavailableAlert'));
      return;
    }
    if (!quickCheckReady) {
      try {
        await handleDownload(QUICK_CHECK_ID);
      } catch {
        Alert.alert(t('riskDetail.downloadFailed'), t('riskDetail.downloadFailedBody'));
      }
      return;
    }
    const ok = await riskAssessmentQueue.reassess(item.id, {
      modelId: QUICK_CHECK_ID,
      modelName: quickCheckLabel,
    });
    if (!ok) {
      Alert.alert(
        t('riskDetail.cannotReassess'),
        item.photoMissing ? t('riskDetail.photoMissing') : t('riskDetail.alreadyProcessing'),
      );
    }
  };

  const handleStop = () => {
    if (!item) return;
    Alert.alert(t('escalation.stopAssessment'), t('escalation.stopAssessmentBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.stop'),
        style: 'destructive',
        onPress: () => riskAssessmentQueue.halt(item.id),
      },
    ]);
  };

  const confirmDelete = () => {
    if (!item) return;
    const stopping = item.status === 'pending' || item.status === 'processing';
    Alert.alert(
      stopping ? t('escalation.stopAndDelete') : t('escalation.removeFromQueue'),
      stopping ? t('escalation.stopDeleteBody') : t('escalation.deleteBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            if (stopping) {
              const ok = await riskAssessmentQueue.haltAndRemove(item.id);
              if (ok) onDeleted?.();
            } else {
              const result = await riskAssessmentQueue.remove(item.id);
              if (result === 'ok') onDeleted?.();
            }
          },
        },
      ],
    );
  };

  if (!item) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>{t('riskDetail.notFound')}</Text>
      </View>
    );
  }

  const isPending = item.status === 'pending' || item.status === 'processing';
  const isManual = isManualQueueItem(item);
  const canReassess = !isPending && !quickCheckDownloading && !item.photoMissing && !isManual;
  const canStop = isPending && !item.halted;
  const reassessLabel = quickCheckReady
    ? t('riskDetail.reassessWith', { model: quickCheckLabel })
    : quickCheckDownloading
      ? quickCheckProgress || t('vlmPicker.downloading')
      : t('riskDetail.downloadQuickCheck');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <RiskQueuePhoto uri={item.photoUri} missing={item.photoMissing} style={styles.photo} missingStyle={styles.photo} />

      <InfoCard title={t('riskDetail.photoMetaTitle')}>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
          <Text style={styles.metaText}>
            {t('riskDetail.takenAt', { time: formatQueueTime(item.createdAt) })}
          </Text>
        </View>
        <PhotoGpsRow gps={item.gps} />
        <PhotoTagsEditor tags={tags} onChange={handleTagsChange} editable={!isPending} />
      </InfoCard>

      {!item.photoMissing ? (
        <InfoCard title={t('similarPhotos.title')}>
          <SimilarPhotosStrip itemId={item.id} onOpenItem={onOpenItem} />
        </InfoCard>
      ) : null}

      {item.photoMissing ? (
        <InfoCard title={t('photo.unavailable')}>
          <Text style={styles.photoMissingText}>{t('riskDetail.photoUnavailableCard')}</Text>
        </InfoCard>
      ) : null}

      <InfoCard title={latestRun?.result?.risk ?? t('riskDetail.riskAssessment')}>
        {isPending ? (
          <View style={styles.pendingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.pendingText}>
              {item.status === 'processing'
                ? item.reassessRequestedAt
                  ? t('riskDetail.vlmRunningSimple')
                  : t('riskDetail.bothRunningSimple')
                : t('riskDetail.waitingQueue')}
            </Text>
          </View>
        ) : null}

        {item.halted && item.status === 'failed' ? (
          <Text style={styles.haltedText}>{item.error ?? t('riskDetail.halted')}</Text>
        ) : null}

        {isManual ? (
          <Text style={styles.rationale}>
            {item.userComment || latestRun?.result?.rationale_en || t('common.emDash')}
          </Text>
        ) : null}

        {latestRun?.result && !isManual ? (
          <>
            {latestRun.userComment ? (
              <Text style={styles.workerNote}>
                {t('riskDetail.workerNote')}: {latestRun.userComment}
              </Text>
            ) : null}
            <Text style={styles.confidence}>
              {t('riskDetail.confidence', { pct: pct(latestRun.result.confidence) })}
            </Text>
            <View style={styles.langRow}>
              {(['en', 'zh'] as const).map((l) => (
                <Pressable
                  key={l}
                  onPress={() => setLang(l)}
                  style={[styles.langChip, lang === l && styles.langChipActive]}
                >
                  <Text style={[styles.langChipText, lang === l && styles.langChipTextActive]}>
                    {l === 'zh' ? t('riskDetail.chinese') : t('riskDetail.english')}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.rationale}>
              {lang === 'zh'
                ? latestRun.result.rationale_zh || latestRun.result.rationale_en || t('common.emDash')
                : latestRun.result.rationale_en || latestRun.result.rationale_zh || t('common.emDash')}
            </Text>
          </>
        ) : null}

        {latestRun?.error ? <Text style={styles.error}>{latestRun.error}</Text> : null}

        {!isManual ? (
          <PrimaryActionButton
            label={reassessLabel}
            icon="refresh"
            onPress={() => void handleReassess()}
            disabled={!canReassess}
            loading={quickCheckDownloading}
            style={styles.reassessBtn}
          />
        ) : null}

        {canStop ? (
          <Pressable style={styles.stopBtn} onPress={handleStop}>
            <Ionicons name="stop-circle-outline" size={18} color="#E65100" />
            <Text style={styles.stopBtnText}>{t('riskDetail.stopAssessment')}</Text>
          </Pressable>
        ) : null}
      </InfoCard>

      <Pressable style={styles.deleteBtn} onPress={confirmDelete}>
        <Ionicons name="trash-outline" size={18} color={colors.error} />
        <Text style={styles.deleteBtnText}>
          {isPending ? t('riskDetail.stopDeleteQueue') : t('riskDetail.deleteQueue')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  photo: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  photoMissingText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  metaText: {
    flex: 1,
    color: colors.text,
    fontSize: typographySimplified.body,
    fontWeight: '600',
  },
  confidence: { marginTop: 4, fontSize: 16, fontWeight: '700', color: colors.primary },
  workerNote: {
    marginTop: 10,
    marginBottom: 6,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  pendingText: { color: colors.text, fontSize: 15 },
  haltedText: { marginTop: 8, color: '#E65100', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  reassessBtn: {
    marginTop: 18,
    minHeight: 72,
    paddingVertical: 22,
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E65100',
    backgroundColor: colors.surface,
  },
  stopBtnText: { color: '#E65100', fontWeight: '700', fontSize: 15 },
  langRow: { flexDirection: 'row', gap: 8, marginBottom: 10, marginTop: 8 },
  langChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  langChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langChipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  langChipTextActive: { color: '#fff' },
  rationale: { color: colors.text, fontSize: 16, lineHeight: 24 },
  error: { marginTop: 8, color: colors.error, fontSize: 14, lineHeight: 20 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.surface,
  },
  deleteBtnText: { color: colors.error, fontWeight: '700', fontSize: 15 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  missingText: { color: colors.textMuted, fontSize: 16 },
});
