import { useState } from 'react';
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFieldInsets } from '../hooks/useFieldInsets';
import { useTranslation } from 'react-i18next';
import { HapticPressable } from './HapticPressable';
import { PrimaryActionButton } from './PrimaryActionButton';
import { InfoCard } from './CommonComponents';
import { CardDateEmphasis, useCardMetaStyles } from './CardDateEmphasis';
import { EscalationDetailModal as CompleteEscalationDetailModal } from './complete/EscalationDetailModal';
import type { EmergencyEscalation } from '../data/models';
import { formatTargetTeam } from '../i18n/localize';
import { colors } from '../theme/colors';
import { typographySimplified } from '../theme/typography';
import { useUiMode } from '../ui/UiModeProvider';

interface EscalationDetailModalProps {
  visible: boolean;
  escalation: EmergencyEscalation | null;
  onClose: () => void;
  onResolve: (escalationId: string) => Promise<void>;
}

export function EscalationDetailModal(props: EscalationDetailModalProps) {
  const { isSimplified } = useUiMode();
  if (!isSimplified) return <CompleteEscalationDetailModal {...props} />;
  return <EscalationDetailModalSimplified {...props} />;
}

function EscalationDetailModalSimplified({
  visible,
  escalation,
  onClose,
  onResolve,
}: EscalationDetailModalProps) {
  const cardMetaStyles = useCardMetaStyles();
  const { t } = useTranslation();
  const field = useFieldInsets();
  const [resolving, setResolving] = useState(false);

  if (!escalation) return null;

  const isResolved = escalation.status === 'RESOLVED';

  const handleResolve = async () => {
    setResolving(true);
    try {
      await onResolve(escalation.id);
      onClose();
    } finally {
      setResolving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View
        style={[
          styles.container,
          {
            paddingTop: field.top,
            paddingLeft: field.left,
            paddingRight: field.right,
            paddingBottom: field.bottom,
          },
        ]}
      >
        <View style={styles.header}>
          <HapticPressable onPress={onClose} hitSlop={12}>
            <Text style={styles.closeText}>{t('common.close')}</Text>
          </HapticPressable>
          <Text style={styles.headerTitle}>{t('escalation.detailTitle')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <InfoCard
            variant="emergency"
            title={escalation.title}
            badge={t('escalation.badge')}
            subtitle={
              <View style={cardMetaStyles.row}>
                <Text style={[cardMetaStyles.muted, cardMetaStyles.mutedEmergency]}>
                  {formatTargetTeam(escalation.targetTeam, t)}
                </Text>
                <CardDateEmphasis date={escalation.escalatedAt} variant="emergency" />
              </View>
            }
          >
            {escalation.taskTitle ? (
              <View style={styles.linkedTask}>
                <Ionicons name="clipboard-outline" size={16} color="rgba(255,255,255,0.9)" />
                <Text style={styles.linkedTaskText}>
                  {t('escalation.relatedTaskLine', { title: escalation.taskTitle })}
                </Text>
              </View>
            ) : null}
            <Text style={styles.body}>{escalation.description}</Text>
            {escalation.photoUri ? (
              <Image source={{ uri: escalation.photoUri }} style={styles.photo} resizeMode="cover" />
            ) : null}
          </InfoCard>

          {!isResolved ? (
            <PrimaryActionButton
              label={t('escalation.markResolved')}
              onPress={handleResolve}
              loading={resolving}
              style={styles.resolveButtonSpacing}
            />
          ) : (
            <View style={styles.resolvedBanner}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.resolvedText}>{t('escalation.resolvedBanner')}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  content: {
    padding: 18,
    paddingBottom: 36,
  },
  linkedTask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  linkedTaskText: {
    flex: 1,
    color: 'rgba(255,255,255,0.95)',
    fontSize: typographySimplified.body,
    fontWeight: '600',
  },
  body: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.95)',
    fontSize: typographySimplified.body,
    lineHeight: typographySimplified.lineHeight.body,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  resolveButtonSpacing: {
    marginTop: 12,
  },
  resolvedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    padding: 16,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.success,
  },
  resolvedText: {
    color: colors.success,
    fontSize: typographySimplified.body,
    fontWeight: '600',
  },
});
