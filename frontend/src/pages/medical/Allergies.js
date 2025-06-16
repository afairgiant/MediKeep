import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMedicalData } from '../../hooks/useMedicalData';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import '../../styles/shared/MedicalPageShared.css';

const Allergies = () => {
  const navigate = useNavigate();
  
  // Standardized data management
  const {
    items: allergies,
    currentPatient,
    loading,
    error,
    successMessage,
    createItem,
    updateItem,
    deleteItem,
    refreshData,
    clearError,
    setSuccessMessage,
    setError  } = useMedicalData({
    entityName: 'allergy',
    apiMethodsConfig: {
      getAll: (signal) => apiService.getAllergies(signal),
      getByPatient: (patientId, signal) => apiService.getPatientAllergies(patientId, signal),
      create: (data, signal) => apiService.createAllergy(data, signal),
      update: (id, data, signal) => apiService.updateAllergy(id, data, signal),
      delete: (id, signal) => apiService.deleteAllergy(id, signal)
    },
    requiresPatient: true
  });

  // Form state
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
    
    if (!currentPatient?.id) {
      setError('Patient information not available');
      return;
    }

    const allergyData = {
      ...formData,
      onset_date: formData.onset_date || null,
      notes: formData.notes || null,
      patient_id: currentPatient.id
    };

    let success;
    if (editingAllergy) {
      success = await updateItem(editingAllergy.id, allergyData);
    } else {
      success = await createItem(allergyData);
    }

    if (success) {
      resetForm();
      await refreshData();
    }
  };

  const handleDeleteAllergy = async (allergyId) => {
    const success = await deleteItem(allergyId);
    if (success) {
      await refreshData();
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
    }
  };

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
      </header>

      <div className="medical-page-content">
        {error && (
          <div className="error-message">
            {error}
            <button onClick={clearError} className="error-close">×</button>
          </div>
        )}
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
        </div>

        {showAddForm && (
          <div className="medical-form-overlay" onClick={() => setShowAddForm(false)}>
            <div className="medical-form-modal" onClick={(e) => e.stopPropagation()}>
              <div className="form-header">
                <h3>{editingAllergy ? 'Edit Allergy' : 'Add New Allergy'}</h3>
                <button 
                  className="close-button"
                  onClick={resetForm}
                >
                  ×
                </button>
              </div>
              
              <div className="medical-form-content">
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
          </div>
        )}

        <div className="medical-items-list">
          {getSortedAllergies().length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">⚠️</div>
              <h3>No allergies found</h3>
              <p>Click "Add New Allergy" to get started.</p>
            </div>
          ) : (
            <div className="medical-items-grid">
              {getSortedAllergies().map((allergy) => (
                <div key={allergy.id} className="medical-item-card">
                  <div className="medical-item-header">
                    <h3 className="item-title">
                      <span className="severity-icon">{getSeverityIcon(allergy.severity)}</span>
                      {allergy.allergen}
                    </h3>
                    <span className={`status-badge status-${allergy.status}`}>
                      {allergy.status}
                    </span>
                  </div>

                  <div className="medical-item-details">
                    <div className="detail-item">
                      <span className="label">Severity:</span>
                      <span className={`value status-badge status-${allergy.severity}`}>
                        {getSeverityIcon(allergy.severity)} {allergy.severity}
                      </span>
                    </div>
                    
                    {allergy.reaction && (
                      <div className="detail-item">
                        <span className="label">Reaction:</span>
                        <span className="value">{allergy.reaction}</span>
                      </div>
                    )}

                    {allergy.onset_date && (
                      <div className="detail-item">
                        <span className="label">Onset Date:</span>
                        <span className="value">{formatDate(allergy.onset_date)}</span>
                      </div>
                    )}
                  </div>

                  {allergy.notes && (
                    <div className="medical-item-notes">
                      <div className="notes-label">Notes</div>
                      <div className="notes-content">{allergy.notes}</div>
                    </div>
                  )}

                  <div className="medical-item-actions">
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Allergies;