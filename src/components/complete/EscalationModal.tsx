import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useFieldInsets } from '../../hooks/useFieldInsets';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { CardDateEmphasis, useCardMetaStyles } from '../CardDateEmphasis';
import { EscalationDictationDock } from '../EscalationDictationDock';
import { InfoCard } from '../CommonComponents';
import {
  CUSTOM_ESCALATION_TEMPLATE_ID,
  getLocalizedEscalationTemplates,
} from '../../i18n/escalationTemplatesI18n';
import { formatEscalationStatus, formatTargetTeam, localizeEscalations } from '../../i18n/localize';
import type { SiteDiaryRepository } from '../../data/repositories';
import type { EmergencyEscalation, SiteTask } from '../../data/models';
import { colors } from '../../theme/colors';

function taskEscalationDefaults(task: SiteTask, t: TFunction): { title: string; description: string } {
  return {
    title: t('taskComplete.taskIssueTitle', { title: task.title }),
    description: t('taskComplete.taskIssueDescription', {
      title: task.title,
      dueDate: task.dueDate,
      description: task.description,
    }),
  };
}

interface EscalationModalProps {
  visible: boolean;
  onClose: () => void;
  diaryRepository: SiteDiaryRepository;
  linkedTask?: SiteTask | null;
  onSubmitted?: () => void;
}

export function EscalationModal({
  visible,
  onClose,
  diaryRepository,
  linkedTask,
  onSubmitted,
}: EscalationModalProps) {
  const { t, i18n } = useTranslation();
  const field = useFieldInsets();
  const cardMetaStyles = useCardMetaStyles();
  const [loading, setLoading] = useState(true);
  const [rawEscalations, setRawEscalations] = useState<EmergencyEscalation[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const templates = useMemo(() => getLocalizedEscalationTemplates(t), [t, i18n.language]);
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
  const escalations = useMemo(
    () => localizeEscalations(rawEscalations, t),
    [rawEscalations, t, i18n.language],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setRawEscalations(await diaryRepository.getEscalations());
    setLoading(false);
  }, [diaryRepository]);

  const resetForm = useCallback(() => {
    setSelectedTemplateId(null);
    setDropdownOpen(false);
    setTitle('');
    setDescription('');
    setPhotoUri(undefined);
  }, []);

  useEffect(() => {
    if (!visible) return;
    void reload();
    resetForm();
  }, [visible, linkedTask?.id, reload, resetForm]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSelectTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;

    setSelectedTemplateId(templateId);
    setDropdownOpen(false);

    if (templateId === CUSTOM_ESCALATION_TEMPLATE_ID) {
      if (linkedTask) {
        const defaults = taskEscalationDefaults(linkedTask, t);
        setTitle(defaults.title);
        setDescription(defaults.description);
      } else {
        setTitle('');
        setDescription('');
      }
      return;
    }

    setTitle(template.title);
    setDescription(template.description);
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('escalation.photoPermissionTitle'), t('escalation.photoPermissionLibrary'));
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
      Alert.alert(t('escalation.photoPermissionTitle'), t('escalation.photoPermissionCamera'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!selectedTemplateId || !title.trim() || !description.trim()) return;
    setSubmitting(true);
    await diaryRepository.submitEscalation({
      title: title.trim(),
      description: description.trim(),
      taskId: linkedTask?.id,
      taskTitle: linkedTask?.title,
      photoUri,
    });
    resetForm();
    setSubmitting(false);
    await reload();
    onSubmitted?.();
    onClose();
  };

  const canSubmit = Boolean(selectedTemplateId && title.trim() && description.trim());

  const appendDictation = (text: string) => {
    if (!selectedTemplateId) {
      setSelectedTemplateId(CUSTOM_ESCALATION_TEMPLATE_ID);
      setDropdownOpen(false);
      if (linkedTask) {
        const defaults = taskEscalationDefaults(linkedTask, t);
        setTitle(defaults.title);
        setDescription(
          defaults.description.trim()
            ? `${defaults.description.trim()} ${text}`
            : text,
        );
      } else {
        setTitle('');
        setDescription(text);
      }
      return;
    }
    setDescription((prev) => (prev ? `${prev} ${text}` : text));
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={[
          styles.container,
          {
            paddingTop: field.top,
            paddingLeft: field.left,
            paddingRight: field.right,
          },
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Text style={styles.closeText}>{t('common.close')}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>
            {linkedTask ? t('escalation.taskEscalation') : t('escalation.emergencyEscalation')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.lead}>
            {linkedTask ? t('escalation.leadTask') : t('escalation.leadGeneral')}
          </Text>

          {linkedTask ? (
            <View style={styles.linkedTaskBanner}>
              <Text style={styles.linkedTaskLabel}>{t('escalation.relatedTask')}</Text>
              <Text style={styles.linkedTaskTitle}>{linkedTask.title}</Text>
              <View style={[cardMetaStyles.row, styles.linkedTaskMetaRow]}>
                <CardDateEmphasis date={linkedTask.dueDate} label={t('common.dueOn')} />
              </View>
            </View>
          ) : null}

          <InfoCard title={t('escalation.newEscalation')} subtitle={t('escalation.newSubtitle')}>
            <Text style={styles.fieldLabel}>{t('escalation.issueType')}</Text>
            <Pressable
              style={[styles.dropdownTrigger, dropdownOpen && styles.dropdownTriggerOpen]}
              onPress={() => setDropdownOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel={t('escalation.issueTypeA11y')}
            >
              <Text
                style={[
                  styles.dropdownTriggerText,
                  !selectedTemplate && styles.dropdownPlaceholder,
                ]}
              >
                {selectedTemplate?.label ?? t('escalation.selectIssueType')}
              </Text>
              <Ionicons
                name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textMuted}
              />
            </Pressable>

            {dropdownOpen ? (
              <View style={styles.dropdownList}>
                {templates.map((template) => {
                  const selected = template.id === selectedTemplateId;
                  return (
                    <Pressable
                      key={template.id}
                      style={[styles.dropdownOption, selected && styles.dropdownOptionSelected]}
                      onPress={() => handleSelectTemplate(template.id)}
                    >
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          selected && styles.dropdownOptionTextSelected,
                        ]}
                      >
                        {template.label}
                      </Text>
                      {selected ? (
                        <Ionicons name="checkmark" size={18} color={colors.primary} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {selectedTemplateId ? (
              <>
                <Text style={styles.fieldLabel}>{t('escalation.title')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('escalation.titlePlaceholder')}
                  value={title}
                  onChangeText={setTitle}
                />
                <Text style={styles.fieldLabel}>{t('escalation.description')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder={t('escalation.descriptionPlaceholder')}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </>
            ) : null}

            {selectedTemplateId ? (
              <>
                <Text style={styles.fieldLabel}>{t('escalation.photoLabel')}</Text>
                <Text style={styles.photoHint}>{t('escalation.photoHint')}</Text>
                <View style={styles.photoActions}>
                  <Pressable style={styles.photoButton} onPress={takePhoto}>
                    <Ionicons name="camera-outline" size={20} color={colors.primary} />
                    <Text style={styles.photoButtonText}>{t('escalation.takePhoto')}</Text>
                  </Pressable>
                  <Pressable style={styles.photoButton} onPress={pickFromLibrary}>
                    <Ionicons name="images-outline" size={20} color={colors.primary} />
                    <Text style={styles.photoButtonText}>{t('escalation.choosePhoto')}</Text>
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
              </>
            ) : null}

            <Pressable
              style={[styles.button, (submitting || !canSubmit) && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={submitting || !canSubmit}
            >
              <Text style={styles.buttonText}>
                {submitting ? t('escalation.submitting') : t('escalation.submit')}
              </Text>
            </Pressable>
          </InfoCard>

          <Text style={styles.groupTitle}>{t('escalation.recent')}</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            escalations.map((escalation) => (
              <InfoCard
                key={escalation.id}
                title={escalation.title}
                subtitle={<EscalationSubtitle escalation={escalation} />}
              >
                <Text style={styles.body}>{escalation.description}</Text>
              </InfoCard>
            ))
          )}
        </ScrollView>
        <EscalationDictationDock
          disabled={submitting}
          onTranscript={appendDictation}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

function EscalationSubtitle({ escalation }: { escalation: EmergencyEscalation }) {
  const { t } = useTranslation();
  const cardMetaStyles = useCardMetaStyles();
  const taskPart = escalation.taskTitle
    ? t('escalation.taskPrefix', { title: escalation.taskTitle })
    : '';

  return (
    <View style={cardMetaStyles.row}>
      {taskPart ? <Text style={cardMetaStyles.muted}>{taskPart.trim()}</Text> : null}
      <Text style={cardMetaStyles.muted}>{formatTargetTeam(escalation.targetTeam, t)}</Text>
      <CardDateEmphasis date={escalation.escalatedAt} />
      <Text style={cardMetaStyles.separator}>·</Text>
      <Text style={cardMetaStyles.muted}>{formatEscalationStatus(escalation.status, t)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
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
  lead: {
    color: colors.textMuted,
    marginBottom: 16,
    lineHeight: 22,
  },
  linkedTaskBanner: {
    backgroundColor: '#FFEBEE',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    padding: 14,
    marginBottom: 16,
  },
  linkedTaskLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.error,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  linkedTaskTitle: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  linkedTaskMetaRow: {
    marginTop: 8,
  },
  fieldLabel: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  dropdownTriggerOpen: {
    borderColor: colors.primary,
  },
  dropdownTriggerText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  dropdownPlaceholder: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  dropdownList: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownOptionSelected: {
    backgroundColor: '#E3F2FD',
  },
  dropdownOptionText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  dropdownOptionTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
  },
  textArea: { minHeight: 96 },
  photoHint: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 10,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 10,
  },
  photoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  photoButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  previewWrap: {
    marginTop: 12,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  preview: {
    width: 140,
    height: 140,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  removePhoto: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.surface,
    borderRadius: 14,
  },
  button: {
    backgroundColor: colors.error,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
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
