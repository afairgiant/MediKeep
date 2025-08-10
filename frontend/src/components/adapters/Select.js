import React from 'react';
import { Select as MantineSelect } from '@mantine/core';

export const Select = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  className = '',
  disabled = false,
  ...props
}) => {

  // Handle the onChange - old component passes value directly, Mantine passes value
  const handleChange = selectedValue => {
    onChange(selectedValue);
  };

  // Ensure options are in the correct format for Mantine Select
  const mantineOptions = options.map(option => ({
    value: option.value,
    label: option.label,
  }));

  return (
    <MantineSelect
      value={value}
      onChange={handleChange}
      data={mantineOptions}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      searchable
      clearable
      {...props}
    />
  );
};

export default Select;
