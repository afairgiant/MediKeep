import React from 'react';
import PropTypes from 'prop-types';
import { Button } from '../ui';
import { MEDICAL_MODELS } from '../../constants/modelConstants';
import { USER_HIDDEN_CREATE_FIELDS, PASSWORD_VALIDATION } from '../../constants/validationConstants';
import { MEDICATION_TYPE_OPTIONS } from '../../constants/medicationTypes';

/**
 * FieldRenderer Component
 *
 * Unified field rendering component for model create and edit forms.
 * Handles different field types and modes (create vs edit).
 *
 * @component
 */
const FieldRenderer = ({
  field,
  value,
  mode = 'edit',
  modelName,
  hasError,
  saving,
  onFieldChange,
  onPasswordReset,
  recordId,
}) => {
  // Don't render primary key fields in create mode
  if (field.primary_key && mode === 'create') {
    return (
      <div className="field-value readonly">
        Auto-generated
        <small className="field-note">Primary key (auto-generated)</small>
      </div>
    );
  }

  // Primary key fields are readonly in edit mode
  if (field.primary_key && mode === 'edit') {
    return (
      <div className="field-value readonly">
        {value}
        <small className="field-note">Primary key (read-only)</small>
      </div>
    );
  }

  // Hide timestamp fields - they should be system-generated, not user-editable
  if (field.name === 'created_at' || field.name === 'updated_at') {
    return (
      <div className="field-value readonly">
        {mode === 'edit' && value ? value : 'Auto-generated'}
        <small className="field-note">System timestamp (auto-generated)</small>
      </div>
    );
  }

  // Hide other auto-generated fields for user creation
  if (mode === 'create' && modelName === 'user' && USER_HIDDEN_CREATE_FIELDS.includes(field.name)) {
    return null;
  }

  // Handle password fields
  if (
    field.name === 'password_hash' ||
    field.name === 'password' ||
    field.name.includes('password')
  ) {
    if (mode === 'create' && modelName === 'user') {
      // Create mode: allow password input
      return (
        <div className="password-field-create">
          <input
            type="password"
            value={value || ''}
            onChange={e => onFieldChange(field.name, e.target.value)}
            className={`field-input ${hasError ? 'error' : ''}`}
            disabled={saving}
            placeholder="Enter password for new user..."
            minLength={PASSWORD_VALIDATION.MIN_LENGTH}
          />
          <small className="field-note">
            Enter a plain text password (minimum {PASSWORD_VALIDATION.MIN_LENGTH} characters with letter and
            number) - it will be securely hashed
          </small>
        </div>
      );
    } else if (mode === 'edit' && modelName === 'user') {
      // Edit mode: show masked password with reset button
      const maskedValue = value
        ? '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'
        : '';
      return (
        <div className="field-value readonly password-field">
          <div className="password-display">{maskedValue}</div>
          <div className="password-actions">
            <small className="field-note">
              Password hash (read-only for security)
            </small>
            <Button
              variant="secondary"
              size="small"
              onClick={() => onPasswordReset(recordId)}
              style={{
                marginLeft: '1rem',
              }}
            >
              Reset Password
            </Button>
          </div>
        </div>
      );
    } else {
      // For non-user models, hide password fields
      return (
        <div className="field-value readonly">
          Not applicable
          <small className="field-note">
            Password fields not supported for this model
          </small>
        </div>
      );
    }
  }

  // Hide patient_id field for medical records
  if (field.name === 'patient_id' && MEDICAL_MODELS.includes(modelName)) {
    if (mode === 'create') {
      return (
        <div className="field-value readonly">
          Auto-populated from current user
          <small className="field-note">Patient ID (auto-populated)</small>
        </div>
      );
    } else {
      return (
        <div className="field-value readonly">
          {value}
          <small className="field-note">
            Patient ID (locked to current user)
          </small>
        </div>
      );
    }
  }

  // Special handling for medication_type field
  if (field.name === 'medication_type' && modelName === 'medication') {
    return (
      <select
        value={value || 'prescription'}
        onChange={e => onFieldChange(field.name, e.target.value)}
        className={`field-input ${hasError ? 'error' : ''}`}
        disabled={saving}
      >
        {MEDICATION_TYPE_OPTIONS.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  // Common props for input elements
  const commonProps = {
    value: value || '',
    onChange: e => onFieldChange(field.name, e.target.value),
    className: `field-input ${hasError ? 'error' : ''}`,
    disabled: saving,
  };

  // Render based on field type
  switch (field.type) {
    case 'boolean':
      return (
        <select
          {...commonProps}
          value={value === null ? '' : String(value)}
          onChange={e => {
            const val =
              e.target.value === '' ? null : e.target.value === 'true';
            onFieldChange(field.name, val);
          }}
        >
          <option value="">-- Select --</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );

    case 'datetime':
    case 'date': {
      // Safely parse date with error handling
      let dateValue = '';
      if (value) {
        try {
          const parsedDate = new Date(value);
          // Check if date is valid
          if (!isNaN(parsedDate.getTime())) {
            dateValue = parsedDate
              .toISOString()
              .slice(0, field.type === 'datetime' ? 16 : 10);
          }
        } catch (err) {
          // Invalid date - leave as empty string
          dateValue = '';
        }
      }

      return (
        <input
          {...commonProps}
          type={field.type === 'datetime' ? 'datetime-local' : 'date'}
          value={dateValue}
        />
      );
    }

    case 'number':
      return <input {...commonProps} type="number" />;

    case 'email':
      return <input {...commonProps} type="email" />;

    case 'text':
      if (field.max_length && field.max_length > 255) {
        return (
          <textarea
            {...commonProps}
            rows={4}
            maxLength={field.max_length}
            placeholder={mode === 'create' ? `Enter ${field.name}...` : undefined}
          />
        );
      }
    // Fall through to default

    default:
      // Check if field has predefined choices (for dropdowns)
      if (field.choices && field.choices.length > 0) {
        return (
          <select {...commonProps}>
            <option value="">-- Select {field.name} --</option>
            {field.choices.map(choice => (
              <option key={choice} value={choice}>
                {choice.charAt(0).toUpperCase() +
                  choice.slice(1).replace('-', ' ')}
              </option>
            ))}
          </select>
        );
      }

      return (
        <input
          {...commonProps}
          type="text"
          maxLength={field.max_length}
          placeholder={mode === 'create' ? `Enter ${field.name}...` : undefined}
        />
      );
  }
};

FieldRenderer.propTypes = {
  field: PropTypes.shape({
    name: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    primary_key: PropTypes.bool,
    nullable: PropTypes.bool,
    max_length: PropTypes.number,
    choices: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  value: PropTypes.any,
  mode: PropTypes.oneOf(['create', 'edit']).isRequired,
  modelName: PropTypes.string.isRequired,
  hasError: PropTypes.bool,
  saving: PropTypes.bool.isRequired,
  onFieldChange: PropTypes.func.isRequired,
  onPasswordReset: PropTypes.func,
  recordId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

FieldRenderer.defaultProps = {
  hasError: false,
  onPasswordReset: null,
  recordId: null,
  value: '',
};

export default FieldRenderer;
