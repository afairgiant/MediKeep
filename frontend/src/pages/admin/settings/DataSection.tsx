import { useTranslation } from 'react-i18next';
import NumberSettingRow from './NumberSettingRow';
import SettingsGroup from './SettingsGroup';
import type { SectionProps } from './useAdminSettings';

const DataSection = ({ state }: SectionProps) => {
  const { t } = useTranslation('admin');

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
        unit={t('settings.units.days', 'days')}
      />
    </SettingsGroup>
  );
};

export default DataSection;
