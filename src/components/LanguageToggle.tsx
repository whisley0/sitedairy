import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LANGUAGE_LABELS, type AppLanguage } from '../i18n';
import { useLanguage } from '../i18n/LanguageProvider';
import { colors } from '../theme/colors';

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  const renderOption = (code: AppLanguage) => {
    const active = language === code;
    return (
      <Pressable
        key={code}
        style={[styles.option, active && styles.optionActive]}
        onPress={() => void setLanguage(code)}
        accessibilityRole="button"
        accessibilityLabel={LANGUAGE_LABELS[code]}
      >
        <Text style={[styles.optionText, active && styles.optionTextActive]}>{LANGUAGE_LABELS[code]}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.pill}>
      <Ionicons name="language" size={14} color={colors.primary} style={styles.icon} />
      {renderOption('en')}
      <View style={styles.divider} />
      {renderOption('zh-TW')}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 6,
    paddingVertical: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  icon: {
    marginHorizontal: 4,
  },
  option: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
  },
  optionActive: {
    backgroundColor: '#E3F2FD',
  },
  optionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  optionTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  divider: {
    width: 1,
    height: 14,
    backgroundColor: colors.border,
  },
});
