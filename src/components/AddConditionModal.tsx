import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ConditionCategory, NewConditionInput } from '../data/models';
import { colors } from '../theme/colors';

interface AddConditionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: NewConditionInput) => Promise<void>;
}

const categories: ConditionCategory[] = ['Safety', 'Quality'];

export function AddConditionModal({ visible, onClose, onSubmit }: AddConditionModalProps) {
  const insets = useSafeAreaInsets();
  const [category, setCategory] = useState<ConditionCategory>('Safety');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setCategory('Safety');
    setDescription('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    if (!description.trim()) {
      Alert.alert('Missing description', 'Please describe the site condition.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        category,
        description: description.trim(),
      });
      resetForm();
      onClose();
    } finally {
      setSubmitting(false);
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
          <Text style={styles.headerTitle}>New site condition</Text>
          <Pressable onPress={handleSave} disabled={submitting} hitSlop={12}>
            {submitting ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryRow}>
            {categories.map((option) => {
              const selected = category === option;
              return (
                <Pressable
                  key={option}
                  style={[styles.categoryButton, selected && styles.categoryButtonSelected]}
                  onPress={() => setCategory(option)}
                >
                  <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe the safety or quality issue"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
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
  categoryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  categoryButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: '#E3F2FD',
  },
  categoryText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
  },
  categoryTextSelected: {
    color: colors.primary,
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
});
