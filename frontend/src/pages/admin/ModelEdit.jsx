import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconAlertCircle, IconArrowLeft } from '@tabler/icons-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { AdminResetPasswordModal } from '../../components/auth';
import FieldRenderer from '../../components/admin/FieldRenderer';
import { EDIT_EXCLUDED_FIELDS } from '../../constants/validationConstants';
import { useAuth } from '../../contexts/AuthContext';
import { useFieldHandlers } from '../../hooks/useFieldHandlers';
import { adminApiService } from '../../services/api/adminApi';
import logger from '../../services/logger';
import { validateForm } from '../../utils/fieldValidation';
import { formatFieldLabel } from '../../utils/formatters';
import { secureStorage } from '../../utils/secureStorage';
import './ModelEdit.css';

const ModelEdit = () => {
  const { modelName, recordId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation('admin');
  const { logout } = useAuth();

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

  // Warning modal states
  const [usernameWarningOpened, { open: openUsernameWarning, close: closeUsernameWarning }] = useDisclosure(false);
  const [roleWarningOpened, { open: openRoleWarning, close: closeRoleWarning }] = useDisclosure(false);
  const [pendingUpdateData, setPendingUpdateData] = useState(null);

  const { handleFieldChange } = useFieldHandlers(setFormData, setValidationErrors);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [metadataResult, recordResult] = await Promise.all([
          adminApiService.getModelMetadata(modelName),
          adminApiService.getModelRecord(modelName, recordId),
        ]);

        setMetadata(metadataResult);
        setRecord(recordResult);
        setFormData(recordResult);
      } catch (err) {
        logger.error('record_edit_load_error', 'Error loading record for edit', {
          component: 'ModelEdit',
          modelName,
          recordId,
          error: err.message,
        });
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

  const buildUpdateData = useCallback(() => {
    const updateData = {};
    metadata.fields.forEach(field => {
      if (
        !field.primary_key &&
        field.name !== 'created_at' &&
        field.name !== 'updated_at' &&
        !EDIT_EXCLUDED_FIELDS.some(excluded => field.name.includes(excluded))
      ) {
        if (field.name === 'medication_type' && modelName === 'medication') {
          updateData[field.name] = formData[field.name] || 'prescription';
        } else {
          updateData[field.name] = formData[field.name];
        }
      }
    });
    return updateData;
  }, [metadata, formData, modelName]);

  const executeSave = useCallback(async (updateData) => {
    try {
      setSaving(true);
      setError(null);

      await adminApiService.updateModelRecord(modelName, recordId, updateData);

      // Handle username change logout
      if (modelName === 'user' && updateData.username && record.username !== updateData.username) {
        const currentUserAfterSave = await secureStorage.getJSON('user') || {};
        const currentUsernameAfterSave = currentUserAfterSave.username;

        if (record.username === currentUsernameAfterSave) {
          notifications.show({
            title: t('models.usernameUpdated', 'Username updated'),
            message: t('models.usernameUpdatedMessage', { username: updateData.username, defaultValue: `Your username has been changed. Please log in with your new username: "${updateData.username}"` }),
            color: 'blue',
            autoClose: 5000,
          });
          await logout();
          navigate('/login');
          return;
        }
      }

      notifications.show({
        title: t('models.changesSaved', 'Changes saved'),
        message: t('models.recordUpdated', 'Record updated successfully'),
        color: 'green',
      });
      navigate(`/admin/models/${modelName}/${recordId}`);
    } catch (err) {
      logger.error('record_save_error', 'Error saving record', {
        component: 'ModelEdit',
        modelName,
        recordId,
        error: err.message,
      });
      setError(err.message || t('models.failedToSave', 'Failed to save record'));
      notifications.show({
        title: t('models.saveFailed', 'Save failed'),
        message: err.message || t('models.failedToSave', 'Failed to save record'),
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  }, [modelName, recordId, record, navigate, logout, t]);

  const handleSave = async () => {
    if (!handleValidateForm()) return;

    const updateData = buildUpdateData();

    if (modelName === 'user') {
      const currentUser = await secureStorage.getJSON('user') || {};
      const currentUsername = currentUser.username;

      // Check username change for self
      if (updateData.username && record.username !== updateData.username) {
        if (record.username === currentUsername) {
          setPendingUpdateData(updateData);
          openUsernameWarning();
          return;
        }
      }

      // Check role demotion
      if (updateData.role && record.role !== updateData.role) {
        const recordRole = (record.role || '').toLowerCase();
        const newRole = (updateData.role || '').toLowerCase();
        if (['admin', 'administrator'].includes(recordRole) && !['admin', 'administrator'].includes(newRole)) {
          setPendingUpdateData(updateData);
          openRoleWarning();
          return;
        }
      }
    }

    await executeSave(updateData);
  };

  const dismissWarning = (closeModal) => {
    closeModal();
    setPendingUpdateData(null);
    setSaving(false);
  };

  const confirmPendingUpdate = async (closeModal) => {
    closeModal();
    if (pendingUpdateData) {
      await executeSave(pendingUpdateData);
      setPendingUpdateData(null);
    }
  };

  const handleChangePassword = userId => {
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
        <Center style={{ minHeight: 'calc(100vh - 140px)' }}>
          <Loader size="lg" />
        </Center>
      </AdminLayout>
    );
  }

  if (error && !metadata) {
    return (
      <AdminLayout>
        <Center style={{ minHeight: 'calc(100vh - 140px)' }}>
          <Stack align="center" gap="md">
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" title="Error">
              {error}
            </Alert>
            <Button variant="default" leftSection={<IconArrowLeft size={16} />} onClick={handleCancel}>
              Back
            </Button>
          </Stack>
        </Center>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="model-edit">
        <div className="model-edit-header">
          <div className="edit-title">
            <h1>{t('models.editRecord', { modelName: metadata?.display_name || modelName, defaultValue: `Edit ${metadata?.display_name || modelName}` })}</h1>
            <p>{t('models.recordId', { id: recordId, defaultValue: `Record ID: ${recordId}` })}</p>
          </div>

          <div className="edit-actions">
            <Button
              variant="default"
              onClick={handleCancel}
              disabled={saving}
            >
              {t('common:buttons.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleSave}
              loading={saving}
            >
              {t('common:buttons.save', 'Save Changes')}
            </Button>
          </div>
        </div>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md">
            {error}
          </Alert>
        )}

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
                    {validationErrors[field.name].map((validationError, index) => (
                      <div key={index} className="error-message">
                        {validationError}
                      </div>
                    ))}
                  </div>
                )}

                <div className="field-meta">
                  {t('models.fieldType', { type: field.type, defaultValue: `Type: ${field.type}` })}
                  {field.max_length && ` | ${t('models.fieldMaxLength', { length: field.max_length, defaultValue: `Max Length: ${field.max_length}` })}`}
                  {field.foreign_key && ` | ${t('models.fieldReferences', { reference: field.foreign_key, defaultValue: `References: ${field.foreign_key}` })}`}
                  {!field.nullable && ` | ${t('models.fieldRequired', 'Required')}`}
                </div>
              </div>
            ))}
          </div>
        </form>
      </div>

      {/* Username Change Warning Modal */}
      <Modal
        opened={usernameWarningOpened}
        onClose={() => dismissWarning(closeUsernameWarning)}
        title={
          <Group gap="xs">
            <IconAlertTriangle size={20} color="var(--mantine-color-yellow-6)" />
            <Text fw={600}>{t('models.usernameChangeWarning', 'Username Change Warning')}</Text>
          </Group>
        }
        centered
      >
        <Stack gap="md">
          <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={16} />}>
            <Text size="sm" dangerouslySetInnerHTML={{ __html: t('models.usernameChangeText', { oldUsername: record?.username, newUsername: pendingUpdateData?.username, defaultValue: `You are about to change your own username from <strong>"${record?.username}"</strong> to <strong>"${pendingUpdateData?.username}"</strong>.` }) }} />
            <Text size="sm" mt="xs">
              {t('models.usernameChangeLogout', 'This will log you out immediately and you will need to log back in with the new username.')}
            </Text>
          </Alert>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => dismissWarning(closeUsernameWarning)}>
              {t('common:buttons.cancel', 'Cancel')}
            </Button>
            <Button color="yellow" onClick={() => confirmPendingUpdate(closeUsernameWarning)}>
              {t('models.changeUsername', 'Change Username')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Role Change Warning Modal */}
      <Modal
        opened={roleWarningOpened}
        onClose={() => dismissWarning(closeRoleWarning)}
        title={
          <Group gap="xs">
            <IconAlertTriangle size={20} color="var(--mantine-color-yellow-6)" />
            <Text fw={600}>{t('models.roleChangeWarning', 'Role Change Warning')}</Text>
          </Group>
        }
        centered
      >
        <Stack gap="md">
          <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={16} />}>
            <Text size="sm">
              {t('models.roleChangeText', 'You are about to remove admin privileges from this user.')}
            </Text>
            <Text size="sm" mt="xs">
              {t('models.roleChangeLastAdmin', 'If this is the last admin user in the system, you may lose admin access.')}
            </Text>
          </Alert>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => dismissWarning(closeRoleWarning)}>
              {t('common:buttons.cancel', 'Cancel')}
            </Button>
            <Button color="yellow" onClick={() => confirmPendingUpdate(closeRoleWarning)}>
              {t('models.changeRole', 'Change Role')}
            </Button>
          </Group>
        </Stack>
      </Modal>

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
