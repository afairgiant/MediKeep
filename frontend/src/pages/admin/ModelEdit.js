import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminApiService } from '../../services/api/adminApi';
import { Loading } from '../../components';
import './ModelEdit.css';

const ModelEdit = () => {
  const { modelName, recordId } = useParams();
  const navigate = useNavigate();

  const [record, setRecord] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load metadata and record in parallel
        const [metadataResult, recordResult] = await Promise.all([
          adminApiService.getModelMetadata(modelName),
          adminApiService.getModelRecord(modelName, recordId),
        ]);

        setMetadata(metadataResult);
        setRecord(recordResult);
        setFormData(recordResult);
      } catch (err) {
        console.error('Error loading record:', err);
        setError(err.message || 'Failed to load record');
      } finally {
        setLoading(false);
      }
    };

    if (modelName && recordId) {
      loadData();
    }
  }, [modelName, recordId]);

  const handleFieldChange = (fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value,
    }));

    // Clear validation error for this field when user starts typing
    if (validationErrors[fieldName]) {
      setValidationErrors(prev => ({
        ...prev,
        [fieldName]: null,
      }));
    }
  };

  const validateField = (field, value) => {
    const errors = [];

    // Required field validation
    if (
      !field.nullable &&
      (value === null || value === undefined || value === '')
    ) {
      errors.push(`${field.name} is required`);
    }

    // Max length validation
    if (
      field.max_length &&
      typeof value === 'string' &&
      value.length > field.max_length
    ) {
      errors.push(
        `${field.name} must be ${field.max_length} characters or less`
      );
    }

    // Type validation
    if (value !== null && value !== undefined && value !== '') {
      if (field.type === 'number' && isNaN(Number(value))) {
        errors.push(`${field.name} must be a valid number`);
      }

      if (
        field.type === 'email' &&
        value &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ) {
        errors.push(`${field.name} must be a valid email address`);
      }
    }

    return errors;
  };

  const validateForm = () => {
    const errors = {};
    let hasErrors = false;

    metadata.fields.forEach(field => {
      if (!field.primary_key) {
        // Don't validate primary keys
        const fieldErrors = validateField(field, formData[field.name]);
        if (fieldErrors.length > 0) {
          errors[field.name] = fieldErrors;
          hasErrors = true;
        }
      }
    });

    setValidationErrors(errors);
    return !hasErrors;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Create update data excluding primary key fields
      const updateData = {};
      metadata.fields.forEach(field => {
        if (!field.primary_key) {
          updateData[field.name] = formData[field.name];
        }
      });

      await adminApiService.updateModelRecord(modelName, recordId, updateData);
      navigate(`/admin/models/${modelName}/${recordId}`);
    } catch (err) {
      console.error('Error saving record:', err);
      setError(err.message || 'Failed to save record');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/admin/models/${modelName}/${recordId}`);
  };
  const renderFieldInput = field => {
    const value = formData[field.name] || '';
    const hasError = validationErrors[field.name];

    // Don't render primary key fields as they shouldn't be editable
    if (field.primary_key) {
      return (
        <div className="field-value readonly">
          {value}
          <small className="field-note">Primary key (read-only)</small>
        </div>
      );
    } // Hide patient_id field for medical records - it should not be changed
    const medicalModels = [
      'medication',
      'lab_result',
      'condition',
      'allergy',
      'immunization',
      'procedure',
      'treatment',
      'encounter',
    ];
    if (field.name === 'patient_id' && medicalModels.includes(modelName)) {
      return (
        <div className="field-value readonly">
          {value}
          <small className="field-note">
            Patient ID (locked to current user)
          </small>
        </div>
      );
    }

    const commonProps = {
      value: value,
      onChange: e => handleFieldChange(field.name, e.target.value),
      className: `field-input ${hasError ? 'error' : ''}`,
      disabled: saving,
    };

    switch (field.type) {
      case 'boolean':
        return (
          <select
            {...commonProps}
            value={value === null ? '' : String(value)}
            onChange={e => {
              const val =
                e.target.value === '' ? null : e.target.value === 'true';
              handleFieldChange(field.name, val);
            }}
          >
            <option value="">-- Select --</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );

      case 'datetime':
      case 'date':
        return (
          <input
            {...commonProps}
            type={field.type === 'datetime' ? 'datetime-local' : 'date'}
            value={
              value
                ? new Date(value)
                    .toISOString()
                    .slice(0, field.type === 'datetime' ? 16 : 10)
                : ''
            }
          />
        );

      case 'number':
        return <input {...commonProps} type="number" />;

      case 'email':
        return <input {...commonProps} type="email" />;
      case 'text':
        if (field.max_length && field.max_length > 255) {
          return (
            <textarea {...commonProps} rows={4} maxLength={field.max_length} />
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
          <input {...commonProps} type="text" maxLength={field.max_length} />
        );
    }
  };
  if (loading) {
    return (
      <AdminLayout>
        <div className="admin-page-loading">
          <Loading message="Loading model for editing..." />
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="model-edit-error">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={handleCancel} className="btn btn-secondary">
            ← Back
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="model-edit">
        <div className="model-edit-header">
          <div className="edit-title">
            <h1>Edit {metadata?.display_name || modelName}</h1>
            <p>Record ID: {recordId}</p>
          </div>

          <div className="edit-actions">
            <button
              onClick={handleCancel}
              className="btn btn-secondary"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? '💾 Saving...' : '💾 Save Changes'}
            </button>
          </div>
        </div>

        <form
          className="edit-form"
          onSubmit={e => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div className="form-grid">
            {metadata?.fields.map(field => (
              <div key={field.name} className="field-group">
                <label className="field-label">
                  {field.name}
                  {field.primary_key && <span className="pk-badge">PK</span>}
                  {field.foreign_key && <span className="fk-badge">FK</span>}
                  {!field.nullable && !field.primary_key && (
                    <span className="required">*</span>
                  )}
                </label>

                {renderFieldInput(field)}

                {validationErrors[field.name] && (
                  <div className="field-errors">
                    {validationErrors[field.name].map((error, index) => (
                      <div key={index} className="error-message">
                        {error}
                      </div>
                    ))}
                  </div>
                )}

                <div className="field-meta">
                  Type: {field.type}
                  {field.max_length && ` | Max Length: ${field.max_length}`}
                  {field.foreign_key && ` | References: ${field.foreign_key}`}
                  {!field.nullable && ` | Required`}
                </div>
              </div>
            ))}
          </div>
        </form>
      </div>
    </AdminLayout>
  );
};

export default ModelEdit;
