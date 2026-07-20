import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SectionHeader } from '../components/CommonComponents';
import { HapticPressable } from '../components/HapticPressable';
import { LanguageToggle } from '../components/LanguageToggle';
import { colors } from '../theme/colors';
import { useAppTypography } from '../theme/useAppTypography';
import type { UiMode } from '../ui/UiModeProvider';
import { useUiMode } from '../ui/UiModeProvider';

export function SettingsScreen() {
  const { t } = useTranslation();
  const typography = useAppTypography();
  const { mode, setMode } = useUiMode();

  const renderModeOption = (value: UiMode, label: string, hint: string) => {
    const active = mode === value;
    return (
      <HapticPressable
        key={value}
        style={[styles.modeOption, active && styles.modeOptionActive]}
        onPress={() => void setMode(value)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
      >
        <View style={styles.modeOptionHeader}>
          <Text style={[styles.modeOptionLabel, { fontSize: typography.body }, active && styles.modeOptionLabelActive]}>
            {label}
          </Text>
          {active ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
        </View>
        <Text style={[styles.modeOptionHint, { fontSize: typography.sm, lineHeight: typography.lineHeight.body }]}>
          {hint}
        </Text>
      </HapticPressable>
    );
  };

  return (
    <View style={styles.container}>
      <SectionHeader title={t('tabs.settings')} />
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { fontSize: typography.sm }]}>{t('settings.uiModeLabel')}</Text>
          <View style={styles.modeList}>
            {renderModeOption('simplified', t('settings.uiModeSimplified'), t('settings.uiModeSimplifiedHint'))}
            {renderModeOption('complete', t('settings.uiModeComplete'), t('settings.uiModeCompleteHint'))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { fontSize: typography.sm }]}>{t('settings.languageLabel')}</Text>
          <LanguageToggle />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  content: { flex: 1, gap: 28, paddingTop: 8 },
  section: { gap: 12 },
  sectionLabel: {
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  modeList: { gap: 10 },
  modeOption: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
  },
  modeOptionActive: {
    borderColor: colors.primary,
    backgroundColor: '#E8F4FD',
  },
  modeOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modeOptionLabel: {
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  modeOptionLabelActive: {
    color: colors.primary,
  },
  modeOptionHint: {
    color: colors.textMuted,
  },
});
