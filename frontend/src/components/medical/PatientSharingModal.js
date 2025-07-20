/**
 * PatientSharingModal Component
 * Interface for sharing patients with other users
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Button,
  Select,
  TextInput,
  Alert,
  Badge,
  ActionIcon,
  Table,
  Paper,
  Title,
  Divider,
  Switch,
  Textarea,
  Box,
  Flex,
  Tooltip,
  Card,
  Avatar,
  Loader,
} from '@mantine/core';
import {
  IconShare,
  IconTrash,
  IconEdit,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconUser,
  IconClock,
  IconShield,
  IconUsers,
  IconRefresh,
} from '@tabler/icons-react';
// Note: Using simple date input instead of @mantine/dates DateTimePicker
import { toast } from 'react-toastify';
import patientSharingApi from '../../services/api/patientSharingApi';
import logger from '../../services/logger';

/**
 * Safely parse JSON string with error handling
 * @param {string} jsonString - The JSON string to parse
 * @param {string} fieldName - Field name for logging purposes
 * @returns {object|null} Parsed object or null if invalid JSON
 */
const safeParseJSON = (jsonString, fieldName = 'custom_permissions') => {
  if (!jsonString || typeof jsonString !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonString);
    return parsed;
  } catch (error) {
    logger.error('json_parse_error', {
      message: `Invalid JSON in ${fieldName}`,
      jsonString: jsonString.substring(0, 100), // Log first 100 chars only
      error: error.message
    });
    
    // Show user-friendly error
    toast.error(`Invalid JSON format in ${fieldName}. Please check your syntax.`);
    throw new Error(`Invalid JSON format in ${fieldName}`);
  }
};

const PatientSharingModal = ({ 
  opened, 
  onClose, 
  patient, 
  onShareUpdate 
}) => {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingShare, setEditingShare] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state for creating/editing shares
  const [formData, setFormData] = useState({
    shared_with_user_identifier: '',
    permission_level: 'view',
    expires_at: null,
    has_expiration: false,
    custom_permissions: '',
  });
  
  const [formErrors, setFormErrors] = useState({});

  // Load shares when modal opens
  useEffect(() => {
    if (opened && patient) {
      loadPatientShares();
    }
  }, [opened, patient]);

  // Reset form when modal closes
  useEffect(() => {
    if (!opened) {
      resetForm();
      setEditingShare(null);
      setShowCreateForm(false);
      setError(null);
    }
  }, [opened]);

  const resetForm = () => {
    setFormData({
      shared_with_user_identifier: '',
      permission_level: 'view',
      expires_at: null,
      has_expiration: false,
      custom_permissions: '',
    });
    setFormErrors({});
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.shared_with_user_identifier) {
      errors.shared_with_user_identifier = 'Please enter a username or email';
    }
    
    if (!['view', 'edit', 'full'].includes(formData.permission_level)) {
      errors.permission_level = 'Invalid permission level';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    if (editingShare) {
      updateShare(formData);
    } else {
      createShare(formData);
    }
  };

  /**
   * Load patient shares
   */
  const loadPatientShares = async () => {
    if (!patient) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await patientSharingApi.getPatientShares(patient.id);
      setShares(response.shares || []);
      
      logger.debug('patient_sharing_modal_loaded', {
        message: 'Patient shares loaded',
        patientId: patient.id,
        shareCount: response.shares?.length || 0
      });
    } catch (error) {
      logger.error('patient_sharing_modal_error', {
        message: 'Failed to load patient shares',
        patientId: patient.id,
        error: error.message
      });
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Create a new share
   */
  const createShare = async (values) => {
    if (!patient) return;

    try {
      setLoading(true);
      
      const shareData = {
        patient_id: patient.id,
        shared_with_user_identifier: values.shared_with_user_identifier,
        permission_level: values.permission_level,
        expires_at: values.has_expiration ? values.expires_at : null,
        custom_permissions: values.custom_permissions ? safeParseJSON(values.custom_permissions, 'custom permissions') : null,
      };
      
      await patientSharingApi.sharePatient(shareData);
      
      toast.success(`Patient shared successfully with ${values.shared_with_user_identifier}`);
      
      // Reload shares and reset form
      await loadPatientShares();
      resetForm();
      setShowCreateForm(false);
      
      if (onShareUpdate) {
        onShareUpdate();
      }
      
      logger.info('patient_sharing_modal_created', {
        message: 'Patient share created successfully',
        patientId: patient.id,
        sharedWithIdentifier: values.shared_with_user_identifier
      });
    } catch (error) {
      logger.error('patient_sharing_modal_create_error', {
        message: 'Failed to create patient share',
        patientId: patient.id,
        sharedWithIdentifier: values.shared_with_user_identifier,
        error: error.message
      });
      
      toast.error(`Share Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update an existing share
   */
  const updateShare = async (values) => {
    if (!patient || !editingShare) return;

    try {
      setLoading(true);
      
      const updateData = {
        permission_level: values.permission_level,
        expires_at: values.has_expiration ? values.expires_at : null,
        custom_permissions: values.custom_permissions ? safeParseJSON(values.custom_permissions, 'custom permissions') : null,
      };
      
      await patientSharingApi.updatePatientShare(
        patient.id,
        editingShare.shared_with_user_id,
        updateData
      );
      
      toast.success('Patient share updated successfully');
      
      // Reload shares and reset form
      await loadPatientShares();
      resetForm();
      setEditingShare(null);
      
      if (onShareUpdate) {
        onShareUpdate();
      }
      
      logger.info('patient_sharing_modal_updated', {
        message: 'Patient share updated successfully',
        patientId: patient.id,
        shareId: editingShare.id
      });
    } catch (error) {
      logger.error('patient_sharing_modal_update_error', {
        message: 'Failed to update patient share',
        patientId: patient.id,
        shareId: editingShare.id,
        error: error.message
      });
      
      toast.error(`Update Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Revoke a share
   */
  const revokeShare = async (share) => {
    if (!patient) return;

    try {
      setLoading(true);
      
      await patientSharingApi.revokePatientShare(patient.id, share.shared_with_user_id);
      
      toast.success(`Access revoked for user ${share.shared_with_user_id}`);
      
      // Reload shares
      await loadPatientShares();
      
      if (onShareUpdate) {
        onShareUpdate();
      }
      
      logger.info('patient_sharing_modal_revoked', {
        message: 'Patient share revoked successfully',
        patientId: patient.id,
        shareId: share.id
      });
    } catch (error) {
      logger.error('patient_sharing_modal_revoke_error', {
        message: 'Failed to revoke patient share',
        patientId: patient.id,
        shareId: share.id,
        error: error.message
      });
      
      toast.error(`Revoke Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Start editing a share
   */
  const startEditShare = (share) => {
    setEditingShare(share);
    setFormData({
      shared_with_user_identifier: share.shared_with_username || share.shared_with_email || share.shared_with_user_id.toString(),
      permission_level: share.permission_level,
      expires_at: share.expires_at ? new Date(share.expires_at) : null,
      has_expiration: !!share.expires_at,
      custom_permissions: share.custom_permissions ? JSON.stringify(share.custom_permissions) : '',
    });
    setShowCreateForm(true);
  };

  /**
   * Get permission level color
   */
  const getPermissionColor = (level) => {
    switch (level) {
      case 'view': return 'blue';
      case 'edit': return 'orange';
      case 'full': return 'red';
      default: return 'gray';
    }
  };

  /**
   * Format expiration date
   */
  const formatExpirationDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  /**
   * Check if share is expired
   */
  const isShareExpired = (share) => {
    if (!share.expires_at) return false;
    return new Date(share.expires_at) < new Date();
  };

  if (!patient) {
    return null;
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconShare size="1.2rem" />
          <Text fw={500}>Share Patient: {patient.first_name} {patient.last_name}</Text>
        </Group>
      }
      size="xl"
      padding="lg"
    >
      <Stack gap="md">
        {/* Error Alert */}
        {error && (
          <Alert
            icon={<IconAlertCircle size="1rem" />}
            title="Error"
            color="red"
            variant="light"
          >
            {error}
          </Alert>
        )}

        {/* Patient Info */}
        <Card withBorder>
          <Group gap="sm">
            <Avatar color="blue" radius="xl">
              <IconUser size="1.2rem" />
            </Avatar>
            <div>
              <Text fw={500} size="lg">
                {patient.first_name} {patient.last_name}
              </Text>
              <Text size="sm" c="dimmed">
                Born: {patient.birth_date} • Privacy: {patient.privacy_level}
              </Text>
            </div>
          </Group>
        </Card>

        {/* Action Buttons */}
        <Group justify="space-between">
          <Button
            variant="light"
            color="blue"
            leftSection={<IconShare size="1rem" />}
            onClick={() => setShowCreateForm(true)}
            disabled={loading}
          >
            New Share
          </Button>
          
          <Button
            variant="light"
            color="gray"
            leftSection={<IconRefresh size="1rem" />}
            onClick={loadPatientShares}
            loading={loading}
          >
            Refresh
          </Button>
        </Group>

        {/* Create/Edit Form */}
        {showCreateForm && (
          <Paper withBorder p="md">
            <form onSubmit={handleFormSubmit}>
              <Stack gap="md">
                <Title order={5}>
                  {editingShare ? 'Edit Share' : 'Create New Share'}
                </Title>

                <TextInput
                  label="Username or Email"
                  placeholder="Enter username or email to share with"
                  required
                  disabled={!!editingShare}
                  value={formData.shared_with_user_identifier}
                  onChange={(e) => setFormData({...formData, shared_with_user_identifier: e.target.value})}
                  error={formErrors.shared_with_user_identifier}
                />

                <Select
                  label="Permission Level"
                  placeholder="Select permission level"
                  required
                  data={[
                    { value: 'view', label: 'View - Can view patient data' },
                    { value: 'edit', label: 'Edit - Can view and edit patient data' },
                    { value: 'full', label: 'Full - Can view, edit, and manage patient' },
                  ]}
                  value={formData.permission_level}
                  onChange={(value) => setFormData({...formData, permission_level: value})}
                  error={formErrors.permission_level}
                />

                <Switch
                  label="Set expiration date"
                  checked={formData.has_expiration}
                  onChange={(event) => setFormData({...formData, has_expiration: event.currentTarget.checked})}
                />

                {formData.has_expiration && (
                  <TextInput
                    type="datetime-local"
                    label="Expires At"
                    placeholder="Select expiration date and time"
                    value={formData.expires_at ? new Date(formData.expires_at - formData.expires_at.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setFormData({...formData, expires_at: e.target.value ? new Date(e.target.value) : null})}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                )}

                <Textarea
                  label="Custom Permissions (JSON)"
                  placeholder='{"can_export": true, "can_share": false}'
                  description="Optional custom permissions as JSON object"
                  value={formData.custom_permissions}
                  onChange={(e) => setFormData({...formData, custom_permissions: e.target.value})}
                />

                <Group justify="flex-end">
                  <Button
                    variant="light"
                    color="gray"
                    onClick={() => {
                      setShowCreateForm(false);
                      setEditingShare(null);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    color="blue"
                    loading={loading}
                  >
                    {editingShare ? 'Update Share' : 'Create Share'}
                  </Button>
                </Group>
              </Stack>
            </form>
          </Paper>
        )}

        {/* Existing Shares */}
        <div>
          <Title order={5} mb="md">
            <IconUsers size="1rem" style={{ marginRight: 8 }} />
            Current Shares ({shares.length})
          </Title>

          {loading && shares.length === 0 ? (
            <Group justify="center" py="xl">
              <Loader size="md" />
            </Group>
          ) : shares.length === 0 ? (
            <Alert
              icon={<IconAlertCircle size="1rem" />}
              title="No shares found"
              color="gray"
              variant="light"
            >
              This patient is not currently shared with anyone.
            </Alert>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>User</Table.Th>
                  <Table.Th>Permission</Table.Th>
                  <Table.Th>Expires</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {shares.map((share) => (
                  <Table.Tr key={share.id}>
                    <Table.Td>
                      <Group gap="sm">
                        <Avatar size="sm" color="blue">
                          <IconUser size="0.8rem" />
                        </Avatar>
                        <div>
                          <Text size="sm" fw={500}>
                            {share.shared_with_full_name || `User ${share.shared_with_user_id}`}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {share.shared_with_email || `ID: ${share.shared_with_user_id}`}
                          </Text>
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={getPermissionColor(share.permission_level)}
                        variant="light"
                      >
                        {share.permission_level}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <IconClock size="0.8rem" />
                        <Text size="sm">
                          {formatExpirationDate(share.expires_at)}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={isShareExpired(share) ? 'red' : 'green'}
                        variant="light"
                      >
                        {isShareExpired(share) ? 'Expired' : 'Active'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Tooltip label="Edit share">
                          <ActionIcon
                            variant="light"
                            color="blue"
                            size="sm"
                            onClick={() => startEditShare(share)}
                            disabled={loading}
                          >
                            <IconEdit size="0.8rem" />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Revoke share">
                          <ActionIcon
                            variant="light"
                            color="red"
                            size="sm"
                            onClick={() => revokeShare(share)}
                            disabled={loading}
                          >
                            <IconTrash size="0.8rem" />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </div>
      </Stack>
    </Modal>
  );
};

export default PatientSharingModal;