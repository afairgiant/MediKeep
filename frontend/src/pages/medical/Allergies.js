import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { MedicalCard, StatusBadge } from '../../components';
import { formatDate } from '../../utils/helpers';
import '../../styles/shared/MedicalPageShared.css';

const Allergies = () => {
  const [allergies, setAllergies] = useState([]);
  const [patientData, setPatientData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAllergy, setEditingAllergy] = useState(null);
  const [sortBy, setSortBy] = useState('severity');
  const [sortOrder, setSortOrder] = useState('desc');
  const [formData, setFormData] = useState({
    allergen: '',
    severity: '',
    reaction: '',
    onset_date: '',
    status: 'active',
    notes: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchPatientAndAllergies();
  }, []);

  const fetchPatientAndAllergies = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Get patient data first
      const patient = await apiService.getCurrentPatient();
      setPatientData(patient);
      
      // Then get allergies for this patient
      if (patient && patient.id) {
        const allergyData = await apiService.getPatientAllergies(patient.id);
        setAllergies(allergyData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(`Failed to load allergy data: ${error.message}`);
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
      allergen: '',
      severity: '',
      reaction: '',
      onset_date: '',
      status: 'active',
      notes: ''
    });
    setEditingAllergy(null);
    setShowAddForm(false);
  };

  const handleAddAllergy = () => {
    resetForm();
    setShowAddForm(true);
  };

  const handleEditAllergy = (allergy) => {
    setFormData({
      allergen: allergy.allergen || '',
      severity: allergy.severity || '',
      reaction: allergy.reaction || '',
      onset_date: allergy.onset_date || '',
      status: allergy.status || 'active',
      notes: allergy.notes || ''
    });
    setEditingAllergy(allergy);
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

      const allergyData = {
        allergen: formData.allergen,
        severity: formData.severity,
        reaction: formData.reaction,
        onset_date: formData.onset_date || null,
        status: formData.status,
        notes: formData.notes || null,
        patient_id: patientData.id
      };

      if (editingAllergy) {
        await apiService.updateAllergy(editingAllergy.id, allergyData);
        setSuccessMessage('Allergy updated successfully!');
      } else {
        await apiService.createAllergy(allergyData);
        setSuccessMessage('Allergy added successfully!');
      }

      resetForm();
      await fetchPatientAndAllergies();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving allergy:', error);
      setError(error.message || 'Failed to save allergy');
    }
  };

  const handleDeleteAllergy = async (allergyId) => {
    if (!window.confirm('Are you sure you want to delete this allergy record?')) {
      return;
    }

    try {
      setError('');
      await apiService.deleteAllergy(allergyId);
      setSuccessMessage('Allergy deleted successfully!');
      await fetchPatientAndAllergies();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting allergy:', error);
      setError(error.message || 'Failed to delete allergy');
    }
  };

  const getSortedAllergies = () => {
    const sorted = [...allergies].sort((a, b) => {
      if (sortBy === 'severity') {
        const severityOrder = { 'life-threatening': 4, 'severe': 3, 'moderate': 2, 'mild': 1 };
        const aVal = severityOrder[a.severity] || 0;
        const bVal = severityOrder[b.severity] || 0;
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      if (sortBy === 'allergen') {
        return sortOrder === 'asc' 
          ? a.allergen.localeCompare(b.allergen)
          : b.allergen.localeCompare(a.allergen);
      }
      
      if (sortBy === 'onset_date') {
        const aDate = new Date(a.onset_date || 0);
        const bDate = new Date(b.onset_date || 0);
        return sortOrder === 'asc' ? aDate - bDate : bDate - aDate;
      }
      
      return 0;
    });
    
    return sorted;
  };

  const handleSortChange = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'life-threatening': return '🚨';
      case 'severe': return '⚠️';
      case 'moderate': return '⚡';
      case 'mild': return '💛';
      default: return '❓';
    }
  };
  if (loading) {
    return (
      <div className="medical-page-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading allergies...</p>
        </div>
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
        <h1>⚠️ Allergies</h1>
      </header>      <div className="medical-page-content">
        {error && <div className="error-message">{error}</div>}
        {successMessage && <div className="success-message">{successMessage}</div>}

        <div className="medical-page-controls">
          <div className="controls-left">
            <button 
              className="add-button"
              onClick={handleAddAllergy}
            >
              + Add New Allergy
            </button>
          </div>
          
          <div className="controls-right">
            <div className="sort-controls">
              <label>Sort by:</label>
              <select 
                value={sortBy} 
                onChange={(e) => handleSortChange(e.target.value)}
              >
                <option value="severity">Severity</option>
                <option value="allergen">Allergen</option>
                <option value="onset_date">Onset Date</option>
              </select>
              <button 
                className="sort-order-button"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>        {showAddForm && (
          <div className="medical-form-overlay">
            <div className="medical-form-modal">
              <div className="form-header">
                <h3>{editingAllergy ? 'Edit Allergy' : 'Add New Allergy'}</h3>
                <button 
                  className="close-button"
                  onClick={resetForm}
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={handleSubmit}>
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="allergen">Allergen *</label>
                    <input
                      type="text"
                      id="allergen"
                      name="allergen"
                      value={formData.allergen}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g., Penicillin, Peanuts, Latex"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="severity">Severity *</label>
                    <select
                      id="severity"
                      name="severity"
                      value={formData.severity}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">Select Severity</option>
                      <option value="mild">Mild</option>
                      <option value="moderate">Moderate</option>
                      <option value="severe">Severe</option>
                      <option value="life-threatening">Life-threatening</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="reaction">Reaction</label>
                    <input
                      type="text"
                      id="reaction"
                      name="reaction"
                      value={formData.reaction}
                      onChange={handleInputChange}
                      placeholder="e.g., Rash, Anaphylaxis, Swelling"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="onset_date">Onset Date</label>
                    <input
                      type="date"
                      id="onset_date"
                      name="onset_date"
                      value={formData.onset_date}
                      onChange={handleInputChange}
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
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>

                  <div className="form-group full-width">
                    <label htmlFor="notes">Notes</label>
                    <textarea
                      id="notes"
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      rows="3"
                      placeholder="Additional notes about the allergy..."
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button 
                    type="button" 
                    className="cancel-button"
                    onClick={resetForm}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="save-button"
                  >
                    {editingAllergy ? 'Update Allergy' : 'Add Allergy'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}        <div className="medical-records-list">
          {getSortedAllergies().length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">⚠️</div>
              <h3>No allergies found</h3>
              <p>Click "Add New Allergy" to get started.</p>
            </div>
          ) : (
            <div className="records-grid">
              {getSortedAllergies().map((allergy) => (
                <MedicalCard
                  key={allergy.id}
                  title={
                    <div className="allergy-title">
                      <span className="severity-icon">{getSeverityIcon(allergy.severity)}</span>
                      {allergy.allergen}
                    </div>
                  }
                  status={allergy.status}
                  statusType="allergy"
                  dateInfo={{
                    custom: allergy.onset_date ? {
                      label: 'Onset Date',
                      date: allergy.onset_date
                    } : null
                  }}                  actions={
                    <div className="record-actions">
                      <button 
                        className="edit-button"
                        onClick={() => handleEditAllergy(allergy)}
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        className="delete-button"
                        onClick={() => handleDeleteAllergy(allergy.id)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  }
                >
                  <div className="record-details">
                    <div className="detail-item">
                      <span className="label">Severity:</span>
                      <StatusBadge 
                        status={allergy.severity} 
                        type="severity"
                      />
                    </div>
                    
                    {allergy.reaction && (
                      <div className="detail-item">
                        <span className="label">Reaction:</span>
                        <span className="value">{allergy.reaction}</span>
                      </div>
                    )}

                    {allergy.notes && (
                      <div className="detail-item full-width">
                        <span className="label">Notes:</span>
                        <span className="value">{allergy.notes}</span>
                      </div>
                    )}
                  </div>
                </MedicalCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Allergies;
