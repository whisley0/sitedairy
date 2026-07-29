import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { PhotoBle } from '../data/models';
import { colors } from '../theme/colors';

interface PhotoBleRowProps {
  ble?: PhotoBle;
  compact?: boolean;
}

export function PhotoBleRow({ ble, compact }: PhotoBleRowProps) {
  const { t } = useTranslation();

  if (!ble) {
    return compact ? null : (
      <View style={styles.row}>
        <Ionicons name="bluetooth-outline" size={16} color={colors.textMuted} />
        <Text style={styles.missing}>{t('photoBle.unavailable')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <Ionicons name="bluetooth" size={compact ? 14 : 16} color={colors.primary} />
      <View style={styles.body}>
        <Text style={[styles.primary, compact && styles.primaryCompact]} numberOfLines={1}>
          {t('photoBle.zone', { zone: ble.zoneId })}
          {' · '}
          {ble.name}
        </Text>
        {!compact ? (
          <Text style={styles.secondary} numberOfLines={1}>
            {t('photoBle.address', { address: ble.deviceId })}
            {' · '}
            {t('ble.rssiValue', { value: ble.rssi })}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    paddingVertical: 4,
  },
  rowCompact: { marginTop: 4, gap: 6, alignItems: 'center' },
  body: { flex: 1, gap: 2 },
  primary: { color: colors.text, fontSize: 14, fontWeight: '600' },
  primaryCompact: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  secondary: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  missing: { flex: 1, color: colors.textMuted, fontSize: 13 },
});
