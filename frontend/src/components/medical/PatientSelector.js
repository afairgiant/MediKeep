/**
 * PatientSelector Component - Netflix-style patient switching
 * Allows users to switch between owned and shared patients
 */

import React, { useState, useEffect } from 'react';
import {
  Select,
  Group,
  Avatar,
  Text,
  Button,
  ActionIcon,
  Stack,
  Badge,
  Divider,
  Box,
  Loader,
  Alert,
  Modal,
  Paper,
  Title,
  Flex,
  Tooltip,
  Menu,
} from '@mantine/core';
import {
  IconUser,
  IconPlus,
  IconRefresh,
  IconChevronDown,
  IconUsers,
  IconShare,
  IconCheck,
  IconAlertCircle,
  IconUserCheck,
  IconEdit,
  IconTrash,
  IconDots,
  IconUserX,
  IconChevronUp,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import patientApi from '../../services/api/patientApi';
import patientSharingApi from '../../services/api/patientSharingApi';
import logger from '../../services/logger';
import PatientForm from './PatientForm';
import PatientSharingModal from './PatientSharingModal';

const PatientSelector = ({ onPatientChange, currentPatientId, loading: externalLoading = false, compact = false }) => {
  const { user: currentUser } = useAuth();
  const [patients, setPatients] = useState([]);
  const [activePatient, setActivePatient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [isMinimized, setIsMinimized] = useState(compact);
  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [sharingModalOpened, { open: openSharingModal, close: closeSharingModal }] = useDisclosure(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [sharingPatient, setSharingPatient] = useState(null);

  // Load patients on component mount only
  useEffect(() => {
    loadPatients();
  }, []);
  
  // Load stats after patients are loaded (only once after initial load)
  useEffect(() => {
    if (patients.length > 0 && initialLoadComplete) {
      loadStats();
    }
  }, [initialLoadComplete]); // Only depend on initialLoadComplete to run once

  // Update active patient when currentPatientId changes (but not on every render)
  useEffect(() => {
    if (currentPatientId && patients.length > 0) {
      const patient = patients.find(p => p.id === currentPatientId);
      if (patient && patient.id !== activePatient?.id) {
        setActivePatient(patient);
      }
    }
  }, [currentPatientId]); // Only depend on currentPatientId changes

  /**
   * Load accessible patients
   */
  const loadPatients = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use the new Phase 1 API
      const response = await patientApi.getAccessiblePatients('view');
      setPatients(response.patients || []);
      
      // If no active patient is set and this is the initial load, try to get the active patient from API
      if (!activePatient && response.patients && response.patients.length > 0 && !initialLoadComplete) {
        try {
          const activePatientData = await patientApi.getActivePatient();
          if (activePatientData) {
            setActivePatient(activePatientData);
            if (onPatientChange) {
              onPatientChange(activePatientData);
            }
          } else {
            // No active patient set, use first patient
            const firstPatient = response.patients[0];
            setActivePatient(firstPatient);
            if (onPatientChange) {
              onPatientChange(firstPatient);
            }
          }
        } catch (error) {
          // If API call fails, just use first patient
          const firstPatient = response.patients[0];
          setActivePatient(firstPatient);
          if (onPatientChange) {
            onPatientChange(firstPatient);
          }
        }
      }
      
      logger.debug('patient_selector_loaded', {
        message: 'Patients loaded successfully',
        count: response.total_count || 0,
        owned: response.owned_count || 0,
        shared: response.shared_count || 0
      });
    } catch (error) {
      logger.error('patient_selector_error', {
        message: 'Failed to load patients',
        error: error.message
      });
      setError(error.message);
      setPatients([]);
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  };

  // Removed loadActivePatient function - now handled in loadPatients

  /**
   * Load patient statistics - use data from patient list instead of separate API
   */
  const loadStats = async () => {
    try {
      // Get the latest patient list data which includes the correct counts
      const response = await patientApi.getAccessiblePatients('view');
      
      // Use the counts from the patient list response
      const statsData = {
        owned_count: response.owned_count || 0,
        accessible_count: response.total_count || 0,
        has_self_record: response.patients?.some(p => p.is_self_record) || false,
        active_patient_id: activePatient?.id || null,
        sharing_stats: {
          owned: response.owned_count || 0,
          shared_with_me: response.shared_count || 0,
          total_accessible: response.total_count || 0
        }
      };
      
      setStats(statsData);
    } catch (error) {
      logger.error('patient_selector_stats_error', {
        message: 'Failed to load patient stats',
        error: error.message
      });
      // Fallback stats - calculate from current patients array
      const fallbackStats = {
        owned_count: patients.filter(p => isPatientOwned(p)).length,
        accessible_count: patients.length,
        has_self_record: patients.some(p => p.is_self_record),
        sharing_stats: {
          owned: patients.filter(p => isPatientOwned(p)).length,
          shared_with_me: patients.filter(p => !isPatientOwned(p)).length,
          total_accessible: patients.length
        }
      };
      setStats(fallbackStats);
    }
  };

  /**
   * Switch to a different patient
   */
  const switchPatient = async (patientId) => {
    if (!patientId || parseInt(patientId) === parseInt(activePatient?.id)) return;

    try {
      setLoading(true);
      
      // Use the new Phase 1 API to switch active patient
      const switchedPatient = await patientApi.switchActivePatient(patientId);
      setActivePatient(switchedPatient);
      
      if (onPatientChange) {
        onPatientChange(switchedPatient);
      }
      
      toast.success(`Now viewing ${switchedPatient.first_name} ${switchedPatient.last_name}`);
      
      logger.info('patient_selector_switched', {
        message: 'Patient switched successfully',
        patientId: switchedPatient.id,
        patientName: `${switchedPatient.first_name} ${switchedPatient.last_name}`
      });
    } catch (error) {
      logger.error('patient_selector_switch_error', {
        message: 'Failed to switch patient',
        patientId,
        error: error.message
      });
      
      toast.error(`Switch Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Refresh patient list (safer version that doesn't trigger auto-selection)
   */
  const refreshPatients = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use the new Phase 1 API
      const response = await patientApi.getAccessiblePatients('view');
      setPatients(response.patients || []);
      
      // Don't auto-select first patient on refresh - keep current active patient
      
      logger.debug('patient_selector_refreshed', {
        message: 'Patients refreshed successfully',
        count: response.total_count || 0,
        owned: response.owned_count || 0,
        shared: response.shared_count || 0
      });
    } catch (error) {
      logger.error('patient_selector_refresh_error', {
        message: 'Failed to refresh patients',
        error: error.message
      });
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Edit a patient
   */
  const editPatient = (patient) => {
    setEditingPatient(patient);
    openEditModal();
  };

  /**
   * Open sharing modal for a patient
   */
  const sharePatient = (patient) => {
    setSharingPatient(patient);
    openSharingModal();
  };

  /**
   * Check if the current user owns this patient
   */
  const isPatientOwned = (patient) => {
    return currentUser && patient.owner_user_id === currentUser.id;
  };

  /**
   * Delete a patient (only for owned patients)
   */
  const deletePatient = async (patient) => {
    if (!isPatientOwned(patient)) {
      toast.error('You can only delete patients that you own');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${patient.first_name} ${patient.last_name}? This action cannot be undone and will delete all medical records for this patient.`)) {
      return;
    }

    try {
      setLoading(true);
      
      await patientApi.deletePatient(patient.id);
      
      toast.success(`Deleted ${patient.first_name} ${patient.last_name} successfully`);
      
      // If we deleted the active patient, clear it
      if (activePatient?.id === patient.id) {
        setActivePatient(null);
        if (onPatientChange) {
          onPatientChange(null);
        }
      }
      
      // Refresh patient list
      await refreshPatients();
      
      logger.info('patient_selector_deleted', {
        message: 'Patient deleted successfully',
        patientId: patient.id,
        patientName: `${patient.first_name} ${patient.last_name}`
      });
    } catch (error) {
      logger.error('patient_selector_delete_error', {
        message: 'Failed to delete patient',
        patientId: patient.id,
        error: error.message
      });
      
      toast.error(`Delete Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Remove shared access to a patient (only for shared patients)
   */
  const removeSharedAccess = async (patient) => {
    if (isPatientOwned(patient)) {
      toast.error('You cannot remove access to patients that you own');
      return;
    }

    if (!window.confirm(`Are you sure you want to remove access to ${patient.first_name} ${patient.last_name}? This patient will no longer appear in your patient list.`)) {
      return;
    }

    try {
      setLoading(true);
      
      // Revoke the share
      await patientSharingApi.revokePatientShare(patient.id, currentUser.id);
      
      toast.success(`Removed access to ${patient.first_name} ${patient.last_name}`);
      
      // If we removed access to the active patient, clear it
      if (activePatient?.id === patient.id) {
        setActivePatient(null);
        if (onPatientChange) {
          onPatientChange(null);
        }
      }
      
      // Refresh patient list
      await refreshPatients();
      
      logger.info('patient_selector_access_removed', {
        message: 'Shared patient access removed successfully',
        patientId: patient.id,
        patientName: `${patient.first_name} ${patient.last_name}`
      });
    } catch (error) {
      logger.error('patient_selector_access_remove_error', {
        message: 'Failed to remove shared patient access',
        patientId: patient.id,
        error: error.message
      });
      
      toast.error(`Remove Access Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Format patient display name
   */
  const formatPatientName = (patient) => {
    return `${patient.first_name} ${patient.last_name}`;
  };

  /**
   * Get patient type badge
   */
  const getPatientBadge = (patient) => {
    if (patient.is_self_record) {
      return (
        <Badge size="xs" color="blue" variant="light">
          <IconUserCheck size="0.7rem" style={{ marginRight: 4 }} />
          Self
        </Badge>
      );
    }
    
    // Check if this is a shared patient (not owned by current user)
    if (!isPatientOwned(patient)) {
      return (
        <Badge size="xs" color="green" variant="light">
          <IconShare size="0.7rem" style={{ marginRight: 4 }} />
          Shared
        </Badge>
      );
    }
    
    return null;
  };

  /**
   * Render patient option for select
   */
  const renderPatientOption = (patient) => (
    <Group gap="sm" key={patient.id}>
      <Avatar size="sm" color="blue" radius="xl">
        <IconUser size="1rem" />
      </Avatar>
      <div style={{ flex: 1 }}>
        <Text size="sm" fw={500}>
          {formatPatientName(patient)}
        </Text>
        <Text size="xs" c="dimmed">
          {patient.birth_date} • {patient.privacy_level}
        </Text>
      </div>
      {getPatientBadge(patient)}
    </Group>
  );

  /**
   * Create select data for patients
   */
  const selectData = patients.map(patient => ({
    value: patient.id.toString(),
    label: formatPatientName(patient),
    patient: patient
  }));

  if (error) {
    return (
      <Alert
        icon={<IconAlertCircle size="1rem" />}
        title="Failed to load patients"
        color="red"
        variant="light"
      >
        {error}
        <Button
          size="xs"
          variant="light"
          color="red"
          onClick={refreshPatients}
          mt="sm"
        >
          Retry
        </Button>
      </Alert>
    );
  }

  // Minimized view - single line with patient name and expand button
  if (isMinimized && activePatient) {
    return (
      <Group gap="sm" p="xs" style={{ borderRadius: 8, border: '1px solid #e9ecef' }}>
        <Avatar size="sm" color="blue" radius="xl">
          <IconUser size="0.8rem" />
        </Avatar>
        <Text fw={500} size="sm" style={{ flex: 1 }}>
          {formatPatientName(activePatient)}
        </Text>
        {getPatientBadge(activePatient)}
        
        {/* Loading indicator */}
        {(loading || externalLoading) && <Loader size="xs" />}
        
        {/* Expand button */}
        <Tooltip label="Expand patient selector">
          <ActionIcon
            variant="subtle"
            color="blue"
            size="sm"
            onClick={() => setIsMinimized(false)}
            disabled={loading || externalLoading}
          >
            <IconChevronDown size="0.8rem" />
          </ActionIcon>
        </Tooltip>
        
        {/* Quick patient switch menu */}
        <Menu shadow="md" width={300}>
          <Menu.Target>
            <Tooltip label="Switch patient">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                disabled={loading || externalLoading}
              >
                <IconUsers size="0.8rem" />
              </ActionIcon>
            </Tooltip>
          </Menu.Target>
          
          <Menu.Dropdown>
            <Menu.Label>Switch to Patient</Menu.Label>
            {patients.map((patient) => (
              <Menu.Item
                key={patient.id}
                leftSection={
                  <Avatar size="xs" color="blue" radius="xl">
                    <IconUser size="0.6rem" />
                  </Avatar>
                }
                rightSection={getPatientBadge(patient)}
                onClick={() => switchPatient(patient.id)}
                disabled={patient.id === activePatient?.id}
              >
                <div>
                  <Text size="sm" fw={patient.id === activePatient?.id ? 600 : 500}>
                    {formatPatientName(patient)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {patient.birth_date}
                  </Text>
                </div>
              </Menu.Item>
            ))}
            
            <Menu.Divider />
            <Menu.Item
              leftSection={<IconPlus size="0.8rem" />}
              onClick={openCreateModal}
            >
              Add New Patient
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    );
  }

  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Title order={4} c="blue">
            <IconUsers size="1.2rem" style={{ marginRight: 8 }} />
            Patient Selector
          </Title>
          
          <Group gap="xs">
            {/* Minimize button */}
            <Tooltip label="Minimize to one line">
              <ActionIcon
                variant="light"
                color="gray"
                onClick={() => setIsMinimized(true)}
                disabled={loading || externalLoading}
              >
                <IconChevronUp size="1rem" />
              </ActionIcon>
            </Tooltip>
            
            <Tooltip label="Refresh patients">
              <ActionIcon
                variant="light"
                color="blue"
                onClick={refreshPatients}
                loading={loading || externalLoading}
                disabled={externalLoading}
              >
                <IconRefresh size="1rem" />
              </ActionIcon>
            </Tooltip>
            
            <Tooltip label="Add new patient">
              <ActionIcon
                variant="light"
                color="green"
                onClick={openCreateModal}
                disabled={loading || externalLoading}
              >
                <IconPlus size="1rem" />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {/* Current Patient Display */}
        {activePatient && (
          <Box>
            <Text size="sm" c="dimmed" mb="xs">
              Currently viewing:
            </Text>
            <Group gap="sm" p="sm" bg="blue.0" style={{ borderRadius: 8, position: 'relative' }}>
              <Avatar color="blue" radius="xl">
                <IconUser size="1.2rem" />
              </Avatar>
              <div style={{ flex: 1 }}>
                <Text fw={500} size="lg">
                  {formatPatientName(activePatient)}
                </Text>
                <Text size="sm" c="dimmed">
                  Born: {activePatient.birth_date}
                </Text>
              </div>
              {getPatientBadge(activePatient)}
              
              {/* Loading overlay */}
              {externalLoading && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  zIndex: 1
                }}>
                  <Loader size="sm" />
                </div>
              )}
              
              {/* Patient Actions Menu */}
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <ActionIcon variant="light" color="blue" disabled={loading || externalLoading}>
                    <IconDots size="1rem" />
                  </ActionIcon>
                </Menu.Target>

                <Menu.Dropdown>
                  <Menu.Label>Patient Actions</Menu.Label>
                  
                  {/* Edit is available for owned patients only */}
                  {isPatientOwned(activePatient) && (
                    <Menu.Item
                      leftSection={<IconEdit size="0.9rem" />}
                      onClick={() => editPatient(activePatient)}
                    >
                      Edit Patient
                    </Menu.Item>
                  )}
                  
                  {/* Share is available for owned patients only */}
                  {isPatientOwned(activePatient) && (
                    <Menu.Item
                      leftSection={<IconShare size="0.9rem" />}
                      onClick={() => sharePatient(activePatient)}
                    >
                      Share Patient
                    </Menu.Item>
                  )}
                  
                  {/* Show different actions based on ownership */}
                  {isPatientOwned(activePatient) ? (
                    // For owned patients: show delete option (except self-record)
                    !activePatient.is_self_record && (
                      <>
                        <Menu.Divider />
                        <Menu.Item
                          leftSection={<IconTrash size="0.9rem" />}
                          color="red"
                          onClick={() => deletePatient(activePatient)}
                        >
                          Delete Patient
                        </Menu.Item>
                      </>
                    )
                  ) : (
                    // For shared patients: show remove access option
                    <>
                      <Menu.Divider />
                      <Menu.Item
                        leftSection={<IconUserX size="0.9rem" />}
                        color="orange"
                        onClick={() => removeSharedAccess(activePatient)}
                      >
                        Remove Access
                      </Menu.Item>
                    </>
                  )}
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Box>
        )}

        {/* Patient Selector */}
        <Box>
          <Text size="sm" c="dimmed" mb="xs">
            {externalLoading ? 'Switching patient...' : 'Switch to another patient:'}
          </Text>
          
          <Select
            placeholder={externalLoading ? "Loading..." : "Select a patient to switch to..."}
            data={selectData}
            value={activePatient?.id?.toString() || ''}
            onChange={(value) => value && switchPatient(parseInt(value))}
            searchable
            clearable
            disabled={loading || externalLoading}
            rightSection={(loading || externalLoading) ? <Loader size="xs" /> : <IconChevronDown size="1rem" />}
            renderOption={({ option }) => renderPatientOption(option.patient)}
          />
        </Box>

        {/* Statistics */}
        {stats && (
          <Box>
            <Divider my="sm" />
            <Flex gap="md" justify="space-between">
              <Group gap="xs">
                <IconUser size="1rem" />
                <Text size="sm">
                  Owned: <Text span fw={500}>{stats.owned_count}</Text>
                </Text>
              </Group>
              
              <Group gap="xs">
                <IconShare size="1rem" />
                <Text size="sm">
                  Shared: <Text span fw={500}>{stats.sharing_stats?.shared_with_me || 0}</Text>
                </Text>
              </Group>
              
              <Group gap="xs">
                <IconUsers size="1rem" />
                <Text size="sm">
                  Total: <Text span fw={500}>{stats.accessible_count}</Text>
                </Text>
              </Group>
            </Flex>
          </Box>
        )}

        {/* No patients message */}
        {!loading && patients.length === 0 && (
          <Alert
            icon={<IconAlertCircle size="1rem" />}
            title="No patients found"
            color="yellow"
            variant="light"
          >
            You don't have access to any patients yet. Create a new patient to get started.
          </Alert>
        )}
      </Stack>

      {/* Create Patient Modal */}
      <Modal
        opened={createModalOpened}
        onClose={closeCreateModal}
        title="Create New Patient"
        size="lg"
        padding="lg"
      >
        <PatientForm
          onSuccess={(newPatient) => {
            // Refresh patient list and switch to new patient
            refreshPatients();
            setActivePatient(newPatient);
            if (onPatientChange) {
              onPatientChange(newPatient);
            }
            closeCreateModal();
            toast.success(`Now viewing ${newPatient.first_name} ${newPatient.last_name}`);
          }}
          onCancel={closeCreateModal}
          isModal={true}
        />
      </Modal>

      {/* Edit Patient Modal */}
      <Modal
        opened={editModalOpened}
        onClose={() => {
          closeEditModal();
          setEditingPatient(null);
        }}
        title="Edit Patient"
        size="lg"
        padding="lg"
      >
        <PatientForm
          patient={editingPatient}
          onSuccess={(updatedPatient) => {
            // Refresh patient list and update active patient if needed
            refreshPatients();
            if (activePatient?.id === updatedPatient.id) {
              setActivePatient(updatedPatient);
              if (onPatientChange) {
                onPatientChange(updatedPatient);
              }
            }
            closeEditModal();
            setEditingPatient(null);
            toast.success(`Updated ${updatedPatient.first_name} ${updatedPatient.last_name} successfully`);
          }}
          onCancel={() => {
            closeEditModal();
            setEditingPatient(null);
          }}
          isModal={true}
        />
      </Modal>

      {/* Patient Sharing Modal */}
      <PatientSharingModal
        opened={sharingModalOpened}
        onClose={() => {
          closeSharingModal();
          setSharingPatient(null);
        }}
        patient={sharingPatient}
        onSuccess={() => {
          // Optionally refresh data if sharing affects patient list
          refreshPatients();
          closeSharingModal();
          setSharingPatient(null);
        }}
      />
    </Paper>
  );
};

export default PatientSelector;