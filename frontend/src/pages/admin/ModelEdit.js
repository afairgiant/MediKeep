import logger from '../../services/logger';

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminApiService } from '../../services/api/adminApi';
import { AdminResetPasswordModal } from '../../components/auth';
import { Loading } from '../../components';
import { Button } from '../../components/ui';
import { MEDICAL_MODELS } from '../../constants/modelConstants';
import { EDIT_EXCLUDED_FIELDS } from '../../constants/validationConstants';
import { useFieldHandlers } from '../../hooks/useFieldHandlers';
import { validateForm } from '../../utils/fieldValidation';
import { formatFieldLabel } from '../../utils/formatters';
import FieldRenderer from '../../components/admin/FieldRenderer';
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
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [resetUserId, setResetUserId] = useState(null);
  const [resetUsername, setResetUsername] = useState('');

  // Use the shared field handlers hook
  const { handleFieldChange } = useFieldHandlers(setFormData, setValidationErrors);

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
        logger.error('Error loading record:', err);
        setError(err.message || 'Failed to load record');
      } finally {
        setLoading(false);
      }
    };

    if (modelName && recordId) {
      loadData();
    }
  }, [modelName, recordId]);

  const handleValidateForm = () => {
    const { hasErrors, errors } = validateForm(metadata, formData, {
      skipPasswordFields: true,
      modelName,
    });
    setValidationErrors(errors);
    return !hasErrors;
  };

  const handleSave = async () => {
    if (!handleValidateForm()) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Create update data excluding primary key fields, password fields, and timestamp fields
      const updateData = {};
      metadata.fields.forEach(field => {
        if (
          !field.primary_key &&
          field.name !== 'created_at' &&
          field.name !== 'updated_at' &&
          !EDIT_EXCLUDED_FIELDS.some(excluded => field.name.includes(excluded))
        ) {
          // Special handling for medication_type - always include with default
          if (field.name === 'medication_type' && modelName === 'medication') {
            updateData[field.name] = formData[field.name] || 'prescription';
          } else {
            updateData[field.name] = formData[field.name];
          }
        }
      });

      // Safety checks for user model updates
      if (modelName === 'user') {
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const currentUsername = currentUser.username;
        
        // Check for username changes
        if (updateData.username && record.username !== updateData.username) {
          // If admin is changing their own username, show warning
          if (record.username === currentUsername) {
            const confirmChange = window.confirm(
              `WARNING: You are about to change your own username from "${record.username}" to "${updateData.username}".\n\n` +
              `This will log you out immediately and you'll need to log back in with the new username.\n\n` +
              `Are you sure you want to continue?`
            );
            
            if (!confirmChange) {
              setSaving(false);
              return;
            }
          }
        }
        
        // Check for role changes that could lock out admin access
        if (updateData.role && record.role !== updateData.role) {
          const currentUserRole = (currentUser.role || '').toLowerCase();
          const recordRole = (record.role || '').toLowerCase();
          const newRole = (updateData.role || '').toLowerCase();
          
          // If changing admin to non-admin, warn about potential lockout
          if (['admin', 'administrator'].includes(recordRole) && !['admin', 'administrator'].includes(newRole)) {
            const confirmRoleChange = window.confirm(
              `WARNING: You are about to remove admin privileges from this user.\n\n` +
              `If this is the last admin user in the system, you may lose admin access.\n\n` +
              `Are you sure you want to continue?`
            );
            
            if (!confirmRoleChange) {
              setSaving(false);
              return;
            }
          }
        }
      }

      await adminApiService.updateModelRecord(modelName, recordId, updateData);
      
      // If user changed their own username, they need to log out
      if (modelName === 'user' && updateData.username && record.username !== updateData.username) {
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const currentUsername = currentUser.username;
        
        if (record.username === currentUsername) {
          alert(
            `Username updated successfully!\n\n` +
            `You have been logged out because your username changed.\n` +
            `Please log back in with your new username: "${updateData.username}"`
          );
          
          // Clear authentication and redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          return;
        }
      }
      
      navigate(`/admin/models/${modelName}/${recordId}`);
    } catch (err) {
      logger.error('Error saving record:', err);
      setError(err.message || 'Failed to save record');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = userId => {
    // Get the username from the form data
    const username = formData.username || `User ${userId}`;
    setResetUserId(userId);
    setResetUsername(username);
    setShowPasswordModal(true);
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setResetUserId(null);
    setResetUsername('');
  };

  const handleCancel = () => {
    navigate(`/admin/models/${modelName}/${recordId}`);
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
            <h1>Edit {metadata?.display_name || modelName}</h1>
            <p>Record ID: {recordId}</p>
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
              onClick={handleSave}
              disabled={saving}
              loading={saving}
            >
              Save Changes
            </Button>
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
                  {formatFieldLabel(field.name)}
                  {field.primary_key && <span className="pk-badge">PK</span>}
                  {field.foreign_key && <span className="fk-badge">FK</span>}
                  {!field.nullable && !field.primary_key && (
                    <span className="required">*</span>
                  )}
                </label>

                <FieldRenderer
                  field={field}
                  value={formData[field.name]}
                  mode="edit"
                  modelName={modelName}
                  hasError={!!validationErrors[field.name]}
                  saving={saving}
                  onFieldChange={handleFieldChange}
                  onPasswordReset={handleChangePassword}
                  recordId={recordId}
                />

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

      <AdminResetPasswordModal
        isOpen={showPasswordModal}
        onClose={handleClosePasswordModal}
        userId={resetUserId}
        username={resetUsername}
      />
    </AdminLayout>
  );
};

export default ModelEdit;
