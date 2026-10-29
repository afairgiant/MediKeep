import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Alert, Anchor, Select, Stack, Text } from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { IconAlertCircle, IconCheck, IconClock } from '@tabler/icons-react';
import NumberSettingRow from './NumberSettingRow';
import SettingRow from './SettingRow';
import SettingsGroup from './SettingsGroup';
import SwitchSettingRow from './SwitchSettingRow';
import type { SectionProps } from './useAdminSettings';
import type { SchedulePreset } from './types';
import { isTimedPreset, useScheduleLabels } from './useScheduleLabels';

const BackupsSection = ({ state }: SectionProps) => {
  const { t } = useTranslation(['admin', 'shared']);
  const { presetData, dayData, nextRunText, lastRunText } = useScheduleLabels();
  const { schedule, scheduleDraft } = state;
  const nextRun = schedule ? nextRunText(schedule) : null;
  const lastRun = schedule ? lastRunText(schedule) : null;
  const backupsUnit = t('settings.units.backups', 'backups');

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
            {isTimedPreset(scheduleDraft.preset) && (
              <SettingRow
                label={t('backup.schedule.timeOfDay', 'Time of Day')}
                description={t(
                  'backup.schedule.timeOfDayDesc',
                  'When should the backup run? (24-hour format)'
                )}
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
            {scheduleDraft.preset === 'weekly' && (
              <SettingRow
                label={t('backup.schedule.dayOfWeek', 'Day of Week')}
                description={t(
                  'backup.schedule.dayOfWeekDesc',
                  'Which day should the weekly backup run?'
                )}
                dirty={schedule.day_of_week !== scheduleDraft.day_of_week}
                control={
                  <Select
                    w={170}
                    allowDeselect={false}
                    value={scheduleDraft.day_of_week}
                    data={dayData}
                    onChange={value =>
                      value && state.updateSchedule({ day_of_week: value })
                    }
                    aria-label={t('backup.schedule.dayOfWeek', 'Day of Week')}
                  />
                }
              />
            )}
            {(nextRun || lastRun) && (
              <div className="setting-row">
                <Stack gap="xs" className="setting-row-extra">
                  {nextRun && (
                    <Text size="sm" c="dimmed">
                      {nextRun}
                    </Text>
                  )}
                  {lastRun && (
                    <Alert
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
                  )}
                </Stack>
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
