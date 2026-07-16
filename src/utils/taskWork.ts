import type { SiteTask, TaskPhoto } from '../data/models';

export function sortTaskPhotos(photos: TaskPhoto[]): TaskPhoto[] {
  return [...photos].sort(
    (a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime(),
  );
}

export function deriveWorkTimesFromPhotos(photos: TaskPhoto[]): {
  workStartedAt?: string;
  workEndedAt?: string;
} {
  const sorted = sortTaskPhotos(photos);
  if (!sorted.length) return {};
  return {
    workStartedAt: sorted[0].uploadedAt,
    workEndedAt: sorted[sorted.length - 1].uploadedAt,
  };
}

export function recomputeTaskWorkTimes(task: SiteTask): SiteTask {
  const photos = task.photos ?? [];
  if (!photos.length) {
    if (!task.workStartedAtManual) task.workStartedAt = undefined;
    if (!task.workEndedAtManual) task.workEndedAt = undefined;
    return task;
  }

  const derived = deriveWorkTimesFromPhotos(photos);
  if (!task.workStartedAtManual && derived.workStartedAt) {
    task.workStartedAt = derived.workStartedAt;
  }
  if (!task.workEndedAtManual && derived.workEndedAt) {
    task.workEndedAt = derived.workEndedAt;
  }

  const sorted = sortTaskPhotos(photos);
  task.confirmationPhotoUri = sorted[sorted.length - 1]?.uri;
  return task;
}

export function formatTaskDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Editable `YYYY-MM-DD HH:mm` (24h) for manual datetime fields. */
export function formatTaskDateTimeForEdit(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseTaskDateTimeInput(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const normalized = trimmed.replace('T', ' ');
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!match) return undefined;

  const [, year, month, day, hour = '00', minute = '00'] = match;
  const d = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0,
  );
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export function taskPhotoCount(task: SiteTask): number {
  return task.photos?.length ?? 0;
}
