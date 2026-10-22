import { useTranslation } from 'react-i18next';
import { Checkbox, Group, NumberInput } from '@mantine/core';
import SettingRow from './SettingRow';
import type { AdminSettingsState } from './useAdminSettings';
import type { NumberSettingKey, SettingValue } from './types';

interface NumberSettingRowProps {
  state: AdminSettingsState;
  settingKey: NumberSettingKey;
  label: string;
  description: string;
  unit: string;
  /** Value filled in when "Keep forever" is unticked; only used when the setting allows 0. */
  foreverOffValue?: number;
}

const NumberSettingRow = ({
  state,
  settingKey,
  label,
  description,
  unit,
  foreverOffValue,
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
  const allowsForever = setting.zero_means_forever;
  const forever = allowsForever && value === 0;
  const foreverLabel = t('settings.dataRetention.keepForever', 'Keep forever');
  const formatValue = (v: SettingValue) =>
    allowsForever && v === 0 ? foreverLabel : `${v} ${unit}`;

  const input = (
    <NumberInput
      w={170}
      min={setting.min ?? undefined}
      max={setting.max ?? undefined}
      allowDecimal={false}
      allowNegative={false}
      clampBehavior="none"
      value={!forever && typeof value === 'number' ? value : ''}
      onChange={next =>
        state.setValue(settingKey, typeof next === 'number' ? next : '')
      }
      suffix={` ${unit}`}
      error={errorText}
      disabled={forever}
      aria-label={label}
    />
  );

  return (
    <SettingRow
      label={label}
      description={description}
      state={setting}
      dirty={state.dirtyKeys.includes(settingKey)}
      pendingReset={state.resets.has(settingKey)}
      onReset={() => state.reset(settingKey)}
      formatValue={formatValue}
      control={
        allowsForever ? (
          <Group gap="sm" wrap="nowrap" align="center">
            {input}
            <Checkbox
              label={foreverLabel}
              checked={forever}
              onChange={event =>
                state.setValue(
                  settingKey,
                  event.currentTarget.checked
                    ? 0
                    : (foreverOffValue ?? setting.min ?? 1)
                )
              }
            />
          </Group>
        ) : (
          input
        )
      }
    />
  );
};

export default NumberSettingRow;
