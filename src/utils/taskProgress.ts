import type { SiteTask } from '../data/models';
import i18n from '../i18n';

export function taskDurationDays(task: SiteTask): number {
  return Math.max(1, task.durationDays ?? 1);
}

export function taskCompletionCount(task: SiteTask): number {
  if (task.completionRecords?.length) {
    return task.completionRecords.length;
  }
  return task.status === 'COMPLETED' ? taskDurationDays(task) : 0;
}

export function taskIsFullyComplete(task: SiteTask): boolean {
  return taskCompletionCount(task) >= taskDurationDays(task);
}

/** True when the task is incomplete and its due date is before today. */
export function taskIsLate(task: SiteTask): boolean {
  if (taskIsFullyComplete(task)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${task.dueDate}T00:00:00`);
  return due.getTime() < today.getTime();
}

/** Late tasks first, then by due date ascending. */
export function sortTasksLateFirst(tasks: SiteTask[]): SiteTask[] {
  return [...tasks].sort((a, b) => {
    const aLate = taskIsLate(a);
    const bLate = taskIsLate(b);
    if (aLate !== bLate) return aLate ? -1 : 1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}

export function taskProgressRatio(task: SiteTask): number {
  const total = taskDurationDays(task);
  return Math.min(1, taskCompletionCount(task) / total);
}

export function taskRequiresMultipleCheckIns(task: SiteTask): boolean {
  return taskDurationDays(task) > 1;
}

export function taskCheckInLabel(task: SiteTask): string {
  const count = taskCompletionCount(task);
  const total = taskDurationDays(task);
  return i18n.t('taskCard.checkIns', { count, total });
}

export function taskNextCheckInNumber(task: SiteTask): number {
  return Math.min(taskCompletionCount(task) + 1, taskDurationDays(task));
}
