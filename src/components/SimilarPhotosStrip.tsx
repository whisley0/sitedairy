import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { RiskQueuePhoto } from './RiskQueuePhoto';
import type { RiskQueueItem } from '../data/models';
import {
  riskAssessmentQueue,
  type SimilarPhotoHit,
} from '../services/riskAssessmentQueue';
import { formatPhotoTag } from '../utils/photoTags';
import { colors } from '../theme/colors';

interface SimilarPhotosStripProps {
  itemId: string;
  onOpenItem?: (itemId: string) => void;
}

export function SimilarPhotosStrip({ itemId, onOpenItem }: SimilarPhotosStripProps) {
  const { t } = useTranslation();
  const [hits, setHits] = useState<SimilarPhotoHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!riskAssessmentQueue.isSiglipReady()) {
          setDownloading(true);
          await riskAssessmentQueue.downloadSiglip((fraction) => {
            if (!cancelled) {
              setProgress(
                fraction > 0
                  ? t('similarPhotos.downloadingPct', { pct: Math.round(fraction * 100) })
                  : t('similarPhotos.downloading'),
              );
            }
          });
          if (!cancelled) setDownloading(false);
        }
        const next = await riskAssessmentQueue.findSimilarPhotos(itemId, 6);
        if (!cancelled) setHits(next);
      } catch (cause) {
        if (!cancelled) setError(String(cause));
      } finally {
        if (!cancelled) {
          setLoading(false);
          setDownloading(false);
          setProgress('');
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [itemId, t]);

  const applyTags = async (source: RiskQueueItem) => {
    setApplyingId(source.id);
    try {
      await riskAssessmentQueue.applyTagsFromSimilar(itemId, source.id);
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.subtitle}>{t('similarPhotos.subtitle')}</Text>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>
            {downloading ? progress || t('similarPhotos.downloading') : t('similarPhotos.searching')}
          </Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{t('similarPhotos.failed')}</Text> : null}

      {!loading && !error && hits.length === 0 ? (
        <Text style={styles.empty}>{t('similarPhotos.empty')}</Text>
      ) : null}

      {hits.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {hits.map(({ item, score }) => (
            <View key={item.id} style={styles.card}>
              <Pressable
                onPress={() => onOpenItem?.(item.id)}
                disabled={!onOpenItem}
                accessibilityRole="button"
                accessibilityLabel={t('similarPhotos.openA11y')}
              >
                <RiskQueuePhoto
                  uri={item.photoUri}
                  missing={item.photoMissing}
                  compact
                  style={styles.thumb}
                  missingStyle={styles.thumb}
                />
              </Pressable>
              <Text style={styles.score}>{Math.round(score * 100)}%</Text>
              <Text style={styles.tags} numberOfLines={2}>
                {item.tags?.length ? formatPhotoTag(item.tags, t) : t('riskDetail.tagEmpty')}
              </Text>
              <Pressable
                style={styles.applyBtn}
                onPress={() => void applyTags(item)}
                disabled={applyingId === item.id}
              >
                {applyingId === item.id ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="pricetag-outline" size={14} color={colors.primary} />
                    <Text style={styles.applyText}>{t('similarPhotos.applyTags')}</Text>
                  </>
                )}
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 0 },
  subtitle: { fontSize: 13, color: colors.textMuted, marginBottom: 10, lineHeight: 18 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  loadingText: { color: colors.textMuted, fontSize: 13, flex: 1 },
  error: { color: colors.error, fontSize: 13 },
  empty: { color: colors.textMuted, fontSize: 13, paddingVertical: 6 },
  row: { gap: 10, paddingVertical: 4 },
  card: {
    width: 132,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 8,
    gap: 6,
  },
  thumb: {
    width: '100%',
    height: 96,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  score: { fontSize: 12, fontWeight: '700', color: colors.primary },
  tags: { fontSize: 11, color: colors.text, lineHeight: 15, minHeight: 30 },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  applyText: { fontSize: 11, fontWeight: '700', color: colors.primary },
});
