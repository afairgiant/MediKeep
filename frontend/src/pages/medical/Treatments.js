import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { MedicalCard, StatusBadge } from '../../components';
import { formatDate } from '../../utils/helpers';
import '../../styles/shared/MedicalPageShared.css';

const Treatments = () => {
  const [treatments, setTreatments] = useState([]);
  const [patientData, setPatientData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState(null);
  const [sortBy, setSortBy] = useState('start_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [formData, setFormData] = useState({
    treatment_name: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'planned',
    dosage: '',
    frequency: '',
    notes: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchPatientAndTreatments();
  }, []);

  const fetchPatientAndTreatments = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Get patient data first
      const patient = await apiService.getCurrentPatient();
      setPatientData(patient);
      
      // Then get treatments for this patient
      if (patient && patient.id) {
        const treatmentData = await apiService.getPatientTreatments(patient.id);
        setTreatments(treatmentData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(`Failed to load treatment data: ${error.message}`);
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

  const resetForm = () => {
    setFormData({
      treatment_name: '',
      description: '',
      start_date: '',
      end_date: '',
      status: 'planned',
      dosage: '',
      frequency: '',
      notes: ''
    });
    setEditingTreatment(null);
    setShowAddForm(false);
  };

  const handleAddTreatment = () => {
    resetForm();
    setShowAddForm(true);
  };

  const handleEditTreatment = (treatment) => {
    setFormData({
      treatment_name: treatment.treatment_name || '',
      description: treatment.description || '',
      start_date: treatment.start_date || '',
      end_date: treatment.end_date || '',
      status: treatment.status || 'planned',
      dosage: treatment.dosage || '',
      frequency: treatment.frequency || '',
      notes: treatment.notes || ''
    });
    setEditingTreatment(treatment);
    setShowAddForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!patientData?.id) {
      setError('Patient information not available');
      return;
    }

    try {
      setError('');
      setSuccessMessage('');

      const treatmentData = {
        treatment_name: formData.treatment_name,
        description: formData.description,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        status: formData.status,
        dosage: formData.dosage || null,
        frequency: formData.frequency || null,
        notes: formData.notes || null,
        patient_id: patientData.id
      };

      if (editingTreatment) {
        await apiService.updateTreatment(editingTreatment.id, treatmentData);
        setSuccessMessage('Treatment updated successfully!');
      } else {
        await apiService.createTreatment(treatmentData);
        setSuccessMessage('Treatment added successfully!');
      }

      resetForm();
      await fetchPatientAndTreatments();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving treatment:', error);
      setError(error.message || 'Failed to save treatment');
    }
  };

  const handleDeleteTreatment = async (treatmentId) => {
    if (!window.confirm('Are you sure you want to delete this treatment record?')) {
      return;
    }

    try {
      setError('');
      await apiService.deleteTreatment(treatmentId);
      setSuccessMessage('Treatment deleted successfully!');
      await fetchPatientAndTreatments();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting treatment:', error);
      setError(error.message || 'Failed to delete treatment');
    }
  };

  const getSortedTreatments = () => {
    const sorted = [...treatments].sort((a, b) => {
      if (sortBy === 'start_date') {
        const aDate = new Date(a.start_date || 0);
        const bDate = new Date(b.start_date || 0);
        return sortOrder === 'asc' ? aDate - bDate : bDate - aDate;
      }
      
      if (sortBy === 'treatment_name') {
        return sortOrder === 'asc' 
          ? a.treatment_name.localeCompare(b.treatment_name)
          : b.treatment_name.localeCompare(a.treatment_name);
      }
      
      if (sortBy === 'status') {
        return sortOrder === 'asc' 
          ? a.status.localeCompare(b.status)
          : b.status.localeCompare(a.status);
      }
      
      return 0;
    });
    
    return sorted;
  };

  const handleSortChange = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {    setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return '🔄';
      case 'completed': return '✅';
      case 'planned': return '📋';
      case 'on-hold': return '⏸️';
      case 'cancelled': return '❌';
      default: return '❓';
    }
  };
  if (loading) {
    return (
      <div className="medical-page-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="medical-page-container">
      <div className="medical-page-header">
        <h1 className="medical-page-title">🩹 Treatments</h1>
        <div className="header-actions">
          <button 
            className="primary-btn add-btn"
            onClick={handleAddTreatment}
          >
            + Add New Treatment
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}      {treatments.length > 0 && (
        <div className="filters-container">
          <div className="filter-group">
            <label>Sort by:</label>
            <select 
              value={sortBy} 
              onChange={(e) => handleSortChange(e.target.value)}
            >
              <option value="start_date">Start Date</option>
              <option value="treatment_name">Treatment Name</option>
              <option value="status">Status</option>
            </select>
            <button 
              className="secondary-btn"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      )}      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingTreatment ? 'Edit Treatment' : 'Add New Treatment'}
              </h2>
              <button className="close-btn" onClick={resetForm}>
                ×
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="treatment_name">Treatment Name *</label>
                  <input
                    type="text"
                    id="treatment_name"
                    name="treatment_name"
                    value={formData.treatment_name}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., Physical Therapy, Chemotherapy"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                  >
                    <option value="planned">Planned</option>
                    <option value="active">Active</option>
                    <option value="on-hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="start_date">Start Date</label>
                  <input
                    type="date"
                    id="start_date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="end_date">End Date</label>
                  <input
                    type="date"
                    id="end_date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="dosage">Dosage</label>
                  <input
                    type="text"
                    id="dosage"
                    name="dosage"
                    value={formData.dosage}
                    onChange={handleInputChange}
                    placeholder="e.g., 500mg, 2 tablets"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="frequency">Frequency</label>
                  <input
                    type="text"
                    id="frequency"
                    name="frequency"
                    value={formData.frequency}
                    onChange={handleInputChange}
                    placeholder="e.g., Daily, 3 times per week"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Description of the treatment..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Additional notes about the treatment..."
                />
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="secondary-btn"
                  onClick={resetForm}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="primary-btn"
                >
                  {editingTreatment ? 'Update Treatment' : 'Add Treatment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {getSortedTreatments().length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🩹</div>
          <h3>No treatments found</h3>
          <p>Click "Add New Treatment" to get started.</p>
        </div>
      ) : (
        <div className="medical-grid">
          {getSortedTreatments().map((treatment) => (
            <MedicalCard
              key={treatment.id}
              className="medical-card"
              onEdit={() => handleEditTreatment(treatment)}
              onDelete={() => handleDeleteTreatment(treatment.id)}
            >
              <div className="card-header">
                <div>
                  <h3 className="card-title">
                    <span className="status-icon">{getStatusIcon(treatment.status)}</span>
                    {treatment.treatment_name}
                  </h3>
                  {treatment.description && (
                    <p className="card-description">{treatment.description}</p>
                  )}
                </div>
                <StatusBadge status={treatment.status} color="info" />
              </div>

              <div className="card-details">
                {treatment.start_date && (
                  <div className="detail-item">
                    <span className="detail-label">Start Date</span>
                    <span className="detail-value">{formatDate(treatment.start_date)}</span>
                  </div>
                )}
                
                {treatment.dosage && (
                  <div className="detail-item">
                    <span className="detail-label">Dosage</span>
                    <span className="detail-value">{treatment.dosage}</span>
                  </div>
                )}

                {treatment.frequency && (
                  <div className="detail-item">
                    <span className="detail-label">Frequency</span>
                    <span className="detail-value">{treatment.frequency}</span>
                  </div>
                )}

                {treatment.end_date && (
                  <div className="detail-item">
                    <span className="detail-label">End Date</span>
                    <span className="detail-value">{formatDate(treatment.end_date)}</span>
                  </div>
                )}
              </div>              {treatment.notes && (
                <div className="card-notes">
                  <div className="notes-label">Notes</div>
                  <div className="notes-content">{treatment.notes}</div>
                </div>
              )}
            </MedicalCard>
          ))}
        </div>
      )}
    </div>
  );
};

export default Treatments;
