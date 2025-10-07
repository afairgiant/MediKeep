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
  useMantineColorScheme,
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
import { usePatientList, useCacheManager } from '../../hooks/useGlobalData';
import { formatRelationshipLabel } from '../../constants/relationshipOptions';
import patientApi from '../../services/api/patientApi';
import patientSharingApi from '../../services/api/patientSharingApi';
import logger from '../../services/logger';
import PatientForm from './PatientForm';
import PatientSharingModal from './PatientSharingModal';
import PatientAvatar from '../shared/PatientAvatar';

const PatientSelector = ({ onPatientChange, currentPatientId, loading: externalLoading = false, compact = false }) => {
  const { colorScheme } = useMantineColorScheme();
  const { user: currentUser } = useAuth();
  
  // Use cached patient list from global state
  const { patientList: patients, loading: patientListLoading, error: patientListError, refresh: refreshPatientList } = usePatientList();
  
  // Use cache manager for invalidating cache when needed
  const { invalidatePatientList } = useCacheManager();
  
  const [activePatient, setActivePatient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [isMinimized, setIsMinimized] = useState(compact);
  const [patientPhotos, setPatientPhotos] = useState({}); // Store patient photos by patient ID
  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [sharingModalOpened, { open: openSharingModal, close: closeSharingModal }] = useDisclosure(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [sharingPatient, setSharingPatient] = useState(null);

  // Combine loading states
  const combinedLoading = loading || patientListLoading;
  const combinedError = error || patientListError;

  // Initialize active patient when patients are loaded from cache
  useEffect(() => {
    if (patients.length > 0 && !initialLoadComplete) {
      initializeActivePatient();
    }
  }, [patients.length, initialLoadComplete]);
  
  // Load stats after patients are loaded (only once after initial load)
  useEffect(() => {
    if (patients.length > 0 && initialLoadComplete) {
      loadStats();
      loadPatientPhotos(); // Load photos for all patients
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
   * Initialize active patient from cached data
   */
  const initializeActivePatient = async () => {
    if (patients.length === 0) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // If no active patient is set and this is the initial load, try to get the active patient from API
      if (!activePatient && !initialLoadComplete) {
        try {
          const activePatientData = await patientApi.getActivePatient();
          if (activePatientData) {
            setActivePatient(activePatientData);
            if (onPatientChange) {
              onPatientChange(activePatientData);
            }
          } else {
            // No active patient set, use first patient
            const firstPatient = patients[0];
            setActivePatient(firstPatient);
            if (onPatientChange) {
              onPatientChange(firstPatient);
            }
          }
        } catch (error) {
          // If API call fails, just use first patient
          const firstPatient = patients[0];
          setActivePatient(firstPatient);
          if (onPatientChange) {
            onPatientChange(firstPatient);
          }
        }
      }
      
      logger.debug('patient_selector_initialized', {
        message: 'Active patient initialized from cached data',
        count: patients.length,
        activePatientId: activePatient?.id
      });
    } catch (error) {
      logger.error('patient_selector_init_error', {
        message: 'Failed to initialize active patient',
        error: error.message
      });
      setError(error.message);
    } finally {
      setLoading(false);
      setInitialLoadComplete(true);
    }
  };

  // Removed loadActivePatient function - now handled in loadPatients

  /**
   * Load patient photos for all available patients with concurrency limit
   */
  const loadPatientPhotos = async () => {
    if (patients.length === 0) return;

    try {
      logger.debug('patient_selector_photos_start', {
        message: 'Loading patient photos for selector',
        patientCount: patients.length
      });

      // Load photos with concurrency limit to avoid overwhelming the server
      const BATCH_SIZE = 5; // Load 5 photos at a time
      const photoResults = [];

      for (let i = 0; i < patients.length; i += BATCH_SIZE) {
        const batch = patients.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (patient) => {
          try {
            const photoUrl = await patientApi.getPhotoUrl(patient.id);
            return { patientId: patient.id, photoUrl };
          } catch (error) {
            // If photo doesn't exist or fails to load, return null
            logger.debug('patient_selector_photo_failed', {
              message: 'Failed to load photo for patient',
              patientId: patient.id,
              error: error.message
            });
            return { patientId: patient.id, photoUrl: null };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        photoResults.push(...batchResults);
      }

      // Update state with all photos
      const photoMap = {};
      photoResults.forEach(({ patientId, photoUrl }) => {
        photoMap[patientId] = photoUrl;
      });

      setPatientPhotos(photoMap);

      logger.debug('patient_selector_photos_loaded', {
        message: 'Patient photos loaded successfully',
        photosCount: Object.values(photoMap).filter(url => url !== null).length,
        totalPatients: patients.length
      });
    } catch (error) {
      logger.error('patient_selector_photos_error', {
        message: 'Failed to load patient photos',
        error: error.message
      });
    }
  };

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
   * Refresh patient list (uses cached refresh)
   */
  const refreshPatients = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use the cached refresh function
      await refreshPatientList();
      
      logger.debug('patient_selector_refreshed', {
        message: 'Patients refreshed successfully from cache',
        count: patients.length
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
   * Find a fallback patient to switch to (prioritize self-record, then other owned patients)
   */
  const findFallbackPatient = async () => {
    try {
      // Wait a bit for the patient list to be updated after invalidation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Trigger refresh to ensure we have the latest data
      await refreshPatientList();
      
      // Get current patient list (should now exclude the removed patient)
      const currentPatients = patients || [];
      const ownedPatients = currentPatients.filter(p => isPatientOwned(p));
      
      if (ownedPatients.length === 0) {
        logger.info('patient_selector_no_owned_patients', {
          message: 'No owned patients available for fallback'
        });
        return null;
      }
      
      // Prioritize self-record
      const selfRecord = ownedPatients.find(p => p.is_self_record);
      if (selfRecord) {
        logger.debug('patient_selector_fallback_self_record', {
          message: 'Found self-record for fallback',
          patientId: selfRecord.id
        });
        return selfRecord;
      }
      
      // Fall back to first owned patient
      const firstOwned = ownedPatients[0];
      logger.debug('patient_selector_fallback_owned', {
        message: 'Found owned patient for fallback',
        patientId: firstOwned.id
      });
      return firstOwned;
      
    } catch (error) {
      logger.error('patient_selector_fallback_error', {
        message: 'Error finding fallback patient',
        error: error.message
      });
      return null;
    }
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
      
      logger.info('patient_selector_delete_start', {
        message: 'Starting patient deletion',
        patientId: patient.id,
        patientName: `${patient.first_name} ${patient.last_name}`
      });
      
      await patientApi.deletePatient(patient.id);
      
      logger.info('patient_selector_delete_api_success', {
        message: 'Patient deletion API call succeeded',
        patientId: patient.id
      });
      
      // If we deleted the active patient, find a fallback patient
      if (activePatient?.id === patient.id) {
        logger.info('patient_selector_deleting_active', {
          message: 'Deleted patient was active, finding fallback',
          patientId: patient.id
        });
        
        // Clear active patient first
        setActivePatient(null);
        if (onPatientChange) {
          onPatientChange(null);
        }
        
        // Invalidate patient list cache to get updated data
        await invalidatePatientList();
        
        // Find a fallback patient after the list is refreshed
        const fallbackPatient = await findFallbackPatient();
        
        if (fallbackPatient) {
          logger.info('patient_selector_delete_fallback', {
            message: 'Auto-switching to fallback patient after deletion',
            deletedPatientId: patient.id,
            fallbackPatientId: fallbackPatient.id,
            fallbackType: fallbackPatient.is_self_record ? 'self_record' : 'owned_patient'
          });
          
          setActivePatient(fallbackPatient);
          if (onPatientChange) {
            onPatientChange(fallbackPatient);
          }
          
          toast.success(`Deleted ${patient.first_name} ${patient.last_name} successfully. Switched to ${fallbackPatient.first_name} ${fallbackPatient.last_name}.`);
        } else {
          logger.info('patient_selector_delete_no_fallback', {
            message: 'No fallback patient available after deletion',
            deletedPatientId: patient.id
          });
          
          toast.success(`Deleted ${patient.first_name} ${patient.last_name} successfully. No other patients available.`);
        }
      } else {
        // Just invalidate the list if we didn't delete the active patient
        await invalidatePatientList();
        toast.success(`Deleted ${patient.first_name} ${patient.last_name} successfully`);
      }
      
      logger.info('patient_selector_deleted', {
        message: 'Patient deleted successfully',
        patientId: patient.id,
        patientName: `${patient.first_name} ${patient.last_name}`
      });
    } catch (error) {
      logger.error('patient_selector_delete_error', {
        message: 'Failed to delete patient',
        patientId: patient.id,
        error: error.message,
        errorStack: error.stack
      });
      
      toast.error(`Delete Failed: ${error.message || 'Unknown error occurred'}`);
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
      
      // Remove my access to the shared patient
      await patientSharingApi.removeMyAccess(patient.id);
      
      toast.success(`Removed access to ${patient.first_name} ${patient.last_name}`);
      
      // Invalidate patient list cache to force fresh data
      await invalidatePatientList();
      
      // If we removed access to the active patient, switch to a fallback patient
      if (activePatient?.id === patient.id) {
        // Find a fallback patient (prioritize self-record, then other owned patients)
        const fallbackPatient = await findFallbackPatient();
        
        if (fallbackPatient) {
          logger.info('patient_selector_auto_switch', {
            message: 'Auto-switching to fallback patient after removing access',
            fromPatientId: patient.id,
            toPatientId: fallbackPatient.id,
            fallbackType: fallbackPatient.is_self_record ? 'self_record' : 'owned_patient'
          });
          
          setActivePatient(fallbackPatient);
          if (onPatientChange) {
            onPatientChange(fallbackPatient);
          }
          
          toast.info(`Switched to ${fallbackPatient.first_name} ${fallbackPatient.last_name}`);
        } else {
          logger.info('patient_selector_no_fallback', {
            message: 'No fallback patient available, clearing active patient',
            removedPatientId: patient.id
          });
          
          setActivePatient(null);
          if (onPatientChange) {
            onPatientChange(null);
          }
        }
      }
      
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
   * Get patient photo URL or null if no photo
   */
  const getPatientPhoto = (patient) => {
    return patientPhotos[patient.id] || null;
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
  const renderPatientOption = (patient) => {
    const photoUrl = getPatientPhoto(patient);
    return (
      <Group gap="sm" key={patient.id}>
        <PatientAvatar
          photoUrl={photoUrl}
          patient={patient}
          size="sm"
          color="blue"
          radius="xl"
        />
        <div style={{ flex: 1 }}>
          <Text size="sm" fw={500}>
            {formatPatientName(patient)}
            {patient.relationship_to_self && (
              <Text span c="dimmed" ml="xs" fw={400}>
                ({formatRelationshipLabel(patient.relationship_to_self)})
              </Text>
            )}
          </Text>
          <Text size="xs" c="dimmed">
            {patient.birth_date} • {patient.privacy_level}
          </Text>
        </div>
        {getPatientBadge(patient)}
      </Group>
    );
  };

  /**
   * Create select data for patients
   */
  const selectData = patients.map(patient => ({
    value: patient.id.toString(),
    label: formatPatientName(patient),
    patient: patient
  }));

  if (combinedError) {
    return (
      <Alert
        icon={<IconAlertCircle size="1rem" />}
        title="Failed to load patients"
        color="red"
        variant="light"
      >
        {combinedError}
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
    const activePatientPhoto = getPatientPhoto(activePatient);
    return (
      <Group gap="sm" p="xs"
        styles={(theme) => ({
          root: {
            borderRadius: 8,
            border: `1px solid ${colorScheme === 'dark'
              ? theme.colors.dark[4]
              : theme.colors.gray[3]}`
          }
        })}>
        <PatientAvatar
          photoUrl={activePatientPhoto}
          patient={activePatient}
          size="sm"
          color="blue"
          radius="xl"
        />
        <div style={{ flex: 1 }}>
          <Text fw={500} size="sm">
            {formatPatientName(activePatient)}
            {activePatient.relationship_to_self && (
              <Text span c="dimmed" ml="xs">
                ({formatRelationshipLabel(activePatient.relationship_to_self)})
              </Text>
            )}
          </Text>
        </div>
        {getPatientBadge(activePatient)}
        
        {/* Loading indicator */}
        {(combinedLoading || externalLoading) && <Loader size="xs" />}
        
        {/* Expand button */}
        <Tooltip label="Expand patient selector">
          <ActionIcon
            variant="subtle"
            color="blue"
            size="sm"
            onClick={() => setIsMinimized(false)}
            disabled={combinedLoading || externalLoading}
          >
            <IconChevronDown size="0.8rem" />
          </ActionIcon>
        </Tooltip>
        
        {/* Quick patient switch menu */}
        <Menu shadow="md" width={300} position="bottom-start">
          <Menu.Target>
            <Tooltip label="Switch patient">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                disabled={combinedLoading || externalLoading}
              >
                <IconUsers size="0.8rem" />
              </ActionIcon>
            </Tooltip>
          </Menu.Target>
          
          <Menu.Dropdown>
            <Menu.Label>Switch to Patient</Menu.Label>
            {patients.map((patient) => {
              const patientPhoto = getPatientPhoto(patient);
              return (
                <Menu.Item
                  key={patient.id}
                  leftSection={
                    <PatientAvatar
                      photoUrl={patientPhoto}
                      patient={patient}
                      size="xs"
                      color="blue"
                      radius="xl"
                    />
                  }
                  rightSection={getPatientBadge(patient)}
                  onClick={() => switchPatient(patient.id)}
                  disabled={patient.id === activePatient?.id}
                >
                  <div>
                    <Text size="sm" fw={patient.id === activePatient?.id ? 600 : 500}>
                      {formatPatientName(patient)}
                      {patient.relationship_to_self && (
                        <Text span c="dimmed" ml="xs" fw={400}>
                          ({formatRelationshipLabel(patient.relationship_to_self)})
                        </Text>
                      )}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {patient.birth_date}
                    </Text>
                  </div>
                </Menu.Item>
              );
            })}
            
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
                loading={combinedLoading || externalLoading}
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
                disabled={combinedLoading || externalLoading}
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
            <Group gap="sm" p="sm" style={{ borderRadius: 8, position: 'relative' }}
              styles={(theme) => ({
                root: {
                  backgroundColor: colorScheme === 'dark'
                    ? theme.colors.dark[6]
                    : theme.colors.blue[0]
                }
              })}>
              <PatientAvatar
                photoUrl={getPatientPhoto(activePatient)}
                patient={activePatient}
                size="lg"
                color="blue"
                radius="xl"
              />
              <div style={{ flex: 1 }}>
                <Text fw={500} size="lg">
                  {formatPatientName(activePatient)}
                  {activePatient.relationship_to_self && (
                    <Text span c="dimmed" ml="xs" fw={400} size="md">
                      ({formatRelationshipLabel(activePatient.relationship_to_self)})
                    </Text>
                  )}
                </Text>
                <Text size="sm" c="dimmed">
                  Born: {activePatient.birth_date}
                </Text>
              </div>
              {getPatientBadge(activePatient)}
              
              {/* Loading overlay */}
              {externalLoading && (
                <Box style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                styles={(theme) => ({
                  root: {
                    backgroundColor: colorScheme === 'dark' 
                      ? 'rgba(0, 0, 0, 0.8)' 
                      : 'rgba(255, 255, 255, 0.8)',
                    borderRadius: 8,
                    zIndex: 1,
                  }
                })}>
                  <Loader size="sm" />
                </Box>
              )}
              
              {/* Patient Actions Menu */}
              <Menu shadow="md" width={200} position="bottom-end">
                <Menu.Target>
                  <ActionIcon variant="light" color="blue" disabled={combinedLoading || externalLoading}>
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
            disabled={combinedLoading || externalLoading}
            rightSection={(combinedLoading || externalLoading) ? <Loader size="xs" /> : undefined}
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
        {!combinedLoading && patients.length === 0 && (
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
          onSuccess={async (newPatient) => {
            // Invalidate patient list cache to force fresh data
            await invalidatePatientList();
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
          onSuccess={async (updatedPatient) => {
            // Invalidate patient list cache to force fresh data
            await invalidatePatientList();
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
        onSuccess={async () => {
          // Invalidate patient list cache in case sharing affects patient list
          await invalidatePatientList();
          closeSharingModal();
          setSharingPatient(null);
        }}
      />
    </Paper>
  );
};

export default PatientSelector;