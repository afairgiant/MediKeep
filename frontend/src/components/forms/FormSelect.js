/**
 * Form Select component
 */

import React from 'react';
import './FormSelect.css';

const FormSelect = ({
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
  const selectId = `select-${name}`;
  const hasError = !!error;
  
  const selectClass = [
    'form-select',
    hasError ? 'form-select-error' : '',
    disabled ? 'form-select-disabled' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={selectId} className="form-label">
          {label}
          {required && <span className="form-required">*</span>}
        </label>
      )}
      
      <select
        id={selectId}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        className={selectClass}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${selectId}-error` : helpText ? `${selectId}-help` : undefined}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option, index) => (
          <option 
            key={option.value || index} 
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      
      {helpText && !hasError && (
        <div id={`${selectId}-help`} className="form-help-text">
          {helpText}
        </div>
      )}
      
      {hasError && (
        <div id={`${selectId}-error`} className="form-error-text">
          {error}
        </div>
      )}
    </div>
  );
};

export default FormSelect;
