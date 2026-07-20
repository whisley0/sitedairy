import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { CardDateEmphasis, useCardMetaStyles } from './CardDateEmphasis';
import { EscalationCard } from './EscalationCard';
import { EscalationComposePanel } from './EscalationComposePanel';
import { EscalationDetailModal } from './EscalationDetailModal';
import { HapticPressable } from './HapticPressable';
import type { SiteDiaryRepository } from '../data/repositories';
import type { EmergencyEscalation, SiteTask } from '../data/models';
import { localizeEscalations } from '../i18n/localize';
import { useFieldInsets } from '../hooks/useFieldInsets';
import { colors } from '../theme/colors';
import { typographySimplified } from '../theme/typography';

interface EscalationModalProps {
  visible: boolean;
  onClose: () => void;
  diaryRepository: SiteDiaryRepository;
  linkedTask?: SiteTask | null;
  onSubmitted?: () => void;
}

export function EscalationModal(props: EscalationModalProps) {
  return <EscalationModalSimplified {...props} />;
}

function EscalationModalSimplified({
  visible,
  onClose,
  diaryRepository,
  linkedTask,
  onSubmitted,
}: EscalationModalProps) {
  const cardMetaStyles = useCardMetaStyles();
  const { t, i18n } = useTranslation();
  const field = useFieldInsets();
  const [loading, setLoading] = useState(true);
  const [rawEscalations, setRawEscalations] = useState<EmergencyEscalation[]>([]);
  const [detailEscalation, setDetailEscalation] = useState<EmergencyEscalation | null>(null);
  const [busyEscalationId, setBusyEscalationId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'close' | 'reopen' | null>(null);
  const [peekHeight, setPeekHeight] = useState(72);

  const escalations = useMemo(
    () => localizeEscalations(rawEscalations, t),
    [rawEscalations, t, i18n.language],
  );

  const sortedEscalations = useMemo(() => {
    const open = escalations.filter((item) => item.status !== 'RESOLVED');
    const closed = escalations.filter((item) => item.status === 'RESOLVED');
    return [...open, ...closed];
  }, [escalations]);

  const reload = useCallback(async () => {
    setLoading(true);
    setRawEscalations(await diaryRepository.getEscalations());
    setLoading(false);
  }, [diaryRepository]);

  useEffect(() => {
    if (!visible) return;
    void reload();
    setDetailEscalation(null);
  }, [visible, linkedTask?.id, reload]);

  const handleClose = () => {
    onClose();
  };

  const handleSubmitted = async () => {
    await reload();
    onSubmitted?.();
  };

  const handleCloseEscalation = async (escalationId: string) => {
    setBusyEscalationId(escalationId);
    setBusyAction('close');
    try {
      await diaryRepository.resolveEscalation(escalationId);
      await handleSubmitted();
    } finally {
      setBusyEscalationId(null);
      setBusyAction(null);
    }
  };

  const handleReopenEscalation = async (escalationId: string) => {
    setBusyEscalationId(escalationId);
    setBusyAction('reopen');
    try {
      await diaryRepository.reopenEscalation(escalationId);
      await handleSubmitted();
    } finally {
      setBusyEscalationId(null);
      setBusyAction(null);
    }
  };

  const listHeader = linkedTask ? (
    <View style={styles.linkedTaskBanner}>
      <Text style={styles.linkedTaskLabel}>{t('escalation.relatedTask')}</Text>
      <Text style={styles.linkedTaskTitle}>{linkedTask.title}</Text>
      <View style={[cardMetaStyles.row, styles.linkedTaskMetaRow]}>
        <CardDateEmphasis date={linkedTask.dueDate} label={t('common.dueOn')} />
      </View>
    </View>
  ) : null;

  const renderItem = ({ item }: { item: EmergencyEscalation }) => (
    <View style={styles.listItem}>
      <EscalationCard
        escalation={item}
        onPress={() => setDetailEscalation(item)}
        onResolvePress={() => void handleCloseEscalation(item.id)}
        onReopenPress={() => void handleReopenEscalation(item.id)}
        resolving={busyEscalationId === item.id && busyAction === 'close'}
        reopening={busyEscalationId === item.id && busyAction === 'reopen'}
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={[
          styles.container,
          { paddingTop: field.top, paddingLeft: field.left, paddingRight: field.right },
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.header}>
          <HapticPressable onPress={handleClose} hitSlop={12}>
            <Text style={styles.closeText}>{t('common.close')}</Text>
          </HapticPressable>
          <Text style={styles.headerTitle}>
            {linkedTask ? t('escalation.taskEscalation') : t('escalation.emergencyEscalation')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <FlatList
            style={styles.list}
            data={sortedEscalations}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
            contentContainerStyle={[
              styles.listContent,
              sortedEscalations.length === 0 && !linkedTask && styles.listContentEmpty,
              { paddingBottom: peekHeight + 12 },
            ]}
            ListEmptyComponent={
              !linkedTask ? <Text style={styles.emptyText}>{t('escalation.listEmpty')}</Text> : null
            }
            keyboardShouldPersistTaps="handled"
          />
        )}

        <EscalationComposePanel
          disabled={loading}
          linkedTask={linkedTask}
          diaryRepository={diaryRepository}
          onSubmitted={() => void handleSubmitted()}
          onPeekHeightChange={setPeekHeight}
        />
      </KeyboardAvoidingView>

      <EscalationDetailModal
        visible={detailEscalation !== null}
        escalation={detailEscalation}
        onClose={() => setDetailEscalation(null)}
        onResolve={async (escalationId) => {
          await diaryRepository.resolveEscalation(escalationId);
          await handleSubmitted();
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: typographySimplified.lg,
    fontWeight: '600',
    color: colors.text,
  },
  headerSpacer: {
    width: 48,
  },
  closeText: {
    color: colors.primary,
    fontSize: typographySimplified.body,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  linkedTaskBanner: {
    backgroundColor: '#FFEBEE',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    padding: 14,
    marginBottom: 12,
  },
  linkedTaskLabel: {
    fontSize: typographySimplified.xs,
    fontWeight: '700',
    color: colors.error,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  linkedTaskTitle: {
    marginTop: 4,
    fontSize: typographySimplified.cardTitle,
    fontWeight: '700',
    lineHeight: typographySimplified.lineHeight.cardTitle,
    color: colors.text,
  },
  linkedTaskMetaRow: {
    marginTop: 8,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  listItem: {
    marginBottom: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: typographySimplified.body,
    lineHeight: typographySimplified.lineHeight.body,
    paddingHorizontal: 24,
  },
});
