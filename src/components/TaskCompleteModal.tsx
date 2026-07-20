import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFieldInsets } from '../hooks/useFieldInsets';
import { useTranslation } from 'react-i18next';
import { HapticPressable } from './HapticPressable';
import { PrimaryActionButton } from './PrimaryActionButton';
import { TaskCompleteModal as CompleteTaskCompleteModal } from './complete/TaskCompleteModal';
import { useUiMode } from '../ui/UiModeProvider';
import type { CompleteTaskInput, SiteTask, TaskPhoto } from '../data/models';
import {
  taskIsFullyComplete,
  taskNextCheckInNumber,
  taskRequiresMultipleCheckIns,
  taskDurationDays,
} from '../utils/taskProgress';
import { taskCompleteButtonLabel } from '../utils/taskCompleteLabel';
import { takeTaskConfirmationPhoto } from '../utils/taskPhoto';
import {
  deriveWorkTimesFromPhotos,
  formatTaskDateTimeForEdit,
  parseTaskDateTimeInput,
  sortTaskPhotos,
} from '../utils/taskWork';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

type PendingPhoto = { key: string; uri: string; uploadedAt: string };

export type TaskCompletePayload = Omit<CompleteTaskInput, 'taskId'>;

interface TaskCompleteModalProps {
  visible: boolean;
  task: SiteTask | null;
  onClose: () => void;
  onComplete: (taskId: string, payload: TaskCompletePayload) => Promise<void>;
}

export function TaskCompleteModal(props: TaskCompleteModalProps) {
  const { isSimplified } = useUiMode();
  if (!isSimplified) return <CompleteTaskCompleteModal {...props} />;
  return <TaskCompleteModalSimplified {...props} />;
}

function TaskCompleteModalSimplified({ visible, task, onClose, onComplete }: TaskCompleteModalProps) {
  const { t } = useTranslation();
  const field = useFieldInsets();
  const [existingPhotos, setExistingPhotos] = useState<TaskPhoto[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [workStartedAt, setWorkStartedAt] = useState('');
  const [workEndedAt, setWorkEndedAt] = useState('');
  const [workStartedAtManual, setWorkStartedAtManual] = useState(false);
  const [workEndedAtManual, setWorkEndedAtManual] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const visiblePhotos = useMemo(() => {
    const kept = existingPhotos.filter((photo) => !removedPhotoIds.includes(photo.id));
    const pending: TaskPhoto[] = pendingPhotos.map((photo) => ({
      id: photo.key,
      uri: photo.uri,
      uploadedAt: photo.uploadedAt,
    }));
    return sortTaskPhotos([...kept, ...pending]);
  }, [existingPhotos, pendingPhotos, removedPhotoIds]);

  const syncTimesFromPhotos = useCallback(
    (photos: TaskPhoto[], startedManual: boolean, endedManual: boolean) => {
      const derived = deriveWorkTimesFromPhotos(photos);
      if (!startedManual && derived.workStartedAt) {
        setWorkStartedAt(formatTaskDateTimeForEdit(derived.workStartedAt));
      } else if (!startedManual && !derived.workStartedAt) {
        setWorkStartedAt('');
      }
      if (!endedManual && derived.workEndedAt) {
        setWorkEndedAt(formatTaskDateTimeForEdit(derived.workEndedAt));
      } else if (!endedManual && !derived.workEndedAt) {
        setWorkEndedAt('');
      }
    },
    [],
  );

  const resetForm = useCallback(() => {
    setExistingPhotos([]);
    setPendingPhotos([]);
    setRemovedPhotoIds([]);
    setWorkStartedAt('');
    setWorkEndedAt('');
    setWorkStartedAtManual(false);
    setWorkEndedAtManual(false);
  }, []);

  useEffect(() => {
    if (!visible || !task) return;

    const photos = task.photos ?? [];
    setExistingPhotos(photos);
    setPendingPhotos([]);
    setRemovedPhotoIds([]);
    setWorkStartedAtManual(Boolean(task.workStartedAtManual));
    setWorkEndedAtManual(Boolean(task.workEndedAtManual));

    if (task.workStartedAt) {
      setWorkStartedAt(formatTaskDateTimeForEdit(task.workStartedAt));
    } else {
      const derived = deriveWorkTimesFromPhotos(photos);
      setWorkStartedAt(derived.workStartedAt ? formatTaskDateTimeForEdit(derived.workStartedAt) : '');
    }

    if (task.workEndedAt) {
      setWorkEndedAt(formatTaskDateTimeForEdit(task.workEndedAt));
    } else {
      const derived = deriveWorkTimesFromPhotos(photos);
      setWorkEndedAt(derived.workEndedAt ? formatTaskDateTimeForEdit(derived.workEndedAt) : '');
    }
  }, [visible, task]);

  useEffect(() => {
    if (!visible) return;
    syncTimesFromPhotos(visiblePhotos, workStartedAtManual, workEndedAtManual);
  }, [visible, visiblePhotos, workStartedAtManual, workEndedAtManual, syncTimesFromPhotos]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const addPhotoUri = (uri: string) => {
    const uploadedAt = new Date().toISOString();
    setPendingPhotos((current) => [
      ...current,
      { key: `pending-${Date.now()}-${current.length}`, uri, uploadedAt },
    ]);
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('taskComplete.permissionTitle'), t('taskComplete.permissionLibrary'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      addPhotoUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const uri = await takeTaskConfirmationPhoto();
    if (uri) addPhotoUri(uri);
  };

  const removePhoto = (photoId: string) => {
    if (photoId.startsWith('pending-')) {
      setPendingPhotos((current) => current.filter((photo) => photo.key !== photoId));
      return;
    }
    setRemovedPhotoIds((current) => (current.includes(photoId) ? current : [...current, photoId]));
  };

  const handleComplete = async () => {
    if (!task) return;

    const parsedStart = workStartedAt.trim() ? parseTaskDateTimeInput(workStartedAt) : undefined;
    const parsedEnd = workEndedAt.trim() ? parseTaskDateTimeInput(workEndedAt) : undefined;

    if (workStartedAt.trim() && !parsedStart) {
      Alert.alert(t('taskComplete.invalidDateTimeTitle'), t('taskComplete.invalidDateTimeBody'));
      return;
    }
    if (workEndedAt.trim() && !parsedEnd) {
      Alert.alert(t('taskComplete.invalidDateTimeTitle'), t('taskComplete.invalidDateTimeBody'));
      return;
    }

    setSubmitting(true);
    try {
      await onComplete(task.id, {
        newPhotos: pendingPhotos.map((photo) => ({ uri: photo.uri, uploadedAt: photo.uploadedAt })),
        removePhotoIds: removedPhotoIds.length ? removedPhotoIds : undefined,
        workStartedAt: parsedStart,
        workEndedAt: parsedEnd,
        workStartedAtManual,
        workEndedAtManual,
      });
      resetForm();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!task) return null;

  const multiDay = taskRequiresMultipleCheckIns(task);
  const nextCheckIn = taskNextCheckInNumber(task);
  const totalCheckIns = taskDurationDays(task);
  const submitLabel = taskCompleteButtonLabel(task, t);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={[
          styles.container,
          {
            paddingTop: field.top,
            paddingLeft: field.left,
            paddingRight: field.right,
            paddingBottom: field.bottom,
          },
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <HapticPressable onPress={handleClose} hitSlop={12}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </HapticPressable>
          <Text style={styles.headerTitle}>{t('taskComplete.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.taskTitle}>{task.title}</Text>
          <Text style={styles.taskDescription}>{task.description}</Text>

          {multiDay ? (
            <View style={styles.checkInBanner}>
              <Text style={styles.checkInBannerText}>
                {taskIsFullyComplete(task)
                  ? t('taskComplete.allCheckIns')
                  : t('taskComplete.dailyCheckIn', { current: nextCheckIn, total: totalCheckIns })}
              </Text>
            </View>
          ) : null}

          <Text style={styles.label}>{t('taskComplete.sitePhotos')}</Text>
          <View style={styles.photoActions}>
            <HapticPressable style={styles.photoButton} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={24} color={colors.primary} />
              <Text style={styles.photoButtonText}>{t('taskComplete.takePhoto')}</Text>
            </HapticPressable>
            <HapticPressable style={styles.photoButton} onPress={pickFromLibrary}>
              <Ionicons name="images-outline" size={24} color={colors.primary} />
              <Text style={styles.photoButtonText}>{t('taskComplete.chooseGallery')}</Text>
            </HapticPressable>
          </View>

          {visiblePhotos.length ? (
            <View style={styles.photoGrid}>
              {visiblePhotos.map((photo) => (
                <View key={photo.id} style={styles.photoTile}>
                  <Image source={{ uri: photo.uri }} style={styles.photoThumb} resizeMode="cover" />
                  <HapticPressable style={styles.removePhoto} onPress={() => removePhoto(photo.id)}>
                    <Ionicons name="close-circle" size={24} color={colors.error} />
                  </HapticPressable>
                  <Text style={styles.photoTime}>{formatTaskDateTimeForEdit(photo.uploadedAt)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={styles.label}>{t('taskComplete.workStartedAt')}</Text>
          <TextInput
            style={styles.input}
            value={workStartedAt}
            onChangeText={(value) => {
              setWorkStartedAt(value);
              setWorkStartedAtManual(true);
            }}
            placeholder={t('taskComplete.dateTimePlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={[styles.label, styles.labelSpaced]}>{t('taskComplete.workEndedAt')}</Text>
          <TextInput
            style={styles.input}
            value={workEndedAt}
            onChangeText={(value) => {
              setWorkEndedAt(value);
              setWorkEndedAtManual(true);
            }}
            placeholder={t('taskComplete.dateTimePlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <PrimaryActionButton
            label={submitLabel}
            onPress={handleComplete}
            loading={submitting}
            style={styles.doneButtonSpacing}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    fontSize: typography.lg,
    fontWeight: '600',
    color: colors.text,
  },
  headerSpacer: {
    width: 56,
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: typography.body,
  },
  form: {
    padding: 18,
    paddingBottom: 36,
  },
  taskTitle: {
    fontSize: typography.cardTitle,
    fontWeight: '700',
    lineHeight: typography.lineHeight.cardTitle,
    color: colors.text,
  },
  taskDescription: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: typography.lineHeight.body,
    marginBottom: 18,
  },
  checkInBanner: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  checkInBannerText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: typography.body,
  },
  label: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  labelSpaced: {
    marginTop: 18,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  photoButtonText: {
    color: colors.primary,
    fontSize: typography.body,
    fontWeight: '600',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  photoTile: {
    width: '47%',
    position: 'relative',
  },
  photoThumb: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  removePhoto: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  photoTime: {
    marginTop: 4,
    fontSize: typography.sm,
    color: colors.textMuted,
    fontWeight: '500',
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    fontSize: typography.body,
    color: colors.text,
  },
  doneButtonSpacing: {
    marginTop: 28,
  },
});
