import React from 'react';
import { useTranslation } from 'react-i18next';
import { Switch, Tooltip } from '@mantine/core';

interface AdvancedModeSwitchProps {
  checked: boolean;
  onChange: (_checked: boolean) => void;
  disabled?: boolean;
}

const AdvancedModeSwitch: React.FC<AdvancedModeSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
}) => {
  const { t } = useTranslation(['labresults']);

  return (
    <Tooltip
      label={t(
        'labresults:advancedModeDescription',
        'Show all tabs (relationships, notes, files) when creating a new lab result'
      )}
      multiline
      w={260}
      withArrow
    >
      <Switch
        size="sm"
        label={t('labresults:advancedMode', 'Advanced mode')}
        checked={checked}
        onChange={e => onChange(e.currentTarget.checked)}
        disabled={disabled}
      />
    </Tooltip>
  );
};

export default AdvancedModeSwitch;
