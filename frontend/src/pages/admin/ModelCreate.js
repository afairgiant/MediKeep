import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminApiService } from '../../services/api/adminApi';
import { apiService } from '../../services/api';
import { Loading } from '../../components';
import './ModelEdit.css'; // Reuse the same styles as ModelEdit

const ModelCreate = () => {
  const { modelName } = useParams();
  const navigate = useNavigate();

  const [metadata, setMetadata] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        setLoading(true);
        setError(null);

        const metadataResult =
          await adminApiService.getModelMetadata(modelName);
        setMetadata(metadataResult);

        // Initialize form data with default values
        const initialData = {};
        metadataResult.fields.forEach(field => {
          if (!field.primary_key) {
            // Set default values based on field type
            if (field.type === 'boolean') {
              initialData[field.name] = null;
            } else if (field.type === 'number') {
              initialData[field.name] = '';
            } else {
              initialData[field.name] = '';
            }
          }
        });
        setFormData(initialData);
      } catch (err) {
        console.error('Error loading metadata:', err);
        setError(err.message || 'Failed to load form metadata');
      } finally {
        setLoading(false);
      }
    };

    if (modelName) {
      loadMetadata();
    }
  }, [modelName]);

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

    metadata.fields.forEach(field => {
      if (!field.primary_key) {
        // Don't validate primary keys (they're auto-generated)
        // Skip patient_id validation for medical models as it will be auto-populated
        if (field.name === 'patient_id' && medicalModels.includes(modelName)) {
          return; // Skip validation for auto-populated patient_id
        }

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
  const handleCreate = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Create submission data excluding primary key fields and empty values
      const submitData = {};
      metadata.fields.forEach(field => {
        if (!field.primary_key) {
          const value = formData[field.name];
          // Only include non-empty values or explicitly set null/false values
          if (value !== null && value !== undefined && value !== '') {
            submitData[field.name] = value;
          } else if (field.type === 'boolean' && value === false) {
            submitData[field.name] = value;
          }
        }
      }); // Auto-populate patient_id for medical records from current user
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
      if (medicalModels.includes(modelName)) {
        try {
          // Get current patient directly using the already imported apiService
          const currentPatient = await apiService.getCurrentPatient();
          if (currentPatient && currentPatient.id) {
            submitData.patient_id = currentPatient.id;
          } else {
            throw new Error('No patient record found for current user');
          }
        } catch (patientError) {
          setError(
            'Failed to get patient information. Please ensure you have a patient record.'
          );
          setSaving(false);
          return;
        }
      }

      const createdRecord = await adminApiService.createModelRecord(
        modelName,
        submitData
      );
      navigate(`/admin/models/${modelName}/${createdRecord.id}`);
    } catch (err) {
      console.error('Error creating record:', err);
      setError(err.message || 'Failed to create record');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/admin/models/${modelName}`);
  };
  const renderFieldInput = field => {
    const value = formData[field.name] || '';
    const hasError = validationErrors[field.name];

    // Don't render primary key fields as they're auto-generated
    if (field.primary_key) {
      return (
        <div className="field-value readonly">
          Auto-generated
          <small className="field-note">Primary key (auto-generated)</small>
        </div>
      );
    } // Hide patient_id field for medical records - it will be auto-populated
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
          Auto-populated from current user
          <small className="field-note">Patient ID (auto-populated)</small>
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
            <textarea
              {...commonProps}
              rows={4}
              maxLength={field.max_length}
              placeholder={`Enter ${field.name}...`}
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
            placeholder={`Enter ${field.name}...`}
          />
        );
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <Loading />
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
            <h1>Create New {metadata?.display_name || modelName}</h1>
            <p>Fill in the form below to create a new record</p>
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
              onClick={handleCreate}
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? '💾 Creating...' : '💾 Create Record'}
            </button>
          </div>
        </div>

        <form
          className="edit-form"
          onSubmit={e => {
            e.preventDefault();
            handleCreate();
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

export default ModelCreate;
