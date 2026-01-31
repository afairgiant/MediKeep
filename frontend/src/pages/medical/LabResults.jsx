import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { useEntityFileCounts } from '../../hooks/useEntityFileCounts';
import { useViewModalNavigation } from '../../hooks/useViewModalNavigation';
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
import { ResponsiveTable } from '../../components/adapters';
import MedicalPageActions from '../../components/shared/MedicalPageActions';
import MedicalPageFilters from '../../components/shared/MedicalPageFilters';
import FileCountBadge from '../../components/shared/FileCountBadge';
import FormLoadingOverlay from '../../components/shared/FormLoadingOverlay';
import EmptyState from '../../components/shared/EmptyState';
import MedicalPageAlerts from '../../components/shared/MedicalPageAlerts';
import MedicalPageLoading from '../../components/shared/MedicalPageLoading';
import AnimatedCardGrid from '../../components/shared/AnimatedCardGrid';
// Import new modular components
import LabResultCard from '../../components/medical/labresults/LabResultCard';
import LabResultViewModal from '../../components/medical/labresults/LabResultViewModal';
import LabResultFormWrapper from '../../components/medical/labresults/LabResultFormWrapper';
import LabResultQuickImportModal from '../../components/medical/labresults/LabResultQuickImportModal';
import { useFormSubmissionWithUploads } from '../../hooks/useFormSubmissionWithUploads';
import {
  Button,
  Container,
  Stack,
  Text,
  Card,
  Paper,
} from '@mantine/core';
import { IconFileUpload } from '@tabler/icons-react';

const LabResults = () => {
  const { t } = useTranslation('common');
  const { formatDate } = useDateFormat();
  const navigate = useNavigate();
  const location = useLocation();
  const responsive = useResponsive();
  const [viewMode, setViewMode] = useState('cards');

  // Modern data management with useMedicalData
  const {
    items: labResults,
    currentPatient,
    loading: labResultsLoading,
    error,
    successMessage,
    createItem,
    updateItem,
    deleteItem,
    refreshData,
    clearError,
    setSuccessMessage,
    setError,
  } = useMedicalData({
    entityName: 'lab-result',
    apiMethodsConfig: {
      getAll: signal => apiService.getLabResults(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientLabResults(patientId, signal),
      create: (data, signal) => apiService.createLabResult(data, signal),
      update: (id, data, signal) =>
        apiService.updateLabResult(id, data, signal),
      delete: (id, signal) => apiService.deleteLabResult(id, signal),
    },
    requiresPatient: true,
  });

  // Get practitioners data
  const { practitioners, loading: practitionersLoading } = usePractitioners();

  // File count management for cards
  const { fileCounts, fileCountsLoading, cleanupFileCount, refreshFileCount } = useEntityFileCounts('lab-result', labResults);

  // Track if we need to refresh after form submission (but not after uploads)
  const needsRefreshAfterSubmissionRef = useRef(false);

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
    entityType: 'lab-result',
    onSuccess: () => {
      // Reset form and close modal on complete success
      setShowModal(false);
      setEditingLabResult(null);
      setFormData({
        test_name: '',
        test_code: '',
        test_category: '',
        test_type: '',
        facility: '',
        status: 'ordered',
        labs_result: '',
        ordered_date: '',
        completed_date: '',
        notes: '',
        practitioner_id: '',
      });
      
      // Only refresh if we created a new lab result during form submission
      // Don't refresh after uploads complete to prevent resource exhaustion
      if (needsRefreshAfterSubmissionRef.current) {
        needsRefreshAfterSubmissionRef.current = false;
        refreshData();
      }
    },
    onError: (error) => {
      logger.error('lab_results_form_error', {
        message: 'Form submission error in lab results',
        error,
        component: 'LabResults',
      });
    },
    component: 'LabResults',
  });

  // Get standardized configuration
  const config = getMedicalPageConfig('labresults');

  // Get standardized formatters for lab results
  const formatters = getEntityFormatters('lab_results', practitioners, null, null, formatDate);


  // Use standardized data management
  const dataManagement = useDataManagement(labResults || [], config);

  // Get patient conditions for linking
  const [conditions, setConditions] = useState([]);
  const [labResultConditions, setLabResultConditions] = useState({});

  useEffect(() => {
    if (currentPatient?.id) {
      apiService
        .getPatientConditions(currentPatient.id)
        .then(response => {
          setConditions(response || []);
        })
        .catch(error => {
          logger.error('medical_conditions_fetch_error', {
            message: 'Failed to fetch conditions for lab results',
            patientId: currentPatient.id,
            error: error.message,
            component: 'LabResults',
          });
          setConditions([]);
        });
    }
  }, [currentPatient?.id]);

  // Helper function to get condition details
  const getConditionDetails = conditionId => {
    if (!conditionId || conditions.length === 0) return null;
    return conditions.find(cond => cond.id === conditionId);
  };

  // Helper function to fetch condition relationships for a lab result
  const fetchLabResultConditions = async labResultId => {
    try {
      const relationships =
        await apiService.getLabResultConditions(labResultId);
      setLabResultConditions(prev => ({
        ...prev,
        [labResultId]: relationships || [],
      }));
      return relationships || [];
    } catch (error) {
      logger.error('medical_conditions_fetch_error', {
        message: 'Failed to fetch lab result conditions',
        labResultId,
        error: error.message,
        component: 'LabResults',
      });
      return [];
    }
  };

  // Get processed data from data management
  const filteredLabResults = dataManagement.data;

  // Combined loading state
  const loading = labResultsLoading || practitionersLoading;

  // Document management state
  const [documentManagerMethods, setDocumentManagerMethods] = useState(null);
  const [viewDocumentManagerMethods, setViewDocumentManagerMethods] = useState(null);

  // View modal navigation with URL deep linking
  const {
    isOpen: showViewModal,
    viewingItem: viewingLabResult,
    openModal: handleViewLabResult,
    closeModal: handleCloseViewModal,
    setViewingItem: setViewingLabResult,
    setIsOpen: setShowViewModal,
  } = useViewModalNavigation({
    items: labResults,
    loading,
    onClose: (labResult) => {
      if (labResult) {
        refreshFileCount(labResult.id);
      }
    },
  });

  // Form and modal state
  const [showModal, setShowModal] = useState(false);
  const [showQuickImportModal, setShowQuickImportModal] = useState(false);
  const [initialViewTab, setInitialViewTab] = useState('overview');
  const [editingLabResult, setEditingLabResult] = useState(null);
  const [formData, setFormData] = useState({
    test_name: '',
    test_code: '',
    test_category: '',
    test_type: '',
    facility: '',
    status: 'ordered',
    labs_result: '',
    ordered_date: '',
    completed_date: '',
    notes: '',
    practitioner_id: '',
  });

  // Modern CRUD handlers using useMedicalData - memoized to prevent LabResultCard re-renders
  const handleAddLabResult = useCallback(() => {
    resetSubmission(); // Reset submission state
    setEditingLabResult(null);
    setDocumentManagerMethods(null); // Reset document manager methods
    setFormData({
      test_name: '',
      test_code: '',
      test_category: '',
      test_type: '',
      facility: '',
      status: 'ordered',
      labs_result: '',
      ordered_date: '',
      completed_date: '',
      notes: '',
      practitioner_id: '',
      tags: [],
    });
    setShowModal(true);
  }, [resetSubmission]);

  const handleEditLabResult = useCallback(async labResult => {
    resetSubmission(); // Reset submission state to prevent modal flash
    setEditingLabResult(labResult);
    setFormData({
      test_name: labResult.test_name || '',
      test_code: labResult.test_code || '',
      test_category: labResult.test_category || '',
      test_type: labResult.test_type || '',
      facility: labResult.facility || '',
      status: labResult.status || 'ordered',
      labs_result: labResult.labs_result || '',
      ordered_date: labResult.ordered_date || '',
      completed_date: labResult.completed_date || '',
      notes: labResult.notes || '',
      practitioner_id: labResult.practitioner_id ? String(labResult.practitioner_id) : '',
      tags: labResult.tags || [],
    });

    // Note: File loading is now handled by DocumentManager component
    setShowModal(true);
  }, [resetSubmission]);

  const handleLabResultUpdated = useCallback(async () => {
    // If modal is open, fetch the updated lab result directly
    if (viewingLabResult) {
      try {
        const updatedLabResult = await apiService.getLabResult(viewingLabResult.id);
        if (updatedLabResult) {
          setViewingLabResult(updatedLabResult);
          logger.info('lab_result_updated_in_modal', {
            message: 'Lab result refreshed in view modal',
            labResultId: viewingLabResult.id,
            completedDate: updatedLabResult.completed_date,
            component: 'LabResults',
          });
        }
      } catch (error) {
        logger.error('lab_result_refresh_error', {
          message: 'Failed to refresh lab result in modal',
          labResultId: viewingLabResult.id,
          error: error.message,
          component: 'LabResults',
        });
      }
    }

    // Refresh the lab results list
    await refreshData();
  }, [viewingLabResult, refreshData]);

  const handleQuickImportSuccess = useCallback(async (labResultId) => {
    setShowQuickImportModal(false);

    // Refresh lab results list
    await refreshData();

    // Fetch the specific lab result directly to avoid race condition with stale state
    try {
      const labResult = await apiService.getLabResult(labResultId);

      if (labResult) {
        // Open the view modal with Test Components tab active
        setViewingLabResult(labResult);
        setInitialViewTab('test-components');
        setShowViewModal(true);

        // Update URL with lab result ID
        const searchParams = new URLSearchParams(location.search);
        searchParams.set('view', labResult.id);
        navigate(`${location.pathname}?${searchParams.toString()}`, {
          replace: true,
        });

        logger.info('quick_import_completed', {
          message: 'Quick PDF import completed successfully',
          labResultId,
          component: 'LabResults',
        });
      }
    } catch (error) {
      logger.error('quick_import_fetch_failed', {
        message: 'Failed to fetch newly created lab result',
        labResultId,
        error: error.message,
        component: 'LabResults',
      });
    }
  }, [refreshData, navigate, location.pathname, location.search]);

  const handleDeleteLabResult = useCallback(async labResultId => {
    const success = await deleteItem(labResultId);
    if (success) {
      cleanupFileCount(labResultId);
    }
  }, [deleteItem, cleanupFileCount]);

  const handleSubmit = useCallback(async e => {
    e.preventDefault();

    // Basic validation first
    if (!formData.test_name.trim()) {
      setError(ERROR_MESSAGES.REQUIRED_FIELD_MISSING);
      return;
    }

    if (!currentPatient?.id) {
      setError(ERROR_MESSAGES.PATIENT_NOT_SELECTED);
      return;
    }

    // Start submission process
    startSubmission();

    // Prevent double submission - check after startSubmission() to avoid race condition
    if (!canSubmit) {
      return;
    }

    const labResultData = {
      ...formData,
      patient_id: currentPatient.id,
      practitioner_id: formData.practitioner_id
        ? parseInt(formData.practitioner_id)
        : null,
      ordered_date: formData.ordered_date || null,
      completed_date: formData.completed_date || null,
    };
    

    try {
      let success;
      let resultId;

      // Submit form data
      if (editingLabResult) {
        success = await updateItem(editingLabResult.id, labResultData);
        resultId = editingLabResult.id;
        // No refresh needed for updates - user stays on same page
      } else {
        const result = await createItem(labResultData);
        success = !!result;
        resultId = result?.id;
        // Set flag to refresh after new lab result creation (but only after form submission, not uploads)
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
          logger.info('lab_results_starting_file_upload', {
            message: 'Starting file upload process',
            labResultId: resultId,
            pendingFilesCount: documentManagerMethods.getPendingFilesCount(),
            component: 'LabResults',
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
            logger.error('lab_results_file_upload_error', {
              message: 'File upload failed',
              labResultId: resultId,
              error: uploadError.message,
              component: 'LabResults',
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
      handleSubmissionFailure(error, 'form');
    }
  }, [
    formData,
    currentPatient,
    canSubmit,
    editingLabResult,
    updateItem,
    createItem,
    documentManagerMethods,
    startSubmission,
    setError,
    completeFormSubmission,
    startFileUpload,
    completeFileUpload,
    handleSubmissionFailure,
    refreshFileCount,
  ]);

  const handleInputChange = useCallback(e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleCloseModal = useCallback(() => {
    // Prevent closing during upload
    if (isBlocking) {
      return;
    }
    
    resetSubmission(); // Reset submission state
    setShowModal(false);
    setEditingLabResult(null);
    setDocumentManagerMethods(null); // Reset document manager methods
    setFormData({
      test_name: '',
      test_code: '',
      test_category: '',
      test_type: '',
      facility: '',
      status: 'ordered',
      labs_result: '',
      ordered_date: '',
      completed_date: '',
      notes: '',
      practitioner_id: '',
    });
  }, [isBlocking, resetSubmission]);

  // File operations for view modal
  // Note: File operations now handled by DocumentManager component

  if (loading) {
    return (
      <MedicalPageLoading
        message={t('labResults.loading', 'Loading lab results...')}
        hint={t('labResults.loadingHint', 'If this takes too long, please refresh the page')}
      />
    );
  }

  return (
    <>
      <Container size="xl" py="md">
        <PageHeader title={t('labResults.title', 'Lab Results')} icon="🧪" />

        <Stack gap="lg">
          <MedicalPageAlerts
            error={error}
            successMessage={successMessage}
            onClearError={clearError}
          />

          <MedicalPageActions
            primaryAction={{
              label: t('labResults.addNew', '+ Add New Lab Result'),
              onClick: handleAddLabResult,
            }}
            secondaryActions={[
              {
                label: t('labResults.quickPdfImport', 'Quick PDF Import'),
                onClick: () => setShowQuickImportModal(true),
                leftSection: <IconFileUpload size={16} />,
              },
            ]}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            mb={0}
          />

          {/* Mantine Filter Controls */}
          <MedicalPageFilters dataManagement={dataManagement} config={config} />

          {filteredLabResults.length === 0 ? (
            <EmptyState
              emoji="🧪"
              title={t('labResults.noResults', 'No Lab Results Found')}
              hasActiveFilters={dataManagement.hasActiveFilters}
              filteredMessage={t('labResults.tryAdjustingFilters', 'Try adjusting your search or filter criteria.')}
              noDataMessage={t('labResults.startAdding', 'Start by adding your first lab result.')}
              actionButton={
                <Button variant="filled" onClick={handleAddLabResult}>
                  {t('labResults.addFirst', 'Add Your First Lab Result')}
                </Button>
              }
            />
          ) : viewMode === 'cards' ? (
            <AnimatedCardGrid
              items={filteredLabResults}
              columns={{ base: 12, sm: 6, lg: 4 }}
              renderCard={(result) => (
                <LabResultCard
                  labResult={result}
                  onEdit={handleEditLabResult}
                  onDelete={() => handleDeleteLabResult(result.id)}
                  onView={handleViewLabResult}
                  practitioners={practitioners}
                  fileCount={fileCounts[result.id] || 0}
                  fileCountLoading={fileCountsLoading[result.id] || false}
                  navigate={navigate}
                />
              )}
            />
          ) : (
            <Paper shadow="sm" radius="md" withBorder>
              <ResponsiveTable
                data={filteredLabResults}
              columns={[
                  { header: t('labResults.table.testName', 'Test Name'), accessor: 'test_name', priority: 'high', width: 200 },
                  { header: t('labResults.table.category', 'Category'), accessor: 'test_category', priority: 'low', width: 150 },
                  { header: t('labResults.table.type', 'Type'), accessor: 'test_type', priority: 'low', width: 120 },
                  { header: t('labResults.table.facility', 'Facility'), accessor: 'facility', priority: 'low', width: 150 },
                  { header: t('labels.status', 'Status'), accessor: 'status', priority: 'high', width: 120 },
                  { header: t('labResults.table.orderingPractitioner', 'Ordering Practitioner'), accessor: 'practitioner_id', priority: 'low', width: 150 },
                  { header: t('labResults.table.orderedDate', 'Ordered Date'), accessor: 'ordered_date', priority: 'low', width: 120 },
                  { header: t('labResults.table.completedDate', 'Completed Date'), accessor: 'completed_date', priority: 'low', width: 120 },
                  { header: t('labResults.table.files', 'Files'), accessor: 'files', priority: 'low', width: 150 }
                ]}
              patientData={currentPatient}
              tableName={t('labResults.title', 'Lab Results')}
              onView={handleViewLabResult}
              onEdit={handleEditLabResult}
              onDelete={handleDeleteLabResult}
              formatters={{
                ...formatters,
                // Custom practitioner formatter for lab results (using practitioner_id)
                practitioner_id: (value, item) => {
                  if (!value) return '-';
                  const practitioner = practitioners.find(p => p.id === value);
                  return practitioner ? practitioner.name : `ID: ${value}`;
                },
                // Custom files formatter for lab results
                files: (value, item) => (
                  <FileCountBadge
                    count={fileCounts[item.id] || 0}
                    entityType="lab-result"
                    variant="text"
                    size="sm"
                    loading={fileCountsLoading[item.id] || false}
                  />
                ),
              }}
              dataType="medical"
              responsive={responsive}
            />
          </Paper>
          )}
        </Stack>
      </Container>

      {/* Create/Edit Form Modal */}
      {showModal && (
        <LabResultFormWrapper
          isOpen={showModal}
          onClose={() => !isBlocking && handleCloseModal()}
          title={editingLabResult ? t('labResults.editTitle', 'Edit Lab Result') : t('labResults.addTitle', 'Add New Lab Result')}
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          practitioners={practitioners}
          editingItem={editingLabResult}
          conditions={conditions}
          labResultConditions={labResultConditions}
          fetchLabResultConditions={fetchLabResultConditions}
          navigate={navigate}
          onDocumentManagerRef={setDocumentManagerMethods}
          onFileUploadComplete={(success) => {
            if (success && editingLabResult) {
              refreshFileCount(editingLabResult.id);
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
        </LabResultFormWrapper>
      )}

      {/* View Details Modal */}
      <LabResultViewModal
        isOpen={showViewModal}
        onClose={handleCloseViewModal}
        labResult={viewingLabResult}
        onEdit={handleEditLabResult}
        practitioners={practitioners}
        conditions={conditions}
        labResultConditions={labResultConditions}
        fetchLabResultConditions={fetchLabResultConditions}
        navigate={navigate}
        isBlocking={isBlocking}
        initialTab={initialViewTab}
        onFileUploadComplete={(success) => {
          if (success && viewingLabResult) {
            refreshFileCount(viewingLabResult.id);
          }
        }}
        onLabResultUpdated={handleLabResultUpdated}
      />

      {/* Quick PDF Import Modal */}
      {showQuickImportModal && (
        <LabResultQuickImportModal
          isOpen={showQuickImportModal}
          onClose={() => setShowQuickImportModal(false)}
          onSuccess={handleQuickImportSuccess}
          patientId={currentPatient?.id}
          practitioners={practitioners}
        />
      )}
    </>
  );
};

// Wrap with responsive HOC for enhanced responsive capabilities
export default withResponsive(LabResults, {
  injectResponsive: true,
  displayName: 'ResponsiveLabResults'
});
