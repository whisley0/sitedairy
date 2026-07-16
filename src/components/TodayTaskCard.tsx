import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CardDateEmphasis, cardMetaStyles } from './CardDateEmphasis';
import { InfoCard } from './CommonComponents';
import type { SiteTask } from '../data/models';
import { formatTaskStatus } from '../i18n/localize';
import {
  taskCheckInLabel,
  taskDurationDays,
  taskIsFullyComplete,
  taskIsLate,
  taskProgressRatio,
  taskRequiresMultipleCheckIns,
} from '../utils/taskProgress';
import { formatTaskDateTime, sortTaskPhotos } from '../utils/taskWork';
import { colors } from '../theme/colors';

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
  onLongPress?: () => void;
}

export function TodayTaskCard({ task, onPress, onPhotoPress, onLongPress }: TodayTaskCardProps) {
  const { t } = useTranslation();
  const isCompleted = taskIsFullyComplete(task);
  const isLate = taskIsLate(task);
  const interactive = Boolean(onPress) && !isCompleted;
  const showCamera = Boolean(onPhotoPress) && !isCompleted;
  const duration = taskDurationDays(task);
  const durationLabel = duration > 1 ? t('taskCard.dayTask', { count: duration }) : '';
  const photos = sortTaskPhotos(task.photos ?? []);
  const hasWorkTimes = Boolean(task.workStartedAt || task.workEndedAt);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      disabled={!interactive && !onLongPress}
      style={({ pressed }) => [pressed && interactive && styles.pressed]}
    >
      <InfoCard
        title={task.title}
        badge={isCompleted || isLate ? undefined : t('common.task')}
        alertBadge={isLate ? t('taskCard.late') : undefined}
        subtitle={
          <View style={cardMetaStyles.row}>
            {durationLabel ? <Text style={cardMetaStyles.muted}>{durationLabel.trim()}</Text> : null}
            <CardDateEmphasis date={task.dueDate} label={t('common.dueOn')} />
            <Text style={cardMetaStyles.separator}>·</Text>
            <Text style={cardMetaStyles.muted}>{formatTaskStatus(task.status, t)}</Text>
          </View>
        }
        style={isCompleted ? styles.completedCard : isLate ? styles.lateCard : undefined}
        trailingAction={
          showCamera ? (
            <Pressable
              style={styles.cameraButton}
              onPress={onPhotoPress}
              accessibilityRole="button"
              accessibilityLabel={t('taskCard.takePhotoA11y')}
              hitSlop={6}
            >
              <Ionicons name="camera" size={18} color={colors.primary} />
            </Pressable>
          ) : undefined
        }
      >
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
            <Text style={styles.photoCount}>
              {t('taskCard.photoCount', { count: photos.length })}
            </Text>
          </>
        ) : null}
        {isCompleted ? (
          <>
            <View style={styles.doneBadge}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
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
          </>
        ) : interactive ? (
          <Text style={styles.tapHint}>
            {taskRequiresMultipleCheckIns(task) ? t('taskCard.tapMultiDay') : t('taskCard.tapSingleDay')}
            {onLongPress ? t('taskCard.longPressEscalate') : ''}
          </Text>
        ) : null}
      </InfoCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  description: { marginTop: 8, color: colors.text, lineHeight: 22 },
  progressSection: {
    marginTop: 10,
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
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tapHint: {
    marginTop: 10,
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.85,
  },
  completedCard: {
    opacity: 0.9,
    borderColor: colors.success,
  },
  lateCard: {
    borderColor: colors.error,
  },
  cameraButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
    marginTop: 10,
  },
  doneText: {
    color: colors.success,
    fontWeight: '600',
    fontSize: 14,
    flex: 1,
  },
  doneDate: {
    fontWeight: '800',
    fontSize: 14,
    color: colors.text,
  },
  workTimes: {
    marginTop: 10,
    gap: 4,
  },
  workTimeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  photoStrip: {
    marginTop: 10,
  },
  photoCount: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  thumbnail: {
    width: 120,
    height: 90,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: colors.border,
  },
});
