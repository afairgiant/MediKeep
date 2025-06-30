import React from 'react';
// CSS now handled by Mantine adapter

export const Select = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  className = '',
  disabled = false,
  ...props
}) => {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`select ${className} ${disabled ? 'disabled' : ''}`}
      disabled={disabled}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

export default Select;
