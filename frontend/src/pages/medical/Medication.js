import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import '../../styles/pages/Medication.css';

const Medication = () => {
  const [medications, setMedications] = useState([]);
  const [patientData, setPatientData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMedication, setEditingMedication] = useState(null);
  const [sortBy, setSortBy] = useState('active');
  const [sortOrder, setSortOrder] = useState('desc');
  const [formData, setFormData] = useState({
    medication_name: '',
    dosage: '',
    frequency: '',
    route: '',
    indication: '',
    effectivePeriod_start: '',
    effectivePeriod_end: '',
    status: 'active',
    practitioner_id: null
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchPatientAndMedications();
  }, []);

  const fetchPatientAndMedications = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Get patient data first
      const patient = await apiService.getCurrentPatient();
      setPatientData(patient);
      
      // Then get medications for this patient
      if (patient && patient.id) {
        const medicationData = await apiService.getPatientMedications(patient.id);
        setMedications(medicationData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load medication data. Please try again.');
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
      medication_name: '',
      dosage: '',
      frequency: '',
      route: '',
      indication: '',
      effectivePeriod_start: '',
      effectivePeriod_end: '',
      status: 'active',
      practitioner_id: null
    });
    setEditingMedication(null);
    setShowAddForm(false);
  };

  const handleAddMedication = () => {
    resetForm();
    setShowAddForm(true);
  };

  const handleEditMedication = (medication) => {
    setFormData({
      medication_name: medication.medication_name || '',
      dosage: medication.dosage || '',
      frequency: medication.frequency || '',
      route: medication.route || '',
      indication: medication.indication || '',
      effectivePeriod_start: medication.effectivePeriod_start || '',
      effectivePeriod_end: medication.effectivePeriod_end || '',
      status: medication.status || 'active',
      practitioner_id: medication.practitioner_id || null
    });
    setEditingMedication(medication);
    setShowAddForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check authentication first
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Authentication required. Please log in again.');
      navigate('/login');
      return;
    }
    
    if (!patientData?.id) {
      setError('Patient information not available');
      return;
    }

    try {
      setError('');
      setSuccessMessage('');

      // Debug auth and patient data
      console.log('🔐 Auth token length:', token.length);
      console.log('🏥 Patient data:', patientData);      const medicationData = {
        ...formData,
        patient_id: patientData.id,
        // Clean up empty strings and null values that might cause validation issues
        effectivePeriod_start: formData.effectivePeriod_start || null,
        effectivePeriod_end: formData.effectivePeriod_end || null,
        practitioner_id: formData.practitioner_id || null,
        // Ensure required fields are not empty
        medication_name: formData.medication_name?.trim(),
        dosage: formData.dosage?.trim(),
        frequency: formData.frequency?.trim(),
        route: formData.route?.trim(),
        indication: formData.indication?.trim(),
        status: formData.status || 'active'
      };

      console.log('🚀 Submitting medication data:', medicationData);
      console.log('🔍 Form data breakdown:', {
        medication_name: formData.medication_name,
        dosage: formData.dosage,
        frequency: formData.frequency,
        route: formData.route,
        indication: formData.indication,
        effectivePeriod_start: formData.effectivePeriod_start,
        effectivePeriod_end: formData.effectivePeriod_end,
        status: formData.status,
        practitioner_id: formData.practitioner_id,
        patient_id: patientData.id
      });

      if (editingMedication) {
        console.log('✏️ Updating medication:', editingMedication.id);
        await apiService.updateMedication(editingMedication.id, medicationData);
        setSuccessMessage('Medication updated successfully!');
      } else {
        console.log('📝 Creating new medication...');
        const result = await apiService.createMedication(medicationData);
        console.log('✅ Create result:', result);
        setSuccessMessage('Medication added successfully!');
      }

      resetForm();
      await fetchPatientAndMedications();
      
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('❌ Error saving medication:', error);
      if (error.message?.includes('Authentication') || error.message?.includes('401') || error.message?.includes('403')) {
        setError('Authentication failed. Please log in again.');
        navigate('/login');
      } else {
        setError(error.response?.data?.detail || error.message || 'Failed to save medication');
      }
    }
  };

  const handleDeleteMedication = async (medicationId) => {
    if (!window.confirm('Are you sure you want to delete this medication?')) {
      return;
    }

    try {
      setError('');
      await apiService.deleteMedication(medicationId);
      setSuccessMessage('Medication deleted successfully!');
      await fetchPatientAndMedications();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting medication:', error);
      setError(error.message || 'Failed to delete medication');
    }
  };

  const getSortedMedications = () => {
    const sorted = [...medications].sort((a, b) => {
      // First sort by active status (active first)
      if (sortBy === 'active') {
        const aIsActive = a.status === 'active';
        const bIsActive = b.status === 'active';
        
        if (aIsActive && !bIsActive) return -1;
        if (!aIsActive && bIsActive) return 1;
        
        // If both have same active status, sort by medication name
        return a.medication_name.localeCompare(b.medication_name);
      }
      
      // Sort by other fields
      if (sortBy === 'name') {
        return sortOrder === 'asc' 
          ? a.medication_name.localeCompare(b.medication_name)
          : b.medication_name.localeCompare(a.medication_name);
      }
      
      if (sortBy === 'start_date') {
        const aDate = new Date(a.effectivePeriod_start || 0);
        const bDate = new Date(b.effectivePeriod_start || 0);
        return sortOrder === 'asc' ? aDate - bDate : bDate - aDate;
      }
      
      return 0;
    });
    
    return sorted;
  };

  const handleSortChange = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');    } else {
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'active': return 'status-active';
      case 'stopped': return 'status-stopped';
      case 'on-hold': return 'status-on-hold';
      case 'completed': return 'status-completed';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-unknown';
    }
  };

  if (loading) {
    return (
      <div className="medication-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading medications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="medication-container">
      <header className="medication-header">
        <button 
          className="back-button"
          onClick={() => navigate('/dashboard')}
        >
          ← Back to Dashboard
        </button>
        <h1>💊 Medications</h1>
      </header>

      <div className="medication-content">
        {error && <div className="error-message">{error}</div>}
        {successMessage && <div className="success-message">{successMessage}</div>}

        <div className="medication-controls">
          <div className="controls-left">
            <button 
              className="add-button"
              onClick={handleAddMedication}
            >
              + Add New Medication
            </button>
          </div>
          
          <div className="controls-right">
            <div className="sort-controls">
              <label>Sort by:</label>
              <select 
                value={sortBy} 
                onChange={(e) => handleSortChange(e.target.value)}
              >
                <option value="active">Status (Active First)</option>
                <option value="name">Medication Name</option>
                <option value="start_date">Start Date</option>
              </select>
              {sortBy !== 'active' && (
                <button 
                  className="sort-order-button"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              )}
            </div>
          </div>
        </div>

        {showAddForm && (
          <div className="medication-form-overlay">
            <div className="medication-form-modal">
              <div className="form-header">
                <h3>{editingMedication ? 'Edit Medication' : 'Add New Medication'}</h3>
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
                    <label htmlFor="medication_name">Medication Name *</label>
                    <input
                      type="text"
                      id="medication_name"
                      name="medication_name"
                      value={formData.medication_name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="dosage">Dosage</label>
                    <input
                      type="text"
                      id="dosage"
                      name="dosage"
                      value={formData.dosage}
                      onChange={handleInputChange}
                      placeholder="e.g., 10mg, 1 tablet"
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
                      placeholder="e.g., Once daily, Twice daily"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="route">Route</label>
                    <select
                      id="route"
                      name="route"
                      value={formData.route}
                      onChange={handleInputChange}
                    >
                      <option value="">Select Route</option>
                      <option value="oral">Oral</option>
                      <option value="injection">Injection</option>
                      <option value="topical">Topical</option>
                      <option value="intravenous">Intravenous</option>
                      <option value="intramuscular">Intramuscular</option>
                      <option value="subcutaneous">Subcutaneous</option>
                      <option value="inhalation">Inhalation</option>
                      <option value="nasal">Nasal</option>
                      <option value="rectal">Rectal</option>
                      <option value="sublingual">Sublingual</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="indication">Indication</label>
                    <input
                      type="text"
                      id="indication"
                      name="indication"
                      value={formData.indication}
                      onChange={handleInputChange}
                      placeholder="What is this medication for?"
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
                      <option value="stopped">Stopped</option>
                      <option value="on-hold">On Hold</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="effectivePeriod_start">Start Date</label>
                    <input
                      type="date"
                      id="effectivePeriod_start"
                      name="effectivePeriod_start"
                      value={formData.effectivePeriod_start}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="effectivePeriod_end">End Date</label>
                    <input
                      type="date"
                      id="effectivePeriod_end"
                      name="effectivePeriod_end"
                      value={formData.effectivePeriod_end}
                      onChange={handleInputChange}
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
                    {editingMedication ? 'Update Medication' : 'Add Medication'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="medications-list">
          {getSortedMedications().length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💊</div>
              <h3>No medications found</h3>
              <p>Click "Add New Medication" to get started.</p>
            </div>
          ) : (
            <div className="medications-grid">
              {getSortedMedications().map((medication) => (
                <div key={medication.id} className="medication-card">
                  <div className="medication-header">
                    <h3 className="medication-name">{medication.medication_name}</h3>
                    <span className={`status-badge ${getStatusBadgeClass(medication.status)}`}>
                      {medication.status || 'Unknown'}
                    </span>
                  </div>
                  
                  <div className="medication-details">
                    {medication.dosage && (
                      <div className="detail-item">
                        <span className="label">Dosage:</span>
                        <span className="value">{medication.dosage}</span>
                      </div>
                    )}
                    
                    {medication.frequency && (
                      <div className="detail-item">
                        <span className="label">Frequency:</span>
                        <span className="value">{medication.frequency}</span>
                      </div>
                    )}
                    
                    {medication.route && (
                      <div className="detail-item">
                        <span className="label">Route:</span>
                        <span className="value">{medication.route}</span>
                      </div>
                    )}
                    
                    {medication.indication && (
                      <div className="detail-item">
                        <span className="label">Indication:</span>
                        <span className="value">{medication.indication}</span>
                      </div>
                    )}
                    
                    <div className="detail-item">
                      <span className="label">Start Date:</span>
                      <span className="value">{formatDate(medication.effectivePeriod_start)}</span>
                    </div>
                    
                    {medication.effectivePeriod_end && (
                      <div className="detail-item">
                        <span className="label">End Date:</span>
                        <span className="value">{formatDate(medication.effectivePeriod_end)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="medication-actions">
                    <button 
                      className="edit-button"
                      onClick={() => handleEditMedication(medication)}
                    >
                      ✏️ Edit
                    </button>
                    <button 
                      className="delete-button"
                      onClick={() => handleDeleteMedication(medication.id)}
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

export default Medication;

