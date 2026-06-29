import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import type { VlmModelId, VlmModelSpec } from '../native/llm/modelManager';

export interface ModelRowState {
  ready: boolean;
  downloading: boolean;
  progress: string;
}

interface VlmModelPickerProps {
  models: VlmModelSpec[];
  state: Record<VlmModelId, ModelRowState>;
  selectedId: VlmModelId;
  disabled?: boolean;
  onSelect: (id: VlmModelId) => void;
  onDownload: (id: VlmModelId) => void;
}

export function VlmModelPicker({
  models,
  state,
  selectedId,
  disabled,
  onSelect,
  onDownload,
}: VlmModelPickerProps) {
  return (
    <View style={styles.wrap}>
      {models.map((model) => {
        const rs = state[model.id];
        const selected = selectedId === model.id;
        return (
          <Pressable
            key={model.id}
            style={[styles.row, selected && styles.rowSelected]}
            disabled={disabled || !rs.ready}
            onPress={() => onSelect(model.id)}
          >
            <Ionicons
              name={selected ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={rs.ready ? colors.primary : colors.border}
            />
            <View style={styles.info}>
              <Text style={styles.name}>{model.name}</Text>
              <Text style={styles.meta}>
                {rs.downloading
                  ? rs.progress || 'Downloading…'
                  : rs.ready
                    ? 'Installed'
                    : model.approxSize}
              </Text>
            </View>
            {rs.ready ? (
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
            ) : rs.downloading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Pressable
                style={[styles.dlBtn, disabled && styles.disabled]}
                disabled={disabled}
                onPress={() => onDownload(model.id)}
              >
                <Ionicons name="download" size={16} color="#fff" />
                <Text style={styles.dlText}>Download</Text>
              </Pressable>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  rowSelected: { borderColor: colors.primary },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  dlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dlText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  disabled: { opacity: 0.6 },
});
