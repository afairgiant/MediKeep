import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import '../styles/LabResults.css';

const LabResults = () => {
  const [labResults, setLabResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedLabResult, setSelectedLabResult] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileUpload, setFileUpload] = useState({ file: null, description: '' });
  const [currentPatient, setCurrentPatient] = useState(null);

  // Form state for creating/editing lab results
  const [formData, setFormData] = useState({
    code: '',
    display: '',
    value_quantity: '',
    value_unit: '',
    value_string: '',
    reference_range: '',
    interpretation: '',
    status: 'final',
    effective_date: '',
    category: ''
  });
  const navigate = useNavigate();
  const interpretationOptions = [
    'normal', 'high', 'low', 'critical high', 'critical low',
    'abnormal', 'positive', 'negative', 'inconclusive'
  ];

  const statusOptions = [
    'registered', 'partial', 'preliminary', 'final', 
    'amended', 'corrected', 'cancelled', 'entered-in-error'
  ];

  const categoryOptions = [
    'laboratory', 'imaging', 'pathology', 'microbiology',
    'chemistry', 'hematology', 'immunology', 'genetics'
  ];

  useEffect(() => {
    fetchCurrentPatient();
    fetchLabResults();
  }, []);

  const fetchCurrentPatient = async () => {
    try {
      const patient = await apiService.getCurrentPatient();
      setCurrentPatient(patient);
    } catch (error) {
      console.error('Error fetching current patient:', error);
    }
  };

  const fetchLabResults = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // If we have a current patient, fetch their lab results
      if (currentPatient?.id) {
        const results = await apiService.getPatientLabResults(currentPatient.id);
        setLabResults(results);
      } else {
        // Otherwise fetch all lab results (for admin users)
        const results = await apiService.getLabResults();
        setLabResults(results);
      }
    } catch (error) {
      console.error('Error fetching lab results:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCreateLabResult = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      
      // Prepare data for submission
      const labResultData = {
        ...formData,
        patient_id: currentPatient?.id,
        value_quantity: formData.value_quantity ? parseFloat(formData.value_quantity) : null,
        effective_date: formData.effective_date || null,
      };

      await apiService.createLabResult(labResultData);
      
      // Reset form and refresh list
      setFormData({
        code: '',
        display: '',
        value_quantity: '',
        value_unit: '',
        value_string: '',
        reference_range: '',
        interpretation: '',
        status: 'final',
        effective_date: '',
        category: ''
      });
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
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!fileUpload.file || !selectedLabResult) return;

    try {
      await apiService.uploadLabResultFile(
        selectedLabResult.id, 
        fileUpload.file, 
        fileUpload.description
      );
      
      // Refresh files list
      const files = await apiService.getLabResultFiles(selectedLabResult.id);
      setSelectedFiles(files);
      
      // Reset file upload form
      setFileUpload({ file: null, description: '' });
    } catch (error) {
      console.error('Error uploading file:', error);
      setError(error.message);
    }
  };

  const handleDownloadFile = async (fileId, fileName) => {
    try {
      const blob = await apiService.downloadLabResultFile(fileId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
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
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const formatValue = (labResult) => {
    if (labResult.value_quantity !== null && labResult.value_unit) {
      return `${labResult.value_quantity} ${labResult.value_unit}`;
    } else if (labResult.value_string) {
      return labResult.value_string;
    }
    return 'N/A';
  };

  const getInterpretationClass = (interpretation) => {
    if (!interpretation) return '';
    switch (interpretation.toLowerCase()) {
      case 'high':
      case 'critical high':
        return 'interpretation-high';
      case 'low':
      case 'critical low':
        return 'interpretation-low';
      case 'normal':
        return 'interpretation-normal';
      case 'abnormal':
        return 'interpretation-abnormal';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="lab-results-container">
        <div className="loading">Loading lab results...</div>
      </div>
    );
  }

  return (
    <div className="lab-results-container">
      <div className="lab-results-header">
        <button
            className="back-button"
            onClick={() => navigate('/dashboard')}
        >
          ← Back to Dashboard            
        </button>
        <h1>🧪 Lab Results</h1>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateForm(true)}
        >
          Add New Lab Result
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Create Lab Result Form */}
      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Add New Lab Result</h2>
              <button 
                className="close-btn"
                onClick={() => setShowCreateForm(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateLabResult} className="lab-result-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Test Code *</label>
                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., LOINC code"
                  />
                </div>

                <div className="form-group">
                  <label>Display Name</label>
                  <input
                    type="text"
                    name="display"
                    value={formData.display}
                    onChange={handleInputChange}
                    placeholder="e.g., Blood Glucose"
                  />
                </div>

                <div className="form-group">
                  <label>Numeric Value</label>
                  <input
                    type="number"
                    step="0.01"
                    name="value_quantity"
                    value={formData.value_quantity}
                    onChange={handleInputChange}
                    placeholder="e.g., 95.5"
                  />
                </div>

                <div className="form-group">
                  <label>Unit</label>
                  <input
                    type="text"
                    name="value_unit"
                    value={formData.value_unit}
                    onChange={handleInputChange}
                    placeholder="e.g., mg/dL"
                  />
                </div>

                <div className="form-group">
                  <label>Text Value</label>
                  <input
                    type="text"
                    name="value_string"
                    value={formData.value_string}
                    onChange={handleInputChange}
                    placeholder="For non-numeric results"
                  />
                </div>

                <div className="form-group">
                  <label>Reference Range</label>
                  <input
                    type="text"
                    name="reference_range"
                    value={formData.reference_range}
                    onChange={handleInputChange}
                    placeholder="e.g., 70-100 mg/dL"
                  />
                </div>

                <div className="form-group">
                  <label>Interpretation</label>
                  <select
                    name="interpretation"
                    value={formData.interpretation}
                    onChange={handleInputChange}
                  >
                    <option value="">Select interpretation</option>
                    {interpretationOptions.map(option => (
                      <option key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
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
                  <label>Test Date</label>
                  <input
                    type="date"
                    name="effective_date"
                    value={formData.effective_date}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label>Category</label>
                  <select
                    name="category"
                    value={formData.category}
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
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Lab Result
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lab Results List */}
      <div className="lab-results-list">
        {labResults.length === 0 ? (
          <div className="no-results">
            <p>No lab results found.</p>
            <p>Click "Add New Lab Result" to get started.</p>
          </div>
        ) : (
          <div className="results-grid">
            {labResults.map(result => (
              <div key={result.id} className="lab-result-card">
                <div className="card-header">
                  <h3>{result.display || result.code}</h3>
                  <span className={`interpretation ${getInterpretationClass(result.interpretation)}`}>
                    {result.interpretation || 'N/A'}
                  </span>
                </div>
                
                <div className="card-body">
                  <div className="result-info">
                    <div className="info-row">
                      <span className="label">Value:</span>
                      <span className="value">{formatValue(result)}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">Reference:</span>
                      <span className="value">{result.reference_range || 'N/A'}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">Date:</span>
                      <span className="value">{formatDate(result.effective_date)}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">Status:</span>
                      <span className="value status">{result.status}</span>
                    </div>
                    {result.category && (
                      <div className="info-row">
                        <span className="label">Category:</span>
                        <span className="value">{result.category}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="card-actions">
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleViewDetails(result)}
                  >
                    View Details
                  </button>
                  <button 
                    className="btn btn-danger"
                    onClick={() => handleDeleteLabResult(result.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lab Result Details Modal */}
      {selectedLabResult && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <div className="modal-header">
              <h2>{selectedLabResult.display || selectedLabResult.code}</h2>
              <button 
                className="close-btn"
                onClick={() => setSelectedLabResult(null)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="details-section">
                <h3>Lab Result Details</h3>
                <div className="details-grid">
                  <div className="detail-item">
                    <strong>Code:</strong> {selectedLabResult.code}
                  </div>
                  <div className="detail-item">
                    <strong>Display:</strong> {selectedLabResult.display || 'N/A'}
                  </div>
                  <div className="detail-item">
                    <strong>Value:</strong> {formatValue(selectedLabResult)}
                  </div>
                  <div className="detail-item">
                    <strong>Reference Range:</strong> {selectedLabResult.reference_range || 'N/A'}
                  </div>
                  <div className="detail-item">
                    <strong>Interpretation:</strong> 
                    <span className={`interpretation ${getInterpretationClass(selectedLabResult.interpretation)}`}>
                      {selectedLabResult.interpretation || 'N/A'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <strong>Status:</strong> {selectedLabResult.status}
                  </div>
                  <div className="detail-item">
                    <strong>Test Date:</strong> {formatDate(selectedLabResult.effective_date)}
                  </div>
                  <div className="detail-item">
                    <strong>Issued Date:</strong> {formatDate(selectedLabResult.issued_date)}
                  </div>
                  {selectedLabResult.category && (
                    <div className="detail-item">
                      <strong>Category:</strong> {selectedLabResult.category}
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
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleDownloadFile(file.id, file.file_name)}
                          >
                            Download
                          </button>
                          <button 
                            className="btn btn-sm btn-danger"
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
  );
};

export default LabResults;
