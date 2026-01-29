import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Paper,
  Text,
  Title,
  Stack,
} from '@mantine/core';
import {
  IconPlus,
  IconCalendar,
  IconShieldCheck,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { useEntityFileCounts } from '../../hooks/useEntityFileCounts';
import { useViewModalNavigation } from '../../hooks/useViewModalNavigation';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { useDateFormat } from '../../hooks/useDateFormat';
import { usePractitioners } from '../../hooks/useGlobalData';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { getEntityFormatters } from '../../utils/tableFormatters';
import { navigateToEntity } from '../../utils/linkNavigation';
import { PageHeader } from '../../components';
import { withResponsive } from '../../hoc/withResponsive';
import { useResponsive } from '../../hooks/useResponsive';
import logger from '../../services/logger';
import { 
  ERROR_MESSAGES, 
  SUCCESS_MESSAGES,
  getUserFriendlyError
} from '../../constants/errorMessages';
import MedicalPageFilters from '../../components/shared/MedicalPageFilters';
import { ResponsiveTable } from '../../components/adapters';
import MedicalPageActions from '../../components/shared/MedicalPageActions';
import FormLoadingOverlay from '../../components/shared/FormLoadingOverlay';
import EmptyState from '../../components/shared/EmptyState';
import MedicalPageAlerts from '../../components/shared/MedicalPageAlerts';
import MedicalPageLoading from '../../components/shared/MedicalPageLoading';
import AnimatedCardGrid from '../../components/shared/AnimatedCardGrid';
import { useFormSubmissionWithUploads } from '../../hooks/useFormSubmissionWithUploads';
// Import new modular components
import VisitCard from '../../components/medical/visits/VisitCard';
import VisitViewModal from '../../components/medical/visits/VisitViewModal';
import VisitFormWrapper from '../../components/medical/visits/VisitFormWrapper';

const Visits = () => {
  const { t } = useTranslation('common');
  const { formatDate } = useDateFormat();
  const [viewMode, setViewMode] = useState('cards');
  const navigate = useNavigate();
  const responsive = useResponsive();

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
        tags: [],
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

  // File count management for cards
  const { fileCounts, fileCountsLoading, cleanupFileCount, refreshFileCount } = useEntityFileCounts('visit', visits);

  // View modal navigation with URL deep linking
  const {
    isOpen: showViewModal,
    viewingItem: viewingVisit,
    openModal: handleViewVisit,
    closeModal: handleCloseViewModal,
  } = useViewModalNavigation({
    items: visits,
    loading,
    onClose: (visit) => {
      if (visit) {
        refreshFileCount(visit.id);
      }
    },
  });

  // Get patient conditions for linking
  const [conditions, setConditions] = useState([]);

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
          logger.error('Failed to fetch conditions:', error);
          setConditions([]);
        });
    }
  }, [currentPatient?.id]);


  // Helper function to get condition details
  const getConditionDetails = (conditionId) => {
    if (!conditionId || conditions.length === 0) return null;
    return conditions.find(cond => cond.id === conditionId);
  };

  // Get standardized formatters for visits with condition linking
  const visitsBaseFormatters = getEntityFormatters('visits', practitioners, navigate, null, formatDate);
  const formatters = {
    ...visitsBaseFormatters,
    condition_name: (value, visit) => {
      const condition = getConditionDetails(visit.condition_id);
      return condition?.diagnosis || '';
    },
  };

  // Form state
  const [showModal, setShowModal] = useState(false);
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
    tags: [],
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
      tags: [],
    });
    setShowModal(true);
  };

  const handleEditVisit = visit => {
    resetSubmission(); // Reset submission state
    setEditingVisit(visit);
    setDocumentManagerMethods(null); // Reset document manager methods
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
      tags: visit.tags || [],
    });
    setShowModal(true);
  };

  const handleDeleteVisit = async visitId => {
    const success = await deleteItem(visitId);
    if (success) {
      cleanupFileCount(visitId);
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
      tags: formData.tags || [],
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

  if (loading) {
    return <MedicalPageLoading message={t('visits.loadingVisits', 'Loading visits...')} />;
  }

  const filteredVisits = dataManagement.data;

  return (
    <>
    <Container size="xl" py="md">
      <PageHeader title={t('visits.title', 'Medical Visits')} icon="📅" />

      <Stack gap="lg">
        <MedicalPageAlerts
          error={error}
          successMessage={successMessage}
          onClearError={clearError}
        />

        <MedicalPageActions
          primaryAction={{
            label: t('visits.addVisit', 'Add New Visit'),
            onClick: handleAddVisit,
            leftSection: <IconPlus size={16} />,
          }}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Mantine Filter Controls */}
        <MedicalPageFilters dataManagement={dataManagement} config={config} />

        {/* Content */}
          {filteredVisits.length === 0 ? (
            <EmptyState
              icon={IconShieldCheck}
              title={t('visits.noVisitsFound', 'No medical visits found')}
              hasActiveFilters={dataManagement.hasActiveFilters}
              filteredMessage={t('visits.tryAdjustingFilters', 'Try adjusting your search or filter criteria.')}
              noDataMessage={t('visits.clickToGetStarted', 'Click "Add New Visit" to get started.')}
            />
          ) : viewMode === 'cards' ? (
            <AnimatedCardGrid
              items={filteredVisits}
              columns={{ base: 12, md: 6, lg: 4 }}
              renderCard={(visit) => (
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
              )}
            />
          ) : (
            <Paper shadow="sm" radius="md" withBorder>
              <ResponsiveTable
                data={filteredVisits}
                columns={[
                  { header: t('visits.table.visitDate', 'Visit Date'), accessor: 'date', priority: 'high', width: 120 },
                  { header: t('visits.table.reason', 'Reason'), accessor: 'reason', priority: 'high', width: 150 },
                  { header: t('visits.table.visitType', 'Visit Type'), accessor: 'visit_type', priority: 'medium', width: 120 },
                  { header: t('visits.table.facility', 'Facility'), accessor: 'location', priority: 'medium', width: 150 },
                  { header: t('labels.practitioner', 'Practitioner'), accessor: 'practitioner_name', priority: 'medium', width: 200 },
                  { header: t('visits.table.relatedCondition', 'Related Condition'), accessor: 'condition_name', priority: 'low', width: 200 },
                  { header: t('visits.table.diagnosis', 'Diagnosis'), accessor: 'diagnosis', priority: 'medium', width: 150 },
                  { header: t('labels.notes', 'Notes'), accessor: 'notes', priority: 'low', width: 200 }
                ]}
                patientData={currentPatient}
                tableName="Visit History"
                onView={handleViewVisit}
                onEdit={handleEditVisit}
                onDelete={handleDeleteVisit}
                formatters={{
                  date: visitsBaseFormatters.date,
                  reason: visitsBaseFormatters.text,
                  visit_type: visitsBaseFormatters.simple,
                  location: visitsBaseFormatters.simple,
                  practitioner_name: visitsBaseFormatters.practitioner_name,
                  condition_name: formatters.condition_name,
                  diagnosis: visitsBaseFormatters.text,
                  notes: visitsBaseFormatters.text,
                }}
                dataType="medical"
                responsive={responsive}
              />
            </Paper>
          )}
      </Stack>
      </Container>

      <VisitFormWrapper
        isOpen={showModal}
        onClose={() => !isBlocking && setShowModal(false)}
        title={editingVisit ? t('visits.editVisit', 'Edit Visit') : t('visits.addNewVisit', 'Add New Visit')}
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
    </>
  );
};

// Wrap with responsive HOC for enhanced responsive capabilities
export default withResponsive(Visits, {
  injectResponsive: true,
  displayName: 'ResponsiveVisits'
});
