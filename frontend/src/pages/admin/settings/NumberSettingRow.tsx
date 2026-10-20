import { useTranslation } from 'react-i18next';
import { NumberInput } from '@mantine/core';
import SettingRow from './SettingRow';
import type { AdminSettingsState } from './useAdminSettings';
import type { NumberSettingKey } from './types';

interface NumberSettingRowProps {
  state: AdminSettingsState;
  settingKey: NumberSettingKey;
  label: string;
  description: string;
  unit: string;
}

const NumberSettingRow = ({
  state,
  settingKey,
  label,
  description,
  unit,
}: NumberSettingRowProps) => {
  const { t } = useTranslation('admin');
  const setting = state.settings?.[settingKey];
  if (!setting || !state.draft) return null;

  const fieldError = state.errors[settingKey];
  let errorText: string | undefined;
  if (fieldError?.code === 'range') {
    errorText = t(
      'settings.errors.outOfRange',
      'Enter a whole number from {{min}} to {{max}}.',
      { min: setting.min, max: setting.max }
    );
  } else if (fieldError?.code === 'minAboveMax') {
    errorText = t(
      'settings.errors.minAboveMax',
      'Must be no more than the maximum backup count.'
    );
  }

  const value = state.draft[settingKey];

  return (
    <SettingRow
      label={label}
      description={description}
      state={setting}
      dirty={state.dirtyKeys.includes(settingKey)}
      pendingReset={state.resets.has(settingKey)}
      onReset={() => state.reset(settingKey)}
      control={
        <NumberInput
          w={170}
          min={setting.min ?? undefined}
          max={setting.max ?? undefined}
          allowDecimal={false}
          allowNegative={false}
          clampBehavior="none"
          value={typeof value === 'number' ? value : ''}
          onChange={next =>
            state.setValue(settingKey, typeof next === 'number' ? next : '')
          }
          suffix={` ${unit}`}
          error={errorText}
          aria-label={label}
        />
      }
    />
  );
};

export default NumberSettingRow;
