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
  transitionProps,
  withinPortal = true,
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

  // Simple limit optimization for large datasets
  const optimizedLimit = useMemo(() => {
    if (limit !== undefined) return limit;
    if (options.length > 100) return 50;
    return undefined;
  }, [limit, options.length]);

  return (
    <MantineSelect
      value={value}
      onChange={handleChange}
      data={mantineOptions}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      searchable={searchable}
      clearable={clearable}
      limit={optimizedLimit}
      maxDropdownHeight={props.maxDropdownHeight || 280}
      withScrollArea={options.length > 10}
      withinPortal={withinPortal}
      transitionProps={transitionProps}
      {...props}
    />
  );
});

export default Select;