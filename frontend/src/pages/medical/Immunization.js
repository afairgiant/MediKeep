import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import '../../styles/pages/Immunization.css';

const Immunization = () => {
  const [immunizations, setImmunizations] = useState([]);
  const [patientData, setPatientData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingImmunization, setEditingImmunization] = useState(null);  const [sortBy, setSortBy] = useState('date_administered');
  const [sortOrder, setSortOrder] = useState('desc');
  const [formData, setFormData] = useState({
    vaccine_name: '',
    date_administered: '',
    dose_number: '',
    lot_number: '',
    manufacturer: '',
    site: '',
    route: '',
    expiration_date: '',
    notes: '',
    practitioner_id: null
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchPatientAndImmunizations();
  }, []);
  const fetchPatientAndImmunizations = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('Fetching patient data...');
      // Get patient data first
      const patient = await apiService.getCurrentPatient();
      console.log('Patient data received:', patient);
      setPatientData(patient);
      
      // Then get immunizations for this patient
      if (patient && patient.id) {
        console.log('Fetching immunizations for patient:', patient.id);
        const immunizationData = await apiService.getPatientImmunizations(patient.id);
        console.log('Immunization data received:', immunizationData);
        setImmunizations(immunizationData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      console.error('Error details:', error.message);
      setError(`Failed to load immunization data: ${error.message}`);
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
  };  const resetForm = () => {
    setFormData({
      vaccine_name: '',
      date_administered: '',
      dose_number: '',
      lot_number: '',
      manufacturer: '',
      site: '',
      route: '',
      expiration_date: '',
      notes: '',
      practitioner_id: null
    });
    setEditingImmunization(null);
    setShowAddForm(false);
  };

  const handleAddImmunization = () => {
    resetForm();
    setShowAddForm(true);
  };  const handleEditImmunization = (immunization) => {
    setFormData({
      vaccine_name: immunization.vaccine_name || '',
      date_administered: immunization.date_administered || '',
      dose_number: immunization.dose_number || '',
      lot_number: immunization.lot_number || '',
      manufacturer: immunization.manufacturer || '',
      site: immunization.site || '',
      route: immunization.route || '',
      expiration_date: immunization.expiration_date || '',
      notes: immunization.notes || '',
      practitioner_id: immunization.practitioner_id || null
    });
    setEditingImmunization(immunization);
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
      setSuccessMessage('');      const immunizationData = {
        vaccine_name: formData.vaccine_name,
        date_administered: formData.date_administered,
        patient_id: patientData.id,
        dose_number: formData.dose_number ? parseInt(formData.dose_number) : null,
        lot_number: formData.lot_number || null,
        manufacturer: formData.manufacturer || null,
        site: formData.site || null,
        route: formData.route || null,
        expiration_date: formData.expiration_date || null,
        notes: formData.notes || null,
        practitioner_id: formData.practitioner_id ? parseInt(formData.practitioner_id) : null
      };

      if (editingImmunization) {
        await apiService.updateImmunization(editingImmunization.id, immunizationData);
        setSuccessMessage('Immunization updated successfully!');
      } else {
        await apiService.createImmunization(immunizationData);
        setSuccessMessage('Immunization added successfully!');
      }

      resetForm();
      await fetchPatientAndImmunizations();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving immunization:', error);
      setError(error.message || 'Failed to save immunization');
    }
  };

  const handleDeleteImmunization = async (immunizationId) => {
    if (!window.confirm('Are you sure you want to delete this immunization record?')) {
      return;
    }

    try {
      setError('');
      await apiService.deleteImmunization(immunizationId);
      setSuccessMessage('Immunization deleted successfully!');
      await fetchPatientAndImmunizations();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting immunization:', error);
      setError(error.message || 'Failed to delete immunization');
    }
  };  const getSortedImmunizations = () => {
    const sorted = [...immunizations].sort((a, b) => {
      if (sortBy === 'date_administered') {
        const aDate = new Date(a.date_administered || 0);
        const bDate = new Date(b.date_administered || 0);
        return sortOrder === 'asc' ? aDate - bDate : bDate - aDate;
      }
      
      if (sortBy === 'vaccine_name') {
        return sortOrder === 'asc' 
          ? a.vaccine_name.localeCompare(b.vaccine_name)
          : b.vaccine_name.localeCompare(a.vaccine_name);
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
      setSortOrder('asc');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="immunization-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading immunizations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="immunization-container">
      <header className="immunization-header">
        <button 
          className="back-button"
          onClick={() => navigate('/dashboard')}
        >
          ← Back to Dashboard
        </button>
        <h1>💉 Immunizations</h1>
      </header>

      <div className="immunization-content">
        {error && <div className="error-message">{error}</div>}
        {successMessage && <div className="success-message">{successMessage}</div>}

        <div className="immunization-controls">
          <div className="controls-left">
            <button 
              className="add-button"
              onClick={handleAddImmunization}
            >
              + Add New Immunization
            </button>
          </div>
          
          <div className="controls-right">
            <div className="sort-controls">
              <label>Sort by:</label>              <select 
                value={sortBy} 
                onChange={(e) => handleSortChange(e.target.value)}
              >
                <option value="date_administered">Date Administered</option>
                <option value="vaccine_name">Vaccine Name</option>
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
          <div className="immunization-form-overlay">
            <div className="immunization-form-modal">
              <div className="form-header">
                <h3>{editingImmunization ? 'Edit Immunization' : 'Add New Immunization'}</h3>
                <button 
                  className="close-button"
                  onClick={resetForm}
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={handleSubmit}>                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="vaccine_name">Vaccine Name *</label>
                    <input
                      type="text"
                      id="vaccine_name"
                      name="vaccine_name"
                      value={formData.vaccine_name}
                      onChange={handleInputChange}
                      required
                      placeholder="e.g., COVID-19, Influenza, MMR"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="date_administered">Date Administered *</label>
                    <input
                      type="date"
                      id="date_administered"
                      name="date_administered"
                      value={formData.date_administered}
                      onChange={handleInputChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="dose_number">Dose Number</label>
                    <input
                      type="number"
                      id="dose_number"
                      name="dose_number"
                      value={formData.dose_number}
                      onChange={handleInputChange}
                      min="1"
                      placeholder="e.g., 1, 2, 3"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="lot_number">Lot Number</label>
                    <input
                      type="text"
                      id="lot_number"
                      name="lot_number"
                      value={formData.lot_number}
                      onChange={handleInputChange}
                      placeholder="Vaccine lot number"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="manufacturer">Manufacturer</label>
                    <input
                      type="text"
                      id="manufacturer"
                      name="manufacturer"
                      value={formData.manufacturer}
                      onChange={handleInputChange}
                      placeholder="e.g., Pfizer, Moderna, Johnson & Johnson"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="site">Injection Site</label>
                    <select
                      id="site"
                      name="site"
                      value={formData.site}
                      onChange={handleInputChange}
                    >
                      <option value="">Select Site</option>
                      <option value="left_arm">Left Arm</option>
                      <option value="right_arm">Right Arm</option>
                      <option value="left_thigh">Left Thigh</option>
                      <option value="right_thigh">Right Thigh</option>
                      <option value="left_deltoid">Left Deltoid</option>
                      <option value="right_deltoid">Right Deltoid</option>
                    </select>
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
                      <option value="intramuscular">Intramuscular</option>
                      <option value="subcutaneous">Subcutaneous</option>
                      <option value="intradermal">Intradermal</option>
                      <option value="oral">Oral</option>
                      <option value="nasal">Nasal</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="expiration_date">Expiration Date</label>
                    <input
                      type="date"
                      id="expiration_date"
                      name="expiration_date"
                      value={formData.expiration_date}
                      onChange={handleInputChange}
                    />
                  </div>

                  <div className="form-group full-width">
                    <label htmlFor="notes">Notes</label>
                    <textarea
                      id="notes"
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      rows="3"
                      placeholder="Any additional notes or reactions"
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
                    {editingImmunization ? 'Update Immunization' : 'Add Immunization'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="immunizations-list">
          {getSortedImmunizations().length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💉</div>
              <h3>No immunizations found</h3>
              <p>Click "Add New Immunization" to get started.</p>
            </div>
          ) : (
            <div className="immunizations-grid">              {getSortedImmunizations().map((immunization) => (
                <div key={immunization.id} className="immunization-card">
                  <div className="immunization-header">
                    <h3 className="vaccine-name">{immunization.vaccine_name}</h3>
                    {immunization.dose_number && (
                      <span className="dose-badge">
                        Dose {immunization.dose_number}
                      </span>
                    )}
                  </div>
                  
                  <div className="immunization-details">
                    <div className="detail-item">
                      <span className="label">Date Administered:</span>
                      <span className="value">{formatDate(immunization.date_administered)}</span>
                    </div>
                    
                    {immunization.manufacturer && (
                      <div className="detail-item">
                        <span className="label">Manufacturer:</span>
                        <span className="value">{immunization.manufacturer}</span>
                      </div>
                    )}
                    
                    {immunization.site && (
                      <div className="detail-item">
                        <span className="label">Site:</span>
                        <span className="value">{immunization.site.replace('_', ' ')}</span>
                      </div>
                    )}
                    
                    {immunization.route && (
                      <div className="detail-item">
                        <span className="label">Route:</span>
                        <span className="value">{immunization.route}</span>
                      </div>
                    )}
                    
                    {immunization.lot_number && (
                      <div className="detail-item">
                        <span className="label">Lot Number:</span>
                        <span className="value">{immunization.lot_number}</span>
                      </div>
                    )}
                    
                    {immunization.expiration_date && (
                      <div className="detail-item">
                        <span className="label">Expiration Date:</span>
                        <span className="value">{formatDate(immunization.expiration_date)}</span>
                      </div>
                    )}

                    {immunization.notes && (
                      <div className="detail-item full-width">
                        <span className="label">Notes:</span>
                        <span className="value">{immunization.notes}</span>
                      </div>
                    )}

                    {immunization.practitioner_id && (
                      <div className="detail-item">
                        <span className="label">Practitioner ID:</span>
                        <span className="value">{immunization.practitioner_id}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="immunization-actions">
                    <button 
                      className="edit-button"
                      onClick={() => handleEditImmunization(immunization)}
                    >
                      ✏️ Edit
                    </button>
                    <button 
                      className="delete-button"
                      onClick={() => handleDeleteImmunization(immunization.id)}
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

export default Immunization;
