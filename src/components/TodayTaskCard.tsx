import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CardDateEmphasis, useCardMetaStyles } from './CardDateEmphasis';
import { HapticPressable } from './HapticPressable';
import { InfoCard } from './CommonComponents';
import { PrimaryActionButton } from './PrimaryActionButton';
import { TodayTaskCard as CompleteTodayTaskCard } from './complete/TodayTaskCard';
import type { SiteTask } from '../data/models';
import { colors } from '../theme/colors';
import { typographySimplified } from '../theme/typography';
import { useUiMode } from '../ui/UiModeProvider';
import {
  taskCheckInLabel,
  taskDurationDays,
  taskIsFullyComplete,
  taskIsLate,
  taskProgressRatio,
  taskRequiresMultipleCheckIns,
} from '../utils/taskProgress';
import { taskCompleteButtonLabel } from '../utils/taskCompleteLabel';
import { formatTaskDateTime, sortTaskPhotos } from '../utils/taskWork';

function TaskProgressBar({ task }: { task: SiteTask }) {
  if (!taskRequiresMultipleCheckIns(task)) return null;

  const ratio = taskProgressRatio(task);

  return (
    <View style={styles.progressSection}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
      </View>
      <Text style={styles.progressLabel}>{taskCheckInLabel(task)}</Text>
    </View>
  );
}

interface TodayTaskCardProps {
  task: SiteTask;
  onPress?: () => void;
  onPhotoPress?: () => void;
  onCompletePress?: () => void;
  onLongPress?: () => void;
  completing?: boolean;
}

export function TodayTaskCard(props: TodayTaskCardProps) {
  const { isSimplified } = useUiMode();
  if (!isSimplified) return <CompleteTodayTaskCard {...props} />;
  return <TodayTaskCardSimplified {...props} />;
}

function TodayTaskCardSimplified({
  task,
  onPress,
  onPhotoPress,
  onCompletePress,
  onLongPress,
  completing,
}: TodayTaskCardProps) {
  const { t } = useTranslation();
  const cardMetaStyles = useCardMetaStyles();
  const isCompleted = taskIsFullyComplete(task);
  const isLate = taskIsLate(task);
  const showCamera = Boolean(onPhotoPress) && !isCompleted;
  const showComplete = Boolean(onCompletePress) && !isCompleted;
  const duration = taskDurationDays(task);
  const durationLabel = duration > 1 ? t('taskCard.dayTask', { count: duration }) : '';
  const photos = sortTaskPhotos(task.photos ?? []);
  const hasWorkTimes = Boolean(task.workStartedAt || task.workEndedAt);

  return (
    <View>
      <InfoCard
        title={task.title}
        badge={isCompleted || isLate ? undefined : t('common.task')}
        alertBadge={isLate ? t('taskCard.late') : undefined}
        onHeaderPress={!isCompleted ? onPress : undefined}
        onHeaderLongPress={onLongPress}
        subtitle={
          <View style={cardMetaStyles.row}>
            {durationLabel ? <Text style={cardMetaStyles.muted}>{durationLabel.trim()}</Text> : null}
            <CardDateEmphasis date={task.dueDate} label={t('common.dueOn')} />
          </View>
        }
        style={isCompleted ? styles.completedCard : isLate ? styles.lateCard : undefined}
        trailingAction={
          showCamera ? (
            <HapticPressable
              style={styles.cameraButton}
              onPress={onPhotoPress}
              accessibilityRole="button"
              accessibilityLabel={t('taskCard.takePhotoA11y')}
              hitSlop={6}
            >
              <Ionicons name="camera" size={22} color={colors.primary} />
            </HapticPressable>
          ) : undefined
        }
      >
        {onPress && !isCompleted ? (
          <HapticPressable onPress={onPress} onLongPress={onLongPress} delayLongPress={400}>
            <Text style={styles.description}>{task.description}</Text>
            <TaskProgressBar task={task} />
            {photos.length ? (
              <>
                {hasWorkTimes ? (
                  <View style={styles.workTimes}>
                    {task.workStartedAt ? (
                      <Text style={styles.workTimeText}>
                        {t('taskCard.started')}: {formatTaskDateTime(task.workStartedAt)}
                      </Text>
                    ) : null}
                    {task.workEndedAt ? (
                      <Text style={styles.workTimeText}>
                        {t('taskCard.ended')}: {formatTaskDateTime(task.workEndedAt)}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
                  {photos.map((photo) => (
                    <Image
                      key={photo.id}
                      source={{ uri: photo.uri }}
                      style={styles.thumbnail}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
              </>
            ) : null}
          </HapticPressable>
        ) : (
          <>
            <Text style={styles.description}>{task.description}</Text>
            <TaskProgressBar task={task} />
            {photos.length ? (
              <>
                {hasWorkTimes ? (
                  <View style={styles.workTimes}>
                    {task.workStartedAt ? (
                      <Text style={styles.workTimeText}>
                        {t('taskCard.started')}: {formatTaskDateTime(task.workStartedAt)}
                      </Text>
                    ) : null}
                    {task.workEndedAt ? (
                      <Text style={styles.workTimeText}>
                        {t('taskCard.ended')}: {formatTaskDateTime(task.workEndedAt)}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
                  {photos.map((photo) => (
                    <Image
                      key={photo.id}
                      source={{ uri: photo.uri }}
                      style={styles.thumbnail}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>
              </>
            ) : null}
          </>
        )}
        {isCompleted ? (
          <View style={styles.doneBadge}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.doneText}>
              {t('taskCard.done')}
              {task.completedAt ? (
                <>
                  {' · '}
                  <Text style={styles.doneDate}>{task.completedAt}</Text>
                </>
              ) : null}
              {taskRequiresMultipleCheckIns(task) ? ` · ${taskCheckInLabel(task)}` : ''}
            </Text>
          </View>
        ) : null}
        {showComplete ? (
          <PrimaryActionButton
            label={taskCompleteButtonLabel(task, t)}
            onPress={onCompletePress!}
            loading={completing}
          />
        ) : null}
      </InfoCard>
    </View>
  );
}

const styles = StyleSheet.create({
  description: {
    marginTop: 10,
    color: colors.text,
    fontSize: typographySimplified.body,
    lineHeight: typographySimplified.lineHeight.body,
  },
  progressSection: {
    marginTop: 12,
    gap: 6,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  progressLabel: {
    fontSize: typographySimplified.sm,
    fontWeight: '600',
    color: colors.textMuted,
  },
  completedCard: {
    opacity: 0.9,
    borderColor: colors.success,
  },
  lateCard: {
    borderColor: colors.error,
  },
  cameraButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  doneText: {
    color: colors.success,
    fontWeight: '600',
    fontSize: typographySimplified.body,
    flex: 1,
  },
  doneDate: {
    fontWeight: '800',
    fontSize: typographySimplified.body,
    color: colors.text,
  },
  workTimes: {
    marginTop: 12,
    gap: 4,
  },
  workTimeText: {
    fontSize: typographySimplified.sm,
    fontWeight: '600',
    color: colors.text,
  },
  photoStrip: {
    marginTop: 12,
  },
  thumbnail: {
    width: 128,
    height: 96,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: colors.border,
  },
});
