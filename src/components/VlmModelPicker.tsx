import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { HapticPressable } from './HapticPressable';
import { VlmModelPicker as CompleteVlmModelPicker } from './complete/VlmModelPicker';
import { colors } from '../theme/colors';
import { useAppTypography } from '../theme/useAppTypography';
import { useUiMode } from '../ui/UiModeProvider';
import type { VlmModelId, VlmModelSpec } from '../native/llm/modelManager';

export interface ModelRowState {
  ready: boolean;
  downloading: boolean;
  progress: string;
}

type IoniconName = ComponentProps<typeof Ionicons>['name'];

const MODEL_ICONS: Record<VlmModelId, IoniconName> = {
  'gemini-nano': 'sparkles',
  'smolvlm-500m': 'flash',
  'smolvlm2-2.2b': 'layers-outline',
  'qwen2.5-vl-3b': 'eye-outline',
  'gemma-3-4b': 'scan-outline',
};

export function vlmModelTitleKey(id: VlmModelId): `vlmPicker.models.${VlmModelId}.title` {
  return `vlmPicker.models.${id}.title`;
}

interface VlmModelPickerProps {
  models: VlmModelSpec[];
  state: Record<VlmModelId, ModelRowState>;
  selectedId: VlmModelId;
  disabled?: boolean;
  recommendedId?: VlmModelId;
  showHeader?: boolean;
  onSelect: (id: VlmModelId) => void;
  onDownload: (id: VlmModelId) => void;
}

export function VlmModelPicker(props: VlmModelPickerProps) {
  const { isSimplified } = useUiMode();
  if (!isSimplified) return <CompleteVlmModelPicker {...props} />;
  return <VlmModelPickerSimplified {...props} />;
}

function VlmModelPickerSimplified({
  models,
  state,
  selectedId,
  disabled,
  recommendedId = 'smolvlm-500m',
  showHeader = false,
  onSelect,
  onDownload,
}: VlmModelPickerProps) {
  const typography = useAppTypography();
  const { t } = useTranslation();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { gap: 12 },
        header: { marginBottom: 4 },
        headerTitle: {
          fontSize: typography.title,
          fontWeight: '800',
          color: colors.text,
          lineHeight: typography.lineHeight.title,
        },
        card: {
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderWidth: 2,
          borderColor: colors.border,
          overflow: 'hidden',
        },
        cardSelected: {
          borderColor: colors.primary,
          backgroundColor: '#E8F4FD',
        },
        cardMuted: {
          opacity: 0.95,
        },
        cardMain: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 14,
          padding: 16,
        },
        iconWrap: {
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        },
        iconWrapSelected: {
          backgroundColor: '#fff',
        },
        info: { flex: 1, gap: 4 },
        titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
        title: {
          fontSize: typography.cardTitle,
          fontWeight: '700',
          color: colors.text,
          lineHeight: typography.lineHeight.cardTitle,
        },
        titleSelected: { color: colors.primary },
        badge: {
          backgroundColor: '#E8F5E9',
          borderRadius: 6,
          paddingHorizontal: 8,
          paddingVertical: 2,
        },
        badgeText: { fontSize: typography.xs, fontWeight: '700', color: '#2E7D32' },
        subtitle: {
          fontSize: typography.sm,
          color: colors.textMuted,
          lineHeight: typography.lineHeight.body,
        },
        statusReady: { fontSize: typography.sm, fontWeight: '600', color: colors.success, marginTop: 2 },
        statusBusy: { fontSize: typography.sm, fontWeight: '600', color: colors.primary, marginTop: 2 },
        statusIdle: { fontSize: typography.sm, color: colors.textMuted, marginTop: 2 },
        addBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginHorizontal: 16,
          marginBottom: 16,
          backgroundColor: colors.primary,
          borderRadius: 10,
          paddingVertical: 12,
        },
        addBtnDisabled: { opacity: 0.65 },
        addBtnText: { color: '#fff', fontWeight: '700', fontSize: typography.body },
      }),
    [typography],
  );

  return (
    <View style={styles.wrap}>
      {showHeader ? (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('vlmPicker.chooseTitle')}</Text>
        </View>
      ) : null}

      {models.map((model) => {
        const rs = state[model.id];
        const selected = selectedId === model.id;
        const recommended = model.id === recommendedId;
        const title = t(vlmModelTitleKey(model.id));
        const subtitle = t(`vlmPicker.models.${model.id}.subtitle`);
        const canSelect = rs.ready && !disabled;

        return (
          <View
            key={model.id}
            style={[styles.card, selected && styles.cardSelected, !rs.ready && styles.cardMuted]}
          >
            <HapticPressable
              style={styles.cardMain}
              disabled={!canSelect}
              onPress={() => onSelect(model.id)}
            >
              <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
                <Ionicons
                  name={MODEL_ICONS[model.id]}
                  size={26}
                  color={selected ? colors.primary : colors.textMuted}
                />
              </View>
              <View style={styles.info}>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, selected && styles.titleSelected]}>{title}</Text>
                  {recommended ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{t('vlmPicker.recommended')}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.subtitle}>{subtitle}</Text>
                {rs.ready ? (
                  <Text style={styles.statusReady}>{t('vlmPicker.readyToUse')}</Text>
                ) : rs.downloading ? (
                  <Text style={styles.statusBusy}>
                    {rs.progress || t('vlmPicker.downloading')}
                  </Text>
                ) : (
                  <Text style={styles.statusIdle}>{t('vlmPicker.needsDownload')}</Text>
                )}
              </View>
              {selected && rs.ready ? (
                <Ionicons name="checkmark-circle" size={28} color={colors.primary} />
              ) : null}
            </HapticPressable>

            {!rs.ready ? (
              <HapticPressable
                style={[styles.addBtn, (disabled || rs.downloading) && styles.addBtnDisabled]}
                disabled={disabled || rs.downloading}
                onPress={() => onDownload(model.id)}
              >
                {rs.downloading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={18} color="#fff" />
                    <Text style={styles.addBtnText}>{t('vlmPicker.addToPhone')}</Text>
                  </>
                )}
              </HapticPressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
