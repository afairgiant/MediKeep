import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import '../../styles/pages/PatientInfo.css';

const PatientInfo = () => {  const [patientData, setPatientData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [patientExists, setPatientExists] = useState(true);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    birthDate: '',
    gender: '',
    address: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchPatientData();
  }, []);
  const fetchPatientData = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiService.getCurrentPatient();
      setPatientData(data);
      setPatientExists(true);
      setFormData({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        birthDate: data.birthDate || '',
        gender: data.gender || '',
        address: data.address || ''
      });
    } catch (error) {
      console.error('Error fetching patient data:', error);
      if (error.message.includes('Patient record not found') || error.message.includes('404')) {
        setPatientExists(false);
        setFormData({
          first_name: '',
          last_name: '',
          birthDate: '',
          gender: '',
          address: ''
        });
      } else {
        setError('Failed to load patient information. Please try again.');
      }
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
  };  const handleEdit = () => {
    setIsEditing(true);
    setError('');
    setSuccessMessage('');
  };

  const handleCancel = () => {
    setIsEditing(false);
    setIsCreating(false);
    if (patientData) {
      setFormData({
        first_name: patientData.first_name || '',
        last_name: patientData.last_name || '',
        birthDate: patientData.birthDate || '',
        gender: patientData.gender || '',
        address: patientData.address || ''
      });
    } else {
      setFormData({
        first_name: '',
        last_name: '',
        birthDate: '',
        gender: '',
        address: ''
      });
    }
    setError('');
    setSuccessMessage('');
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccessMessage('');
      
      let updatedData;
      if (isCreating || !patientExists) {
        updatedData = await apiService.createCurrentPatient(formData);
        setPatientExists(true);
        setIsCreating(false);
        setSuccessMessage('Patient information created successfully!');
      } else {
        updatedData = await apiService.updateCurrentPatient(formData);
        setIsEditing(false);
        setSuccessMessage('Patient information updated successfully!');
      }
      
      setPatientData(updatedData);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving patient data:', error);
      setError(error.message || 'Failed to save patient information. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not provided';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getGenderDisplay = (gender) => {
    switch (gender?.toUpperCase()) {
      case 'M': return 'Male';
      case 'F': return 'Female';
      case 'OTHER': return 'Other';
      default: return 'Not specified';
    }
  };

  if (loading) {
    return (
      <div className="patient-info-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading patient information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="patient-info-container">
      <header className="patient-info-header">
        <button 
          className="back-button"
          onClick={() => navigate('/dashboard')}
        >
          ← Back to Dashboard
        </button>
        <h1>📋 Patient Information</h1>
      </header>

      <div className="patient-info-content">
        {error && <div className="error-message">{error}</div>}
        {successMessage && <div className="success-message">{successMessage}</div>}

        <div className="patient-card">
          <div className="card-header">
            <h2>Personal Information</h2>
            {!isEditing && (
              <button 
                className="edit-button"
                onClick={handleEdit}
              >
                ✏️ Edit
              </button>
            )}
          </div>

          {isEditing ? (
            <form className="patient-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="first_name">First Name *</label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    required
                    disabled={saving}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="last_name">Last Name *</label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    required
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="birthDate">Birth Date *</label>
                  <input
                    type="date"
                    id="birthDate"
                    name="birthDate"
                    value={formData.birthDate}
                    onChange={handleInputChange}
                    required
                    disabled={saving}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="gender">Gender *</label>
                  <select
                    id="gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    required
                    disabled={saving}
                  >
                    <option value="">Select Gender</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="address">Address *</label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  required
                  disabled={saving}
                  rows="3"
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="save-button"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            <div className="patient-details">
              <div className="detail-row">
                <div className="detail-group">
                  <label>First Name:</label>
                  <span>{patientData?.first_name || 'Not provided'}</span>
                </div>
                <div className="detail-group">
                  <label>Last Name:</label>
                  <span>{patientData?.last_name || 'Not provided'}</span>
                </div>
              </div>

              <div className="detail-row">
                <div className="detail-group">
                  <label>Birth Date:</label>
                  <span>{formatDate(patientData?.birthDate)}</span>
                </div>
                <div className="detail-group">
                  <label>Gender:</label>
                  <span>{getGenderDisplay(patientData?.gender)}</span>
                </div>
              </div>

              <div className="detail-group full-width">
                <label>Address:</label>
                <span>{patientData?.address || 'Not provided'}</span>
              </div>

              {patientData?.id && (
                <div className="detail-group">
                  <label>Patient ID:</label>
                  <span>{patientData.id}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientInfo;