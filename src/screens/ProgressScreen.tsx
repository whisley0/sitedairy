import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InfoCard, SectionHeader } from '../components/CommonComponents';
import { TaskCompleteModal } from '../components/TaskCompleteModal';
import type { SiteDiaryRepository } from '../data/repositories';
import type { SiteTask } from '../data/models';
import { colors } from '../theme/colors';

function formatStatus(status: SiteTask['status']) {
  return status.replace('_', ' ');
}

function TodayTaskCard({ task, onPress }: { task: SiteTask; onPress: () => void }) {
  const isCompleted = task.status === 'COMPLETED';

  return (
    <Pressable onPress={onPress} disabled={isCompleted} style={({ pressed }) => [pressed && !isCompleted && styles.pressed]}>
      <InfoCard
        title={task.title}
        subtitle={`Due ${task.dueDate} · ${formatStatus(task.status)}`}
        style={isCompleted ? styles.completedCard : undefined}
      >
        <Text style={styles.description}>{task.description}</Text>
        {isCompleted ? (
          <>
            <View style={styles.doneBadge}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.doneText}>Done{task.completedAt ? ` · ${task.completedAt}` : ''}</Text>
            </View>
            {task.confirmationPhotoUri ? (
              <Image source={{ uri: task.confirmationPhotoUri }} style={styles.thumbnail} resizeMode="cover" />
            ) : null}
          </>
        ) : (
          <Text style={styles.tapHint}>Tap to mark as done and add confirmation photo</Text>
        )}
      </InfoCard>
    </Pressable>
  );
}

function FutureTaskCard({ task }: { task: SiteTask }) {
  return (
    <InfoCard title={task.title} subtitle={`Due ${task.dueDate} · ${formatStatus(task.status)}`}>
      <Text style={styles.description}>{task.description}</Text>
    </InfoCard>
  );
}

export function ProgressScreen({ diaryRepository }: { diaryRepository: SiteDiaryRepository }) {
  const [loading, setLoading] = useState(true);
  const [todayTasks, setTodayTasks] = useState<SiteTask[]>([]);
  const [futureTasks, setFutureTasks] = useState<SiteTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<SiteTask | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const [today, future] = await Promise.all([
      diaryRepository.getTodayTasks(),
      diaryRepository.getFutureTasks(),
    ]);
    setTodayTasks(today);
    setFutureTasks(future);
    setLoading(false);
  }, [diaryRepository]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const openTask = (task: SiteTask) => {
    if (task.status === 'COMPLETED') return;
    setSelectedTask(task);
    setModalVisible(true);
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <SectionHeader
          title="Progress input"
          description="Today's tasks and upcoming work with deadline tracking"
        />
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <Text style={styles.groupTitle}>Today's tasks</Text>
            {todayTasks.map((task) => (
              <TodayTaskCard key={task.id} task={task} onPress={() => openTask(task)} />
            ))}
            <Text style={styles.groupTitle}>Future tasks</Text>
            {futureTasks.map((task) => (
              <FutureTaskCard key={task.id} task={task} />
            ))}
          </>
        )}
      </ScrollView>

      <TaskCompleteModal
        visible={modalVisible}
        task={selectedTask}
        onClose={() => {
          setModalVisible(false);
          setSelectedTask(null);
        }}
        onComplete={async (taskId, confirmationPhotoUri) => {
          await diaryRepository.completeTask({ taskId, confirmationPhotoUri });
          await loadTasks();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 32 },
  groupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 8,
  },
  description: { marginTop: 8, color: colors.text, lineHeight: 22 },
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
  },
  thumbnail: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginTop: 12,
    backgroundColor: colors.border,
  },
});
