import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDateFormat } from '../../../hooks/useDateFormat';
import type { DayOfWeek, ScheduleConfig, ScheduleDraft } from './types';

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];
export const INTERVAL_HOURS_RANGE = { min: 1, max: 168 };
// Every month has a 28th, so a monthly backup is never skipped.
export const DAY_OF_MONTH_RANGE = { min: 1, max: 28 };

// 2024-01-01 was a Monday.
const A_MONDAY = Date.UTC(2024, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

/** Presets that run at a set time of day. */
export const usesTimeOfDay = (preset: string | null | undefined): boolean =>
  preset === 'daily' || preset === 'weekly' || preset === 'monthly';

/** Translated labels for the auto-backup schedule, shared by the admin pages. */
export const useScheduleLabels = () => {
  const { t, i18n } = useTranslation(['admin', 'shared']);
  const { formatDateTime } = useDateFormat() as {
    formatDateTime: (_value: string) => string;
  };

  const presetData = useMemo(
    () => [
      { value: 'disabled', label: t('shared:labels.disabled', 'Disabled') },
      {
        value: 'interval',
        label: t('backup.schedule.presets.interval', 'Every N hours'),
      },
      { value: 'daily', label: t('backup.schedule.presets.daily', 'Daily') },
      { value: 'weekly', label: t('shared:labels.weekly', 'Weekly') },
      {
        value: 'monthly',
        label: t('backup.schedule.presets.monthly', 'Monthly'),
      },
    ],
    [t]
  );

  const shortDayNames = useMemo(() => {
    const format = new Intl.DateTimeFormat(i18n.language, {
      weekday: 'short',
      timeZone: 'UTC',
    });
    return Object.fromEntries(
      DAYS_OF_WEEK.map((day, i) => [day, format.format(A_MONDAY + i * DAY_MS)])
    ) as Record<DayOfWeek, string>;
  }, [i18n.language]);

  /** One-line summary such as "Mon, Wed, Fri at 02:00". */
  const describeSchedule = useCallback(
    (schedule: ScheduleDraft): string => {
      const time = schedule.time_of_day;
      switch (schedule.preset) {
        case 'interval':
          if (schedule.interval_hours === 1)
            return t('backup.schedule.summary.hourly', 'Every hour');
          return t('backup.schedule.summary.interval', {
            count: Number(schedule.interval_hours),
            defaultValue: 'Every {{count}} hours',
          });
        case 'daily':
          return t('backup.schedule.summary.daily', 'Daily at {{time}}', {
            time,
          });
        case 'weekly':
          return t('backup.schedule.summary.weekly', '{{days}} at {{time}}', {
            days: schedule.days_of_week
              .map(day => shortDayNames[day])
              .join(', '),
            time,
          });
        case 'monthly':
          return t(
            'backup.schedule.summary.monthly',
            'Monthly on day {{day}} at {{time}}',
            { day: schedule.day_of_month, time }
          );
        default:
          return t('shared:labels.disabled', 'Disabled');
      }
    },
    [t, shortDayNames]
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

  return {
    presetData,
    shortDayNames,
    describeSchedule,
    nextRunText,
    lastRunText,
  };
};
