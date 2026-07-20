import type { TFunction } from 'i18next';
import type { SiteTask } from '../data/models';
import {
  taskDurationDays,
  taskNextCheckInNumber,
  taskRequiresMultipleCheckIns,
} from './taskProgress';

export function taskCompleteButtonLabel(task: SiteTask, t: TFunction): string {
  const multiDay = taskRequiresMultipleCheckIns(task);
  const nextCheckIn = taskNextCheckInNumber(task);
  const totalCheckIns = taskDurationDays(task);
  const isFinalCheckIn = multiDay && nextCheckIn === totalCheckIns;

  if (multiDay) {
    return isFinalCheckIn
      ? t('taskComplete.submitFinal', { current: nextCheckIn, total: totalCheckIns })
      : t('taskComplete.submitCheckIn', { current: nextCheckIn, total: totalCheckIns });
  }

  return t('taskComplete.markDone');
}
