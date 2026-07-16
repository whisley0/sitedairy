import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LanguageToggle } from './LanguageToggle';
import { colors } from '../theme/colors';

interface InfoCardProps {
  title: string;
  subtitle?: React.ReactNode;
  badge?: string;
  alertBadge?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'emergency';
  trailingAction?: React.ReactNode;
}

export function InfoCard({
  title,
  subtitle,
  badge,
  alertBadge,
  children,
  style,
  variant = 'default',
  trailingAction,
}: InfoCardProps) {
  const emergency = variant === 'emergency';
  return (
    <View style={[styles.card, emergency && styles.cardEmergency, style]}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, emergency && styles.titleEmergency, badge ? styles.titleWithBadge : null]}>
          {title}
        </Text>
        {badge ? (
          <View style={[styles.badge, emergency && styles.badgeEmergency]}>
            <Text style={[styles.badgeText, emergency && styles.badgeTextEmergency]}>{badge}</Text>
          </View>
        ) : null}
        {alertBadge ? (
          <View style={styles.alertBadge}>
            <Text style={styles.alertBadgeText}>{alertBadge}</Text>
          </View>
        ) : null}
        {trailingAction}
      </View>
      {subtitle ? (
        <View style={styles.subtitleWrap}>
          {typeof subtitle === 'string' ? (
            <Text style={[styles.subtitle, emergency && styles.subtitleEmergency]}>{subtitle}</Text>
          ) : (
            subtitle
          )}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function SectionHeader({
  title,
  description,
  showLanguage = true,
}: {
  title: string;
  description?: string;
  showLanguage?: boolean;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle} numberOfLines={2}>
          {title}
        </Text>
        {showLanguage ? <LanguageToggle /> : null}
      </View>
      {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
    </View>
  );
}

export function Chip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardEmergency: {
    backgroundColor: colors.error,
    borderColor: '#8E0000',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  titleWithBadge: {
    flex: 1,
    marginRight: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: colors.secondary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeEmergency: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  alertBadge: {
    backgroundColor: colors.error,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  alertBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  badgeTextEmergency: {
    color: '#fff',
  },
  titleEmergency: {
    color: '#fff',
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  subtitleWrap: {
    marginTop: 6,
  },
  subtitleEmergency: {
    color: 'rgba(255,255,255,0.9)',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF3E0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
  },
  chipText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
});
