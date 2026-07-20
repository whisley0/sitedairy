import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CardDateEmphasis, useCardMetaStyles } from '../CardDateEmphasis';
import { InfoCard } from '../CommonComponents';
import type { EmergencyEscalation } from '../../data/models';
import { formatEscalationStatus, formatTargetTeam } from '../../i18n/localize';
import { colors } from '../../theme/colors';

interface EscalationCardProps {
  escalation: EmergencyEscalation;
  onPress?: () => void;
}

export function EscalationCard({ escalation, onPress }: EscalationCardProps) {
  const { t } = useTranslation();
  const cardMetaStyles = useCardMetaStyles();
  const taskPart = escalation.taskTitle
    ? t('escalation.taskPrefix', { title: escalation.taskTitle })
    : '';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [pressed && onPress && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={t('escalation.openA11y', { title: escalation.title })}
    >
      <InfoCard
        variant="emergency"
        title={escalation.title}
        badge={t('escalation.badge')}
        subtitle={
          <View style={cardMetaStyles.row}>
            {taskPart ? <Text style={[cardMetaStyles.muted, cardMetaStyles.mutedEmergency]}>{taskPart.trim()}</Text> : null}
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
        trailingAction={
          onPress ? (
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.9)" />
          ) : undefined
        }
      >
        <Text style={styles.description} numberOfLines={2}>
          {escalation.description}
        </Text>
        {onPress ? <Text style={styles.tapHint}>{t('escalation.tapViewResolve')}</Text> : null}
      </InfoCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.9,
  },
  description: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.95)',
    fontSize: 15,
    lineHeight: 22,
  },
  tapHint: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
});
