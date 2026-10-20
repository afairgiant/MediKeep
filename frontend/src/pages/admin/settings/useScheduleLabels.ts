import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDateFormat } from '../../../hooks/useDateFormat';
import type { ScheduleConfig } from './types';

/** Presets that run at a set time of day, so time (and for weekly, day) apply. */
export const isTimedPreset = (preset: string | null | undefined): boolean =>
  preset === 'daily' || preset === 'weekly';

/** Translated labels for the auto-backup schedule, shared by the settings and backup pages. */
export const useScheduleLabels = () => {
  const { t } = useTranslation(['admin', 'shared']);
  const { formatDateTime } = useDateFormat() as {
    formatDateTime: (_value: string) => string;
  };

  const presetData = useMemo(
    () => [
      { value: 'disabled', label: t('shared:labels.disabled', 'Disabled') },
      {
        value: 'every_6_hours',
        label: t('backup.schedule.presets.every6Hours', 'Every 6 hours'),
      },
      {
        value: 'every_12_hours',
        label: t('backup.schedule.presets.every12Hours', 'Every 12 hours'),
      },
      { value: 'daily', label: t('backup.schedule.presets.daily', 'Daily') },
      { value: 'weekly', label: t('shared:labels.weekly', 'Weekly') },
    ],
    [t]
  );

  const dayData = useMemo(
    () => [
      { value: 'mon', label: t('backup.schedule.days.mon', 'Monday') },
      { value: 'tue', label: t('backup.schedule.days.tue', 'Tuesday') },
      { value: 'wed', label: t('backup.schedule.days.wed', 'Wednesday') },
      { value: 'thu', label: t('backup.schedule.days.thu', 'Thursday') },
      { value: 'fri', label: t('backup.schedule.days.fri', 'Friday') },
      { value: 'sat', label: t('backup.schedule.days.sat', 'Saturday') },
      { value: 'sun', label: t('backup.schedule.days.sun', 'Sunday') },
    ],
    [t]
  );

  const nextRunText = useCallback(
    (schedule: ScheduleConfig): string | null =>
      schedule.enabled && schedule.next_run_at
        ? `${t('backup.schedule.nextScheduledRun', 'Next Scheduled Run')}: ${formatDateTime(schedule.next_run_at)}`
        : null,
    [t, formatDateTime]
  );

  const lastRunText = useCallback(
    (schedule: ScheduleConfig): string | null => {
      if (!schedule.last_run_at) return null;
      const outcome =
        schedule.last_run_status === 'success'
          ? t('backup.schedule.completedSuccessfully', 'Completed successfully')
          : t('backup.schedule.failed', 'Failed: {{error}}', {
              error:
                schedule.last_run_error ||
                t('backup.schedule.unknownError', 'Unknown error'),
            });
      return `${t('backup.schedule.lastBackup', 'Last backup:')} ${formatDateTime(schedule.last_run_at)} — ${outcome}`;
    },
    [t, formatDateTime]
  );

  return { presetData, dayData, nextRunText, lastRunText };
};
