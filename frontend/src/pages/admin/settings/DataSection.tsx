import { useTranslation } from 'react-i18next';
import NumberSettingRow from './NumberSettingRow';
import SettingsGroup from './SettingsGroup';
import type { SectionProps } from './useAdminSettings';

const DataSection = ({ state }: SectionProps) => {
  const { t } = useTranslation('admin');
  const days = t('settings.units.days', 'days');

  return (
    <SettingsGroup title={t('settings.groups.retention', 'Retention')}>
      <NumberSettingRow
        state={state}
        settingKey="trash_retention_days"
        label={t(
          'settings.dataRetention.trashRetention',
          'Keep deleted files in trash for'
        )}
        description={t(
          'settings.dataRetention.trashRetentionDesc',
          'After this, files in the trash are deleted for good.'
        )}
        unit={days}
      />
      <NumberSettingRow
        state={state}
        settingKey="activity_log_retention_days"
        label={t(
          'settings.dataRetention.activityLogRetention',
          'Keep activity history for'
        )}
        description={t(
          'settings.dataRetention.activityLogRetentionDesc',
          'When a limit is set, entries older than it, including sign-ins and their IP addresses, are deleted once a day. They also disappear from the Audit Log and Recent Activity.'
        )}
        unit={days}
        foreverOffValue={365}
      />
      <NumberSettingRow
        state={state}
        settingKey="notification_history_retention_days"
        label={t(
          'settings.dataRetention.notificationHistoryRetention',
          'Keep notification history for'
        )}
        description={t(
          'settings.dataRetention.notificationHistoryRetentionDesc',
          'When a limit is set, sent notifications older than it are deleted once a day, including from each user’s notification history in their settings.'
        )}
        unit={days}
        foreverOffValue={90}
      />
    </SettingsGroup>
  );
};

export default DataSection;
