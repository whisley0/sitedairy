import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { InfoCard } from './CommonComponents';
import { CardDateEmphasis, cardMetaStyles } from './CardDateEmphasis';
import type { EmergencyEscalation } from '../data/models';
import { formatEscalationStatus, formatTargetTeam } from '../i18n/localize';
import { colors } from '../theme/colors';

interface EscalationDetailModalProps {
  visible: boolean;
  escalation: EmergencyEscalation | null;
  onClose: () => void;
  onResolve: (escalationId: string) => Promise<void>;
}

export function EscalationDetailModal({
  visible,
  escalation,
  onClose,
  onResolve,
}: EscalationDetailModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.closeText}>{t('common.close')}</Text>
          </Pressable>
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
                <Text style={[cardMetaStyles.separator, cardMetaStyles.separatorEmergency]}>·</Text>
                <Text style={[cardMetaStyles.muted, cardMetaStyles.mutedEmergency]}>
                  {formatEscalationStatus(escalation.status, t)}
                </Text>
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
            <Pressable
              style={[styles.resolveButton, resolving && styles.resolveButtonDisabled]}
              onPress={handleResolve}
              disabled={resolving}
            >
              {resolving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.resolveButtonText}>{t('escalation.markResolved')}</Text>
                </>
              )}
            </Pressable>
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
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  headerSpacer: {
    width: 48,
  },
  closeText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
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
    fontSize: 14,
    fontWeight: '600',
  },
  body: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.95)',
    fontSize: 16,
    lineHeight: 24,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  resolveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.success,
    borderRadius: 10,
    paddingVertical: 16,
    marginTop: 8,
  },
  resolveButtonDisabled: {
    opacity: 0.6,
  },
  resolveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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
    fontSize: 15,
    fontWeight: '600',
  },
});
