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
 * Builds a graph (edge when score ≥ minScore) and takes connected components,
 * so mutual look-alikes stay together even when neither is close to a single seed.
 */
export function groupQueueItemsBySimilarity<T extends SimilarityGroupable>(
  items: T[],
  options?: { minScore?: number; unindexedLabel?: string },
): { key: string; title: string; items: T[]; seedId?: string }[] {
  const minScore = options?.minScore ?? 0.4;
  const unindexedLabel = options?.unindexedLabel ?? 'Not indexed yet';

  const indexed = items.filter((item) => item.embedding && item.embedding.length >= 8);
  const unindexed = items.filter((item) => !item.embedding || item.embedding.length < 8);

  const n = indexed.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const rank = Array.from({ length: n }, () => 0);

  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    let cur = i;
    while (cur !== root) {
      const next = parent[cur];
      parent[cur] = root;
      cur = next;
    }
    return root;
  };

  const unite = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    if (rank[ra] < rank[rb]) parent[ra] = rb;
    else if (rank[ra] > rank[rb]) parent[rb] = ra;
    else {
      parent[rb] = ra;
      rank[ra] += 1;
    }
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (cosineSimilarity(indexed[i].embedding!, indexed[j].embedding!) >= minScore) {
        unite(i, j);
      }
    }
  }

  const buckets = new Map<number, T[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const list = buckets.get(root) ?? [];
    list.push(indexed[i]);
    buckets.set(root, list);
  }

  const clusters = [...buckets.values()].map((members) => {
    const dim = members[0]?.embedding?.length ?? 0;
    const centroid = new Array(dim).fill(0);
    for (const item of members) {
      const emb = item.embedding!;
      for (let i = 0; i < dim; i++) centroid[i] += emb[i] ?? 0;
    }
    let norm = 0;
    for (let i = 0; i < dim; i++) {
      centroid[i] /= members.length;
      norm += centroid[i] * centroid[i];
    }
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < dim; i++) centroid[i] /= norm;

    const ranked = members
      .map((item) => ({
        item,
        score: cosineSimilarity(centroid, item.embedding!),
      }))
      .sort((a, b) => b.score - a.score);

    const newest = members.reduce((best, item) =>
      item.createdAt > best.createdAt ? item : best,
    );

    return {
      key: `sim-${ranked[0]?.item.id ?? newest.id}`,
      seedId: ranked[0]?.item.id,
      newestAt: newest.createdAt,
      items: ranked.map((row) => row.item),
    };
  });

  clusters.sort((a, b) => b.newestAt.localeCompare(a.newestAt));

  const result: { key: string; title: string; items: T[]; seedId?: string }[] = clusters.map(
    (cluster, index) => ({
      key: cluster.key,
      title: `Group ${index + 1}`,
      seedId: cluster.seedId,
      items: cluster.items,
    }),
  );

  if (unindexed.length > 0) {
    result.push({
      key: 'unindexed',
      title: unindexedLabel,
      items: [...unindexed].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    });
  }

  return result;
}

export function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem > 0 ? `${min}m ${rem}s` : `${min}m`;
}
