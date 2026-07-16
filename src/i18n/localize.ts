import type { TFunction } from 'i18next';
import type { EmergencyEscalation, SiteTask } from '../data/models';

export function localizeSiteTask(task: SiteTask, t: TFunction): SiteTask {
  const key = `mock.tasks.${task.id}`;
  const title = t(`${key}.title`, { defaultValue: task.title });
  const description = t(`${key}.description`, { defaultValue: task.description });
  if (title === task.title && description === task.description) {
    return task;
  }
  return { ...task, title, description };
}

export function localizeSiteTasks(tasks: SiteTask[], t: TFunction): SiteTask[] {
  return tasks.map((task) => localizeSiteTask(task, t));
}

export function localizeEscalation(escalation: EmergencyEscalation, t: TFunction): EmergencyEscalation {
  const key = `mock.escalations.${escalation.id}`;
  const title = t(`${key}.title`, { defaultValue: escalation.title });
  const description = t(`${key}.description`, { defaultValue: escalation.description });
  if (title === escalation.title && description === escalation.description) {
    return escalation;
  }
  return { ...escalation, title, description };
}

export function localizeEscalations(
  escalations: EmergencyEscalation[],
  t: TFunction,
): EmergencyEscalation[] {
  return escalations.map((escalation) => localizeEscalation(escalation, t));
}

export function formatTaskStatus(status: SiteTask['status'], t: TFunction): string {
  return t(`taskStatus.${status}`, { defaultValue: status.replace('_', ' ') });
}

export function formatEscalationStatus(status: EmergencyEscalation['status'], t: TFunction): string {
  return t(`escalationStatus.${status}`, { defaultValue: status });
}

export function formatTargetTeam(team: string, t: TFunction): string {
  if (team === 'Upper Management') return t('common.upperManagement');
  return team;
}
