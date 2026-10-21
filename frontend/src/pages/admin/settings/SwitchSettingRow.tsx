import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@mantine/core';
import SettingRow from './SettingRow';
import type { AdminSettingsState } from './useAdminSettings';
import type { BoolSettingKey } from './types';

interface SwitchSettingRowProps {
  state: AdminSettingsState;
  settingKey: BoolSettingKey;
  label: string;
  description: ReactNode;
  children?: ReactNode;
}

const SwitchSettingRow = ({
  state,
  settingKey,
  label,
  description,
  children,
}: SwitchSettingRowProps) => {
  const { t } = useTranslation('shared');
  const setting = state.settings?.[settingKey];
  if (!setting || !state.draft) return null;

  return (
    <SettingRow
      label={label}
      description={description}
      state={setting}
      dirty={state.dirtyKeys.includes(settingKey)}
      pendingReset={state.resets.has(settingKey)}
      onReset={() => state.reset(settingKey)}
      formatValue={value =>
        value
          ? t('labels.enabled', 'Enabled')
          : t('labels.disabled', 'Disabled')
      }
      control={
        <Switch
          size="md"
          checked={state.draft[settingKey] === true}
          onChange={event =>
            state.setValue(settingKey, event.currentTarget.checked)
          }
          aria-label={label}
        />
      }
    >
      {children}
    </SettingRow>
  );
};

export default SwitchSettingRow;
