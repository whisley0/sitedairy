import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '../theme/colors';

type TaskSectionVariant = 'today' | 'future';

interface TaskSectionHeaderProps {
  variant: TaskSectionVariant;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  style?: ViewStyle;
}

const SECTION_THEME: Record<
  TaskSectionVariant,
  {
    titleKey: 'taskSection.todayTitle' | 'taskSection.futureTitle';
    subtitleKey: 'taskSection.todaySubtitle' | 'taskSection.futureSubtitle';
    backgroundColor: string;
    borderColor: string;
    titleColor: string;
    subtitleColor: string;
    icon: ComponentProps<typeof Ionicons>['name'];
    iconBackground: string;
    iconColor: string;
    countBackground: string;
  }
> = {
  today: {
    titleKey: 'taskSection.todayTitle',
    subtitleKey: 'taskSection.todaySubtitle',
    backgroundColor: '#E3F2FD',
    borderColor: '#90CAF9',
    titleColor: '#0D47A1',
    subtitleColor: '#1565C0',
    icon: 'flash',
    iconBackground: '#1565C0',
    iconColor: '#FFFFFF',
    countBackground: '#0D47A1',
  },
  future: {
    titleKey: 'taskSection.futureTitle',
    subtitleKey: 'taskSection.futureSubtitle',
    backgroundColor: '#EDE7F6',
    borderColor: '#B39DDB',
    titleColor: '#4527A0',
    subtitleColor: '#5E35B1',
    icon: 'calendar',
    iconBackground: '#5E35B1',
    iconColor: '#FFFFFF',
    countBackground: '#4527A0',
  },
};

export function TaskSectionHeader({
  variant,
  count,
  expanded,
  onToggle,
  style,
}: TaskSectionHeaderProps) {
  const { t } = useTranslation();
  const theme = SECTION_THEME[variant];
  const title = t(theme.titleKey);
  const subtitle = t(theme.subtitleKey);
  const countLabel = t(count === 1 ? 'taskSection.oneTask' : 'taskSection.nTasks', { count });

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.wrapper,
        { backgroundColor: theme.backgroundColor, borderColor: theme.borderColor },
        pressed && styles.wrapperPressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={
        expanded
          ? t('taskSection.a11yExpanded', { title, count: countLabel })
          : t('taskSection.a11yCollapsed', { title, count: countLabel })
      }
    >
      <View style={[styles.iconCircle, { backgroundColor: theme.iconBackground }]}>
        <Ionicons name={theme.icon} size={22} color={theme.iconColor} />
      </View>
      <View style={styles.textBlock}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.titleColor }]}>{title}</Text>
          <View style={[styles.countPill, { backgroundColor: theme.countBackground }]}>
            <Text style={styles.countText}>{countLabel}</Text>
          </View>
        </View>
        <Text style={[styles.subtitle, { color: theme.subtitleColor }]} numberOfLines={expanded ? 2 : 1}>
          {expanded ? subtitle : t('taskSection.tapToExpand')}
        </Text>
      </View>
      <Ionicons
        name={expanded ? 'chevron-up' : 'chevron-down'}
        size={22}
        color={theme.titleColor}
        style={styles.chevron}
      />
    </Pressable>
  );
}

interface TaskSectionProps {
  variant: TaskSectionVariant;
  count: number;
  emptyMessage?: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export function TaskSection({
  variant,
  count,
  emptyMessage,
  defaultExpanded = true,
  children,
}: TaskSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={styles.section}>
      <TaskSectionHeader
        variant={variant}
        count={count}
        expanded={expanded}
        onToggle={() => setExpanded((value) => !value)}
      />
      {expanded ? (
        count === 0 && emptyMessage ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
        ) : (
          <View style={styles.cards}>{children}</View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 12,
  },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 4,
  },
  wrapperPressed: {
    opacity: 0.92,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  countPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  chevron: {
    marginLeft: 2,
  },
  cards: {
    marginTop: 4,
  },
  emptyBox: {
    marginTop: 4,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
