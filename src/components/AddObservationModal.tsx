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
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NewObservationInput } from '../data/models';
import { colors } from '../theme/colors';

interface AddObservationModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: NewObservationInput) => Promise<void>;
}

export function AddObservationModal({ visible, onClose, onSubmit }: AddObservationModalProps) {
  const insets = useSafeAreaInsets();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setSubject('');
    setDescription('');
    setPhotoUri(undefined);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    if (!subject.trim() || !description.trim()) {
      Alert.alert('Missing fields', 'Please enter a subject and description.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        title: subject.trim(),
        notes: description.trim(),
        photoUri,
      });
      resetForm();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to attach an image.');
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
      Alert.alert('Permission needed', 'Allow camera access to take a photo.');
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
          <Text style={styles.headerTitle}>New observation</Text>
          <Pressable onPress={handleSave} disabled={submitting} hitSlop={12}>
            {submitting ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Subject</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Unexpected soil condition"
            value={subject}
            onChangeText={setSubject}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe what you observed on site"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />

          <Text style={styles.label}>Photo</Text>
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
  cancelText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  saveText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  form: {
    padding: 16,
    paddingBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: colors.text,
  },
  textArea: {
    minHeight: 120,
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
});
