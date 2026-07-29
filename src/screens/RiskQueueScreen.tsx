import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Ionicons } from '@expo/vector-icons';
import { HapticPressable } from '../components/HapticPressable';
import { RiskQueuePhoto } from '../components/RiskQueuePhoto';
import { PhotoGpsRow } from '../components/PhotoGpsRow';
import { PhotoBleRow } from '../components/PhotoBleRow';
import { SectionHeader } from '../components/CommonComponents';
import type { RiskQueueItem, RiskQueueStatus } from '../data/models';
import { latestAssessmentResult } from '../data/models';
import { riskAssessmentQueue } from '../services/riskAssessmentQueue';
import {
  formatQueueDate,
  formatQueueTimeShort,
  groupQueueItemsByAddedDate,
  groupQueueItemsByInspectionType,
  groupQueueItemsBySimilarity,
  type QueueGroupMode,
} from '../utils/riskQueueFormat';
import {
  formatClassifierLabel,
  formatPhotoTag,
  resolveInspectionTypeCode,
} from '../utils/photoTags';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

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

function tagMetaLabel(item: RiskQueueItem, t: TFunction): string {
  const domain = item.domain?.trim()
    ? formatClassifierLabel('domain', item.domain, t)
    : '';
  const subject = item.subject?.trim()
    ? formatClassifierLabel('subject', item.subject, t)
    : '';
  if (domain && subject) return `${domain} · ${subject}`;
  if (domain) return domain;
  if (subject) return subject;
  return formatQueueTimeShort(item.createdAt);
}

function inspectionDomainLabel(item: RiskQueueItem, t: TFunction): string {
  const inspectionType = item.inspectionType?.trim()
    ? formatClassifierLabel('inspectionType', item.inspectionType, t)
    : '';
  const domain = item.domain?.trim()
    ? formatClassifierLabel('domain', item.domain, t)
    : '';
  if (inspectionType && domain) return `${inspectionType} · ${domain}`;
  if (inspectionType) return inspectionType;
  if (domain) return domain;
  return t('queue.untagged');
}

function itemLabelHaystack(item: RiskQueueItem, t: TFunction): string {
  const parts = [
    item.inspectionType,
    item.domain,
    item.subject,
    item.labelHint,
    ...(item.tags ?? []),
    item.inspectionType
      ? formatClassifierLabel('inspectionType', item.inspectionType, t)
      : '',
    item.domain ? formatClassifierLabel('domain', item.domain, t) : '',
    item.subject ? formatClassifierLabel('subject', item.subject, t) : '',
    formatPhotoTag(item.tags, t),
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function itemMatchesLabelQuery(item: RiskQueueItem, query: string, t: TFunction): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return itemLabelHaystack(item, t).includes(q);
}

interface QueueThumbnailProps {
  item: RiskQueueItem;
  onPress: () => void;
  groupMode: QueueGroupMode;
}

function QueueThumbnail({ item, onPress, groupMode }: QueueThumbnailProps) {
  const { t } = useTranslation();
  const latest = latestAssessmentResult(item);
  const processing = item.status === 'processing' && !item.halted;

  return (
    <HapticPressable
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
          {groupMode === 'tag'
            ? tagMetaLabel(item, t)
            : groupMode === 'similarity'
              ? t('queue.similarMeta')
              : formatQueueTimeShort(item.createdAt)}
        </Text>
      </View>
      <Text style={styles.tileStatus} numberOfLines={1}>
        {groupMode === 'similarity' ? inspectionDomainLabel(item, t) : statusLabel(item, t)}
      </Text>
      {item.gps ? <PhotoGpsRow gps={item.gps} compact /> : null}
      {item.ble ? <PhotoBleRow ble={item.ble} compact /> : null}
    </HapticPressable>
  );
}

interface GroupModeToggleProps {
  mode: QueueGroupMode;
  onChange: (mode: QueueGroupMode) => void;
}

function GroupModeToggle({ mode, onChange }: GroupModeToggleProps) {
  const { t } = useTranslation();

  const renderOption = (value: QueueGroupMode, label: string, icon: keyof typeof Ionicons.glyphMap) => {
    const active = mode === value;
    return (
      <HapticPressable
        key={value}
        style={[styles.modeOption, active && styles.modeOptionActive]}
        onPress={() => onChange(value)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
      >
        <Ionicons name={icon} size={14} color={active ? colors.primary : colors.textMuted} />
        <Text style={[styles.modeOptionText, active && styles.modeOptionTextActive]}>{label}</Text>
      </HapticPressable>
    );
  };

  return (
    <View style={styles.modeToggle}>
      {renderOption('time', t('queue.groupByTime'), 'time-outline')}
      <View style={styles.modeDivider} />
      {renderOption('tag', t('queue.groupByTag'), 'pricetags-outline')}
      <View style={styles.modeDivider} />
      {renderOption('similarity', t('queue.groupBySimilarity'), 'git-compare-outline')}
    </View>
  );
}

interface RiskQueueScreenProps {
  onCapture?: () => void;
  onOpenItem: (itemId: string) => void;
}

export function RiskQueueScreen({ onCapture, onOpenItem }: RiskQueueScreenProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<RiskQueueItem[]>(() => riskAssessmentQueue.getItems());
  const [groupMode, setGroupMode] = useState<QueueGroupMode>('time');
  const [searchOpen, setSearchOpen] = useState(false);
  const [labelQuery, setLabelQuery] = useState('');
  const [indexing, setIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState('');
  const indexingRef = useRef(false);

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

  const missingEmbeddingCount = useMemo(
    () =>
      items.filter((item) => !item.photoMissing && (!item.embedding || item.embedding.length < 8))
        .length,
    [items],
  );

  const runSimilarityIndex = useCallback(
    async (mode: 'missing' | 'rebuild') => {
      if (indexingRef.current) return;
      indexingRef.current = true;
      setIndexing(true);
      setIndexProgress(
        mode === 'rebuild'
          ? t('queue.resortingSimilarityStart')
          : t('queue.indexingSimilarityStart'),
      );
      try {
        const onProgress = (done: number, total: number) => {
          setIndexProgress(
            mode === 'rebuild'
              ? t('queue.resortingSimilarity', { done, total })
              : t('queue.indexingSimilarity', { done, total }),
          );
        };
        if (mode === 'rebuild') {
          await riskAssessmentQueue.rebuildLibraryEmbeddings(onProgress);
        } else {
          await riskAssessmentQueue.ensureLibraryEmbeddings(onProgress);
        }
      } finally {
        indexingRef.current = false;
        setIndexing(false);
        setIndexProgress('');
        refresh();
      }
    },
    [refresh, t],
  );

  useEffect(() => {
    if (groupMode !== 'similarity' || missingEmbeddingCount === 0 || indexingRef.current) return;
    void runSimilarityIndex('missing');
  }, [groupMode, missingEmbeddingCount, runSimilarityIndex]);

  const handleRefreshSimilarity = useCallback(() => {
    void runSimilarityIndex('rebuild');
  }, [runSimilarityIndex]);

  const filteredItems = useMemo(
    () => items.filter((item) => itemMatchesLabelQuery(item, labelQuery, t)),
    [items, labelQuery, t],
  );
  const labelFilterActive = labelQuery.trim().length > 0;

  const timeSections = useMemo(() => groupQueueItemsByAddedDate(filteredItems), [filteredItems]);
  const tagSections = useMemo(
    () => groupQueueItemsByInspectionType(filteredItems, t('queue.untagged')),
    [filteredItems, t],
  );
  const similaritySections = useMemo(() => {
    const groups = groupQueueItemsBySimilarity(filteredItems, {
      unindexedLabel: t('queue.similarityUnindexed'),
    });
    let similarIndex = 0;
    return groups.map((section) => {
      if (section.key === 'unindexed') {
        return { ...section, title: section.title };
      }
      similarIndex += 1;
      return {
        ...section,
        title: t('queue.similarityGroup', {
          index: similarIndex,
          count: section.items.length,
        }),
      };
    });
  }, [filteredItems, t]);

  const processingCount = items.filter((i) => i.status === 'pending' || i.status === 'processing').length;

  const renderGrid = (sectionItems: RiskQueueItem[]) => (
    <View style={styles.grid}>
      {sectionItems.map((item) => (
        <QueueThumbnail
          key={item.id}
          item={item}
          groupMode={groupMode}
          onPress={() => onOpenItem(item.id)}
        />
      ))}
    </View>
  );

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <SectionHeader title={t('queue.title')} />
          </View>
          {items.length > 0 ? (
            <HapticPressable
              style={styles.searchToggle}
              onPress={() => setSearchOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel={
                searchOpen ? t('queue.hideLabelSearchA11y') : t('queue.showLabelSearchA11y')
              }
              accessibilityState={{ expanded: searchOpen }}
            >
              <Ionicons
                name={searchOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={labelFilterActive ? colors.primary : colors.textMuted}
              />
              {labelFilterActive ? <View style={styles.searchActiveDot} /> : null}
            </HapticPressable>
          ) : null}
        </View>

        {searchOpen && items.length > 0 ? (
          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={labelQuery}
              onChangeText={setLabelQuery}
              placeholder={t('queue.labelSearchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              returnKeyType="search"
            />
            {labelQuery.length > 0 ? (
              <HapticPressable
                onPress={() => setLabelQuery('')}
                accessibilityRole="button"
                accessibilityLabel={t('queue.clearLabelSearchA11y')}
                hitSlop={8}
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </HapticPressable>
            ) : null}
          </View>
        ) : null}

        {items.length > 0 ? (
          <View style={styles.modeRow}>
            <GroupModeToggle mode={groupMode} onChange={setGroupMode} />
            {groupMode === 'similarity' ? (
              <HapticPressable
                style={[styles.refreshBtn, indexing && styles.refreshBtnDisabled]}
                onPress={handleRefreshSimilarity}
                disabled={indexing}
                accessibilityRole="button"
                accessibilityLabel={t('queue.refreshSimilarityA11y')}
              >
                {indexing ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Ionicons name="refresh" size={16} color={colors.primary} />
                )}
                <Text style={styles.refreshBtnText}>{t('queue.refreshSimilarity')}</Text>
              </HapticPressable>
            ) : null}
          </View>
        ) : null}

        {processingCount > 0 ? (
          <View style={styles.banner}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.bannerText}>{t('queue.inProgress', { count: processingCount })}</Text>
          </View>
        ) : null}

        {indexing ? (
          <View style={styles.banner}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.bannerText}>
              {indexProgress || t('queue.indexingSimilarityStart')}
            </Text>
          </View>
        ) : null}

        {items.length === 0 ? (
          <Text style={styles.empty}>{t('queue.empty')}</Text>
        ) : filteredItems.length === 0 ? (
          <Text style={styles.empty}>{t('queue.labelSearchEmpty')}</Text>
        ) : groupMode === 'time' ? (
          timeSections.map((section) => (
            <View key={section.date} style={styles.section}>
              <Text style={styles.sectionTitle}>{formatQueueDate(section.date)}</Text>
              {renderGrid(section.items)}
            </View>
          ))
        ) : groupMode === 'tag' ? (
          tagSections.map((section) => (
            <View key={section.key} style={styles.section}>
              <Text style={styles.sectionTitle}>
                {resolveInspectionTypeCode(section.title)
                  ? formatClassifierLabel('inspectionType', section.title, t)
                  : section.title}
              </Text>
              {renderGrid(section.items)}
            </View>
          ))
        ) : (
          similaritySections.map((section) => (
            <View key={section.key} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {renderGrid(section.items)}
            </View>
          ))
        )}
      </ScrollView>

      {onCapture ? (
        <HapticPressable style={styles.fab} onPress={onCapture} accessibilityLabel={t('queue.captureA11y')}>
          <Text style={styles.fabIcon}>+</Text>
        </HapticPressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 88 },
  headerRow: {
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerText: {
    flex: 1,
  },
  searchToggle: {
    marginTop: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchActiveDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  searchRow: {
    marginHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 4,
  },
  modeRow: {
    marginHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  refreshBtnDisabled: { opacity: 0.6 },
  refreshBtnText: { color: colors.primary, fontWeight: '800', fontSize: 12 },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modeOptionActive: {
    backgroundColor: '#E3F2FD',
  },
  modeOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  modeOptionTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  modeDivider: {
    width: 1,
    height: 14,
    backgroundColor: colors.border,
  },
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
    fontSize: typography.headline,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 10,
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
    fontSize: typography.sm,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tileStatus: {
    fontSize: typography.sm,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
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
