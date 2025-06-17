import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { formatDateTime } from '../../utils/helpers';
import '../../styles/shared/MedicalPageShared.css';
import '../../styles/pages/LabResults.css';

const LabResults = () => {
  const [labResults, setLabResults] = useState([]);
  const [filesCounts, setFilesCounts] = useState({}); // Track file counts per lab result
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingLabResult, setEditingLabResult] = useState(null);
  const [selectedLabResult, setSelectedLabResult] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileUpload, setFileUpload] = useState({ file: null, description: '' });
  const [pendingFiles, setPendingFiles] = useState([]); // Files to be uploaded after lab result creation/update
  const [filesToDelete, setFilesToDelete] = useState([]); // Files to be deleted during edit
  const [currentPatient, setCurrentPatient] = useState(null);
  const [practitioners, setPractitioners] = useState([]);
  
  // Use useRef to maintain abort controller reference without causing re-renders
  const abortControllerRef = useRef(null);
  
  // Form state for creating/editing lab results (simplified schema)
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
    practitioner_id: ''
  });
    const navigate = useNavigate();
  
  const statusOptions = [
    'ordered', 'in-progress', 'completed', 'cancelled'
  ];
  const categoryOptions = [
    'blood work', 'imaging', 'pathology', 'microbiology',
    'chemistry', 'hematology', 'immunology', 'genetics',
    'cardiology', 'pulmonology', 'other'
  ];
  const testTypeOptions = [
    'routine', 'urgent', 'stat', 'emergency', 'follow-up', 'screening'
  ];
  const labsResultOptions = [
    'normal', 'abnormal', 'critical', 'high', 'low', 'borderline', 'inconclusive'
  ];const fetchCurrentPatient = async () => {
    try {
      const patient = await apiService.getCurrentPatient();
      setCurrentPatient(patient);
    } catch (error) {
      console.error('Error fetching current patient:', error);
      // Don't set error state for patient fetch failures to avoid blocking the page
    }
  };

  const fetchPractitioners = async () => {
    try {
      const practitionersData = await apiService.getPractitioners();
      setPractitioners(practitionersData);
    } catch (error) {
      console.error('Error fetching practitioners:', error);
      // Don't set error state for practitioner fetch failures
    }
  };const fetchLabResults = useCallback(async () => {
    // Cancel any existing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const newAbortController = new AbortController();
    abortControllerRef.current = newAbortController;

    try {
      setLoading(true);
      setError(null);
      
      let results;
      // If we have a current patient, fetch their lab results
      if (currentPatient?.id) {
        results = await apiService.getPatientLabResults(currentPatient.id);
      } else {
        // Otherwise fetch all lab results (for admin users)
        results = await apiService.getLabResults();
      }
      
      // Check if request was cancelled
      if (newAbortController.signal.aborted) {
        return;
      }
        setLabResults(results);
      
      // Only load file counts if there aren't too many lab results to prevent rate limiting
      if (results.length <= 20) {
        // Load file counts for each lab result with cancellation support
        await loadFilesCounts(results, newAbortController);
      } else {
        console.log(`Skipping file count loading for ${results.length} lab results to prevent rate limiting`);
        // Initialize file counts to 0 for all results
        const counts = {};
        results.forEach(result => {
          counts[result.id] = 0;
        });
        setFilesCounts(counts);
      }
      
    } catch (error) {
      // Don't show errors if the request was cancelled
      if (error.name !== 'AbortError' && !newAbortController.signal.aborted) {
        console.error('Error fetching lab results:', error);
        setError(error.message);
      }
    } finally {
      if (!newAbortController.signal.aborted) {
        setLoading(false);
      }    }
  }, [currentPatient?.id]); // Only depend on patient ID
  useEffect(() => {
    fetchCurrentPatient();
    fetchPractitioners();
    
    // Cleanup function to cancel requests when component unmounts
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []); // Only run once on mount
  
  useEffect(() => {
    if (currentPatient) {
      // Add debouncing to prevent rapid successive calls
      const timer = setTimeout(() => {
        fetchLabResults();
      }, 300); // 300ms debounce
      
      return () => clearTimeout(timer);
    }
  }, [currentPatient, fetchLabResults]); // Run when patient changes

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Helper functions for file management during create/edit
  const handleAddPendingFile = (file, description = '') => {
    setPendingFiles(prev => [...prev, { file, description, id: Date.now() }]);
  };

  const handleRemovePendingFile = (fileId) => {
    setPendingFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleMarkFileForDeletion = (fileId) => {
    setFilesToDelete(prev => [...prev, fileId]);
  };

  const handleUnmarkFileForDeletion = (fileId) => {
    setFilesToDelete(prev => prev.filter(id => id !== fileId));
  };

  const uploadPendingFiles = async (labResultId) => {
    const uploadPromises = pendingFiles.map(async (pendingFile) => {
      try {
        await apiService.uploadLabResultFile(labResultId, pendingFile.file, pendingFile.description);
      } catch (error) {
        console.error(`Failed to upload file: ${pendingFile.file.name}`, error);
        throw error;
      }
    });
    
    await Promise.all(uploadPromises);
    setPendingFiles([]); // Clear pending files after successful upload
  };

  const deleteMarkedFiles = async () => {
    const deletePromises = filesToDelete.map(async (fileId) => {
      try {
        await apiService.deleteLabResultFile(fileId);
      } catch (error) {
        console.error(`Failed to delete file: ${fileId}`, error);
        throw error;
      }
    });
    
    await Promise.all(deletePromises);
    setFilesToDelete([]); // Clear marked files after successful deletion
  };

  const clearPendingFiles = () => {
    setPendingFiles([]);
    setFilesToDelete([]);
  };

  const handleCreateLabResult = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      
      // Prepare data for submission (simplified schema)
      const labResultData = {
        ...formData,
        patient_id: currentPatient?.id,
        practitioner_id: formData.practitioner_id ? parseInt(formData.practitioner_id) : null,
        ordered_date: formData.ordered_date || new Date().toISOString(),
        completed_date: formData.completed_date || null,
      };

      const createdLabResult = await apiService.createLabResult(labResultData);
      
      // Upload any pending files
      if (pendingFiles.length > 0) {
        await uploadPendingFiles(createdLabResult.id);
      }
      
      // Reset form and refresh list
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
        practitioner_id: ''
      });
      setPendingFiles([]); // Clear pending files
      setShowCreateForm(false);
      fetchLabResults();
    } catch (error) {
      console.error('Error creating lab result:', error);
      setError(error.message);
    }
  };

  const handleDeleteLabResult = async (labResultId) => {
    if (window.confirm('Are you sure you want to delete this lab result? This action cannot be undone.')) {
      try {
        await apiService.deleteLabResult(labResultId);
        fetchLabResults();
      } catch (error) {
        console.error('Error deleting lab result:', error);
        setError(error.message);
      }
    }
  };  const handleEditLabResult = async (labResult) => {
    setEditingLabResult(labResult);
    setFormData({
      test_name: labResult.test_name || '',
      test_code: labResult.test_code || '',
      test_category: labResult.test_category || '',
      test_type: labResult.test_type || '',
      facility: labResult.facility || '',
      status: labResult.status || 'ordered',
      labs_result: labResult.labs_result || '',
      ordered_date: labResult.ordered_date ? labResult.ordered_date.slice(0, 16) : '',
      completed_date: labResult.completed_date ? labResult.completed_date.slice(0, 16) : '',
      notes: labResult.notes || '',
      practitioner_id: labResult.practitioner_id || ''
    });
    
    // Load existing files for this lab result
    try {
      const files = await apiService.getLabResultFiles(labResult.id);
      setSelectedFiles(files);
    } catch (error) {
      console.error('Error loading files:', error);
      setSelectedFiles([]);
    }
    
    // Clear any pending files and files marked for deletion
    setPendingFiles([]);
    setFilesToDelete([]);
    setShowEditForm(true);
  };
  const handleUpdateLabResult = async (e) => {
    e.preventDefault();
    if (!editingLabResult) return;

    try {
      setError(null);
      
      // Delete marked files first
      if (filesToDelete.length > 0) {
        await deleteMarkedFiles();
      }      // Prepare data for submission
      const labResultData = {
        ...formData,
        practitioner_id: formData.practitioner_id ? parseInt(formData.practitioner_id) : null,
        ordered_date: formData.ordered_date ? new Date(formData.ordered_date).toISOString() : new Date().toISOString(),
        completed_date: formData.completed_date ? new Date(formData.completed_date).toISOString() : null,
      };

      console.log('Updating lab result with data:', labResultData);
      await apiService.updateLabResult(editingLabResult.id, labResultData);
      
      // Upload any pending files
      if (pendingFiles.length > 0) {
        await uploadPendingFiles(editingLabResult.id);
      }
      
      // Reset form and refresh list
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
        practitioner_id: ''
      });
      setPendingFiles([]); // Clear pending files
      setFilesToDelete([]); // Clear files to delete
      setShowEditForm(false);
      setEditingLabResult(null);
      fetchLabResults();
    } catch (error) {
      console.error('Error updating lab result:', error);
      setError(error.message);
    }
  };

  const handleViewDetails = async (labResult) => {
    try {
      setSelectedLabResult(labResult);
      // Fetch files for this lab result
      const files = await apiService.getLabResultFiles(labResult.id);
      setSelectedFiles(files);
    } catch (error) {
      console.error('Error fetching lab result details:', error);
      setError(error.message);
    }
  };  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!fileUpload.file || !selectedLabResult) return;

    try {
      const formData = new FormData();
      formData.append('file', fileUpload.file);
      if (fileUpload.description && fileUpload.description.trim()) {
        formData.append('description', fileUpload.description);      }
      
      await apiService.post(`/lab-results/${selectedLabResult.id}/files`, formData);
      
      // Refresh files list
      const files = await apiService.getLabResultFiles(selectedLabResult.id);
      setSelectedFiles(files);      
      // Update the file count for this lab result
      setFilesCounts(prev => ({
        ...prev,
        [selectedLabResult.id]: files.length
      }));
      
      // Reset file upload form
      setFileUpload({ file: null, description: '' });
    } catch (error) {
      console.error('Error uploading file:', error);
      setError(error.message);
    }
  };  const handleDownloadFile = async (fileId, fileName) => {
    try {
      const blob = await apiService.get(`/lab-result-files/${fileId}/download`, { 
        responseType: 'blob' 
      });
      
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
      } else {
        throw new Error('Invalid response type for file download');
      }
    } catch (error) {
      console.error('Error downloading file:', error);
      setError(error.message);
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      try {
        await apiService.deleteLabResultFile(fileId);
        // Refresh files list
        const files = await apiService.getLabResultFiles(selectedLabResult.id);
        setSelectedFiles(files);
      } catch (error) {
        console.error('Error deleting file:', error);
        setError(error.message);
      }    }
  };

  const getStatusClass = (status) => {
    if (!status) return '';
    switch (status.toLowerCase()) {
      case 'completed':
        return 'status-completed';
      case 'in-progress':
        return 'status-in-progress';
      case 'ordered':
        return 'status-ordered';
      case 'cancelled':
        return 'status-cancelled';
      default:
        return '';
    }  };  // Load file counts for all lab results
  const loadFilesCounts = async (results, abortController) => {
    try {
      console.log('Loading file counts for', results.length, 'lab results');
      const counts = {};
      
      // Process lab results in smaller batches to avoid rate limiting
      const batchSize = 1; // Process one at a time to prevent rate limiting
      for (let i = 0; i < results.length; i += batchSize) {
        // Check if request was cancelled
        if (abortController && abortController.signal.aborted) {
          console.log('File count loading cancelled');
          return;
        }
        
        const batch = results.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (result) => {
            try {
              // Check cancellation before each request
              if (abortController && abortController.signal.aborted) {
                return;
              }
              
              const files = await apiService.getLabResultFiles(result.id);
              counts[result.id] = files.length;
              console.log(`Lab result ${result.id} has ${files.length} files`);
            } catch (error) {
              // Don't log errors if request was cancelled or rate limited
              if (error.name !== 'AbortError' && (!abortController || !abortController.signal.aborted)) {
                // Handle rate limiting gracefully
                if (error.message && error.message.includes('Rate limit exceeded')) {
                  console.log(`Rate limited for lab result ${result.id}, setting count to 0`);
                } else {
                  console.log(`Error loading files for lab result ${result.id}:`, error);
                }
              }
              counts[result.id] = 0;
            }
          })
        );
        
        // Check cancellation before delay
        if (abortController && abortController.signal.aborted) {
          return;
        }
        
        // Longer delay between requests to prevent rate limiting
        if (i + batchSize < results.length) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Increased delay to 500ms
        }
      }
      
      // Only update state if not cancelled
      if (!abortController || !abortController.signal.aborted) {
        console.log('Final file counts:', counts);
        setFilesCounts(counts);
      }
    } catch (error) {
      if (error.name !== 'AbortError' && (!abortController || !abortController.signal.aborted)) {
        console.error('Error loading file counts:', error);
      }
      // Don't fail the whole page if file counts fail
    }
  };
  if (loading) {
    return (
      <div className="medical-page-container">
        <div className="loading">Loading lab results...</div>
      </div>
    );
  }
  return (
    <div className="medical-page-container">
      <header className="medical-page-header">
        <button
            className="back-button"
            onClick={() => navigate('/dashboard')}
        >
          ← Back to Dashboard            
        </button>
        <h1>🧪 Lab Results</h1>
      </header>

      <div className="medical-page-content">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="medical-page-controls">
          <div className="controls-left">
            <button 
              className="add-button"
              onClick={() => setShowCreateForm(true)}
            >
              + Add New Lab Result
            </button>
          </div>
          
          <div className="controls-right">
            {/* Future: Add sort controls if needed */}
          </div>
        </div>      {/* Create Lab Result Form */}
      {showCreateForm && (
        <div className="medical-form-overlay">
          <div className="medical-form-modal">
            <div className="form-header">
              <h3>Add New Lab Result</h3>              <button 
                className="close-button"
                onClick={() => {
                  setShowCreateForm(false);
                  clearPendingFiles();
                }}
              >
                ×
              </button>
            </div>
            <div className="medical-form-content">
              <form onSubmit={handleCreateLabResult}>
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

                <div className="form-group">
                  <label>Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    required
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
                    <option value="">Select result...</option>
                    {labsResultOptions.map(option => (
                      <option key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Ordered Date</label>
                  <input
                    type="datetime-local"
                    name="ordered_date"
                    value={formData.ordered_date}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label>Completed Date</label>
                  <input
                    type="datetime-local"
                    name="completed_date"
                    value={formData.completed_date}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group full-width">
                  <label>Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Additional notes about the test"
                    rows="3"
                  />
                </div>
              </div>                {/* File Upload Section */}
              <div className="file-upload-section">
                <h4>Attach Files</h4>
                <div className="file-upload-controls">
                  <input
                    type="file"
                    id="create-file-input"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.tiff,.bmp,.gif,.txt,.csv,.xml,.json,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => {
                      Array.from(e.target.files).forEach(file => {
                        handleAddPendingFile(file, '');
                      });
                      e.target.value = ''; // Reset input
                    }}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="create-file-input" className="file-upload-button">
                    Add Files
                  </label>
                </div>
                
                {/* Pending Files Display */}
                {pendingFiles.length > 0 && (
                  <div className="pending-files">
                    <h5>Files to Upload:</h5>
                    {pendingFiles.map(pendingFile => (
                      <div key={pendingFile.id} className="pending-file-item">
                        <span className="file-name">{pendingFile.file.name}</span>
                        <span className="file-size">{(pendingFile.file.size / 1024).toFixed(1)} KB</span>
                        <input
                          type="text"
                          placeholder="Description (optional)"
                          value={pendingFile.description}
                          onChange={(e) => {
                            setPendingFiles(prev => prev.map(f => 
                              f.id === pendingFile.id 
                                ? { ...f, description: e.target.value }
                                : f
                            ));
                          }}
                        />
                        <button
                          type="button"
                          className="remove-file-button"
                          onClick={() => handleRemovePendingFile(pendingFile.id)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-actions">                  <button type="button" className="cancel-button" onClick={() => {
                    setShowCreateForm(false);
                    setPendingFiles([]);
                  }}>
                    Cancel
                  </button>
                  <button type="submit" className="save-button">
                    Create Lab Result
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}      {/* Edit Lab Result Form */}
      {showEditForm && editingLabResult && (
        <div className="medical-form-overlay">
          <div className="medical-form-modal">
            <div className="form-header">
              <h3>Edit Lab Result</h3>              <button 
                className="close-button"
                onClick={() => {
                  setShowEditForm(false);
                  setEditingLabResult(null);
                  clearPendingFiles();
                }}
              >
                ×
              </button>
            </div>
            <div className="medical-form-content">
              <form onSubmit={handleUpdateLabResult}>
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

                <div className="form-group">
                  <label>Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    required
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
                    <option value="">Select result...</option>
                    {labsResultOptions.map(option => (
                      <option key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Ordered Date</label>
                  <input
                    type="datetime-local"
                    name="ordered_date"
                    value={formData.ordered_date}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label>Completed Date</label>
                  <input
                    type="datetime-local"
                    name="completed_date"
                    value={formData.completed_date}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group full-width">
                  <label>Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Additional notes about the test"
                    rows="3"
                  />
                </div>
              </div>              {/* File Upload Section for Edit */}
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
                        <span className="file-size">{(file.file_size / 1024).toFixed(1)} KB</span>
                        {file.description && (
                          <span className="file-description">{file.description}</span>
                        )}
                        <div className="file-actions">
                          <button
                            type="button"
                            className="download-button"
                            onClick={() => handleDownloadFile(file.id, file.file_name)}
                          >
                            Download
                          </button>
                          {filesToDelete.includes(file.id) ? (
                            <button
                              type="button"
                              className="restore-button"
                              onClick={() => handleUnmarkFileForDeletion(file.id)}
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
                    id="edit-file-input"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.tiff,.bmp,.gif,.txt,.csv,.xml,.json,.doc,.docx,.xls,.xlsx"
                    onChange={(e) => {
                      Array.from(e.target.files).forEach(file => {
                        handleAddPendingFile(file, '');
                      });
                      e.target.value = ''; // Reset input
                    }}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="edit-file-input" className="file-upload-button">
                    Add New Files
                  </label>
                </div>
                
                {/* Pending Files Display */}
                {pendingFiles.length > 0 && (
                  <div className="pending-files">
                    <h5>Files to Upload:</h5>
                    {pendingFiles.map(pendingFile => (
                      <div key={pendingFile.id} className="pending-file-item">
                        <span className="file-name">{pendingFile.file.name}</span>
                        <span className="file-size">{(pendingFile.file.size / 1024).toFixed(1)} KB</span>
                        <input
                          type="text"
                          placeholder="Description (optional)"
                          value={pendingFile.description}
                          onChange={(e) => {
                            setPendingFiles(prev => prev.map(f => 
                              f.id === pendingFile.id 
                                ? { ...f, description: e.target.value }
                                : f
                            ));
                          }}
                        />
                        <button
                          type="button"
                          className="remove-file-button"
                          onClick={() => handleRemovePendingFile(pendingFile.id)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-actions">                
                <button 
                  type="button" 
                  className="cancel-button"
                  onClick={() => {
                    setShowEditForm(false);
                    setEditingLabResult(null);
                    setPendingFiles([]);
                    setFilesToDelete([]);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="save-button">
                  Update Lab Result
                </button>
              </div>
              </form>
            </div>
          </div>
        </div>
      )}{/* Lab Results List */}
      <div className="medical-items-list">
        {labResults.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧪</div>
            <h3>No lab results found</h3>
            <p>Click "Add New Lab Result" to get started.</p>
          </div>
        ) : (          <div className="medical-items-grid">            {labResults.map(result => {
              console.log(`Rendering lab result ${result.id}, file count:`, filesCounts[result.id]);
              return (              <div key={result.id} className="medical-item-card">
                <div className="medical-item-header">
                  <h3 className="item-title">{result.test_name}</h3>
                  <span className={`status-badge status-${result.status.replace(/\s+/g, '-')}`}>
                    {result.status}
                  </span>
                </div>
                  <div className="medical-item-details">
                  <div className="detail-item">
                    <span className="label">Test Code:</span>
                    <span className="value">{result.test_code || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Category:</span>
                    <span className="value">{result.test_category || 'N/A'}</span>
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
                    <span className="value">{formatDateTime(result.ordered_date)}</span>
                  </div>
                  {result.completed_date && (
                    <div className="detail-item">
                      <span className="label">Completed:</span>
                      <span className="value">{formatDateTime(result.completed_date)}</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="label">Files:</span>
                    <span className="value">
                      {filesCounts[result.id] > 0 ? (
                        <span className="file-indicator" title={`${filesCounts[result.id]} file(s) attached`}>
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
              );
            })}
          </div>
        )}
      </div>      {/* Lab Result Details Modal */}
      {selectedLabResult && (
        <div className="medical-form-overlay">
          <div className="medical-form-modal">
            <div className="form-header">
              <h3>{selectedLabResult.test_name}</h3>
              <button 
                className="close-button"
                onClick={() => setSelectedLabResult(null)}
              >
                ×
              </button>
            </div>
            
            <div className="medical-form-content">
              <div className="details-section">
                <h3>Lab Result Details</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <strong>Test Name:</strong> {selectedLabResult.test_name}
                  </div>
                  <div className="detail-item">
                    <strong>Test Code:</strong> {selectedLabResult.test_code || 'N/A'}
                  </div>                  <div className="detail-item">
                    <strong>Category:</strong> {selectedLabResult.test_category || 'N/A'}
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
                    <span className={`status-badge ${getStatusClass(selectedLabResult.status)}`}>
                      {selectedLabResult.status}
                    </span>
                  </div>
                  {selectedLabResult.labs_result && (
                    <div className="detail-item">
                      <strong>Lab Result:</strong> 
                      <span className={`result-badge result-${selectedLabResult.labs_result.toLowerCase()}`}>
                        {selectedLabResult.labs_result.charAt(0).toUpperCase() + selectedLabResult.labs_result.slice(1)}
                      </span>
                    </div>
                  )}
                  {selectedLabResult.practitioner_id && (
                    <div className="detail-item">
                      <strong>Ordering Practitioner:</strong> {
                        practitioners.find(p => p.id === selectedLabResult.practitioner_id)?.name || 
                        `Practitioner ID: ${selectedLabResult.practitioner_id}`
                      }
                    </div>
                  )}
                  <div className="detail-item">
                    <strong>Ordered Date:</strong> {formatDateTime(selectedLabResult.ordered_date)}
                  </div>
                  {selectedLabResult.completed_date && (
                    <div className="detail-item">
                      <strong>Completed Date:</strong> {formatDateTime(selectedLabResult.completed_date)}
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
                      onChange={(e) => setFileUpload(prev => ({...prev, file: e.target.files[0]}))}
                      accept=".pdf,.jpg,.jpeg,.png,.tiff,.bmp,.gif"
                    />
                    <input
                      type="text"
                      placeholder="File description (optional)"
                      value={fileUpload.description}
                      onChange={(e) => setFileUpload(prev => ({...prev, description: e.target.value}))}
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
                          <span className="file-size">{(file.file_size / 1024).toFixed(1)} KB</span>
                          <span className="file-type">{file.file_type}</span>
                          {file.description && (
                            <span className="file-description">{file.description}</span>
                          )}
                        </div>                        
                        
                        <div className="file-actions">
                          <button 
                            className="view-button"
                            onClick={() => handleDownloadFile(file.id, file.file_name)}
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
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default LabResults;
