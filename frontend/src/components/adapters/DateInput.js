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
  // Handle different input formats properly to avoid timezone issues
  const dateValue = value ? (() => {
    // If it's already a Date object, return as-is
    if (value instanceof Date) {
      return value;
    }
    
    // If it's a string, check the format
    if (typeof value === 'string') {
      const trimmedValue = value.trim();
      
      // Check if it's a date-only string (YYYY-MM-DD format)
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
        // Parse manually to avoid timezone issues
        const [year, month, day] = trimmedValue.split('-').map(Number);
        return new Date(year, month - 1, day); // month is 0-indexed
      }
      
      // For datetime strings or other formats, use standard Date constructor
      return new Date(trimmedValue);
    }
    
    // Fallback for other types
    return new Date(value);
  })() : null;

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
