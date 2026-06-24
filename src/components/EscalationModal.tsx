import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { InfoCard } from '../components/CommonComponents';
import type { SiteDiaryRepository } from '../data/repositories';
import type { EmergencyEscalation } from '../data/models';
import { colors } from '../theme/colors';

interface EscalationModalProps {
  visible: boolean;
  onClose: () => void;
  diaryRepository: SiteDiaryRepository;
}

export function EscalationModal({ visible, onClose, diaryRepository }: EscalationModalProps) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [escalations, setEscalations] = useState<EmergencyEscalation[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setEscalations(await diaryRepository.getEscalations());
    setLoading(false);
  }, [diaryRepository]);

  useEffect(() => {
    if (visible) {
      reload();
    }
  }, [visible, reload]);

  const handleClose = () => {
    setTitle('');
    setDescription('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    await diaryRepository.submitEscalation(title.trim(), description.trim());
    setTitle('');
    setDescription('');
    setSubmitting(false);
    await reload();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Emergency escalation</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.description}>
            Alert upper management when critical site issues occur
          </Text>

          <InfoCard
            title="New escalation"
            subtitle="Example: nobody on site, severe weather, safety incident"
          >
            <TextInput
              style={styles.input}
              placeholder="Title"
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Pressable
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={submitting || !title.trim() || !description.trim()}
            >
              <Text style={styles.buttonText}>
                {submitting ? 'Submitting…' : 'Escalate to upper management'}
              </Text>
            </Pressable>
          </InfoCard>

          <Text style={styles.groupTitle}>Recent escalations</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            escalations.map((escalation) => (
              <InfoCard
                key={escalation.id}
                title={escalation.title}
                subtitle={`${escalation.targetTeam} · ${escalation.escalatedAt} · ${escalation.status}`}
              >
                <Text style={styles.body}>{escalation.description}</Text>
              </InfoCard>
            ))
          )}
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
    width: 48,
  },
  closeText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  description: {
    color: colors.textMuted,
    marginBottom: 16,
    lineHeight: 22,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    fontSize: 16,
    color: colors.text,
  },
  textArea: { minHeight: 96 },
  button: {
    backgroundColor: colors.error,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600' },
  groupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 8,
  },
  body: { marginTop: 8, color: colors.text, lineHeight: 22 },
});
