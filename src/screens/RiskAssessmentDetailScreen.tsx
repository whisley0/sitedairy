import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { InfoCard } from '../components/CommonComponents';
import { RiskQueuePhoto } from '../components/RiskQueuePhoto';
import { PhotoGpsRow } from '../components/PhotoGpsRow';
import { VlmModelPicker, vlmModelTitleKey } from '../components/VlmModelPicker';
import type { RiskAssessmentRecord, RiskQueueItem } from '../data/models';
import { isManualQueueItem, latestAssessmentRecord } from '../data/models';
import { useVlmModelState } from '../hooks/useVlmModelState';
import { riskAssessmentQueue } from '../services/riskAssessmentQueue';
import { formatDuration, formatQueueTime } from '../utils/riskQueueFormat';
import { colors } from '../theme/colors';

const pct = (n: number) => `${Math.round(n * 100)}%`;

interface RiskAssessmentDetailScreenProps {
  itemId: string;
  onDeleted?: () => void;
}

export function RiskAssessmentDetailScreen({ itemId, onDeleted }: RiskAssessmentDetailScreenProps) {
  const { t } = useTranslation();
  const [item, setItem] = useState<RiskQueueItem | undefined>(() => riskAssessmentQueue.getItem(itemId));
  const [lang, setLang] = useState<'zh' | 'en'>('en');
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>(undefined);
  const [reassessComment, setReassessComment] = useState('');
  const {
    rows,
    selectedId,
    visibleModels,
    recommendedId,
    selectModel,
    handleDownload,
    syncReadyFromDisk,
    selectedReady,
    selectedDownloading,
  } = useVlmModelState(item && !isManualQueueItem(item) ? item.modelId : undefined);

  const selectedModelLabel =
    item && isManualQueueItem(item) ? item.modelName : t(vlmModelTitleKey(selectedId));

  useEffect(() => {
    const current = riskAssessmentQueue.getItem(itemId);
    const latest = current ? latestAssessmentRecord(current) : undefined;
    setReassessComment(latest?.userComment ?? '');
  }, [itemId]);

  const refresh = useCallback(() => {
    setItem(riskAssessmentQueue.getItem(itemId));
  }, [itemId]);

  useEffect(() => riskAssessmentQueue.subscribe(refresh), [refresh]);

  const history = useMemo(
    () => [...(item?.assessmentHistory ?? [])].reverse(),
    [item?.assessmentHistory],
  );

  const selectedRun = useMemo(() => {
    if (!history.length) return undefined;
    if (selectedRunId) {
      return history.find((run) => run.id === selectedRunId) ?? history[0];
    }
    return history[0];
  }, [history, selectedRunId]);

  useEffect(() => {
    if (!item) return;
    const latest = latestAssessmentRecord(item);
    if (latest && !selectedRunId) {
      setSelectedRunId(latest.id);
    }
  }, [item, selectedRunId]);

  useFocusEffect(
    useCallback(() => {
      syncReadyFromDisk();
    }, [syncReadyFromDisk]),
  );

  useEffect(() => {
    const current = riskAssessmentQueue.getItem(itemId);
    if (current?.modelId && !isManualQueueItem(current)) {
      selectModel(current.modelId as typeof selectedId);
    }
  }, [itemId, selectModel]);

  const handleReassess = async () => {
    if (!item || !selectedReady) return;
    if (item.photoMissing) {
      Alert.alert(t('queue.photoUnavailableTitle'), t('riskDetail.photoUnavailableAlert'));
      return;
    }
    const ok = await riskAssessmentQueue.reassess(item.id, {
      modelId: selectedId,
      modelName: selectedModelLabel,
      userComment: reassessComment.trim() || undefined,
    });
    if (!ok) {
      Alert.alert(
        t('riskDetail.cannotReassess'),
        item.photoMissing ? t('riskDetail.photoMissing') : t('riskDetail.alreadyProcessing'),
      );
    }
  };

  const onDownloadModel = async (id: typeof selectedId) => {
    try {
      await handleDownload(id);
    } catch {
      Alert.alert(t('riskDetail.downloadFailed'), t('riskDetail.downloadFailedBody'));
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
  const canReassess =
    !isPending && selectedReady && !selectedDownloading && !item.photoMissing && !isManual;
  const canStop = isPending && !item.halted;
  const displayModelName = selectedRun?.modelName ?? item.modelName;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <RiskQueuePhoto uri={item.photoUri} missing={item.photoMissing} style={styles.photo} missingStyle={styles.photo} />
      <PhotoGpsRow gps={item.gps} />

      {item.photoMissing ? (
        <InfoCard title={t('photo.unavailable')}>
          <Text style={styles.photoMissingText}>{t('riskDetail.photoUnavailableCard')}</Text>
        </InfoCard>
      ) : null}

      <InfoCard
        title={selectedRun?.result?.risk ?? t('riskDetail.riskAssessment')}
        subtitle={t('riskDetail.queuedMeta', {
          model: displayModelName,
          time: formatQueueTime(item.createdAt),
        })}
      >
        {isPending ? (
          <View style={styles.pendingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.pendingText}>
              {item.status === 'processing' && item.processingStartedAt
                ? item.reassessRequestedAt
                  ? t('riskDetail.vlmRunning', { time: formatQueueTime(item.processingStartedAt) })
                  : t('riskDetail.bothRunning', { time: formatQueueTime(item.processingStartedAt) })
                : t('riskDetail.waitingQueue')}
            </Text>
          </View>
        ) : null}

        {item.halted && item.status === 'failed' ? (
          <Text style={styles.haltedText}>{item.error ?? t('riskDetail.halted')}</Text>
        ) : null}

        {selectedRun ? (
          <Text style={styles.timing}>
            {t('riskDetail.timing', {
              model: selectedRun.modelName,
              duration: formatDuration(selectedRun.durationMs),
              time: formatQueueTime(selectedRun.completedAt),
            })}
          </Text>
        ) : null}

        {!isManual ? (
          <>
            <Text style={styles.sectionLabel}>
              {item.photoMissing ? t('riskDetail.modelPickerMissing') : t('riskDetail.modelForNext')}
            </Text>
            <VlmModelPicker
              models={visibleModels}
              state={rows}
              selectedId={selectedId}
              disabled={isPending || item.photoMissing}
              showHeader
              recommendedId={recommendedId}
              onSelect={selectModel}
              onDownload={onDownloadModel}
            />

            <Text style={styles.sectionLabel}>{t('riskDetail.reassessCommentLabel')}</Text>
            <TextInput
              style={styles.commentInput}
              value={reassessComment}
              onChangeText={setReassessComment}
              placeholder={t('riskDetail.reassessCommentPlaceholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              editable={!isPending && !item.photoMissing}
            />
            <Text style={styles.commentHint}>{t('riskDetail.reassessCommentHint')}</Text>

            <Pressable
              style={[styles.reassessBtn, !canReassess && styles.reassessBtnDisabled]}
              disabled={!canReassess}
              onPress={handleReassess}
            >
              <Ionicons name="refresh" size={18} color={canReassess ? '#fff' : colors.textMuted} />
              <Text style={[styles.reassessBtnText, !canReassess && styles.reassessBtnTextDisabled]}>
                {t('riskDetail.reassessWith', { model: selectedModelLabel })}
              </Text>
            </Pressable>
          </>
        ) : null}

        {canStop ? (
          <Pressable style={styles.stopBtn} onPress={handleStop}>
            <Ionicons name="stop-circle-outline" size={18} color="#E65100" />
            <Text style={styles.stopBtnText}>{t('riskDetail.stopAssessment')}</Text>
          </Pressable>
        ) : null}
      </InfoCard>

      {isManual ? (
        <InfoCard title={t('riskDetail.manualEntryTitle')} subtitle={t('riskDetail.manualEntrySubtitle')}>
          <Text style={styles.rationale}>
            {item.userComment || selectedRun?.result?.rationale_en || t('common.emDash')}
          </Text>
        </InfoCard>
      ) : (
        <InfoCard title={t('riskDetail.classifierTitle')}>
          <Text style={styles.field}>
            {t('riskDetail.domain')}{' '}
            <Text style={styles.value}>{selectedRun?.domain ?? item.domain ?? t('common.emDash')}</Text>
          </Text>
          <Text style={styles.field}>
            {t('riskDetail.subject')}{' '}
            <Text style={styles.value}>{selectedRun?.subject ?? item.subject ?? t('common.emDash')}</Text>
          </Text>
          <Text style={styles.field}>
            {t('riskDetail.labelHint')}{' '}
            <Text style={styles.value}>{selectedRun?.labelHint ?? item.labelHint ?? t('common.emDash')}</Text>
          </Text>
        </InfoCard>
      )}

      {selectedRun?.result && !isManual ? (
        <InfoCard title={t('riskDetail.assessment')}>
          {selectedRun.userComment ? (
            <Text style={styles.workerNote}>
              {t('riskDetail.workerNote')}: {selectedRun.userComment}
            </Text>
          ) : null}
          <Text style={styles.confidence}>
            {t('riskDetail.confidence', { pct: pct(selectedRun.result.confidence) })}
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
              ? selectedRun.result.rationale_zh || selectedRun.result.rationale_en || t('common.emDash')
              : selectedRun.result.rationale_en || selectedRun.result.rationale_zh || t('common.emDash')}
          </Text>
          {selectedRun.result.rawVlmOutput ? (
            <Text style={styles.rawOutput} selectable>
              {t('riskDetail.modelOutput')} {selectedRun.result.rawVlmOutput.slice(0, 600)}
              {selectedRun.result.rawVlmOutput.length > 600 ? '…' : ''}
            </Text>
          ) : null}
        </InfoCard>
      ) : null}

      {selectedRun?.error ? (
        <InfoCard title={t('riskDetail.error')}>
          <Text style={styles.error}>{selectedRun.error}</Text>
        </InfoCard>
      ) : null}

      {history.length > 0 ? (
        <InfoCard title={t('riskDetail.history', { count: history.length })} subtitle={t('riskDetail.historySubtitle')}>
          {history.map((run, index) => (
            <HistoryRow
              key={run.id}
              run={run}
              runNumber={history.length - index}
              selected={selectedRun?.id === run.id}
              onSelect={() => setSelectedRunId(run.id)}
            />
          ))}
        </InfoCard>
      ) : null}

      <Pressable style={styles.deleteBtn} onPress={confirmDelete}>
        <Ionicons name="trash-outline" size={18} color={colors.error} />
        <Text style={styles.deleteBtnText}>
          {isPending ? t('riskDetail.stopDeleteQueue') : t('riskDetail.deleteQueue')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function HistoryRow({
  run,
  runNumber,
  selected,
  onSelect,
}: {
  run: RiskAssessmentRecord;
  runNumber: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const title = run.result?.risk ?? (run.error ? t('riskDetail.failedRun') : t('riskDetail.run'));

  return (
    <Pressable
      style={[styles.historyRow, selected && styles.historyRowSelected]}
      onPress={onSelect}
    >
      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>{t('riskDetail.runNumber', { n: runNumber, title })}</Text>
        <Text style={styles.historyMeta}>
          {run.modelName} · {formatDuration(run.durationMs)} · {formatQueueTime(run.completedAt)}
        </Text>
      </View>
      {run.result ? (
        <Text style={styles.historyPreview} numberOfLines={2}>
          {run.result.rationale_en || run.result.rationale_zh}
        </Text>
      ) : null}
      {run.error ? <Text style={styles.historyError}>{run.error}</Text> : null}
    </Pressable>
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
    marginBottom: 12,
  },
  photoMissingText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  timing: { marginTop: 6, fontSize: 14, fontWeight: '600', color: colors.primary },
  sectionLabel: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  commentInput: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  commentHint: { marginTop: 6, marginBottom: 4, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  workerNote: {
    marginBottom: 10,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  confidence: { marginTop: 4, fontSize: 16, fontWeight: '700', color: colors.primary },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  pendingText: { color: colors.text, fontSize: 15 },
  haltedText: { marginTop: 8, color: '#E65100', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  reassessBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
  },
  reassessBtnDisabled: { backgroundColor: colors.border },
  reassessBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  reassessBtnTextDisabled: { color: colors.textMuted },
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
  field: { color: colors.textMuted, fontSize: 14, marginTop: 6 },
  value: { color: colors.text, fontWeight: '600' },
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
  rawOutput: {
    marginTop: 12,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
    fontFamily: 'monospace',
  },
  error: { color: colors.error, fontSize: 14, lineHeight: 20 },
  historyRow: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  historyRowSelected: {
    borderColor: colors.primary,
    backgroundColor: '#E3F2FD',
  },
  historyHeader: { gap: 2 },
  historyTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  historyMeta: { fontSize: 12, color: colors.textMuted },
  historyPreview: { marginTop: 6, fontSize: 13, color: colors.text, lineHeight: 18 },
  historyError: { marginTop: 6, fontSize: 12, color: colors.error },
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
