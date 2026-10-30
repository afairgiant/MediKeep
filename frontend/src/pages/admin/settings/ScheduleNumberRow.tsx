import type { ReactNode } from 'react';
import { NumberInput } from '@mantine/core';
import SettingRow from './SettingRow';

interface ScheduleNumberRowProps {
  label: string;
  description: ReactNode;
  value: number | '';
  savedValue: number;
  range: { min: number; max: number };
  onChange: (_value: number | '') => void;
  suffix?: string;
  error?: string;
}

/** A whole-number schedule field; an empty input reports ''. */
const ScheduleNumberRow = ({
  label,
  description,
  value,
  savedValue,
  range,
  onChange,
  suffix,
  error,
}: ScheduleNumberRowProps) => (
  <SettingRow
    label={label}
    description={description}
    dirty={savedValue !== value}
    control={
      <NumberInput
        w={170}
        min={range.min}
        max={range.max}
        allowDecimal={false}
        allowNegative={false}
        clampBehavior="none"
        value={value}
        onChange={next => onChange(typeof next === 'number' ? next : '')}
        suffix={suffix}
        error={error}
        aria-label={label}
      />
    }
  />
);

export default ScheduleNumberRow;
