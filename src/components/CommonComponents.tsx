import { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LanguageToggle } from './LanguageToggle';
import { HapticPressable } from './HapticPressable';
import { colors } from '../theme/colors';
import { useAppTypography } from '../theme/useAppTypography';
import { useUiMode } from '../ui/UiModeProvider';

interface InfoCardProps {
  title: string;
  subtitle?: React.ReactNode;
  badge?: string;
  alertBadge?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'emergency';
  trailingAction?: React.ReactNode;
  onHeaderPress?: () => void;
  onHeaderLongPress?: () => void;
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
  onHeaderPress,
  onHeaderLongPress,
}: InfoCardProps) {
  const typography = useAppTypography();
  const { isSimplified } = useUiMode();
  const emergency = variant === 'emergency';
  const headerInteractive = Boolean(onHeaderPress || onHeaderLongPress);

  const titleRow = (
    <View style={styles.titleRow}>
      <Text
        style={[
          styles.title,
          {
            fontSize: typography.cardTitle,
            lineHeight: typography.lineHeight.cardTitle,
            fontWeight: isSimplified ? '700' : '600',
          },
          emergency && styles.titleEmergency,
          badge ? styles.titleWithBadge : null,
        ]}
      >
        {title}
      </Text>
      {badge ? (
        <View style={[styles.badge, emergency && styles.badgeEmergency]}>
          <Text
            style={[
              styles.badgeText,
              { fontSize: typography.xs },
              emergency && styles.badgeTextEmergency,
            ]}
          >
            {badge}
          </Text>
        </View>
      ) : null}
      {alertBadge ? (
        <View style={styles.alertBadge}>
          <Text style={[styles.alertBadgeText, { fontSize: typography.xs }]}>{alertBadge}</Text>
        </View>
      ) : null}
      {trailingAction}
    </View>
  );

  return (
    <View
      style={[
        styles.card,
        {
          padding: isSimplified ? 18 : 16,
          marginBottom: isSimplified ? 14 : 12,
        },
        emergency && styles.cardEmergency,
        style,
      ]}
    >
      {headerInteractive ? (
        <HapticPressable
          onPress={onHeaderPress}
          onLongPress={onHeaderLongPress}
          delayLongPress={400}
          disabled={!onHeaderPress && !onHeaderLongPress}
        >
          {titleRow}
        </HapticPressable>
      ) : (
        titleRow
      )}
      {subtitle ? (
        <View style={styles.subtitleWrap}>
          {typeof subtitle === 'string' ? (
            <Text
              style={[
                styles.subtitle,
                { fontSize: typography.sm },
                emergency && styles.subtitleEmergency,
              ]}
            >
              {subtitle}
            </Text>
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
  const typography = useAppTypography();
  const { isSimplified } = useUiMode();

  return (
    <View
      style={[
        styles.sectionHeader,
        {
          paddingTop: isSimplified ? 8 : 4,
          paddingBottom: isSimplified ? 12 : 8,
        },
      ]}
    >
      <View style={styles.sectionTitleRow}>
        <Text
          style={[
            styles.sectionTitle,
            {
              fontSize: typography.title,
              lineHeight: typography.lineHeight.title,
            },
          ]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {showLanguage ? <LanguageToggle /> : null}
      </View>
      {description ? (
        <Text style={[styles.sectionDescription, { fontSize: typography.sm }]}>{description}</Text>
      ) : null}
    </View>
  );
}

export function Chip({ label }: { label: string }) {
  const typography = useAppTypography();
  return (
    <View style={styles.chip}>
      <Text style={[styles.chipText, { fontSize: typography.sm }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardEmergency: {
    backgroundColor: colors.error,
    borderColor: '#8E0000',
  },
  title: {
    flex: 1,
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
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  badgeText: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  badgeTextEmergency: {
    color: '#fff',
  },
  titleEmergency: {
    color: '#fff',
    fontWeight: '800',
  },
  subtitle: {
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
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: {
    flex: 1,
    fontWeight: '700',
    color: colors.text,
  },
  sectionDescription: {
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
    fontWeight: '600',
  },
});
