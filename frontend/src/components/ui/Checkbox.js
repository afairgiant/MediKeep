import React from 'react';
import './Checkbox.css';

export const Checkbox = ({
  checked,
  onChange,
  label,
  className = '',
  disabled = false,
  id,
  ...props
}) => {
  const checkboxId =
    id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div
      className={`checkbox-wrapper ${className} ${disabled ? 'disabled' : ''}`}
    >
      <input
        type="checkbox"
        id={checkboxId}
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="checkbox-input"
        disabled={disabled}
        {...props}
      />
      <label htmlFor={checkboxId} className="checkbox-label">
        <span className="checkbox-custom">
          {checked && (
            <svg
              className="checkbox-icon"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </span>
        {label && <span className="checkbox-text">{label}</span>}
      </label>
    </div>
  );
};

export default Checkbox;
