import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SiteTask } from '../data/models';
import { colors } from '../theme/colors';

interface TaskCompleteModalProps {
  visible: boolean;
  task: SiteTask | null;
  onClose: () => void;
  onComplete: (taskId: string, confirmationPhotoUri?: string) => Promise<void>;
}

export function TaskCompleteModal({ visible, task, onClose, onComplete }: TaskCompleteModalProps) {
  const insets = useSafeAreaInsets();
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => setPhotoUri(undefined);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to attach confirmation.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow camera access to take a confirmation photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleComplete = async () => {
    if (!task) return;
    setSubmitting(true);
    try {
      await onComplete(task.id, photoUri);
      resetForm();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!task) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Complete task</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.taskTitle}>{task.title}</Text>
          <Text style={styles.taskDescription}>{task.description}</Text>

          <Text style={styles.label}>Confirmation photo</Text>
          <Text style={styles.hint}>Attach a site photo to confirm this task is done</Text>
          <View style={styles.photoActions}>
            <Pressable style={styles.photoButton} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={22} color={colors.primary} />
              <Text style={styles.photoButtonText}>Take photo</Text>
            </Pressable>
            <Pressable style={styles.photoButton} onPress={pickFromLibrary}>
              <Ionicons name="images-outline" size={22} color={colors.primary} />
              <Text style={styles.photoButtonText}>Choose from gallery</Text>
            </Pressable>
          </View>

          {photoUri ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="cover" />
              <Pressable style={styles.removePhoto} onPress={() => setPhotoUri(undefined)}>
                <Ionicons name="close-circle" size={28} color={colors.error} />
              </Pressable>
            </View>
          ) : null}

          <Pressable
            style={[styles.doneButton, submitting && styles.doneButtonDisabled]}
            onPress={handleComplete}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.doneButtonText}>Mark as done</Text>
            )}
          </Pressable>
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
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  headerSpacer: {
    width: 56,
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  form: {
    padding: 16,
    paddingBottom: 32,
  },
  taskTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  taskDescription: {
    marginTop: 8,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 12,
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
    fontSize: 14,
    fontWeight: '600',
  },
  previewWrap: {
    marginTop: 16,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  preview: {
    width: 160,
    height: 160,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  removePhoto: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: colors.surface,
    borderRadius: 14,
  },
  doneButton: {
    backgroundColor: colors.success,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  doneButtonDisabled: {
    opacity: 0.6,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
