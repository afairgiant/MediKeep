import React, { memo, useMemo } from 'react';
import { Select as MantineSelect } from '@mantine/core';

export const Select = memo(({
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  className = '',
  disabled = false,
  searchable = true,
  clearable = true,
  limit = undefined,
  ...props
}) => {

  // Handle the onChange - old component passes value directly, Mantine passes value
  const handleChange = selectedValue => {
    onChange(selectedValue);
  };

  // Memoize options transformation to prevent unnecessary re-renders
  const mantineOptions = useMemo(() => 
    options.map(option => ({
      value: option.value,
      label: option.label,
    })), [options]
  );

  // Optimize for large datasets by limiting rendered options
  const optimizedLimit = useMemo(() => {
    if (limit !== undefined) return limit;
    // Auto-limit for large datasets to improve performance
    return options.length > 100 ? 50 : undefined;
  }, [limit, options.length]);

  return (
    <MantineSelect
      value={value}
      onChange={handleChange}
      data={mantineOptions}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      searchable={searchable && options.length > 10} // Only enable search for larger lists
      clearable={clearable}
      limit={optimizedLimit}
      maxDropdownHeight={280} // Fixed height for consistent performance
      withScrollArea={options.length > 20} // Enable virtual scrolling for large lists
      {...props}
    />
  );
});

export default Select;
