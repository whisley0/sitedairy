import { useState, useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { HapticPressable } from './HapticPressable';
import { TaskSectionHeader as CompleteTaskSectionHeader, TaskSection as CompleteTaskSection } from './complete/TaskSectionHeader';
import { useUiMode } from '../ui/UiModeProvider';
import { colors } from '../theme/colors';
import { useAppTypography } from '../theme/useAppTypography';

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
    backgroundColor: string;
    borderColor: string;
    titleColor: string;
    icon: ComponentProps<typeof Ionicons>['name'];
    iconBackground: string;
    iconColor: string;
    countBackground: string;
  }
> = {
  today: {
    titleKey: 'taskSection.todayTitle',
    backgroundColor: '#E3F2FD',
    borderColor: '#90CAF9',
    titleColor: '#0D47A1',
    icon: 'flash',
    iconBackground: '#1565C0',
    iconColor: '#FFFFFF',
    countBackground: '#0D47A1',
  },
  future: {
    titleKey: 'taskSection.futureTitle',
    backgroundColor: '#EDE7F6',
    borderColor: '#B39DDB',
    titleColor: '#4527A0',
    icon: 'calendar',
    iconBackground: '#5E35B1',
    iconColor: '#FFFFFF',
    countBackground: '#4527A0',
  },
};

export function TaskSectionHeader(props: TaskSectionHeaderProps) {
  const { isSimplified } = useUiMode();
  if (!isSimplified) return <CompleteTaskSectionHeader {...props} />;
  return <TaskSectionHeaderSimplified {...props} />;
}

function TaskSectionHeaderSimplified({
  variant,
  count,
  expanded,
  onToggle,
  style,
}: TaskSectionHeaderProps) {
  const { t } = useTranslation();
  const typography = useAppTypography();
  const theme = SECTION_THEME[variant];
  const title = t(theme.titleKey);
  const countLabel = t(count === 1 ? 'taskSection.oneTask' : 'taskSection.nTasks', { count });

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        title: {
          flex: 1,
          fontSize: typography.headline,
          fontWeight: '800',
          letterSpacing: -0.2,
        },
        countText: {
          color: '#fff',
          fontSize: typography.xs,
          fontWeight: '800',
          letterSpacing: 0.2,
        },
      }),
    [typography],
  );

  return (
    <HapticPressable
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
          <Text style={[dynamicStyles.title, { color: theme.titleColor }]}>{title}</Text>
          <View style={[styles.countPill, { backgroundColor: theme.countBackground }]}>
            <Text style={dynamicStyles.countText}>{countLabel}</Text>
          </View>
        </View>
      </View>
      <Ionicons
        name={expanded ? 'chevron-up' : 'chevron-down'}
        size={24}
        color={theme.titleColor}
        style={styles.chevron}
      />
    </HapticPressable>
  );
}

interface TaskSectionProps {
  variant: TaskSectionVariant;
  count: number;
  emptyMessage?: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export function TaskSection(props: TaskSectionProps) {
  const { isSimplified } = useUiMode();
  if (!isSimplified) return <CompleteTaskSection {...props} />;
  return <TaskSectionSimplified {...props} />;
}

function TaskSectionSimplified({
  variant,
  count,
  emptyMessage,
  defaultExpanded = true,
  children,
}: TaskSectionProps) {
  const typography = useAppTypography();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const dynamicStyles = useMemo(
    () =>
      StyleSheet.create({
        emptyText: {
          color: colors.textMuted,
          fontSize: typography.body,
          lineHeight: typography.lineHeight.body,
          textAlign: 'center',
        },
      }),
    [typography],
  );

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
            <Text style={dynamicStyles.emptyText}>{emptyMessage}</Text>
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
    marginTop: 16,
  },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
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
  countPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
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
});
