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
import MantineLabResultForm from '../../components/medical/MantineLabResultForm';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import StatusBadge from '../../components/medical/StatusBadge';
import MantineFilters from '../../components/mantine/MantineFilters';
import ConditionRelationships from '../../components/medical/ConditionRelationships';
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
  FileInput,
  TextInput,
  ActionIcon,
  Title,
  SimpleGrid,
  ThemeIcon,
  Anchor,
  Modal,
  ScrollArea,
} from '@mantine/core';
import {
  IconDownload,
  IconTrash,
  IconFile,
  IconFileText,
  IconUpload,
  IconX,
  IconRestore,
} from '@tabler/icons-react';

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

  // Get standardized configuration
  const config = getMedicalPageConfig('labresults');

  // Get standardized formatters for lab results
  const formatters = getEntityFormatters('lab_results', practitioners);

  // File management state (moved up before useDataManagement)
  const [filesCounts, setFilesCounts] = useState({});

  // Use standardized data management
  const dataManagement = useDataManagement(labResults || [], config, {
    filesCounts,
  });

  // Get patient conditions for linking
  const [conditions, setConditions] = useState([]);
  const [labResultConditions, setLabResultConditions] = useState({});
  
  useEffect(() => {
    if (currentPatient?.id) {
      apiService.getPatientConditions(currentPatient.id)
        .then(response => {
          setConditions(response || []);
        })
        .catch(error => {
          logger.error('medical_conditions_fetch_error', {
            message: 'Failed to fetch conditions for lab results',
            patientId: currentPatient.id,
            error: error.message,
            component: 'LabResults'
          });
          setConditions([]);
        });
    }
  }, [currentPatient?.id]);

  // Helper function to get condition details
  const getConditionDetails = (conditionId) => {
    if (!conditionId || conditions.length === 0) return null;
    return conditions.find(cond => cond.id === conditionId);
  };

  // Helper function to fetch condition relationships for a lab result
  const fetchLabResultConditions = async (labResultId) => {
    try {
      const relationships = await apiService.getLabResultConditions(labResultId);
      setLabResultConditions(prev => ({
        ...prev,
        [labResultId]: relationships || []
      }));
      return relationships || [];
    } catch (error) {
      logger.error('medical_conditions_fetch_error', {
        message: 'Failed to fetch lab result conditions',
        labResultId,
        error: error.message,
        component: 'LabResults'
      });
      return [];
    }
  };

  // Get processed data from data management
  const filteredLabResults = dataManagement.data;

  // Combined loading state
  const loading = labResultsLoading || practitionersLoading;

  // Additional file management state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileUpload, setFileUpload] = useState({ file: null, description: '' });
  const [pendingFiles, setPendingFiles] = useState([]);
  const [filesToDelete, setFilesToDelete] = useState([]);
  const abortControllerRef = useRef(null);

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

  // File management functions (preserve complex logic)
  const loadFilesCounts = useCallback(async (results, abortController) => {
    try {
      const counts = {};
      const batchSize = 1;

      for (let i = 0; i < results.length; i += batchSize) {
        if (abortController?.signal.aborted) return;

        const batch = results.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async result => {
            try {
              if (abortController?.signal.aborted) return;
              const files = await apiService.getLabResultFiles(result.id);
              counts[result.id] = files.length;
            } catch (error) {
              counts[result.id] = 0;
            }
          })
        );

        if (i + batchSize < results.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (!abortController?.signal.aborted) {
        setFilesCounts(counts);
      }
    } catch (error) {
      logger.error('medical_data_fetch_error', {
        message: 'Error loading file counts for lab results',
        resultsCount: results?.length,
        error: error.message,
        component: 'LabResults'
      });
    }
  }, []);

  // Load file counts when lab results change
  React.useEffect(() => {
    if (labResults && labResults.length > 0 && labResults.length <= 20) {
      const controller = new AbortController();
      loadFilesCounts(labResults, controller);
      return () => controller.abort();
    } else if (labResults) {
      // Initialize counts to 0 for large datasets
      const counts = {};
      labResults.forEach(result => {
        counts[result.id] = 0;
      });
      setFilesCounts(counts);
    }
  }, [labResults, loadFilesCounts]);

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

        // Load files for this specific lab result
        const loadFiles = async () => {
          try {
            const files = await apiService.getLabResultFiles(labResult.id);
            setSelectedFiles(files);
          } catch (error) {
            logger.error('medical_file_download_error', {
              message: 'Error fetching lab result files for view',
              labResultId: labResult.id,
              labResultName: labResult.test_name,
              error: error.message,
              component: 'LabResults'
            });
            setSelectedFiles([]);
          }
        };
        loadFiles();
      }
    }
  }, [location.search, labResults, loading, showViewModal]);

  const handleAddPendingFile = (file, description = '') => {
    setPendingFiles(prev => [...prev, { file, description, id: Date.now() }]);
  };

  const handleRemovePendingFile = fileId => {
    setPendingFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleMarkFileForDeletion = fileId => {
    setFilesToDelete(prev => [...prev, fileId]);
  };

  const handleUnmarkFileForDeletion = fileId => {
    setFilesToDelete(prev => prev.filter(id => id !== fileId));
  };

  const uploadPendingFiles = async labResultId => {
    const uploadPromises = pendingFiles.map(async pendingFile => {
      try {
        await apiService.uploadLabResultFile(
          labResultId,
          pendingFile.file,
          pendingFile.description
        );
      } catch (error) {
        logger.error('medical_file_upload_error', {
          message: 'Failed to upload file to lab result',
          fileName: pendingFile.file.name,
          fileSize: pendingFile.file.size,
          labResultId,
          error: error.message,
          component: 'LabResults'
        });
        throw error;
      }
    });
    await Promise.all(uploadPromises);
    setPendingFiles([]);
  };

  const deleteMarkedFiles = async () => {
    const deletePromises = filesToDelete.map(async fileId => {
      try {
        await apiService.deleteLabResultFile(fileId);
      } catch (error) {
        logger.error('medical_file_delete_error', {
          message: 'Failed to delete lab result file',
          fileId,
          error: error.message,
          component: 'LabResults'
        });
        throw error;
      }
    });
    await Promise.all(deletePromises);
    setFilesToDelete([]);
  };

  // Modern CRUD handlers using useMedicalData
  const handleAddLabResult = () => {
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
    setPendingFiles([]);
    setFilesToDelete([]);
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

    // Load existing files
    try {
      const files = await apiService.getLabResultFiles(labResult.id);
      setSelectedFiles(files);
    } catch (error) {
      logger.error('medical_data_fetch_error', {
        message: 'Error loading files for lab result edit',
        labResultId: labResult.id,
        labResultName: labResult.test_name,
        error: error.message,
        component: 'LabResults'
      });
      setSelectedFiles([]);
    }

    setPendingFiles([]);
    setFilesToDelete([]);
    setShowModal(true);
  };

  const handleViewLabResult = async labResult => {
    setViewingLabResult(labResult);
    setShowViewModal(true);

    // Load files for this specific lab result
    try {
      const files = await apiService.getLabResultFiles(labResult.id);
      setSelectedFiles(files);
    } catch (error) {
      logger.error('medical_data_fetch_error', {
        message: 'Error fetching lab result files for view',
        labResultId: labResult.id,
        labResultName: labResult.test_name,
        error: error.message,
        component: 'LabResults'
      });
      setSelectedFiles([]);
    }

    // Update URL with lab result ID for sharing/bookmarking
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', labResult.id);
    navigate(`${location.pathname}?${searchParams.toString()}`, {
      replace: true,
    });
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setViewingLabResult(null);
    setSelectedFiles([]); // Clear files when closing view modal
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
    if (success) {
      await refreshData();
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!currentPatient?.id) {
      setError('Patient information not available');
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

      if (editingLabResult) {
        // Delete marked files first
        if (filesToDelete.length > 0) {
          await deleteMarkedFiles();
        }
        success = await updateItem(editingLabResult.id, labResultData);
        resultId = editingLabResult.id;
      } else {
        const result = await createItem(labResultData);
        success = !!result;
        resultId = result?.id;
      }

      if (success && resultId) {
        // Upload pending files
        if (pendingFiles.length > 0) {
          await uploadPendingFiles(resultId);
        }

        // Reset all form and modal state
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
        setPendingFiles([]);
        setFilesToDelete([]);
        setSelectedFiles([]);

        await refreshData();
      }
    } catch (error) {
      setError(error.message || 'Failed to save lab result');
    }
  };

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCloseModal = () => {
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
    setPendingFiles([]);
    setFilesToDelete([]);
    setSelectedFiles([]);
  };

  // File operations for view modal
  const handleFileUpload = async e => {
    e.preventDefault();
    if (!fileUpload.file || !viewingLabResult) return;

    try {
      const formData = new FormData();
      formData.append('file', fileUpload.file);
      if (fileUpload.description?.trim()) {
        formData.append('description', fileUpload.description);
      }

      await apiService.post(
        `/lab-results/${viewingLabResult.id}/files`,
        formData
      );

      // Refresh files list
      const files = await apiService.getLabResultFiles(viewingLabResult.id);
      setSelectedFiles(files);
      setFilesCounts(prev => ({
        ...prev,
        [viewingLabResult.id]: files.length,
      }));
      setFileUpload({ file: null, description: '' });
    } catch (error) {
      logger.error('medical_file_upload_error', {
        message: 'Error uploading file from view modal',
        fileName: fileUpload.file?.name,
        labResultId: viewingLabResult?.id,
        labResultName: viewingLabResult?.test_name,
        error: error.message,
        component: 'LabResults'
      });
      setError(error.message);
    }
  };

  const handleDownloadFile = async (fileId, fileName) => {
    try {
      const blob = await apiService.get(
        `/lab-result-files/${fileId}/download`,
        {
          responseType: 'blob',
        }
      );

      if (blob instanceof Blob) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      logger.error('medical_file_download_error', {
        message: 'Error downloading lab result file',
        fileId,
        fileName,
        error: error.message,
        component: 'LabResults'
      });
      setError(error.message);
    }
  };

  const handleDeleteFile = async fileId => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      try {
        await apiService.deleteLabResultFile(fileId);
        const files = await apiService.getLabResultFiles(viewingLabResult.id);
        setSelectedFiles(files);
        setFilesCounts(prev => ({
          ...prev,
          [viewingLabResult.id]: files.length,
        }));
      } catch (error) {
        logger.error('medical_file_delete_error', {
          message: 'Error deleting lab result file',
          fileId,
          labResultId: viewingLabResult?.id,
          labResultName: viewingLabResult?.test_name,
          error: error.message,
          component: 'LabResults'
        });
        setError(error.message);
      }
    }
  };

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
                          {filesCounts[result.id] > 0 ? (
                            <Badge
                              variant="light"
                              color="green"
                              size="sm"
                              leftSection={<IconFile size={12} />}
                            >
                              {filesCounts[result.id]} attached
                            </Badge>
                          ) : (
                            <Text c="dimmed" size="sm">
                              No files
                            </Text>
                          )}
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
                files: (value, item) =>
                  filesCounts[item.id] > 0 ? (
                    <span style={{ color: '#2e7d32', fontWeight: 500 }}>
                      {filesCounts[item.id]} file
                      {filesCounts[item.id] !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span style={{ color: '#9e9e9e', fontStyle: 'italic' }}>
                      None
                    </span>
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
          {/* File Management Section for Edit Mode */}
          {editingLabResult && (
            <Paper withBorder p="md" mt="md">
              <Title order={4} mb="md">
                Manage Files
              </Title>

              {/* Existing Files */}
              {selectedFiles.length > 0 && (
                <Stack gap="md" mb="md">
                  <Title order={5}>Current Files:</Title>
                  <Stack gap="sm">
                    {selectedFiles.map(file => (
                      <Paper
                        key={file.id}
                        withBorder
                        p="sm"
                        bg={filesToDelete.includes(file.id) ? 'red.0' : 'white'}
                        style={{
                          opacity: filesToDelete.includes(file.id) ? 0.7 : 1,
                          borderColor: filesToDelete.includes(file.id)
                            ? 'var(--mantine-color-red-3)'
                            : undefined,
                        }}
                      >
                        <Group justify="space-between" align="center">
                          <Group gap="xs" style={{ flex: 1 }}>
                            <ThemeIcon variant="light" size="sm">
                              <IconFile size={14} />
                            </ThemeIcon>
                            <Stack gap={2} style={{ flex: 1 }}>
                              <Text fw={500} size="sm">
                                {file.file_name}
                              </Text>
                              <Group gap="md">
                                <Text size="xs" c="dimmed">
                                  {(file.file_size / 1024).toFixed(1)} KB
                                </Text>
                                {file.description && (
                                  <Text size="xs" c="dimmed" fs="italic">
                                    {file.description}
                                  </Text>
                                )}
                              </Group>
                            </Stack>
                          </Group>
                          <Group gap="xs">
                            <ActionIcon
                              variant="light"
                              color="blue"
                              size="sm"
                              onClick={() =>
                                handleDownloadFile(file.id, file.file_name)
                              }
                            >
                              <IconDownload size={14} />
                            </ActionIcon>
                            {filesToDelete.includes(file.id) ? (
                              <ActionIcon
                                variant="light"
                                color="green"
                                size="sm"
                                onClick={() =>
                                  handleUnmarkFileForDeletion(file.id)
                                }
                              >
                                <IconRestore size={14} />
                              </ActionIcon>
                            ) : (
                              <ActionIcon
                                variant="light"
                                color="red"
                                size="sm"
                                onClick={() =>
                                  handleMarkFileForDeletion(file.id)
                                }
                              >
                                <IconTrash size={14} />
                              </ActionIcon>
                            )}
                          </Group>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                </Stack>
              )}

              {/* Add New Files */}
              <Group mb="md">
                <FileInput
                  placeholder="Select files to upload"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.tiff,.bmp,.gif,.txt,.csv,.xml,.json,.doc,.docx,.xls,.xlsx"
                  onChange={files => {
                    if (files) {
                      files.forEach(file => {
                        handleAddPendingFile(file, '');
                      });
                    }
                  }}
                  leftSection={<IconUpload size={16} />}
                  style={{ flex: 1 }}
                />
              </Group>

              {/* Pending Files */}
              {pendingFiles.length > 0 && (
                <Stack gap="md">
                  <Title order={5}>Files to Upload:</Title>
                  <Stack gap="sm">
                    {pendingFiles.map(pendingFile => (
                      <Paper key={pendingFile.id} withBorder p="sm" bg="blue.1">
                        <Group justify="space-between" align="flex-start">
                          <Group gap="xs" style={{ flex: 1 }}>
                            <ThemeIcon variant="light" color="blue" size="sm">
                              <IconFileText size={14} />
                            </ThemeIcon>
                            <Stack gap="xs" style={{ flex: 1 }}>
                              <Group gap="md">
                                <Text fw={500} size="sm">
                                  {pendingFile.file.name}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  {(pendingFile.file.size / 1024).toFixed(1)} KB
                                </Text>
                              </Group>
                              <TextInput
                                placeholder="Description (optional)"
                                value={pendingFile.description}
                                onChange={e => {
                                  setPendingFiles(prev =>
                                    prev.map(f =>
                                      f.id === pendingFile.id
                                        ? { ...f, description: e.target.value }
                                        : f
                                    )
                                  );
                                }}
                                size="xs"
                              />
                            </Stack>
                          </Group>
                          <ActionIcon
                            variant="light"
                            color="red"
                            size="sm"
                            onClick={() =>
                              handleRemovePendingFile(pendingFile.id)
                            }
                          >
                            <IconX size={14} />
                          </ActionIcon>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                </Stack>
              )}
            </Paper>
          )}
        </MantineLabResultForm>
      )}

      {/* View Details Modal */}
      <Modal
        opened={showViewModal}
        onClose={handleCloseViewModal}
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

              {/* File Upload Form */}
              <Paper withBorder p="md" bg="gray.1">
                <form onSubmit={handleFileUpload}>
                  <Stack gap="md">
                    <Group align="flex-end">
                      <FileInput
                        placeholder="Select a file to upload"
                        value={fileUpload.file}
                        onChange={file =>
                          setFileUpload(prev => ({
                            ...prev,
                            file: file,
                          }))
                        }
                        accept=".pdf,.jpg,.jpeg,.png,.tiff,.bmp,.gif"
                        leftSection={<IconUpload size={16} />}
                        style={{ flex: 1 }}
                      />
                      <TextInput
                        placeholder="File description (optional)"
                        value={fileUpload.description}
                        onChange={e =>
                          setFileUpload(prev => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        style={{ flex: 1 }}
                      />
                      <Button
                        type="submit"
                        disabled={!fileUpload.file}
                        leftSection={<IconUpload size={16} />}
                      >
                        Upload
                      </Button>
                    </Group>
                  </Stack>
                </form>
              </Paper>

              {/* Files List */}
              <Stack gap="md">
                {selectedFiles.length === 0 ? (
                  <Paper withBorder p="md" ta="center">
                    <Stack align="center" gap="sm">
                      <ThemeIcon size="xl" variant="light" color="gray">
                        <IconFile size={24} />
                      </ThemeIcon>
                      <Text c="dimmed">
                        No files attached to this lab result.
                      </Text>
                    </Stack>
                  </Paper>
                ) : (
                  <Stack gap="sm">
                    {selectedFiles.map(file => (
                      <Paper key={file.id} withBorder p="md">
                        <Group justify="space-between" align="center">
                          <Group gap="md" style={{ flex: 1 }}>
                            <ThemeIcon variant="light" color="blue">
                              <IconFile size={20} />
                            </ThemeIcon>
                            <Stack gap={2} style={{ flex: 1 }}>
                              <Text fw={500}>{file.file_name}</Text>
                              <Group gap="md">
                                <Text size="sm" c="dimmed">
                                  {(file.file_size / 1024).toFixed(1)} KB
                                </Text>
                                <Text size="sm" c="dimmed">
                                  {file.file_type}
                                </Text>
                                {file.description && (
                                  <Text size="sm" c="dimmed" fs="italic">
                                    {file.description}
                                  </Text>
                                )}
                              </Group>
                            </Stack>
                          </Group>
                          <Group gap="xs">
                            <ActionIcon
                              variant="light"
                              color="blue"
                              onClick={() =>
                                handleDownloadFile(file.id, file.file_name)
                              }
                            >
                              <IconDownload size={16} />
                            </ActionIcon>
                            <ActionIcon
                              variant="light"
                              color="red"
                              onClick={() => handleDeleteFile(file.id)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Stack>
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
              <Button 
                variant="filled" 
                onClick={handleCloseViewModal}
              >
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
