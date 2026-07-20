import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { typographySimplified } from '../theme/typography';
import { dedupeOverlappingTags, formatClassifierLabel, formatPhotoTag, resolveDomainCode, resolveInspectionTypeCode, resolveSubjectCode } from '../utils/photoTags';

interface PhotoTagsEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  editable?: boolean;
  compact?: boolean;
}

export function PhotoTagsEditor({ tags, onChange, editable = true, compact }: PhotoTagsEditorProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');

  const addTag = () => {
    const next = draft.trim();
    if (!next) return;
    onChange(dedupeOverlappingTags([...tags, next]));
    setDraft('');
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const displayTag = (tag: string) => {
    if (resolveInspectionTypeCode(tag)) return formatClassifierLabel('inspectionType', tag, t);
    if (resolveDomainCode(tag)) return formatClassifierLabel('domain', tag, t);
    if (resolveSubjectCode(tag)) return formatClassifierLabel('subject', tag, t);
    return tag;
  };

  return (
    <View style={compact ? styles.compactWrap : styles.wrap}>
      <Text style={styles.label}>{t('riskDetail.tag')}</Text>
      {tags.length > 0 ? (
        <Text style={styles.combined} numberOfLines={compact ? 2 : undefined}>
          {formatPhotoTag(tags, t)}
        </Text>
      ) : (
        <Text style={styles.empty}>{t('riskDetail.tagEmpty')}</Text>
      )}

      <View style={styles.chipRow}>
        {tags.map((tag, index) => (
          <View key={`${tag}-${index}`} style={styles.chip}>
            <Text style={styles.chipText}>{displayTag(tag)}</Text>
            {editable ? (
              <Pressable
                onPress={() => removeTag(index)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('riskDetail.removeTagA11y', { tag: displayTag(tag) })}
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>

      {editable ? (
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder={t('riskDetail.addTagPlaceholder')}
            placeholderTextColor={colors.textMuted}
            onSubmitEditing={addTag}
            returnKeyType="done"
          />
          <Pressable
            style={[styles.addBtn, !draft.trim() && styles.addBtnDisabled]}
            onPress={addTag}
            disabled={!draft.trim()}
            accessibilityRole="button"
            accessibilityLabel={t('riskDetail.addTag')}
          >
            <Ionicons name="add" size={20} color={draft.trim() ? '#fff' : colors.textMuted} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  compactWrap: { marginTop: 6 },
  label: {
    fontSize: typographySimplified.sm,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 4,
  },
  combined: {
    color: colors.text,
    fontSize: typographySimplified.body,
    fontWeight: '700',
    marginBottom: 8,
  },
  empty: { color: colors.textMuted, fontSize: 13, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  addBtnDisabled: { backgroundColor: colors.border },
});
