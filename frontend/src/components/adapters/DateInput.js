import React from 'react';
import { DateInput as MantineDateInput } from '@mantine/dates';
import OldDateInput from '../ui/DateInput';

export const DateInput = ({
  useMantine = true,
  label,
  name,
  value,
  onChange,
  onBlur,
  error,
  required = false,
  disabled = false,
  placeholder,
  className = '',
  helpText,
  ...props
}) => {
  // Easy toggle - if something breaks, just set useMantine=false
  if (!useMantine) {
    return (
      <OldDateInput
        value={value}
        onChange={val => onChange({ target: { name, value: val } })}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        {...props}
      />
    );
  }

  // Handle the change event to match form expectations
  const handleChange = date => {
    let formattedDate = '';
    if (date) {
      // Use local date formatting to avoid timezone issues with toISOString()
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      formattedDate = `${year}-${month}-${day}`;
    }
    const syntheticEvent = {
      target: {
        name: name,
        value: formattedDate,
      },
    };
    onChange(syntheticEvent);
  };

  // Convert string value to Date object for Mantine
  // For date-only strings like "1990-01-15", create Date in local timezone to avoid off-by-1 errors
  const dateValue = value ? new Date(value + 'T00:00:00') : null;

  return (
    <MantineDateInput
      label={label}
      name={name}
      value={dateValue}
      onChange={handleChange}
      onBlur={onBlur}
      error={error}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      description={helpText}
      className={className}
      withAsterisk={required}
      clearable
      {...props}
    />
  );
};

export default DateInput;
