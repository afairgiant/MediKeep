import { useTranslation } from 'react-i18next';
import SettingsGroup from './SettingsGroup';
import SwitchSettingRow from './SwitchSettingRow';
import type { SectionProps } from './useAdminSettings';

const GeneralSection = ({ state }: SectionProps) => {
  const { t } = useTranslation('admin');

  return (
    <SettingsGroup title={t('settings.groups.updates', 'Updates')}>
      <SwitchSettingRow
        state={state}
        settingKey="release_check_enabled"
        label={t('settings.updates.releaseCheck', 'Check for updates')}
        description={t(
          'settings.updates.releaseCheckDesc',
          'Shows signed-in users when a newer MediKeep version is out, in the page footer and next to the version number in their settings.'
        )}
      />
      <SwitchSettingRow
        state={state}
        settingKey="whats_new_popup_enabled"
        label={t(
          'settings.updates.whatsNewPopup',
          'Show release notes after an upgrade'
        )}
        description={t(
          'settings.updates.whatsNewPopupDesc',
          'Opens the notes for the new version once for each user, the first time they sign in after an upgrade.'
        )}
      />
    </SettingsGroup>
  );
};

export default GeneralSection;
