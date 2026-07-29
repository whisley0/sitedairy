import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { RiskQueuePhoto } from '../../components/RiskQueuePhoto';
import { PhotoGpsRow } from '../../components/PhotoGpsRow';
import { PhotoBleRow } from '../../components/PhotoBleRow';
import { SectionHeader } from '../../components/CommonComponents';
import type { RiskQueueItem, RiskQueueStatus } from '../../data/models';
import { latestAssessmentResult } from '../../data/models';
import { riskAssessmentQueue } from '../../services/riskAssessmentQueue';
import {
  formatQueueDate,
  formatQueueTimeShort,
  groupQueueItemsByAddedDate,
} from '../../utils/riskQueueFormat';
import { colors } from '../../theme/colors';

const STATUS_COLOR: Record<RiskQueueStatus, string> = {
  pending: colors.secondary,
  processing: colors.primary,
  done: colors.success,
  failed: colors.error,
};

function statusLabel(item: RiskQueueItem, t: TFunction): string {
  if (item.halted && item.status === 'failed') return t('queue.status.halted');
  return t(`queue.status.${item.status}`);
}

function statusColor(item: RiskQueueItem): string {
  if (item.halted && item.status === 'failed') return '#E65100';
  return STATUS_COLOR[item.status];
}

interface QueueThumbnailProps {
  item: RiskQueueItem;
  onPress: () => void;
}

function QueueThumbnail({ item, onPress }: QueueThumbnailProps) {
  const { t } = useTranslation();
  const latest = latestAssessmentResult(item);
  const processing = item.status === 'processing' && !item.halted;

  return (
    <Pressable
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('queue.openA11y', { risk: latest?.risk ?? t('queue.status.pending') })}
    >
      <View style={styles.tileImageWrap}>
        <RiskQueuePhoto
          uri={item.photoUri}
          missing={item.photoMissing}
          style={styles.tileImage}
          missingStyle={styles.tileImage}
          compact
        />
        {processing ? (
          <View style={styles.processingOverlay}>
            <ActivityIndicator color="#fff" size="small" />
          </View>
        ) : null}
      </View>
      <View style={styles.tileMeta}>
        <View style={[styles.statusDot, { backgroundColor: statusColor(item) }]} />
        <Text style={styles.tileMetaText} numberOfLines={1}>
          {formatQueueTimeShort(item.createdAt)}
        </Text>
      </View>
      <Text style={styles.tileStatus} numberOfLines={1}>
        {statusLabel(item, t)}
      </Text>
      {item.gps ? <PhotoGpsRow gps={item.gps} compact /> : null}
      {item.ble ? <PhotoBleRow ble={item.ble} compact /> : null}
    </Pressable>
  );
}

interface RiskQueueScreenProps {
  onCapture?: () => void;
  onOpenItem: (itemId: string) => void;
}

export function RiskQueueScreen({ onCapture, onOpenItem }: RiskQueueScreenProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<RiskQueueItem[]>(() => riskAssessmentQueue.getItems());

  const refresh = useCallback(() => {
    setItems(riskAssessmentQueue.getItems());
  }, []);

  useEffect(() => riskAssessmentQueue.subscribe(refresh), [refresh]);

  useFocusEffect(
    useCallback(() => {
      riskAssessmentQueue.enableBackgroundProcessing();
      refresh();
    }, [refresh]),
  );

  const sections = useMemo(
    () => groupQueueItemsByAddedDate(items),
    [items],
  );

  const processingCount = items.filter((i) => i.status === 'pending' || i.status === 'processing').length;

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <SectionHeader title={t('queue.title')} description={t('queue.description')} />
        {processingCount > 0 ? (
          <View style={styles.banner}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.bannerText}>{t('queue.inProgress', { count: processingCount })}</Text>
          </View>
        ) : null}

        {items.length === 0 ? (
          <Text style={styles.empty}>{t('queue.empty')}</Text>
        ) : (
          sections.map((section) => (
            <View key={section.date} style={styles.section}>
              <Text style={styles.sectionTitle}>{formatQueueDate(section.date)}</Text>
              <View style={styles.grid}>
                {section.items.map((item) => (
                  <QueueThumbnail
                    key={item.id}
                    item={item}
                    onPress={() => onOpenItem(item.id)}
                  />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {onCapture ? (
        <Pressable style={styles.fab} onPress={onCapture} accessibilityLabel={t('queue.captureA11y')}>
          <Text style={styles.fabIcon}>+</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 88 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  empty: { marginHorizontal: 16, color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    width: '31%',
  },
  tilePressed: { opacity: 0.85 },
  tileImageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tileMetaText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tileStatus: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text,
    marginTop: 1,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -2 },
});
