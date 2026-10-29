import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Chip,
  Group,
  Loader,
  Select,
  Stack,
  Text,
} from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { IconAlertCircle, IconCheck, IconClock } from '@tabler/icons-react';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { formatFileSize } from '../../../utils/helpers';
import NumberSettingRow from './NumberSettingRow';
import ScheduleNumberRow from './ScheduleNumberRow';
import SettingRow from './SettingRow';
import SettingsGroup from './SettingsGroup';
import SwitchSettingRow from './SwitchSettingRow';
import type { AdminSettingsState, SectionProps } from './useAdminSettings';
import { toSchedulePayload } from './useAdminSettings';
import type { DayOfWeek, SchedulePreset, ScheduleError } from './types';
import {
  DAY_OF_MONTH_RANGE,
  DAYS_OF_WEEK,
  INTERVAL_HOURS_RANGE,
  usesTimeOfDay,
  useScheduleLabels,
} from './useScheduleLabels';
import { useSchedulePreview } from './useSchedulePreview';

/** The preview request for the current drafts, or null when there is nothing valid to preview. */
const previewRequest = (state: AdminSettingsState) => {
  const { scheduleDraft, scheduleError, draft, errors } = state;
  if (!scheduleDraft || scheduleError || scheduleDraft.preset === 'disabled')
    return null;
  const request: Record<string, unknown> = toSchedulePayload(scheduleDraft);
  // Invalid retention drafts fall back to the saved values on the server.
  if (draft && !errors.backup_retention_days)
    request.backup_retention_days = draft.backup_retention_days;
  if (draft && !errors.backup_min_count)
    request.backup_min_count = draft.backup_min_count;
  return request;
};

const BackupsSection = ({ state }: SectionProps) => {
  const { t } = useTranslation(['admin', 'shared']);
  const { presetData, shortDayNames, describeSchedule, lastRunText } =
    useScheduleLabels();
  const { formatDateTime } = useDateFormat() as {
    formatDateTime: (_value: string) => string;
  };
  const { schedule, scheduleDraft, scheduleError } = state;
  const request = previewRequest(state);
  const { preview, loading, failed } = useSchedulePreview(request, schedule);
  const lastRun = schedule ? lastRunText(schedule) : null;
  const backupsUnit = t('settings.units.backups', 'backups');
  const timezone = preview?.timezone ?? schedule?.timezone;

  const rangeError = (error: ScheduleError | null) =>
    error?.code === 'range'
      ? t(
          'settings.errors.outOfRange',
          'Enter a whole number from {{min}} to {{max}}.',
          { min: error.min, max: error.max }
        )
      : undefined;

  return (
    <Stack gap="md">
      <SettingsGroup title={t('backup.schedule.title', 'Auto-Backup Schedule')}>
        {schedule && scheduleDraft ? (
          <>
            <SettingRow
              label={t('backup.schedule.frequency', 'Backup Frequency')}
              description={t(
                'backup.schedule.frequencyDesc',
                'Schedule automatic full backups (database + files)'
              )}
              dirty={schedule.preset !== scheduleDraft.preset}
              control={
                <Select
                  w={200}
                  allowDeselect={false}
                  value={scheduleDraft.preset}
                  data={presetData}
                  onChange={value =>
                    value &&
                    state.updateSchedule({ preset: value as SchedulePreset })
                  }
                  aria-label={t(
                    'backup.schedule.frequency',
                    'Backup Frequency'
                  )}
                />
              }
            />
            {scheduleDraft.preset === 'interval' && (
              <ScheduleNumberRow
                label={t('backup.schedule.intervalHours', 'Run every')}
                description={t(
                  'backup.schedule.intervalHoursDesc',
                  'Hours between backups, up to one week.'
                )}
                value={scheduleDraft.interval_hours}
                savedValue={schedule.interval_hours}
                range={INTERVAL_HOURS_RANGE}
                onChange={interval_hours =>
                  state.updateSchedule({ interval_hours })
                }
                suffix={` ${t('settings.units.hours', 'hours')}`}
                error={rangeError(scheduleError)}
              />
            )}
            {scheduleDraft.preset === 'weekly' && (
              <SettingRow
                label={t('backup.schedule.daysOfWeek', 'Days of Week')}
                description={t(
                  'backup.schedule.daysOfWeekDesc',
                  'Which days should the backup run?'
                )}
                dirty={
                  schedule.days_of_week.join() !==
                  scheduleDraft.days_of_week.join()
                }
                control={
                  <Stack gap={4}>
                    <Chip.Group
                      multiple
                      value={scheduleDraft.days_of_week}
                      onChange={values =>
                        state.updateSchedule({
                          days_of_week: DAYS_OF_WEEK.filter(day =>
                            values.includes(day)
                          ),
                        })
                      }
                    >
                      <Group
                        gap="xs"
                        role="group"
                        aria-label={t(
                          'backup.schedule.daysOfWeek',
                          'Days of Week'
                        )}
                      >
                        {DAYS_OF_WEEK.map((day: DayOfWeek) => (
                          <Chip key={day} value={day} size="sm">
                            {shortDayNames[day]}
                          </Chip>
                        ))}
                      </Group>
                    </Chip.Group>
                    {scheduleError?.code === 'noDays' && (
                      <Text size="xs" c="red">
                        {t('backup.schedule.noDays', 'Pick at least one day.')}
                      </Text>
                    )}
                  </Stack>
                }
              />
            )}
            {scheduleDraft.preset === 'monthly' && (
              <ScheduleNumberRow
                label={t('backup.schedule.dayOfMonth', 'Day of Month')}
                description={t(
                  'backup.schedule.dayOfMonthDesc',
                  'Up to the 28th, so the backup runs every month.'
                )}
                value={scheduleDraft.day_of_month}
                savedValue={schedule.day_of_month}
                range={DAY_OF_MONTH_RANGE}
                onChange={day_of_month =>
                  state.updateSchedule({ day_of_month })
                }
                error={rangeError(scheduleError)}
              />
            )}
            {usesTimeOfDay(scheduleDraft.preset) && (
              <SettingRow
                label={t('backup.schedule.timeOfDay', 'Time of Day')}
                description={
                  <>
                    {t(
                      'backup.schedule.timeOfDayDesc',
                      'When should the backup run? (24-hour format)'
                    )}
                    {timezone && (
                      <>
                        {' '}
                        {t('backup.schedule.timeZone', 'Time zone: {{zone}}', {
                          zone: timezone,
                        })}
                      </>
                    )}
                  </>
                }
                dirty={schedule.time_of_day !== scheduleDraft.time_of_day}
                control={
                  <TimeInput
                    w={170}
                    value={scheduleDraft.time_of_day}
                    onChange={event =>
                      state.updateSchedule({ time_of_day: event.target.value })
                    }
                    leftSection={<IconClock size={16} />}
                    aria-label={t('backup.schedule.timeOfDay', 'Time of Day')}
                  />
                }
              />
            )}
            {request && (
              <div className="setting-row">
                <Stack
                  gap={4}
                  className="setting-row-extra"
                  aria-live="polite"
                  data-testid="schedule-preview"
                >
                  <Group gap="xs">
                    <Text size="sm" fw={500}>
                      {describeSchedule(scheduleDraft)}
                    </Text>
                    {loading && (
                      <Loader
                        size="xs"
                        aria-label={t(
                          'backup.schedule.preview.loading',
                          'Updating preview'
                        )}
                      />
                    )}
                  </Group>
                  {preview && preview.upcoming_runs.length > 0 && (
                    <Text size="sm" c="dimmed">
                      {t(
                        'backup.schedule.preview.nextRuns',
                        'Next runs: {{runs}}',
                        {
                          runs: preview.upcoming_runs
                            .map(run => formatDateTime(run))
                            .join(' · '),
                        }
                      )}
                    </Text>
                  )}
                  {preview?.retained_count != null &&
                    preview.estimated_bytes != null && (
                      <Text size="sm" c="dimmed">
                        {t('backup.schedule.preview.estimate', {
                          count: preview.retained_count,
                          size: formatFileSize(preview.estimated_bytes),
                          defaultValue:
                            'Clean-up keeps about {{count}} scheduled backups, roughly {{size}}.',
                        })}
                        {state.draft?.backup_auto_cleanup_enabled === false &&
                          ` ${t(
                            'backup.schedule.preview.cleanupOff',
                            'Automatic clean-up is off, so until you clean up by hand they add up.'
                          )}`}
                      </Text>
                    )}
                  {failed && (
                    <Text size="sm" c="red">
                      {t(
                        'backup.schedule.preview.failed',
                        'The preview could not be loaded.'
                      )}
                    </Text>
                  )}
                </Stack>
              </div>
            )}
            {lastRun && (
              <div className="setting-row">
                <Alert
                  className="setting-row-extra"
                  variant="light"
                  color={
                    schedule.last_run_status === 'success' ? 'green' : 'red'
                  }
                  icon={
                    schedule.last_run_status === 'success' ? (
                      <IconCheck size={16} />
                    ) : (
                      <IconAlertCircle size={16} />
                    )
                  }
                >
                  {lastRun}
                </Alert>
              </div>
            )}
          </>
        ) : (
          <div className="setting-row">
            <Text size="sm" c="dimmed" className="setting-row-extra">
              {t(
                'settings.backups.scheduleUnavailable',
                'The backup schedule could not be loaded.'
              )}
            </Text>
          </div>
        )}
      </SettingsGroup>

      <SettingsGroup
        title={t('settings.groups.backupCleanup', 'Backup clean-up')}
      >
        <SwitchSettingRow
          state={state}
          settingKey="backup_auto_cleanup_enabled"
          label={t(
            'settings.backups.autoCleanup',
            'Delete old backups automatically'
          )}
          description={t(
            'settings.backups.autoCleanupDesc',
            'After each scheduled backup, delete backups older than the limit below, including ones made by hand.'
          )}
        />
        <NumberSettingRow
          state={state}
          settingKey="backup_retention_days"
          label={t(
            'settings.backups.retentionDays',
            'Delete backups older than'
          )}
          description={t(
            'settings.backups.retentionDaysDesc',
            'Clean-up never goes below the minimum count.'
          )}
          unit={t('settings.units.days', 'days')}
        />
        <NumberSettingRow
          state={state}
          settingKey="backup_min_count"
          label={t('settings.backups.minCount', 'Always keep at least')}
          description={t(
            'settings.backups.minCountDesc',
            "The most recent successful backups are kept regardless of age. Failed attempts don't count."
          )}
          unit={backupsUnit}
        />
        <NumberSettingRow
          state={state}
          settingKey="backup_max_count"
          label={t('settings.backups.maxCount', 'Expected maximum')}
          description={t(
            'settings.backups.maxCountDesc',
            'For reference only. Backups above this number are not deleted or blocked.'
          )}
          unit={backupsUnit}
        />
      </SettingsGroup>

      <Anchor component={Link} to="/admin/backup" size="sm">
        {t(
          'settings.backups.operationsLink',
          'Create, download and restore backups on the Backup Management page'
        )}
      </Anchor>
    </Stack>
  );
};

export default BackupsSection;
