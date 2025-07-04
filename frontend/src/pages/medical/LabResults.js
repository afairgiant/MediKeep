import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { apiService } from '../../services/api';
import { formatDate, formatDateTime } from '../../utils/helpers';
import { usePractitioners } from '../../hooks/useGlobalData';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { PageHeader } from '../../components';
import MantineLabResultForm from '../../components/medical/MantineLabResultForm';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import MedicalFormModal from '../../components/medical/MedicalFormModal';
import StatusBadge from '../../components/medical/StatusBadge';
import MantineFilters from '../../components/mantine/MantineFilters';
import { Button } from '../../components/ui';
import {
  Badge,
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
} from '@mantine/core';
import '../../styles/pages/LabResults.css';

const LabResults = () => {
  const navigate = useNavigate();
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

  // File management state (moved up before useDataManagement)
  const [filesCounts, setFilesCounts] = useState({});

  // Use standardized data management
  const dataManagement = useDataManagement(labResults || [], config, {
    filesCounts,
  });

  // Get processed data from data management
  const filteredLabResults = dataManagement.data;

  // Combined loading state
  const loading = labResultsLoading || practitionersLoading;

  // Additional file management state
  const [selectedLabResult, setSelectedLabResult] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileUpload, setFileUpload] = useState({ file: null, description: '' });
  const [pendingFiles, setPendingFiles] = useState([]);
  const [filesToDelete, setFilesToDelete] = useState([]);
  const abortControllerRef = useRef(null);

  // Form and modal state
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create'); // 'create', 'edit', 'view'
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
      console.error('Error loading file counts:', error);
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
        console.error(`Failed to upload file: ${pendingFile.file.name}`, error);
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
        console.error(`Failed to delete file: ${fileId}`, error);
        throw error;
      }
    });
    await Promise.all(deletePromises);
    setFilesToDelete([]);
  };

  // Modern CRUD handlers using useMedicalData
  const handleAddLabResult = () => {
    setModalType('create');
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
    setModalType('edit');
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
      console.error('Error loading files:', error);
      setSelectedFiles([]);
    }

    setPendingFiles([]);
    setFilesToDelete([]);
    setShowModal(true);
  };

  const handleViewDetails = async labResult => {
    setModalType('view');
    setSelectedLabResult(labResult);
    try {
      const files = await apiService.getLabResultFiles(labResult.id);
      setSelectedFiles(files);
    } catch (error) {
      console.error('Error fetching lab result details:', error);
      setSelectedFiles([]);
    }
    setShowModal(true);
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
    setSelectedLabResult(null);
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
    if (!fileUpload.file || !selectedLabResult) return;

    try {
      const formData = new FormData();
      formData.append('file', fileUpload.file);
      if (fileUpload.description?.trim()) {
        formData.append('description', fileUpload.description);
      }

      await apiService.post(
        `/lab-results/${selectedLabResult.id}/files`,
        formData
      );

      // Refresh files list
      const files = await apiService.getLabResultFiles(selectedLabResult.id);
      setSelectedFiles(files);
      setFilesCounts(prev => ({
        ...prev,
        [selectedLabResult.id]: files.length,
      }));
      setFileUpload({ file: null, description: '' });
    } catch (error) {
      console.error('Error uploading file:', error);
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
      console.error('Error downloading file:', error);
      setError(error.message);
    }
  };

  const handleDeleteFile = async fileId => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      try {
        await apiService.deleteLabResultFile(fileId);
        const files = await apiService.getLabResultFiles(selectedLabResult.id);
        setSelectedFiles(files);
        setFilesCounts(prev => ({
          ...prev,
          [selectedLabResult.id]: files.length,
        }));
      } catch (error) {
        console.error('Error deleting file:', error);
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
                          <Text size="sm">
                            {filesCounts[result.id] > 0 ? (
                              <Badge
                                variant="light"
                                color="green"
                                size="sm"
                                leftSection="📎"
                              >
                                {filesCounts[result.id]} attached
                              </Badge>
                            ) : (
                              <Text c="dimmed" size="sm">
                                No files
                              </Text>
                            )}
                          </Text>
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
                          variant="light"
                          size="xs"
                          onClick={() => handleViewDetails(result)}
                        >
                          View
                        </Button>
                        <Button
                          variant="light"
                          size="xs"
                          onClick={() => handleEditLabResult(result)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="light"
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
                { header: 'Test Code', accessor: 'test_code' },
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
              onView={handleViewDetails}
              onEdit={handleEditLabResult}
              onDelete={handleDeleteLabResult}
              formatters={{
                test_name: value => (
                  <Text fw={600} style={{ minWidth: 150 }}>
                    {value}
                  </Text>
                ),
                status: value => <StatusBadge status={value} size="small" />,
                practitioner_id: (value, item) => {
                  if (!value) return '-';
                  const practitioner = practitioners.find(p => p.id === value);
                  return practitioner ? practitioner.name : `ID: ${value}`;
                },
                ordered_date: value => formatDate(value),
                completed_date: value => (value ? formatDate(value) : '-'),
                files: (value, item) =>
                  filesCounts[item.id] > 0 ? (
                    <span className="file-indicator">
                      📎 {filesCounts[item.id]}
                    </span>
                  ) : (
                    <span className="no-files">None</span>
                  ),
              }}
            />
          )}
        </Stack>
      </Container>

      {/* Create/Edit Form Modal */}
      {showModal && (modalType === 'create' || modalType === 'edit') && (
        <MantineLabResultForm
          isOpen={showModal}
          onClose={handleCloseModal}
          title={editingLabResult ? 'Edit Lab Result' : 'Add New Lab Result'}
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          practitioners={practitioners}
          editingLabResult={editingLabResult}
        >
          {/* File Management Section for Edit Mode */}
          {editingLabResult && (
            <div className="file-upload-section">
              <h4>Manage Files</h4>

              {/* Existing Files */}
              {selectedFiles.length > 0 && (
                <div className="existing-files">
                  <h5>Current Files:</h5>
                  {selectedFiles.map(file => (
                    <div
                      key={file.id}
                      className={`existing-file-item ${filesToDelete.includes(file.id) ? 'marked-for-deletion' : ''}`}
                    >
                      <span className="file-name">{file.file_name}</span>
                      <span className="file-size">
                        {(file.file_size / 1024).toFixed(1)} KB
                      </span>
                      {file.description && (
                        <span className="file-description">
                          {file.description}
                        </span>
                      )}
                      <div className="file-actions">
                        <Button
                          type="button"
                          variant="secondary"
                          size="small"
                          onClick={() =>
                            handleDownloadFile(file.id, file.file_name)
                          }
                        >
                          Download
                        </Button>
                        {filesToDelete.includes(file.id) ? (
                          <Button
                            type="button"
                            variant="subtle"
                            size="small"
                            onClick={() => handleUnmarkFileForDeletion(file.id)}
                          >
                            Restore
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="danger"
                            size="small"
                            onClick={() => handleMarkFileForDeletion(file.id)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Files */}
              <div className="file-upload-controls">
                <input
                  type="file"
                  id="file-input"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.tiff,.bmp,.gif,.txt,.csv,.xml,.json,.doc,.docx,.xls,.xlsx"
                  onChange={e => {
                    Array.from(e.target.files).forEach(file => {
                      handleAddPendingFile(file, '');
                    });
                    e.target.value = '';
                  }}
                  style={{ display: 'none' }}
                />
                <label htmlFor="file-input" className="file-upload-button">
                  Add New Files
                </label>
              </div>

              {/* Pending Files */}
              {pendingFiles.length > 0 && (
                <div className="pending-files">
                  <h5>Files to Upload:</h5>
                  {pendingFiles.map(pendingFile => (
                    <div key={pendingFile.id} className="pending-file-item">
                      <span className="file-name">{pendingFile.file.name}</span>
                      <span className="file-size">
                        {(pendingFile.file.size / 1024).toFixed(1)} KB
                      </span>
                      <input
                        type="text"
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
                      />
                      <Button
                        type="button"
                        variant="danger"
                        size="small"
                        onClick={() => handleRemovePendingFile(pendingFile.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </MantineLabResultForm>
      )}

      {/* View Details Modal */}
      {showModal && modalType === 'view' && selectedLabResult && (
        <MedicalFormModal
          isOpen={showModal}
          onClose={handleCloseModal}
          title={selectedLabResult.test_name}
          maxWidth="900px"
        >
          <div className="details-section">
            <h3>Lab Result Details</h3>
            <div className="details-grid">
              <div className="detail-item">
                <strong>Test Name:</strong> {selectedLabResult.test_name}
              </div>
              <div className="detail-item">
                <strong>Test Code:</strong>{' '}
                {selectedLabResult.test_code || 'N/A'}
              </div>
              <div className="detail-item">
                <strong>Category:</strong>{' '}
                {selectedLabResult.test_category || 'N/A'}
              </div>
              {selectedLabResult.test_type && (
                <div className="detail-item">
                  <strong>Test Type:</strong> {selectedLabResult.test_type}
                </div>
              )}
              {selectedLabResult.facility && (
                <div className="detail-item">
                  <strong>Facility:</strong> {selectedLabResult.facility}
                </div>
              )}
              <div className="detail-item">
                <strong>Status:</strong>
                <StatusBadge status={selectedLabResult.status} />
              </div>
              {selectedLabResult.labs_result && (
                <div className="detail-item">
                  <strong>Lab Result:</strong>
                  <StatusBadge status={selectedLabResult.labs_result} />
                </div>
              )}
              {selectedLabResult.practitioner_id && (
                <div className="detail-item">
                  <strong>Ordering Practitioner:</strong>
                  {practitioners.find(
                    p => p.id === selectedLabResult.practitioner_id
                  )?.name ||
                    `Practitioner ID: ${selectedLabResult.practitioner_id}`}
                </div>
              )}
              <div className="detail-item">
                <strong>Ordered Date:</strong>{' '}
                {formatDate(selectedLabResult.ordered_date)}
              </div>
              {selectedLabResult.completed_date && (
                <div className="detail-item">
                  <strong>Completed Date:</strong>{' '}
                  {formatDate(selectedLabResult.completed_date)}
                </div>
              )}
              {selectedLabResult.notes && (
                <div className="detail-item full-width">
                  <strong>Notes:</strong>
                  <div className="notes-content">{selectedLabResult.notes}</div>
                </div>
              )}
            </div>
          </div>

          <div className="files-section">
            <h3>Associated Files</h3>

            {/* File Upload Form */}
            <form onSubmit={handleFileUpload} className="file-upload-form">
              <div className="upload-inputs">
                <input
                  type="file"
                  onChange={e =>
                    setFileUpload(prev => ({
                      ...prev,
                      file: e.target.files[0],
                    }))
                  }
                  accept=".pdf,.jpg,.jpeg,.png,.tiff,.bmp,.gif"
                />
                <input
                  type="text"
                  placeholder="File description (optional)"
                  value={fileUpload.description}
                  onChange={e =>
                    setFileUpload(prev => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
                <button type="submit" disabled={!fileUpload.file}>
                  Upload
                </button>
              </div>
            </form>

            {/* Files List */}
            <div className="files-list">
              {selectedFiles.length === 0 ? (
                <p>No files attached to this lab result.</p>
              ) : (
                selectedFiles.map(file => (
                  <div key={file.id} className="file-item">
                    <div className="file-info">
                      <span className="file-name">{file.file_name}</span>
                      <span className="file-size">
                        {(file.file_size / 1024).toFixed(1)} KB
                      </span>
                      <span className="file-type">{file.file_type}</span>
                      {file.description && (
                        <span className="file-description">
                          {file.description}
                        </span>
                      )}
                    </div>
                    <div className="file-actions">
                      <button
                        className="view-button"
                        onClick={() =>
                          handleDownloadFile(file.id, file.file_name)
                        }
                      >
                        Download
                      </button>
                      <button
                        className="delete-button"
                        onClick={() => handleDeleteFile(file.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </MedicalFormModal>
      )}
    </>
  );
};

export default LabResults;
