import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { EscalationDictationDock } from './EscalationDictationDock';
import { HapticPressable } from './HapticPressable';
import {
  CUSTOM_ESCALATION_TEMPLATE_ID,
  getLocalizedEscalationTemplates,
} from '../i18n/escalationTemplatesI18n';
import type { SiteDiaryRepository } from '../data/repositories';
import type { SiteTask } from '../data/models';
import { useFieldInsets } from '../hooks/useFieldInsets';
import { colors } from '../theme/colors';
import { typographySimplified } from '../theme/typography';

const HORIZONTAL_PADDING = 18;
const SCREEN_WIDTH = Dimensions.get('window').width;

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

interface EscalationComposePanelProps {
  disabled?: boolean;
  linkedTask?: SiteTask | null;
  diaryRepository: SiteDiaryRepository;
  onSubmitted: () => void;
  onPeekHeightChange?: (height: number) => void;
}

export function EscalationComposePanel({
  disabled,
  linkedTask,
  diaryRepository,
  onSubmitted,
  onPeekHeightChange,
}: EscalationComposePanelProps) {
  const { t, i18n } = useTranslation();
  const field = useFieldInsets();
  const [composeOpen, setComposeOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [convertedMessage, setConvertedMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fallbackPanelWidth = SCREEN_WIDTH - field.left - field.right - HORIZONTAL_PADDING * 2;
  const dockWidth = panelWidth > 0 ? panelWidth : fallbackPanelWidth;
  const semicircleHeight = dockWidth / 2;
  const peekHeight = semicircleHeight + field.bottom;

  const templates = useMemo(() => getLocalizedEscalationTemplates(t), [t, i18n.language]);
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
  const cannedMessage =
    selectedTemplate && selectedTemplate.id !== CUSTOM_ESCALATION_TEMPLATE_ID
      ? selectedTemplate.description
      : '';

  useEffect(() => {
    onPeekHeightChange?.(peekHeight);
  }, [onPeekHeightChange, peekHeight]);

  const handleRootLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0) {
      setPanelWidth(width);
    }
  }, []);

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setDropdownOpen(false);
  };

  const openComposeFromTranscript = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setConvertedMessage(trimmed);
    setDropdownOpen(false);
    setComposeOpen(true);

    if (!selectedTemplateId) {
      setSelectedTemplateId(
        linkedTask ? CUSTOM_ESCALATION_TEMPLATE_ID : templates[0]?.id ?? CUSTOM_ESCALATION_TEMPLATE_ID,
      );
    }
  };

  const dismissCompose = () => {
    setComposeOpen(false);
    setDropdownOpen(false);
    setConvertedMessage('');
    setSelectedTemplateId(null);
  };

  const resolveSubmitPayload = () => {
    const message = convertedMessage.trim();
    if (!selectedTemplateId || !message) return null;

    if (selectedTemplateId === CUSTOM_ESCALATION_TEMPLATE_ID) {
      if (linkedTask) {
        const defaults = taskEscalationDefaults(linkedTask, t);
        return {
          title: defaults.title,
          description: defaults.description.trim()
            ? `${defaults.description.trim()}\n\n${message}`
            : message,
        };
      }
      return {
        title: message.slice(0, 80),
        description: message,
      };
    }

    const template = templates.find((item) => item.id === selectedTemplateId);
    if (!template) return null;

    return {
      title: template.title,
      description: template.description.trim()
        ? `${template.description.trim()}\n\n${message}`
        : message,
    };
  };

  const canSubmit = Boolean(selectedTemplateId && convertedMessage.trim());

  const handleSubmit = async () => {
    const payload = resolveSubmitPayload();
    if (!payload || submitting) return;
    setSubmitting(true);
    try {
      await diaryRepository.submitEscalation({
        title: payload.title,
        description: payload.description,
        taskId: linkedTask?.id,
        taskTitle: linkedTask?.title,
      });
      dismissCompose();
      onSubmitted();
    } finally {
      setSubmitting(false);
    }
  };

  const busy = disabled || submitting;

  return (
    <View
      style={[styles.root, { paddingBottom: field.bottom, paddingHorizontal: HORIZONTAL_PADDING }]}
      onLayout={handleRootLayout}
      pointerEvents="box-none"
    >
      {composeOpen ? (
        <View style={styles.floatingBox}>
          <View style={styles.floatingHeader}>
            <Text style={styles.floatingTitle}>{t('escalation.newEscalation')}</Text>
            <HapticPressable
              onPress={dismissCompose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('escalation.dismissCompose')}
            >
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </HapticPressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Text style={styles.fieldLabel}>{t('escalation.cannedMessage')}</Text>
            <HapticPressable
              style={[styles.dropdownTrigger, dropdownOpen && styles.dropdownTriggerOpen]}
              onPress={() => setDropdownOpen((open) => !open)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={t('escalation.issueTypeA11y')}
            >
              <Text style={[styles.dropdownTriggerText, !selectedTemplate && styles.dropdownPlaceholder]}>
                {selectedTemplate?.label ?? t('escalation.selectIssueType')}
              </Text>
              <Ionicons name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={22} color={colors.textMuted} />
            </HapticPressable>

            {dropdownOpen ? (
              <View style={styles.dropdownList}>
                {templates.map((template) => {
                  const selected = template.id === selectedTemplateId;
                  return (
                    <HapticPressable
                      key={template.id}
                      style={[styles.dropdownOption, selected && styles.dropdownOptionSelected]}
                      onPress={() => handleSelectTemplate(template.id)}
                    >
                      <Text style={[styles.dropdownOptionText, selected && styles.dropdownOptionTextSelected]}>
                        {template.label}
                      </Text>
                      {selected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                    </HapticPressable>
                  );
                })}
              </View>
            ) : null}

            {cannedMessage ? (
              <View style={styles.cannedPreview}>
                <Text style={styles.cannedPreviewText}>{cannedMessage}</Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>{t('escalation.convertedMessage')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('escalation.descriptionPlaceholder')}
              value={convertedMessage}
              onChangeText={setConvertedMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!busy}
            />

            <HapticPressable
              style={[styles.submitButton, (!canSubmit || busy) && styles.submitButtonDisabled]}
              onPress={() => void handleSubmit()}
              disabled={!canSubmit || busy}
              accessibilityRole="button"
              accessibilityLabel={t('escalation.submit')}
            >
              <Ionicons name="send" size={20} color={colors.actionForeground} />
              <Text style={styles.submitButtonText}>
                {submitting ? t('escalation.submitting') : t('escalation.submit')}
              </Text>
            </HapticPressable>
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.semicircleRow}>
        <EscalationDictationDock
          disabled={busy}
          onTranscript={openComposeFromTranscript}
          embedded
          width={dockWidth}
          height={semicircleHeight}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    alignItems: 'center',
  },
  floatingBox: {
    width: '100%',
    maxHeight: '58%',
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 10,
  },
  floatingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  floatingTitle: {
    fontSize: typographySimplified.lg,
    fontWeight: '700',
    color: colors.text,
  },
  semicircleRow: {
    width: '100%',
    alignItems: 'center',
  },
  fieldLabel: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: typographySimplified.sm,
    fontWeight: '700',
    color: colors.textMuted,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dropdownTriggerOpen: {
    borderColor: colors.primary,
  },
  dropdownTriggerText: {
    flex: 1,
    fontSize: typographySimplified.body,
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
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.background,
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
    fontSize: typographySimplified.body,
    color: colors.text,
    fontWeight: '500',
  },
  dropdownOptionTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  cannedPreview: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cannedPreviewText: {
    color: colors.textMuted,
    fontSize: typographySimplified.sm,
    lineHeight: 20,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: typographySimplified.body,
    color: colors.text,
  },
  textArea: {
    minHeight: 96,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
    backgroundColor: colors.action,
    borderWidth: 3,
    borderColor: colors.actionBorder,
    borderRadius: 14,
    paddingVertical: 16,
    minHeight: 56,
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  submitButtonText: {
    color: colors.actionForeground,
    fontSize: typographySimplified.headline,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
