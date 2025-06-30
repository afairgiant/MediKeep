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
    const formattedDate = date ? date.toISOString().split('T')[0] : '';
    const syntheticEvent = {
      target: {
        name: name,
        value: formattedDate,
      },
    };
    onChange(syntheticEvent);
  };

  // Convert string value to Date object for Mantine
  const dateValue = value ? new Date(value) : null;

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
