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
import logger from '../../services/logger';
import { 
  ERROR_MESSAGES, 
  SUCCESS_MESSAGES,
  getUserFriendlyError
} from '../../constants/errorMessages';
import MantineLabResultForm from '../../components/medical/MantineLabResultForm';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import StatusBadge from '../../components/medical/StatusBadge';
import MantineFilters from '../../components/mantine/MantineFilters';
import ConditionRelationships from '../../components/medical/ConditionRelationships';
import DocumentManagerWithProgress from '../../components/shared/DocumentManagerWithProgress';
import FormLoadingOverlay from '../../components/shared/FormLoadingOverlay';
import { useFormSubmissionWithUploads } from '../../hooks/useFormSubmissionWithUploads';
import {
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
  Grid,
  Container,
  Alert,
  Loader,
  Center,
  Divider,
  Paper,
  TextInput,
  Title,
  SimpleGrid,
  ThemeIcon,
  Anchor,
  Modal,
  ScrollArea,
} from '@mantine/core';

const LabResults = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
      console.error(`Error refreshing file count for lab result ${labResultId}:`, error);
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
          console.error(`Error loading file count for lab result ${labResult.id}:`, error);
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
    });
    setShowModal(true);
  };

  const handleEditLabResult = async labResult => {
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

    if (!currentPatient?.id) {
      setError(ERROR_MESSAGES.PATIENT_NOT_SELECTED);
      return;
    }

    // Start submission immediately to prevent race conditions
    startSubmission();

    if (!canSubmit) {
      logger.warn('lab_results_race_condition_prevented', {
        message: 'Form submission prevented due to race condition',
        component: 'LabResults',
      });
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
              {filteredLabResults.map(result => (
                <Grid.Col key={result.id} span={{ base: 12, sm: 6, lg: 4 }}>
                  <Card
                    withBorder
                    shadow="sm"
                    radius="md"
                    h="100%"
                    style={{ display: 'flex', flexDirection: 'column' }}
                  >
                    <Stack gap="sm" style={{ flex: 1 }}>
                      <Group justify="space-between" align="flex-start">
                        <Stack gap="xs" style={{ flex: 1 }}>
                          <Text fw={600} size="lg">
                            {result.test_name}
                          </Text>
                          {result.test_category && (
                            <Badge variant="light" color="blue" size="md">
                              {result.test_category}
                            </Badge>
                          )}
                        </Stack>
                        <StatusBadge status={result.status} />
                      </Group>

                      <Stack gap="xs">
                        {result.test_code && (
                          <Group>
                            <Text size="sm" fw={500} c="dimmed" w={120}>
                              Test Code:
                            </Text>
                            <Text size="sm">{result.test_code}</Text>
                          </Group>
                        )}
                        {result.test_type && (
                          <Group>
                            <Text size="sm" fw={500} c="dimmed" w={120}>
                              Type:
                            </Text>
                            <Badge variant="light" color="cyan" size="sm">
                              {result.test_type}
                            </Badge>
                          </Group>
                        )}
                        {result.facility && (
                          <Group>
                            <Text size="sm" fw={500} c="dimmed" w={120}>
                              Facility:
                            </Text>
                            <Text size="sm">{result.facility}</Text>
                          </Group>
                        )}
                        <Group>
                          <Text size="sm" fw={500} c="dimmed" w={120}>
                            Ordered:
                          </Text>
                          <Text size="sm">
                            {formatDate(result.ordered_date)}
                          </Text>
                        </Group>
                        {result.completed_date && (
                          <Group>
                            <Text size="sm" fw={500} c="dimmed" w={120}>
                              Completed:
                            </Text>
                            <Text size="sm">
                              {formatDate(result.completed_date)}
                            </Text>
                          </Group>
                        )}
                        {result.labs_result && (
                          <Group>
                            <Text size="sm" fw={500} c="dimmed" w={120}>
                              Result:
                            </Text>
                            <StatusBadge status={result.labs_result} />
                          </Group>
                        )}
                        {result.practitioner_id && (
                          <Group>
                            <Text size="sm" fw={500} c="dimmed" w={120}>
                              Doctor:
                            </Text>
                            <Text size="sm">
                              {practitioners.find(
                                p => p.id === result.practitioner_id
                              )?.name ||
                                `Practitioner ID: ${result.practitioner_id}`}
                            </Text>
                          </Group>
                        )}
                        <Group>
                          <Text size="sm" fw={500} c="dimmed" w={120}>
                            Files:
                          </Text>
                          <FileCountBadge
                            count={fileCounts[result.id] || 0}
                            entityType="lab-result"
                            variant="badge"
                            size="sm"
                            loading={fileCountsLoading[result.id] || false}
                            onClick={() => handleViewLabResult(result)}
                          />
                        </Group>
                      </Stack>

                      {result.notes && (
                        <Stack gap="xs">
                          <Divider />
                          <Stack gap="xs">
                            <Text size="sm" fw={500} c="dimmed">
                              Notes
                            </Text>
                            <Text size="sm">{result.notes}</Text>
                          </Stack>
                        </Stack>
                      )}
                    </Stack>

                    {/* Buttons always at bottom */}
                    <Stack gap={0} mt="auto">
                      <Divider />
                      <Group justify="flex-end" gap="xs" pt="sm">
                        <Button
                          variant="filled"
                          size="xs"
                          onClick={() => handleViewLabResult(result)}
                        >
                          View
                        </Button>
                        <Button
                          variant="filled"
                          size="xs"
                          onClick={() => handleEditLabResult(result)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="filled"
                          color="red"
                          size="xs"
                          onClick={() => handleDeleteLabResult(result.id)}
                        >
                          Delete
                        </Button>
                      </Group>
                    </Stack>
                  </Card>
                </Grid.Col>
              ))}
            </Grid>
          ) : (
            <MedicalTable
              data={filteredLabResults}
              columns={[
                { header: 'Test Name', accessor: 'test_name' },
                { header: 'Category', accessor: 'test_category' },
                { header: 'Type', accessor: 'test_type' },
                { header: 'Facility', accessor: 'facility' },
                { header: 'Status', accessor: 'status' },
                {
                  header: 'Ordering Practitioner',
                  accessor: 'practitioner_id',
                },
                { header: 'Ordered Date', accessor: 'ordered_date' },
                { header: 'Completed Date', accessor: 'completed_date' },
                { header: 'Files', accessor: 'files' },
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
            />
          )}
        </Stack>
      </Container>

      {/* Create/Edit Form Modal */}
      {showModal && (
        <MantineLabResultForm
          isOpen={showModal}
          onClose={handleCloseModal}
          title={editingLabResult ? 'Edit Lab Result' : 'Add New Lab Result'}
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          practitioners={practitioners}
          editingLabResult={editingLabResult}
          conditions={conditions}
          labResultConditions={labResultConditions}
          fetchLabResultConditions={fetchLabResultConditions}
          navigate={navigate}
        >
          {/* Form Loading Overlay */}
          <FormLoadingOverlay
            visible={isBlocking}
            message={statusMessage?.title || 'Processing...'}
            submessage={statusMessage?.message}
            type={statusMessage?.type || 'loading'}
          />
          {/* File Management Section for Both Create and Edit Mode */}
          <Paper withBorder p="md" mt="md">
            <Title order={4} mb="md">
              {editingLabResult ? 'Manage Files' : 'Add Files (Optional)'}
            </Title>
            <DocumentManagerWithProgress
              entityType="lab-result"
              entityId={editingLabResult?.id}
              mode={editingLabResult ? 'edit' : 'create'}
              config={{
                acceptedTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.gif', '.txt', '.csv', '.xml', '.json', '.doc', '.docx', '.xls', '.xlsx'],
                maxSize: 10 * 1024 * 1024, // 10MB
                maxFiles: 10
              }}
              onUploadPendingFiles={setDocumentManagerMethods}
              onError={(error) => {
                logger.error('document_manager_error', {
                  message: `Document manager error in lab results ${editingLabResult ? 'edit' : 'create'}`,
                  labResultId: editingLabResult?.id,
                  error: error,
                  component: 'LabResults',
                });
              }}
              showProgressModal={true}
            />
          </Paper>
        </MantineLabResultForm>
      )}

      {/* View Details Modal */}
      <Modal
        opened={showViewModal}
        onClose={() => !isBlocking && handleCloseViewModal()}
        title={viewingLabResult?.test_name || 'Lab Result Details'}
        size="xl"
        scrollAreaComponent={ScrollArea.Autosize}
        centered
      >
        {viewingLabResult && (
          <>
            <Stack gap="lg" mb="lg">
              <Title order={3}>Lab Result Details</Title>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">
                    Test Name
                  </Text>
                  <Text>{viewingLabResult.test_name}</Text>
                </Stack>
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">
                    Test Code
                  </Text>
                  <Text>{viewingLabResult.test_code || 'N/A'}</Text>
                </Stack>
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">
                    Category
                  </Text>
                  <Text>{viewingLabResult.test_category || 'N/A'}</Text>
                </Stack>
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">
                    Test Type
                  </Text>
                  <Text c={viewingLabResult.test_type ? 'inherit' : 'dimmed'}>
                    {viewingLabResult.test_type || 'Not specified'}
                  </Text>
                </Stack>
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">
                    Facility
                  </Text>
                  <Text c={viewingLabResult.facility ? 'inherit' : 'dimmed'}>
                    {viewingLabResult.facility || 'Not specified'}
                  </Text>
                </Stack>
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">
                    Status
                  </Text>
                  <StatusBadge status={viewingLabResult.status} />
                </Stack>
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">
                    Lab Result
                  </Text>
                  {viewingLabResult.labs_result ? (
                    <StatusBadge status={viewingLabResult.labs_result} />
                  ) : (
                    <Text c="dimmed">Not specified</Text>
                  )}
                </Stack>
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">
                    Ordering Practitioner
                  </Text>
                  <Text
                    c={viewingLabResult.practitioner_id ? 'inherit' : 'dimmed'}
                  >
                    {viewingLabResult.practitioner_id
                      ? practitioners.find(
                          p => p.id === viewingLabResult.practitioner_id
                        )?.name ||
                        `Practitioner ID: ${viewingLabResult.practitioner_id}`
                      : 'Not specified'}
                  </Text>
                </Stack>
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">
                    Ordered Date
                  </Text>
                  <Text>{formatDate(viewingLabResult.ordered_date)}</Text>
                </Stack>
                <Stack gap="xs">
                  <Text fw={500} size="sm" c="dimmed">
                    Completed Date
                  </Text>
                  <Text
                    c={viewingLabResult.completed_date ? 'inherit' : 'dimmed'}
                  >
                    {viewingLabResult.completed_date
                      ? formatDate(viewingLabResult.completed_date)
                      : 'Not specified'}
                  </Text>
                </Stack>
              </SimpleGrid>
              <Stack gap="xs">
                <Text fw={500} size="sm" c="dimmed">
                  Notes
                </Text>
                <Paper withBorder p="sm" bg="gray.1">
                  <Text
                    style={{ whiteSpace: 'pre-wrap' }}
                    c={viewingLabResult.notes ? 'inherit' : 'dimmed'}
                  >
                    {viewingLabResult.notes || 'No notes available'}
                  </Text>
                </Paper>
              </Stack>
            </Stack>

            {/* Related Conditions Section */}
            <Stack gap="lg">
              <Title order={3}>Related Conditions</Title>
              <ConditionRelationships
                labResultId={viewingLabResult.id}
                labResultConditions={labResultConditions}
                conditions={conditions}
                fetchLabResultConditions={fetchLabResultConditions}
                navigate={navigate}
                isViewMode={true}
              />
            </Stack>

            <Stack gap="lg">
              <Title order={3}>Associated Files</Title>
              <DocumentManagerWithProgress
                entityType="lab-result"
                entityId={viewingLabResult.id}
                mode="view"
                config={{
                  acceptedTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.gif', '.txt', '.csv', '.xml', '.json', '.doc', '.docx', '.xls', '.xlsx'],
                  maxSize: 10 * 1024 * 1024, // 10MB
                  maxFiles: 10
                }}
                onError={(error) => {
                  logger.error('document_manager_error', {
                    message: 'Document manager error in lab results view',
                    labResultId: viewingLabResult.id,
                    error: error,
                    component: 'LabResults',
                  });
                }}
                showProgressModal={true}
              />
            </Stack>

            {/* Modal Action Buttons */}
            <Group justify="flex-end" mt="md">
              <Button
                variant="filled"
                size="xs"
                onClick={() => {
                  handleCloseViewModal();
                  handleEditLabResult(viewingLabResult);
                }}
              >
                Edit Lab Result
              </Button>
              <Button variant="filled" onClick={handleCloseViewModal}>
                Close
              </Button>
            </Group>
          </>
        )}
      </Modal>
    </>
  );
};

export default LabResults;
