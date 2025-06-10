/**
 * Form Input component with validation
 */

import React from 'react';
import './FormInput.css';

const FormInput = ({
  label,
  name,
  type = 'text',
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
  const inputId = `input-${name}`;
  const hasError = !!error;
  
  const inputClass = [
    'form-input',
    hasError ? 'form-input-error' : '',
    disabled ? 'form-input-disabled' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={inputId} className="form-label">
          {label}
          {required && <span className="form-required">*</span>}
        </label>
      )}
      
      <input
        id={inputId}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder}
        className={inputClass}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined}
        {...props}
      />
      
      {helpText && !hasError && (
        <div id={`${inputId}-help`} className="form-help-text">
          {helpText}
        </div>
      )}
      
      {hasError && (
        <div id={`${inputId}-error`} className="form-error-text">
          {error}
        </div>
      )}
    </div>
  );
};

export default FormInput;
