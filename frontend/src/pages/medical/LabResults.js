import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
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
import ViewToggle from '../../components/shared/ViewToggle';
import MantineFilters from '../../components/mantine/MantineFilters';
import FileCountBadge from '../../components/shared/FileCountBadge';
import FormLoadingOverlay from '../../components/shared/FormLoadingOverlay';
// Import new modular components
import LabResultCard from '../../components/medical/labresults/LabResultCard';
import LabResultViewModal from '../../components/medical/labresults/LabResultViewModal';
import LabResultFormWrapper from '../../components/medical/labresults/LabResultFormWrapper';
import { useFormSubmissionWithUploads } from '../../hooks/useFormSubmissionWithUploads';
import {
  Button,
  Grid,
  Container,
  Alert,
  Loader,
  Center,
  Stack,
  Text,
  Card,
  Group,
  Paper,
} from '@mantine/core';

const LabResults = () => {
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
  const [fileCounts, setFileCounts] = useState({});
  const [fileCountsLoading, setFileCountsLoading] = useState({});

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
  const formatters = getEntityFormatters('lab_results', practitioners);


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

  // Function to refresh file counts for all lab results
  const refreshFileCount = useCallback(async (labResultId) => {
    try {
      const files = await apiService.getEntityFiles('lab-result', labResultId);
      const count = Array.isArray(files) ? files.length : 0;
      setFileCounts(prev => ({ ...prev, [labResultId]: count }));
    } catch (error) {
      logger.error(`Error refreshing file count for lab result ${labResultId}:`, error);
    }
  }, []);

  // Form and modal state
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingLabResult, setViewingLabResult] = useState(null);
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

  // Load file counts for lab results
  useEffect(() => {
    const loadFileCountsForLabResults = async () => {
      if (!labResults || labResults.length === 0) return;
      
      const countPromises = labResults.map(async (labResult) => {
        setFileCountsLoading(prev => {
          if (prev[labResult.id] !== undefined) return prev; // Already loading
          return { ...prev, [labResult.id]: true };
        });
        
        try {
          const files = await apiService.getEntityFiles('lab-result', labResult.id);
          const count = Array.isArray(files) ? files.length : 0;
          setFileCounts(prev => ({ ...prev, [labResult.id]: count }));
        } catch (error) {
          logger.error(`Error loading file count for lab result ${labResult.id}:`, error);
          setFileCounts(prev => ({ ...prev, [labResult.id]: 0 }));
        } finally {
          setFileCountsLoading(prev => ({ ...prev, [labResult.id]: false }));
        }
      });
      
      await Promise.all(countPromises);
    };

    loadFileCountsForLabResults();
  }, [labResults]); // Remove fileCounts from dependencies


  // Handle URL parameters for direct linking to specific lab results
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const viewId = searchParams.get('view');

    if (viewId && labResults && labResults.length > 0 && !loading) {
      const labResult = labResults.find(lr => lr.id.toString() === viewId);
      if (labResult && !showViewModal) {
        // Only auto-open if modal isn't already open
        setViewingLabResult(labResult);
        setShowViewModal(true);

        // Note: File loading now handled by DocumentManager
      }
    }
  }, [location.search, labResults, loading, showViewModal]);

  // Note: File management functions removed - now handled by DocumentManager component

  // Modern CRUD handlers using useMedicalData
  const handleAddLabResult = () => {
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
  };

  const handleEditLabResult = async labResult => {
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
      practitioner_id: labResult.practitioner_id || '',
      tags: labResult.tags || [],
    });

    // Note: File loading is now handled by DocumentManager component
    setShowModal(true);
  };

  const handleViewLabResult = async labResult => {
    setViewingLabResult(labResult);
    setShowViewModal(true);

    // Note: File loading now handled by DocumentManager

    // Update URL with lab result ID for sharing/bookmarking
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', labResult.id);
    navigate(`${location.pathname}?${searchParams.toString()}`, {
      replace: true,
    });
  };

  const handleCloseViewModal = () => {
    // Refresh file count for the viewed lab result before closing
    if (viewingLabResult) {
      refreshFileCount(viewingLabResult.id);
    }

    setShowViewModal(false);
    setViewingLabResult(null);
    // Remove view parameter from URL
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete('view');
    const newSearch = searchParams.toString();
    navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, {
      replace: true,
    });
  };

  const handleLabResultUpdated = async () => {
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
  };

  const handleDeleteLabResult = async labResultId => {
    const success = await deleteItem(labResultId);
    // Note: deleteItem already updates local state, no need to refresh all data
    // The useMedicalData hook handles state updates automatically
    if (success) {
      // Only refresh file counts as they might be affected by deletion
      setFileCounts(prev => {
        const updated = { ...prev };
        delete updated[labResultId];
        return updated;
      });
      setFileCountsLoading(prev => {
        const updated = { ...prev };
        delete updated[labResultId];
        return updated;
      });
    }
  };

  const handleSubmit = async e => {
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
  };

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCloseModal = () => {
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
  };

  // File operations for view modal
  // Note: File operations now handled by DocumentManager component

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Center h={200}>
          <Stack align="center">
            <Loader size="lg" />
            <Text>Loading lab results...</Text>
            <Text size="sm" c="dimmed">
              If this takes too long, please refresh the page
            </Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <>
      <Container size="xl" py="md">
        <PageHeader title="Lab Results" icon="🧪" />

        <Stack gap="lg">
          {error && (
            <Alert
              variant="light"
              color="red"
              title="Error"
              withCloseButton
              onClose={clearError}
            >
              {error}
            </Alert>
          )}
          {successMessage && (
            <Alert variant="light" color="green" title="Success">
              {successMessage}
            </Alert>
          )}

          <Group justify="space-between" align="center">
            <Button variant="filled" onClick={handleAddLabResult}>
              + Add New Lab Result
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
            orderedDateOptions={dataManagement.orderedDateOptions}
            completedDateOptions={dataManagement.completedDateOptions}
            resultOptions={dataManagement.resultOptions}
            typeOptions={dataManagement.typeOptions}
            filesOptions={dataManagement.filesOptions}
            sortOptions={dataManagement.sortOptions}
            sortBy={dataManagement.sortBy}
            sortOrder={dataManagement.sortOrder}
            handleSortChange={dataManagement.handleSortChange}
            totalCount={dataManagement.totalCount}
            filteredCount={dataManagement.filteredCount}
            config={config.filterControls}
          />

          {filteredLabResults.length === 0 ? (
            <Card withBorder p="xl">
              <Stack align="center" gap="md">
                <Text size="3rem">🧪</Text>
                <Text size="xl" fw={600}>
                  No Lab Results Found
                </Text>
                <Text ta="center" c="dimmed">
                  {dataManagement.hasActiveFilters
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Start by adding your first lab result.'}
                </Text>
                {!dataManagement.hasActiveFilters && (
                  <Button variant="filled" onClick={handleAddLabResult}>
                    Add Your First Lab Result
                  </Button>
                )}
              </Stack>
            </Card>
          ) : viewMode === 'cards' ? (
            <Grid>
              {filteredLabResults.map((result) => (
                <Grid.Col key={result.id} span={{ base: 12, sm: 6, lg: 4 }}>
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
                </Grid.Col>
              ))}
            </Grid>
          ) : (
            <Paper shadow="sm" radius="md" withBorder>
              <ResponsiveTable
                data={filteredLabResults}
              columns={[
                  { header: 'Test Name', accessor: 'test_name', priority: 'high', width: 200 },
                  { header: 'Category', accessor: 'test_category', priority: 'low', width: 150 },
                  { header: 'Type', accessor: 'test_type', priority: 'low', width: 120 },
                  { header: 'Facility', accessor: 'facility', priority: 'low', width: 150 },
                  { header: 'Status', accessor: 'status', priority: 'high', width: 120 },
                  { header: 'Ordering Practitioner', accessor: 'practitioner_id', priority: 'low', width: 150 },
                  { header: 'Ordered Date', accessor: 'ordered_date', priority: 'low', width: 120 },
                  { header: 'Completed Date', accessor: 'completed_date', priority: 'low', width: 120 },
                  { header: 'Files', accessor: 'files', priority: 'low', width: 150 }
                ]}
              patientData={currentPatient}
              tableName="Lab Results"
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
          title={editingLabResult ? 'Edit Lab Result' : 'Add New Lab Result'}
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
        onFileUploadComplete={(success) => {
          if (success && viewingLabResult) {
            refreshFileCount(viewingLabResult.id);
          }
        }}
        onLabResultUpdated={handleLabResultUpdated}
      />
    </>
  );
};

// Wrap with responsive HOC for enhanced responsive capabilities
export default withResponsive(LabResults, {
  injectResponsive: true,
  displayName: 'ResponsiveLabResults'
});
