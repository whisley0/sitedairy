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

export function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem > 0 ? `${min}m ${rem}s` : `${min}m`;
}
