import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CardDateEmphasis, useCardMetaStyles } from './CardDateEmphasis';
import { HapticPressable } from './HapticPressable';
import { InfoCard } from './CommonComponents';
import { PrimaryActionButton } from './PrimaryActionButton';
import { EscalationCard as CompleteEscalationCard } from './complete/EscalationCard';
import type { EmergencyEscalation } from '../data/models';
import { formatTargetTeam } from '../i18n/localize';
import { typographySimplified } from '../theme/typography';
import { useUiMode } from '../ui/UiModeProvider';

interface EscalationCardProps {
  escalation: EmergencyEscalation;
  onPress?: () => void;
  onResolvePress?: () => void;
  onReopenPress?: () => void;
  resolving?: boolean;
  reopening?: boolean;
}

export function EscalationCard(props: EscalationCardProps) {
  const { isSimplified } = useUiMode();
  if (!isSimplified) return <CompleteEscalationCard {...props} />;
  return <EscalationCardSimplified {...props} />;
}

function EscalationCardSimplified({
  escalation,
  onPress,
  onResolvePress,
  onReopenPress,
  resolving,
  reopening,
}: EscalationCardProps) {
  const { t } = useTranslation();
  const cardMetaStyles = useCardMetaStyles();
  const taskPart = escalation.taskTitle
    ? t('escalation.taskPrefix', { title: escalation.taskTitle })
    : '';
  const isResolved = escalation.status === 'RESOLVED';
  const showResolve = Boolean(onResolvePress) && !isResolved;
  const showReopen = Boolean(onReopenPress) && isResolved;

  return (
    <View>
      <InfoCard
        variant="emergency"
        title={escalation.title}
        badge={t('escalation.badge')}
        onHeaderPress={onPress}
        subtitle={
          <View style={cardMetaStyles.row}>
            {taskPart ? <Text style={[cardMetaStyles.muted, cardMetaStyles.mutedEmergency]}>{taskPart.trim()}</Text> : null}
            <Text style={[cardMetaStyles.muted, cardMetaStyles.mutedEmergency]}>
              {formatTargetTeam(escalation.targetTeam, t)}
            </Text>
            <CardDateEmphasis date={escalation.escalatedAt} variant="emergency" />
          </View>
        }
        trailingAction={
          onPress ? (
            <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.9)" />
          ) : undefined
        }
      >
        {onPress ? (
          <HapticPressable onPress={onPress}>
            <Text style={styles.description} numberOfLines={3}>
              {escalation.description}
            </Text>
          </HapticPressable>
        ) : (
          <Text style={styles.description} numberOfLines={3}>
            {escalation.description}
          </Text>
        )}
        {showResolve ? (
          <PrimaryActionButton
            label={t('escalation.closeEscalation')}
            onPress={onResolvePress!}
            loading={resolving}
            icon="checkmark-done-outline"
          />
        ) : null}
        {showReopen ? (
          <PrimaryActionButton
            label={t('escalation.reopenEscalation')}
            onPress={onReopenPress!}
            loading={reopening}
            icon="arrow-up-circle-outline"
          />
        ) : null}
      </InfoCard>
    </View>
  );
}

const styles = StyleSheet.create({
  description: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.95)',
    fontSize: typographySimplified.body,
    lineHeight: typographySimplified.lineHeight.body,
  },
});
