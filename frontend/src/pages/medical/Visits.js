import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Container,
  Paper,
  Group,
  Text,
  Title,
  Stack,
  Alert,
  Loader,
  Center,
  Grid,
  Button,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCheck,
  IconPlus,
  IconCalendar,
  IconShieldCheck,
} from '@tabler/icons-react';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { usePractitioners } from '../../hooks/useGlobalData';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { getEntityFormatters } from '../../utils/tableFormatters';
import { navigateToEntity } from '../../utils/linkNavigation';
import { PageHeader } from '../../components';
import logger from '../../services/logger';
import { 
  ERROR_MESSAGES, 
  SUCCESS_MESSAGES,
  getUserFriendlyError
} from '../../constants/errorMessages';
import MantineFilters from '../../components/mantine/MantineFilters';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import FormLoadingOverlay from '../../components/shared/FormLoadingOverlay';
import { useFormSubmissionWithUploads } from '../../hooks/useFormSubmissionWithUploads';
import FileCountBadge from '../../components/shared/FileCountBadge';
// Import new modular components
import VisitCard from '../../components/medical/visits/VisitCard';
import VisitViewModal from '../../components/medical/visits/VisitViewModal';
import VisitFormWrapper from '../../components/medical/visits/VisitFormWrapper';

const Visits = () => {
  const [viewMode, setViewMode] = useState('cards');
  const navigate = useNavigate();
  const location = useLocation();

  // Get practitioners data
  const { practitioners } = usePractitioners();

  // Modern data management with useMedicalData for encounters
  const {
    items: visits,
    currentPatient,
    loading,
    error,
    successMessage,
    createItem,
    updateItem,
    deleteItem,
    refreshData,
    clearError,
    setError,
  } = useMedicalData({
    entityName: 'encounter',
    apiMethodsConfig: {
      getAll: signal => apiService.getEncounters(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientEncounters(patientId, signal),
      create: (data, signal) => apiService.createEncounter(data, signal),
      update: (id, data, signal) =>
        apiService.updateEncounter(id, data, signal),
      delete: (id, signal) => apiService.deleteEncounter(id, signal),
    },
    requiresPatient: true,
  });

  // Get standardized configuration
  const config = getMedicalPageConfig('visits');

  // Form submission with uploads hook
  const {
    submissionState,
    startSubmission,
    completeFormSubmission,
    startFileUpload,
    completeFileUpload,
    handleSubmissionFailure,
    resetSubmission,
    isBlocking,
    canSubmit,
    statusMessage,
  } = useFormSubmissionWithUploads({
    entityType: 'visit',
    onSuccess: () => {
      // Reset form and close modal on complete success
      setShowModal(false);
      setEditingVisit(null);
      setFormData({
        reason: '',
        date: '',
        notes: '',
        practitioner_id: '',
        condition_id: '',
        visit_type: '',
        chief_complaint: '',
        diagnosis: '',
        treatment_plan: '',
        follow_up_instructions: '',
        duration_minutes: '',
        location: '',
        priority: '',
      });
      
      // Only refresh if we created a new visit during form submission
      // Don't refresh after uploads complete to prevent resource exhaustion
      if (needsRefreshAfterSubmissionRef.current) {
        needsRefreshAfterSubmissionRef.current = false;
        refreshData();
      }
    },
    onError: (error) => {
      logger.error('visits_form_error', {
        message: 'Form submission error in visits',
        error,
        component: 'Visits',
      });
    },
    component: 'Visits',
  });

  // Use standardized data management
  const dataManagement = useDataManagement(visits, config);

  // Get patient conditions for linking
  const [conditions, setConditions] = useState([]);
  
  // File count management for cards
  const [fileCounts, setFileCounts] = useState({});
  const [fileCountsLoading, setFileCountsLoading] = useState({});

  // Document management state
  const [documentManagerMethods, setDocumentManagerMethods] = useState(null);
  const [viewDocumentManagerMethods, setViewDocumentManagerMethods] = useState(null);

  // Track if we need to refresh after form submission (but not after uploads)
  const needsRefreshAfterSubmissionRef = useRef(false);
  
  useEffect(() => {
    if (currentPatient?.id) {
      apiService.getPatientConditions(currentPatient.id)
        .then(response => {
          setConditions(response || []);
        })
        .catch(error => {
          console.error('Failed to fetch conditions:', error);
          setConditions([]);
        });
    }
  }, [currentPatient?.id]);

  // Load file counts for visits
  useEffect(() => {
    const loadFileCountsForVisits = async () => {
      if (!visits || visits.length === 0) return;
      
      const countPromises = visits.map(async (visit) => {
        setFileCountsLoading(prev => {
          if (prev[visit.id] !== undefined) return prev; // Already loading
          return { ...prev, [visit.id]: true };
        });
        
        try {
          const files = await apiService.getEntityFiles('visit', visit.id);
          const count = Array.isArray(files) ? files.length : 0;
          setFileCounts(prev => ({ ...prev, [visit.id]: count }));
        } catch (error) {
          console.error(`Error loading file count for visit ${visit.id}:`, error);
          setFileCounts(prev => ({ ...prev, [visit.id]: 0 }));
        } finally {
          setFileCountsLoading(prev => ({ ...prev, [visit.id]: false }));
        }
      });
      
      await Promise.all(countPromises);
    };

    loadFileCountsForVisits();
  }, [visits]); // Remove fileCounts from dependencies

  // Function to refresh file counts for all visits
  const refreshFileCount = useCallback(async (visitId) => {
    try {
      const files = await apiService.getEntityFiles('visit', visitId);
      const count = Array.isArray(files) ? files.length : 0;
      setFileCounts(prev => ({ ...prev, [visitId]: count }));
    } catch (error) {
      console.error(`Error refreshing file count for visit ${visitId}:`, error);
    }
  }, []);


  // Helper function to get condition details
  const getConditionDetails = (conditionId) => {
    if (!conditionId || conditions.length === 0) return null;
    return conditions.find(cond => cond.id === conditionId);
  };

  // Get standardized formatters for visits with condition linking
  const formatters = {
    ...getEntityFormatters('visits', [], navigate),
    condition_name: (value, visit) => {
      const condition = getConditionDetails(visit.condition_id);
      return condition?.diagnosis || '';
    },
  };

  // Form state
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingVisit, setViewingVisit] = useState(null);
  const [editingVisit, setEditingVisit] = useState(null);
  const [formData, setFormData] = useState({
    reason: '',
    date: '',
    notes: '',
    practitioner_id: '',
    condition_id: '',
    visit_type: '',
    chief_complaint: '',
    diagnosis: '',
    treatment_plan: '',
    follow_up_instructions: '',
    duration_minutes: '',
    location: '',
    priority: '',
  });

  const handleAddVisit = () => {
    resetSubmission(); // Reset submission state
    setEditingVisit(null);
    setDocumentManagerMethods(null); // Reset document manager methods
    setFormData({
      reason: '',
      date: '',
      notes: '',
      practitioner_id: '',
      condition_id: '',
      visit_type: '',
      chief_complaint: '',
      diagnosis: '',
      treatment_plan: '',
      follow_up_instructions: '',
      duration_minutes: '',
      location: '',
      priority: '',
    });
    setShowModal(true);
  };

  const handleViewVisit = visit => {
    setViewingVisit(visit);
    setShowViewModal(true);
    // Update URL with visit ID for sharing/bookmarking
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', visit.id);
    navigate(`${location.pathname}?${searchParams.toString()}`, {
      replace: true,
    });
  };

  const handleEditVisit = visit => {
    setEditingVisit(visit);
    setFormData({
      reason: visit.reason || '',
      date: visit.date ? visit.date.split('T')[0] : '',
      notes: visit.notes || '',
      practitioner_id: visit.practitioner_id || '',
      condition_id: visit.condition_id ? visit.condition_id.toString() : '',
      visit_type: visit.visit_type || '',
      chief_complaint: visit.chief_complaint || '',
      diagnosis: visit.diagnosis || '',
      treatment_plan: visit.treatment_plan || '',
      follow_up_instructions: visit.follow_up_instructions || '',
      duration_minutes: visit.duration_minutes || '',
      location: visit.location || '',
      priority: visit.priority || '',
    });
    setShowModal(true);
  };

  const handleCloseViewModal = () => {
    // Refresh file count for the viewed visit before closing
    if (viewingVisit) {
      refreshFileCount(viewingVisit.id);
    }
    
    setShowViewModal(false);
    setViewingVisit(null);
    // Remove view parameter from URL
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete('view');
    const newSearch = searchParams.toString();
    navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, {
      replace: true,
    });
  };

  const handleDeleteVisit = async visitId => {
    const success = await deleteItem(visitId);
    // Note: deleteItem already updates local state, no need to refresh all data
    // The useMedicalData hook handles state updates automatically
    if (success) {
      // Only refresh file counts as they might be affected by deletion
      setFileCounts(prev => {
        const updated = { ...prev };
        delete updated[visitId];
        return updated;
      });
      setFileCountsLoading(prev => {
        const updated = { ...prev };
        delete updated[visitId];
        return updated;
      });
    }
  };

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!formData.reason.trim()) {
      setError(ERROR_MESSAGES.REQUIRED_FIELD_MISSING);
      return;
    }

    if (!formData.date) {
      setError(ERROR_MESSAGES.INVALID_DATE);
      return;
    }

    if (!currentPatient?.id) {
      setError(ERROR_MESSAGES.PATIENT_NOT_SELECTED);
      return;
    }

    // Start submission immediately to prevent race conditions
    startSubmission();

    if (!canSubmit) {
      logger.warn('visits_race_condition_prevented', {
        message: 'Form submission prevented due to race condition',
        component: 'Visits',
      });
      return;
    }

    const visitData = {
      reason: formData.reason,
      date: formData.date,
      notes: formData.notes || null,
      practitioner_id: formData.practitioner_id || null,
      condition_id: formData.condition_id ? parseInt(formData.condition_id) : null,
      visit_type: formData.visit_type || null,
      chief_complaint: formData.chief_complaint || null,
      diagnosis: formData.diagnosis || null,
      treatment_plan: formData.treatment_plan || null,
      follow_up_instructions: formData.follow_up_instructions || null,
      duration_minutes: formData.duration_minutes || null,
      location: formData.location || null,
      priority: formData.priority || null,
      patient_id: currentPatient.id,
    };

    try {
      let success;
      let resultId;

      // Submit form data
      if (editingVisit) {
        success = await updateItem(editingVisit.id, visitData);
        resultId = editingVisit.id;
        // No refresh needed for updates - user stays on same page
      } else {
        const result = await createItem(visitData);
        success = !!result;
        resultId = result?.id;
        // Set flag to refresh after new visit creation (but only after form submission, not uploads)
        if (success) {
          needsRefreshAfterSubmissionRef.current = true;
        }
      }

      // Complete form submission
      completeFormSubmission(success, resultId);

      if (success && resultId) {
        // Check if we have files to upload
        const hasPendingFiles = documentManagerMethods?.hasPendingFiles?.();
        
        if (hasPendingFiles) {
          logger.info('visits_starting_file_upload', {
            message: 'Starting file upload process',
            visitId: resultId,
            pendingFilesCount: documentManagerMethods.getPendingFilesCount(),
            component: 'Visits',
          });

          // Start file upload process
          startFileUpload();

          try {
            // Upload files with progress tracking
            await documentManagerMethods.uploadPendingFiles(resultId);
            
            // File upload completed successfully
            completeFileUpload(true, documentManagerMethods.getPendingFilesCount(), 0);
            
            // Refresh file count
            refreshFileCount(resultId);
          } catch (uploadError) {
            logger.error('visits_file_upload_error', {
              message: 'File upload failed',
              visitId: resultId,
              error: uploadError.message,
              component: 'Visits',
            });
            
            // File upload failed
            completeFileUpload(false, 0, documentManagerMethods.getPendingFilesCount());
          }
        } else {
          // No files to upload, complete immediately
          completeFileUpload(true, 0, 0);
        }
      }
    } catch (error) {
      logger.error('visits_submission_error', {
        message: 'Form submission failed',
        error: error.message,
        component: 'Visits',
      });
      
      handleSubmissionFailure(error, 'form');
    }
  };

  // Helper function to get practitioner display name
  const getPractitionerDisplay = practitionerId => {
    if (!practitionerId) return 'No practitioner assigned';

    const practitioner = practitioners.find(
      p => p.id === parseInt(practitionerId)
    );
    if (practitioner) {
      return `${practitioner.name} - ${practitioner.specialty}`;
    }
    return `Practitioner ID: ${practitionerId}`;
  };

  const getPriorityColor = priority => {
    switch (priority) {
      case 'urgent':
        return 'red';
      case 'high':
        return 'orange';
      case 'medium':
        return 'yellow';
      case 'low':
        return 'blue';
      default:
        return 'gray';
    }
  };

  const getVisitTypeColor = visitType => {
    switch (visitType?.toLowerCase()) {
      case 'emergency':
        return 'red';
      case 'urgent care':
        return 'orange';
      case 'follow-up':
        return 'blue';
      case 'routine':
        return 'green';
      case 'consultation':
        return 'purple';
      default:
        return 'gray';
    }
  };

  // Handle URL parameters for direct linking to specific visits
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const viewId = searchParams.get('view');

    if (viewId && visits && visits.length > 0 && !loading) {
      const visit = visits.find(v => v.id.toString() === viewId);
      if (visit && !showViewModal) {
        // Only auto-open if modal isn't already open
        setViewingVisit(visit);
        setShowViewModal(true);
      }
    }
  }, [location.search, visits, loading, showViewModal]);

  if (loading) {
    return (
      <Container size="xl" py="lg">
        <Center py="xl">
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text size="lg">Loading visits...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  const filteredVisits = dataManagement.data;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <PageHeader title="Medical Visits" icon="🏥" />

      <Container size="xl" py="lg">
        {error && (
          <Alert
            variant="light"
            color="red"
            title="Error"
            icon={<IconAlertTriangle size={16} />}
            withCloseButton
            onClose={clearError}
            mb="md"
          >
            {error}
          </Alert>
        )}

        {successMessage && (
          <Alert
            variant="light"
            color="green"
            title="Success"
            icon={<IconCheck size={16} />}
            mb="md"
          >
            {successMessage}
          </Alert>
        )}

        <Group justify="space-between" mb="lg">
          <Button
            variant="filled"
            leftSection={<IconPlus size={16} />}
            onClick={handleAddVisit}
            size="md"
          >
            Add New Visit
          </Button>

          <ViewToggle
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            showPrint={true}
          />
        </Group>

        {/* Mantine Filter Controls */}
        <MantineFilters
          filters={dataManagement.filters}
          updateFilter={dataManagement.updateFilter}
          clearFilters={dataManagement.clearFilters}
          hasActiveFilters={dataManagement.hasActiveFilters}
          statusOptions={dataManagement.statusOptions}
          categoryOptions={dataManagement.categoryOptions}
          dateRangeOptions={dataManagement.dateRangeOptions}
          sortOptions={dataManagement.sortOptions}
          sortBy={dataManagement.sortBy}
          sortOrder={dataManagement.sortOrder}
          handleSortChange={dataManagement.handleSortChange}
          totalCount={dataManagement.totalCount}
          filteredCount={dataManagement.filteredCount}
          config={config.filterControls}
        />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {filteredVisits.length === 0 ? (
            <Paper shadow="sm" p="xl" radius="md">
              <Center py="xl">
                <Stack align="center" gap="md">
                  <IconShieldCheck
                    size={64}
                    stroke={1}
                    color="var(--mantine-color-gray-5)"
                  />
                  <Stack align="center" gap="xs">
                    <Title order={3}>No medical visits found</Title>
                    <Text c="dimmed" ta="center">
                      {dataManagement.hasActiveFilters
                        ? 'Try adjusting your search or filter criteria.'
                        : 'Click "Add New Visit" to get started.'}
                    </Text>
                  </Stack>
                </Stack>
              </Center>
            </Paper>
          ) : viewMode === 'cards' ? (
            <Grid>
              <AnimatePresence>
                {filteredVisits.map((visit, index) => (
                  <Grid.Col key={visit.id} span={{ base: 12, md: 6, lg: 4 }}>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <VisitCard
                        visit={visit}
                        onEdit={handleEditVisit}
                        onDelete={() => handleDeleteVisit(visit.id)}
                        onView={handleViewVisit}
                        practitioners={practitioners}
                        conditions={conditions}
                        fileCount={fileCounts[visit.id] || 0}
                        fileCountLoading={fileCountsLoading[visit.id] || false}
                        navigate={navigate}
                      />
                    </motion.div>
                  </Grid.Col>
                ))}
              </AnimatePresence>
            </Grid>
          ) : (
            <Paper shadow="sm" radius="md" withBorder>
              <MedicalTable
                data={filteredVisits}
                columns={[
                  { header: 'Visit Date', accessor: 'date' },
                  { header: 'Reason', accessor: 'reason' },
                  { header: 'Visit Type', accessor: 'visit_type' },
                  { header: 'Facility', accessor: 'location' },
                  { header: 'Practitioner', accessor: 'practitioner_name' },
                  { header: 'Related Condition', accessor: 'condition_name' },
                  { header: 'Diagnosis', accessor: 'diagnosis' },
                  { header: 'Notes', accessor: 'notes' },
                ]}
                patientData={currentPatient}
                tableName="Visit History"
                onView={handleViewVisit}
                onEdit={handleEditVisit}
                onDelete={handleDeleteVisit}
                formatters={{
                  date: getEntityFormatters('visits').date,
                  reason: getEntityFormatters('visits').text,
                  visit_type: getEntityFormatters('visits').simple,
                  location: getEntityFormatters('visits').simple,
                  practitioner_name: (value, item) =>
                    getEntityFormatters(
                      'visits',
                      practitioners
                    ).practitioner_name(value, item),
                  condition_name: formatters.condition_name,
                  diagnosis: getEntityFormatters('visits').text,
                  notes: getEntityFormatters('visits').text,
                }}
              />
            </Paper>
          )}
        </motion.div>
      </Container>

      <VisitFormWrapper
        isOpen={showModal}
        onClose={() => !isBlocking && setShowModal(false)}
        title={editingVisit ? 'Edit Visit' : 'Add New Visit'}
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        practitioners={practitioners}
        conditions={conditions}
        editingItem={editingVisit}
        onDocumentManagerRef={setDocumentManagerMethods}
        onFileUploadComplete={(success) => {
          if (success && editingVisit) {
            refreshFileCount(editingVisit.id);
          }
        }}
      >
        {/* Form Loading Overlay */}
        <FormLoadingOverlay
          visible={isBlocking}
          message={statusMessage?.title || 'Processing...'}
          submessage={statusMessage?.message}
          type={statusMessage?.type || 'loading'}
        />
      </VisitFormWrapper>

      {/* Visit View Modal */}
      <VisitViewModal
        isOpen={showViewModal}
        onClose={handleCloseViewModal}
        visit={viewingVisit}
        onEdit={handleEditVisit}
        practitioners={practitioners}
        conditions={conditions}
        navigate={navigate}
        isBlocking={isBlocking}
        onFileUploadComplete={(success) => {
          if (success && viewingVisit) {
            refreshFileCount(viewingVisit.id);
          }
        }}
      />
    </motion.div>
  );
};

export default Visits;
