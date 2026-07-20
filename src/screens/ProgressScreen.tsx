import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SectionHeader } from '../components/CommonComponents';
import { TaskCompleteModal } from '../components/TaskCompleteModal';
import { TaskSection } from '../components/TaskSectionHeader';
import { TodayTaskCard } from '../components/TodayTaskCard';
import type { SiteDiaryRepository } from '../data/repositories';
import type { SiteTask } from '../data/models';
import { localizeSiteTasks } from '../i18n/localize';
import { takeTaskConfirmationPhoto } from '../utils/taskPhoto';
import { taskIsFullyComplete, sortTasksLateFirst } from '../utils/taskProgress';
import { colors } from '../theme/colors';
import { useUiMode } from '../ui/UiModeProvider';
import { ProgressScreen as CompleteProgressScreen } from './complete/ProgressScreen';

export function ProgressScreen(props: {
  diaryRepository: SiteDiaryRepository;
  onTaskEscalate?: (task: SiteTask) => void;
}) {
  const { isSimplified } = useUiMode();
  if (!isSimplified) return <CompleteProgressScreen {...props} />;
  return <ProgressScreenSimplified {...props} />;
}

function ProgressScreenSimplified({
  diaryRepository,
  onTaskEscalate,
}: {
  diaryRepository: SiteDiaryRepository;
  onTaskEscalate?: (task: SiteTask) => void;
}) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [rawTodayTasks, setRawTodayTasks] = useState<SiteTask[]>([]);
  const [rawTomorrowTasks, setRawTomorrowTasks] = useState<SiteTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<SiteTask | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);

  const todayTasks = useMemo(
    () => sortTasksLateFirst(localizeSiteTasks(rawTodayTasks, t)),
    [rawTodayTasks, t, i18n.language],
  );
  const tomorrowTasks = useMemo(
    () => sortTasksLateFirst(localizeSiteTasks(rawTomorrowTasks, t)),
    [rawTomorrowTasks, t, i18n.language],
  );

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const [today, tomorrow] = await Promise.all([
      diaryRepository.getTodayTasks(),
      diaryRepository.getTomorrowTasks(),
    ]);
    setRawTodayTasks(today);
    setRawTomorrowTasks(tomorrow);
    setLoading(false);
  }, [diaryRepository]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const openTask = (task: SiteTask) => {
    if (taskIsFullyComplete(task)) return;
    setSelectedTask(task);
    setModalVisible(true);
  };

  const submitTaskPhoto = async (task: SiteTask) => {
    const uri = await takeTaskConfirmationPhoto();
    if (!uri) return;
    await diaryRepository.addTaskPhoto({ taskId: task.id, uri });
    await loadTasks();
  };

  const completeTask = async (task: SiteTask) => {
    setCompletingTaskId(task.id);
    try {
      await diaryRepository.completeTask({ taskId: task.id });
      await loadTasks();
    } finally {
      setCompletingTaskId(null);
    }
  };

  const renderTask = (task: SiteTask) => (
    <TodayTaskCard
      key={task.id}
      task={task}
      onPress={() => openTask(task)}
      onPhotoPress={() => submitTaskPhoto(task)}
      onCompletePress={() => completeTask(task)}
      completing={completingTaskId === task.id}
      onLongPress={onTaskEscalate ? () => onTaskEscalate(task) : undefined}
    />
  );

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <SectionHeader title={t('progress.title')} />
        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <>
            <TaskSection variant="today" count={todayTasks.length}>
              {todayTasks.map(renderTask)}
            </TaskSection>
            <TaskSection
              variant="future"
              count={tomorrowTasks.length}
              emptyMessage={t('progress.futureEmpty')}
            >
              {tomorrowTasks.map(renderTask)}
            </TaskSection>
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
        onComplete={async (taskId, payload) => {
          await diaryRepository.completeTask({ taskId, ...payload });
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
  loader: { marginTop: 24 },
});
