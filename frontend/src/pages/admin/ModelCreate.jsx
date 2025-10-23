import logger from '../../services/logger';

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminApiService } from '../../services/api/adminApi';
import { apiService } from '../../services/api';
import { Loading } from '../../components';
import { Button } from '../../components/ui';
import { MEDICAL_MODELS } from '../../constants/modelConstants';
import { USER_HIDDEN_CREATE_FIELDS } from '../../constants/validationConstants';
import { useFieldHandlers } from '../../hooks/useFieldHandlers';
import { validateForm } from '../../utils/fieldValidation';
import { formatFieldLabel } from '../../utils/formatters';
import FieldRenderer from '../../components/admin/FieldRenderer';
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

  // Use the shared field handlers hook
  const { handleFieldChange } = useFieldHandlers(setFormData, setValidationErrors);

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
        logger.error('Error loading metadata:', err);
        setError(err.message || 'Failed to load form metadata');
      } finally {
        setLoading(false);
      }
    };

    if (modelName) {
      loadMetadata();
    }
  }, [modelName]);

  const handleValidateForm = () => {
    const { hasErrors, errors } = validateForm(metadata, formData, {
      includePasswordValidation: true,
      modelName,
    });
    setValidationErrors(errors);
    return !hasErrors;
  };

  const handleCreate = async () => {
    if (!handleValidateForm()) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Create submission data excluding primary key fields, timestamp fields, and empty values
      const submitData = {};
      metadata.fields.forEach(field => {
        // Exclude primary keys and system-generated timestamp fields
        if (!field.primary_key && field.name !== 'created_at' && field.name !== 'updated_at') {
          const value = formData[field.name];

          // Special handling for medication_type - always include with default
          if (field.name === 'medication_type' && modelName === 'medication') {
            submitData[field.name] = value || 'prescription';
            return;
          }

          // Include non-empty values
          if (value !== null && value !== undefined && value !== '') {
            submitData[field.name] = value;
          }
          // Include false for booleans (since it's a valid value)
          else if (field.type === 'boolean' && value === false) {
            submitData[field.name] = value;
          }
          // Include null for nullable fields that are explicitly set to null
          else if (field.nullable && value === null) {
            submitData[field.name] = null;
          }
        }
      }); // Auto-populate patient_id for medical records from current user
      if (MEDICAL_MODELS.includes(modelName)) {
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
      logger.error('Error creating record:', err);
      setError(err.message || 'Failed to create record');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(`/admin/models/${modelName}`);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="admin-page-loading">
          <Loading message="Loading model creation form..." />
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
          <Button variant="secondary" onClick={handleCancel}>
            ← Back
          </Button>
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
            <Button
              variant="secondary"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={saving}
              loading={saving}
            >
              Create Record
            </Button>
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
            {metadata?.fields
              .filter(field => {
                // Filter out hidden fields for user creation
                if (modelName === 'user') {
                  return !USER_HIDDEN_CREATE_FIELDS.includes(field.name);
                }
                return true;
              })
              .map(field => {
                const fieldRenderer = (
                  <FieldRenderer
                    field={field}
                    value={formData[field.name]}
                    mode="create"
                    modelName={modelName}
                    hasError={!!validationErrors[field.name]}
                    saving={saving}
                    onFieldChange={handleFieldChange}
                  />
                );

                // Skip rendering if FieldRenderer returns null
                if (!fieldRenderer) return null;

                return (
                  <div key={field.name} className="field-group">
                    <label className="field-label">
                      {formatFieldLabel(field.name)}
                      {field.primary_key && <span className="pk-badge">PK</span>}
                      {field.foreign_key && <span className="fk-badge">FK</span>}
                      {!field.nullable && !field.primary_key && (
                        <span className="required">*</span>
                      )}
                    </label>

                    {fieldRenderer}

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
                );
              })}
          </div>
        </form>
      </div>
    </AdminLayout>
  );
};

export default ModelCreate;
