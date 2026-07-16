import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { EscalationCard } from '../components/EscalationCard';
import { EscalationDetailModal } from '../components/EscalationDetailModal';
import { SectionHeader } from '../components/CommonComponents';
import { TaskCompleteModal } from '../components/TaskCompleteModal';
import { TodayTaskCard } from '../components/TodayTaskCard';
import type { AuthRepository, SiteDiaryRepository } from '../data/repositories';
import type { EmergencyEscalation, SiteTask } from '../data/models';
import { localizeEscalations, localizeSiteTasks } from '../i18n/localize';
import { takeTaskConfirmationPhoto } from '../utils/taskPhoto';
import { taskIsFullyComplete, taskIsLate, sortTasksLateFirst } from '../utils/taskProgress';
import { colors } from '../theme/colors';

interface DashboardScreenProps {
  authRepository: AuthRepository;
  diaryRepository: SiteDiaryRepository;
  onTaskEscalate?: (task: SiteTask) => void;
  escalationRefreshSignal?: number;
}

type DashboardRow =
  | { key: string; type: 'escalation'; data: EmergencyEscalation }
  | { key: string; type: 'task'; data: SiteTask };

export function DashboardScreen({
  authRepository,
  diaryRepository,
  onTaskEscalate,
  escalationRefreshSignal = 0,
}: DashboardScreenProps) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [rawTodayTasks, setRawTodayTasks] = useState<SiteTask[]>([]);
  const [rawEscalations, setRawEscalations] = useState<EmergencyEscalation[]>([]);
  const [selectedTask, setSelectedTask] = useState<SiteTask | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedEscalation, setSelectedEscalation] = useState<EmergencyEscalation | null>(null);
  const [escalationDetailVisible, setEscalationDetailVisible] = useState(false);
  const user = authRepository.currentUser();

  const todayTasks = useMemo(
    () => sortTasksLateFirst(localizeSiteTasks(rawTodayTasks, t)),
    [rawTodayTasks, t, i18n.language],
  );
  const activeEscalations = useMemo(
    () => localizeEscalations(rawEscalations.filter((e) => e.status !== 'RESOLVED'), t),
    [rawEscalations, t, i18n.language],
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    const [tasks, escalations] = await Promise.all([
      diaryRepository.getTodayTasks(),
      diaryRepository.getEscalations(),
    ]);
    setRawTodayTasks(tasks);
    setRawEscalations(escalations);
    setLoading(false);
  }, [diaryRepository]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  useEffect(() => {
    if (escalationRefreshSignal > 0) {
      void loadDashboard();
    }
  }, [escalationRefreshSignal, loadDashboard]);

  const rows = useMemo<DashboardRow[]>(() => {
    const lateTasks = todayTasks.filter((task) => taskIsLate(task));
    const otherTasks = todayTasks.filter((task) => !taskIsLate(task));
    return [
      ...activeEscalations.map((escalation) => ({
        key: escalation.id,
        type: 'escalation' as const,
        data: escalation,
      })),
      ...lateTasks.map((task) => ({
        key: task.id,
        type: 'task' as const,
        data: task,
      })),
      ...otherTasks.map((task) => ({
        key: task.id,
        type: 'task' as const,
        data: task,
      })),
    ];
  }, [activeEscalations, todayTasks]);

  const openTask = (task: SiteTask) => {
    if (taskIsFullyComplete(task)) return;
    setSelectedTask(task);
    setModalVisible(true);
  };

  const openEscalation = (escalation: EmergencyEscalation) => {
    setSelectedEscalation(escalation);
    setEscalationDetailVisible(true);
  };

  const submitTaskPhoto = async (task: SiteTask) => {
    const uri = await takeTaskConfirmationPhoto();
    if (!uri) return;
    await diaryRepository.addTaskPhoto({ taskId: task.id, uri });
    await loadDashboard();
  };

  const listHeader = (
    <View>
      <SectionHeader
        title={t('dashboard.welcome', { name: user?.displayName ?? t('common.supervisor') })}
        description={t('dashboard.description')}
      />
      {loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
    </View>
  );

  return (
    <View style={styles.wrapper}>
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.content}
        data={loading ? [] : rows}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) =>
          item.type === 'escalation' ? (
            <EscalationCard escalation={item.data} onPress={() => openEscalation(item.data)} />
          ) : (
            <TodayTaskCard
              task={item.data}
              onPress={() => openTask(item.data)}
              onPhotoPress={() => submitTaskPhoto(item.data)}
              onLongPress={onTaskEscalate ? () => onTaskEscalate(item.data) : undefined}
            />
          )
        }
        ListHeaderComponent={listHeader}
        showsVerticalScrollIndicator
      />

      <EscalationDetailModal
        visible={escalationDetailVisible}
        escalation={selectedEscalation}
        onClose={() => {
          setEscalationDetailVisible(false);
          setSelectedEscalation(null);
        }}
        onResolve={async (escalationId) => {
          await diaryRepository.resolveEscalation(escalationId);
          await loadDashboard();
        }}
      />

      <TaskCompleteModal
        visible={modalVisible}
        task={selectedTask}
        onClose={() => {
          setModalVisible(false);
          setSelectedTask(null);
        }}
        onComplete={async (taskId, payload) => {
          await diaryRepository.completeTask({ taskId, ...payload });
          await loadDashboard();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  loader: { marginVertical: 16 },
});
