import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMedicalData } from '../../hooks/useMedicalData';
import { apiService } from '../../services/api';
import { formatDate, formatDateTime } from '../../utils/helpers';
import { usePractitioners } from '../../hooks/useGlobalData';
import { PageHeader } from '../../components';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import MedicalFormModal from '../../components/medical/MedicalFormModal';
import StatusBadge from '../../components/medical/StatusBadge';
import '../../styles/shared/MedicalPageShared.css';
import '../../styles/pages/LabResults.css';
import '../../styles/pages/MedicationTable.css';

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

  // Combined loading state
  const loading = labResultsLoading || practitionersLoading;

  // File management state (keep complex file functionality)
  const [filesCounts, setFilesCounts] = useState({});
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

  // Options for dropdowns
  const statusOptions = ['ordered', 'in-progress', 'completed', 'cancelled'];
  const categoryOptions = [
    'blood work',
    'imaging',
    'pathology',
    'microbiology',
    'chemistry',
    'hematology',
    'immunology',
    'genetics',
    'cardiology',
    'pulmonology',
    'other',
  ];
  const testTypeOptions = [
    'routine',
    'urgent',
    'stat',
    'emergency',
    'follow-up',
    'screening',
  ];
  const labsResultOptions = [
    'normal',
    'abnormal',
    'critical',
    'high',
    'low',
    'borderline',
    'inconclusive',
  ];

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
    if (labResults.length > 0 && labResults.length <= 20) {
      const controller = new AbortController();
      loadFilesCounts(labResults, controller);
      return () => controller.abort();
    } else {
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

        setShowModal(false);
        setPendingFiles([]);
        setFilesToDelete([]);
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
    setPendingFiles([]);
    setFilesToDelete([]);
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
      <div className="medical-page-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading lab results...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="medical-page-container">
      <PageHeader title="Lab Results" icon="🧪" />

      <div className="medical-page-content">
        {error && (
          <div className="error-message">
            {error}
            <button onClick={clearError} className="error-close">
              ×
            </button>
          </div>
        )}
        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}

        <div className="medical-page-controls">
          <div className="controls-left">
            <button className="add-button" onClick={handleAddLabResult}>
              + Add New Lab Result
            </button>
          </div>

          <div className="controls-center">
            <ViewToggle
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              showPrint={true}
            />
          </div>

          <div className="controls-right">
            {/* Future: Add sort/filter controls */}
          </div>
        </div>

        <div className="medical-items-list">
          {labResults.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🧪</div>
              <h3>No lab results found</h3>
              <p>Click "Add New Lab Result" to get started.</p>
              <button className="add-button" onClick={handleAddLabResult}>
                Add Your First Lab Result
              </button>
            </div>
          ) : viewMode === 'cards' ? (
            <div className="medical-items-grid">
              {labResults.map(result => (
                <div key={result.id} className="medical-item-card">
                  <div className="medical-item-header">
                    <div className="item-info">
                      <h3 className="item-title">{result.test_name}</h3>
                    </div>
                    <div className="status-badges">
                      <StatusBadge status={result.status} />
                    </div>
                  </div>

                  <div className="medical-item-details">
                    <div className="detail-item">
                      <span className="label">Test Code:</span>
                      <span className="value">{result.test_code || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Category:</span>
                      <span className="value">
                        {result.test_category || 'N/A'}
                      </span>
                    </div>
                    {result.test_type && (
                      <div className="detail-item">
                        <span className="label">Type:</span>
                        <span className="value">{result.test_type}</span>
                      </div>
                    )}
                    {result.facility && (
                      <div className="detail-item">
                        <span className="label">Facility:</span>
                        <span className="value">{result.facility}</span>
                      </div>
                    )}
                    <div className="detail-item">
                      <span className="label">Ordered:</span>
                      <span className="value">
                        {formatDate(result.ordered_date)}
                      </span>
                    </div>
                    {result.completed_date && (
                      <div className="detail-item">
                        <span className="label">Completed:</span>
                        <span className="value">
                          {formatDate(result.completed_date)}
                        </span>
                      </div>
                    )}
                    {result.labs_result && (
                      <div className="detail-item">
                        <span className="label">Result:</span>
                        <StatusBadge status={result.labs_result} />
                      </div>
                    )}
                    {result.practitioner_id && (
                      <div className="detail-item">
                        <span className="label">Ordering Practitioner:</span>
                        <span className="value">
                          {practitioners.find(
                            p => p.id === result.practitioner_id
                          )?.name ||
                            `Practitioner ID: ${result.practitioner_id}`}
                        </span>
                      </div>
                    )}
                    <div className="detail-item">
                      <span className="label">Files:</span>
                      <span className="value">
                        {filesCounts[result.id] > 0 ? (
                          <span
                            className="file-indicator"
                            title={`${filesCounts[result.id]} file(s) attached`}
                          >
                            📎 {filesCounts[result.id]} attached
                          </span>
                        ) : (
                          <span className="no-files">No files attached</span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="medical-item-actions">
                    <button
                      className="view-button"
                      onClick={() => handleViewDetails(result)}
                    >
                      👁️ View
                    </button>
                    <button
                      className="edit-button"
                      onClick={() => handleEditLabResult(result)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => handleDeleteLabResult(result.id)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <MedicalTable
              data={labResults}
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
                  <span className="primary-field">{value}</span>
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
        </div>
      </div>

      {/* Create/Edit Form Modal */}
      {showModal && (modalType === 'create' || modalType === 'edit') && (
        <MedicalFormModal
          isOpen={showModal}
          onClose={handleCloseModal}
          title={editingLabResult ? 'Edit Lab Result' : 'Add New Lab Result'}
          maxWidth="800px"
        >
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Test Name *</label>
                <input
                  type="text"
                  name="test_name"
                  value={formData.test_name}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Complete Blood Count"
                />
              </div>

              <div className="form-group">
                <label>Test Code</label>
                <input
                  type="text"
                  name="test_code"
                  value={formData.test_code}
                  onChange={handleInputChange}
                  placeholder="e.g., CBC, LOINC code"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Test Category</label>
                  <select
                    name="test_category"
                    value={formData.test_category}
                    onChange={handleInputChange}
                  >
                    <option value="">Select category</option>
                    {categoryOptions.map(option => (
                      <option key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Test Type</label>
                  <select
                    name="test_type"
                    value={formData.test_type}
                    onChange={handleInputChange}
                  >
                    <option value="">Select type</option>
                    {testTypeOptions.map(option => (
                      <option key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Facility</label>
                  <input
                    type="text"
                    name="facility"
                    value={formData.facility}
                    onChange={handleInputChange}
                    placeholder="e.g., Main Hospital Lab"
                  />
                </div>

                <div className="form-group">
                  <label>Ordering Practitioner</label>
                  <select
                    name="practitioner_id"
                    value={formData.practitioner_id}
                    onChange={handleInputChange}
                  >
                    <option value="">Select practitioner</option>
                    {practitioners.map(practitioner => (
                      <option key={practitioner.id} value={practitioner.id}>
                        {practitioner.name} - {practitioner.specialty}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                  >
                    {statusOptions.map(option => (
                      <option key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Lab Result</label>
                  <select
                    name="labs_result"
                    value={formData.labs_result}
                    onChange={handleInputChange}
                  >
                    <option value="">Select result</option>
                    {labsResultOptions.map(option => (
                      <option key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Ordered Date</label>
                  <input
                    type="date"
                    name="ordered_date"
                    value={formData.ordered_date}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label>Completed Date</label>
                  <input
                    type="date"
                    name="completed_date"
                    value={formData.completed_date}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Additional notes about the test"
                  rows="3"
                />
              </div>
            </div>

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
                          <button
                            type="button"
                            className="download-button"
                            onClick={() =>
                              handleDownloadFile(file.id, file.file_name)
                            }
                          >
                            Download
                          </button>
                          {filesToDelete.includes(file.id) ? (
                            <button
                              type="button"
                              className="restore-button"
                              onClick={() =>
                                handleUnmarkFileForDeletion(file.id)
                              }
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="delete-button"
                              onClick={() => handleMarkFileForDeletion(file.id)}
                            >
                              Delete
                            </button>
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
                        <span className="file-name">
                          {pendingFile.file.name}
                        </span>
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
                        <button
                          type="button"
                          className="remove-file-button"
                          onClick={() =>
                            handleRemovePendingFile(pendingFile.id)
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={handleCloseModal}
              >
                Cancel
              </button>
              <button type="submit" className="save-button">
                {editingLabResult ? 'Update Lab Result' : 'Add Lab Result'}
              </button>
            </div>
          </form>
        </MedicalFormModal>
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
    </div>
  );
};

export default LabResults;
