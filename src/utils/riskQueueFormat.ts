import { resolveInspectionTypeCode } from './photoTags';
import { cosineSimilarity } from '../native/siglip/similarity';

export function formatQueueTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatQueueDate(dateKey: string) {
  const d = new Date(`${dateKey}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatQueueTimeShort(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function queueAddedDateKey(iso: string): string {
  return iso.slice(0, 10);
}

export function groupQueueItemsByAddedDate<T extends { createdAt: string }>(
  items: T[],
): { date: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = queueAddedDateKey(item.createdAt);
    const group = map.get(key) ?? [];
    group.push(item);
    map.set(key, group);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, groupItems]) => ({ date, items: groupItems }));
}

export type QueueGroupMode = 'time' | 'tag' | 'similarity';

type TagGroupable = {
  createdAt: string;
  inspectionType?: string;
  labelHint?: string;
  domain?: string;
  subject?: string;
  tags?: string[];
};

type SimilarityGroupable = {
  id: string;
  createdAt: string;
  embedding?: number[];
};

function resolveItemInspectionType(item: TagGroupable): string {
  const fromField = item.inspectionType?.trim() || item.labelHint?.trim();
  if (fromField) return fromField;
  const firstTag = item.tags?.[0]?.trim();
  return firstTag || '';
}

function inspectionGroupKey(item: TagGroupable, untaggedLabel: string): string {
  const raw = resolveItemInspectionType(item);
  if (!raw) return untaggedLabel;
  return resolveInspectionTypeCode(raw) || raw;
}

function compareLocale(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

/** Group by inspection type code; sort within each group by domain → subject → time. */
export function groupQueueItemsByInspectionType<T extends TagGroupable>(
  items: T[],
  untaggedLabel = 'Untagged',
): { key: string; title: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = inspectionGroupKey(item, untaggedLabel);
    const group = map.get(key) ?? [];
    group.push(item);
    map.set(key, group);
  }

  return [...map.entries()]
    .sort((a, b) => {
      if (a[0] === untaggedLabel) return 1;
      if (b[0] === untaggedLabel) return -1;
      return compareLocale(a[0], b[0]);
    })
    .map(([key, groupItems]) => ({
      key,
      title: key,
      items: [...groupItems].sort((a, b) => {
        const domainCmp = compareLocale(a.domain?.trim() ?? '', b.domain?.trim() ?? '');
        if (domainCmp !== 0) return domainCmp;
        const subjectCmp = compareLocale(a.subject?.trim() ?? '', b.subject?.trim() ?? '');
        if (subjectCmp !== 0) return subjectCmp;
        return b.createdAt.localeCompare(a.createdAt);
      }),
    }));
}

/**
 * Cluster gallery photos by SigLIP cosine similarity.
 * Newest unassigned photo becomes a seed; others above minScore join that cluster.
 */
export function groupQueueItemsBySimilarity<T extends SimilarityGroupable>(
  items: T[],
  options?: { minScore?: number; unindexedLabel?: string },
): { key: string; title: string; items: T[]; seedId?: string }[] {
  const minScore = options?.minScore ?? 0.42;
  const unindexedLabel = options?.unindexedLabel ?? 'Not indexed yet';

  const indexed = items.filter((item) => item.embedding && item.embedding.length >= 8);
  const unindexed = items.filter((item) => !item.embedding || item.embedding.length < 8);

  const pool = [...indexed].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const clusters: { key: string; title: string; items: T[]; seedId?: string }[] = [];
  let clusterIndex = 1;

  while (pool.length > 0) {
    const seed = pool.shift()!;
    const members: { item: T; score: number }[] = [{ item: seed, score: 1 }];

    for (let i = pool.length - 1; i >= 0; i--) {
      const candidate = pool[i];
      const score = cosineSimilarity(seed.embedding!, candidate.embedding!);
      if (score >= minScore) {
        members.push({ item: candidate, score });
        pool.splice(i, 1);
      }
    }

    members.sort((a, b) => b.score - a.score);
    clusters.push({
      key: `sim-${seed.id}`,
      title: `Group ${clusterIndex}`,
      seedId: seed.id,
      items: members.map((row) => row.item),
    });
    clusterIndex += 1;
  }

  if (unindexed.length > 0) {
    clusters.push({
      key: 'unindexed',
      title: unindexedLabel,
      items: [...unindexed].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    });
  }

  return clusters;
}

export function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem > 0 ? `${min}m ${rem}s` : `${min}m`;
}
