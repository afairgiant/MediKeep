import React from 'react';
import './DateInput.css';

export const DateInput = ({
  value,
  onChange,
  placeholder = 'Select date',
  className = '',
  disabled = false,
  min,
  max,
  ...props
}) => {
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`date-input ${className} ${disabled ? 'disabled' : ''}`}
      disabled={disabled}
      min={min}
      max={max}
      {...props}
    />
  );
};

export default DateInput;
