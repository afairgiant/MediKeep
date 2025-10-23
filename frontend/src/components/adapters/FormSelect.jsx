import React, { memo, useMemo, useCallback } from 'react';
import { Select } from '@mantine/core';

export const FormSelect = memo(({
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
  searchable = true,
  clearable = true,
  limit = undefined,
  ...props
}) => {

  // Memoize the onChange handler to prevent unnecessary re-renders
  const handleChange = useCallback(selectedValue => {
    // Create a synthetic event to match the old component's expectations
    const syntheticEvent = {
      target: {
        name: name,
        value: selectedValue,
      },
    };
    onChange(syntheticEvent);
  }, [name, onChange]);

  // Memoize options transformation to prevent unnecessary re-renders
  const mantineOptions = useMemo(() => 
    options.map(option => ({
      value: option.value,
      label: option.label,
      disabled: option.disabled,
    })), [options]
  );

  // Optimize for large datasets by limiting rendered options
  const optimizedLimit = useMemo(() => {
    if (limit !== undefined) return limit;
    // Auto-limit for large datasets to improve performance
    return options.length > 100 ? 50 : undefined;
  }, [limit, options.length]);

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
      searchable={searchable && options.length > 10} // Only enable search for larger lists
      clearable={clearable}
      limit={optimizedLimit}
      maxDropdownHeight={280} // Fixed height for consistent performance
      withScrollArea={options.length > 20} // Enable virtual scrolling for large lists
      {...props}
    />
  );
});

export default FormSelect;
