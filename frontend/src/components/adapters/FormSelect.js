import React from 'react';
import { Select } from '@mantine/core';

export const FormSelect = ({
  label,
  name,
  value,
  onChange,
  onBlur,
  options = [],
  error,
  required = false,
  disabled = false,
  placeholder = 'Select an option',
  className = '',
  helpText,
  ...props
}) => {

  // Mantine Select expects different onChange signature
  const handleChange = selectedValue => {
    // Create a synthetic event to match the old component's expectations
    const syntheticEvent = {
      target: {
        name: name,
        value: selectedValue,
      },
    };
    onChange(syntheticEvent);
  };

  // Ensure options are in the correct format for Mantine Select
  const mantineOptions = options.map(option => ({
    value: option.value,
    label: option.label,
    disabled: option.disabled,
  }));

  return (
    <Select
      label={label}
      name={name}
      value={value}
      onChange={handleChange}
      onBlur={onBlur}
      data={mantineOptions}
      error={error}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      description={helpText}
      className={className}
      withAsterisk={required}
      searchable
      clearable
      {...props}
    />
  );
};

export default FormSelect;
