import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { PhotoGps } from '../data/models';
import { colors } from '../theme/colors';
import { formatPhotoGps, photoGpsMapsUrl } from '../utils/photoGps';

interface PhotoGpsRowProps {
  gps?: PhotoGps;
  compact?: boolean;
}

export function PhotoGpsRow({ gps, compact }: PhotoGpsRowProps) {
  const { t } = useTranslation();

  if (!gps) {
    return compact ? null : (
      <View style={styles.row}>
        <Ionicons name="location-outline" size={16} color={colors.textMuted} />
        <Text style={styles.missing}>{t('photoGps.unavailable')}</Text>
      </View>
    );
  }

  const content = (
    <>
      <Ionicons name="location" size={compact ? 14 : 16} color={colors.primary} />
      <Text style={[styles.coords, compact && styles.coordsCompact]} numberOfLines={1}>
        {formatPhotoGps(gps)}
        {gps.accuracy != null ? ` · ±${Math.round(gps.accuracy)}m` : ''}
      </Text>
      {!compact ? <Text style={styles.link}>{t('photoGps.openMaps')}</Text> : null}
    </>
  );

  if (compact) {
    return <View style={[styles.row, styles.rowCompact]}>{content}</View>;
  }

  const openMaps = () => {
    void Linking.openURL(photoGpsMapsUrl(gps));
  };

  return (
    <Pressable
      style={styles.row}
      onPress={openMaps}
      accessibilityRole="button"
      accessibilityLabel={t('photoGps.openMapsA11y', { coords: formatPhotoGps(gps) })}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingVertical: 4,
  },
  rowCompact: { marginTop: 4, gap: 6 },
  coords: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
  coordsCompact: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  link: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  missing: { flex: 1, color: colors.textMuted, fontSize: 13 },
});
