import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

interface CardDateEmphasisProps {
  date: string;
  label?: string;
  variant?: 'default' | 'emergency';
}

export function CardDateEmphasis({ date, label, variant = 'default' }: CardDateEmphasisProps) {
  const emergency = variant === 'emergency';

  return (
    <View style={[styles.pill, emergency && styles.pillEmergency]}>
      {label ? (
        <Text style={[styles.label, emergency && styles.labelEmergency]}>{label}</Text>
      ) : null}
      <Text style={[styles.date, emergency && styles.dateEmergency]}>{date}</Text>
    </View>
  );
}

export const cardMetaStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  muted: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  mutedEmergency: {
    color: 'rgba(255,255,255,0.88)',
  },
  separator: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  separatorEmergency: {
    color: 'rgba(255,255,255,0.75)',
  },
});

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  pillEmergency: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderColor: 'rgba(255,255,255,0.45)',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  labelEmergency: {
    color: 'rgba(255,255,255,0.92)',
  },
  date: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.2,
  },
  dateEmergency: {
    color: '#fff',
  },
});
