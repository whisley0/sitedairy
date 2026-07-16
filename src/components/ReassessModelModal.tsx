import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { RiskQueueItem } from '../data/models';
import { latestAssessmentRecord } from '../data/models';
import { useVlmModelState } from '../hooks/useVlmModelState';
import { riskAssessmentQueue } from '../services/riskAssessmentQueue';
import { colors } from '../theme/colors';
import { VlmModelPicker, vlmModelTitleKey } from './VlmModelPicker';

interface ReassessModelModalProps {
  visible: boolean;
  item: RiskQueueItem | null;
  onClose: () => void;
}

export function ReassessModelModal({ visible, item, onClose }: ReassessModelModalProps) {
  const { t } = useTranslation();
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
  } = useVlmModelState(item?.modelId);
  const [submitting, setSubmitting] = useState(false);
  const [reassessComment, setReassessComment] = useState('');

  const selectedModelLabel = t(vlmModelTitleKey(selectedId));

  useEffect(() => {
    if (visible && item) {
      const latest = latestAssessmentRecord(item);
      setReassessComment(latest?.userComment ?? '');
    }
  }, [visible, item?.id]);

  useEffect(() => {
    if (visible) {
      syncReadyFromDisk();
    }
  }, [visible, syncReadyFromDisk]);

  useEffect(() => {
    if (visible && item?.modelId) {
      selectModel(item.modelId as typeof selectedId);
    }
  }, [visible, item?.id, item?.modelId, selectModel]);

  const onDownload = async (id: typeof selectedId) => {
    try {
      await handleDownload(id);
    } catch {
      Alert.alert(t('riskDetail.downloadFailed'), t('riskDetail.downloadFailedBody'));
    }
  };

  const onConfirm = async () => {
    if (!item || !selectedReady || submitting) return;
    setSubmitting(true);
    try {
      const ok = await riskAssessmentQueue.reassess(item.id, {
        modelId: selectedId,
        modelName: selectedModelLabel,
        userComment: reassessComment.trim() || undefined,
      });
      if (!ok) {
        Alert.alert(
          t('reassessModal.cannotReassess'),
          item.photoMissing ? t('reassessModal.photoMissing') : t('reassessModal.inQueue'),
        );
        return;
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const busy = selectedDownloading || submitting;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('reassessModal.title')}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel={t('reassessModal.closeA11y')}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.subtitle}>{t('reassessModal.subtitle')}</Text>
          <ScrollView style={styles.pickerScroll} keyboardShouldPersistTaps="handled">
            <VlmModelPicker
              models={visibleModels}
              state={rows}
              selectedId={selectedId}
              disabled={submitting}
              showHeader
              recommendedId={recommendedId}
              onSelect={selectModel}
              onDownload={onDownload}
            />
            <Text style={styles.commentLabel}>{t('reassessModal.commentLabel')}</Text>
            <TextInput
              style={styles.commentInput}
              value={reassessComment}
              onChangeText={setReassessComment}
              placeholder={t('reassessModal.commentPlaceholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              editable={!submitting}
            />
          </ScrollView>
          <Pressable
            style={[
              styles.confirmBtn,
              (!selectedReady || busy || item?.photoMissing) && styles.confirmBtnDisabled,
            ]}
            disabled={!selectedReady || busy || item?.photoMissing}
            onPress={onConfirm}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={styles.confirmText}>
                  {t('reassessModal.confirm', { model: selectedModelLabel })}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: 12 },
  pickerScroll: { maxHeight: 480 },
  commentLabel: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  commentInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
