import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { SectionHeader } from '../components/CommonComponents';
import { colors } from '../theme/colors';

export function SettingsScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <SectionHeader title={t('tabs.settings')} description={t('settings.placeholder')} />
      <View style={styles.iconWrap}>
        <Ionicons name="settings-outline" size={48} color={colors.textMuted} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  iconWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', opacity: 0.35 },
});
