import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { DATE_FORMATS } from '../../utils/constants';
import { useCurrentPatient, usePractitioners } from '../../hooks/useGlobalData';
import { PageHeader } from '../../components';
import '../../styles/pages/PatientInfo.css';

const PatientInfo = () => {
  // Using global state for patient and practitioners data
  const {
    patient: patientData,
    loading: patientLoading,
    error: patientError,
    refresh: refreshPatient,
  } = useCurrentPatient();
  const { practitioners, loading: practitionersLoading } = usePractitioners();

  // Combine loading states
  const loading = patientLoading || practitionersLoading;

  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [patientExists, setPatientExists] = useState(true);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    birthDate: '',
    gender: '',
    address: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();
  // Initialize form data when patient data becomes available or changes
  useEffect(() => {
    if (patientData) {
      setPatientExists(true);
      setFormData({
        first_name: patientData.first_name || '',
        last_name: patientData.last_name || '',
        birthDate: patientData.birthDate || '',
        gender: patientData.gender || '',
        address: patientData.address || '',
        bloodType: patientData.bloodType || '',
        height: patientData.height || '',
        weight: patientData.weight || '',
        physician_id: patientData.physician_id || '',
      });
    } else if (
      patientError &&
      patientError.includes('Patient record not found')
    ) {
      setPatientExists(false);
      setFormData({
        first_name: '',
        last_name: '',
        birthDate: '',
        gender: '',
        address: '',
        bloodType: '',
        height: '',
        weight: '',
        physician_id: '',
      });
    }
  }, [patientData, patientError]);

  // Handle global error state
  useEffect(() => {
    if (patientError && !patientError.includes('Patient record not found')) {
      setError('Failed to load patient information. Please try again.');
    } else {
      setError('');
    }
  }, [patientError]);

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };
  const handleEdit = () => {
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
        address: patientData.address || '',
        bloodType: patientData.bloodType || '',
        height: patientData.height || '',
        weight: patientData.weight || '',
        physician_id: patientData.physician_id || '',
      });
    } else {
      setFormData({
        first_name: '',
        last_name: '',
        birthDate: '',
        gender: '',
        address: '',
        bloodType: '',
        height: '',
        weight: '',
        physician_id: '',
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
        // Use the correct API method for updating current patient
        updatedData = await apiService.updateCurrentPatient(formData);
        setIsEditing(false);
        setSuccessMessage('Patient information updated successfully!');
      }

      // Refresh global patient data to reflect changes across the app
      await refreshPatient();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving patient data:', error);
      setError(
        error.message || 'Failed to save patient information. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const getGenderDisplay = gender => {
    switch (gender?.toUpperCase()) {
      case 'M':
        return 'Male';
      case 'F':
        return 'Female';
      case 'OTHER':
        return 'Other';
      default:
        return 'Not specified';
    }
  };
  const getPractitionerDisplay = physicianId => {
    if (!physicianId) return 'Not assigned';

    const practitioner = practitioners.find(
      p => p.id === parseInt(physicianId)
    );
    if (practitioner) {
      return `${practitioner.name} (${practitioner.specialty})`;
    }
    return `ID: ${physicianId}`;
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
      <PageHeader title="Patient Information" icon="📋" />

      <div className="patient-info-content">
        {error && <div className="error-message">{error}</div>}
        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}

        <div className="patient-card">
          <div className="card-header">
            <h2>Personal Information</h2>
            {!isEditing && (
              <button className="edit-button" onClick={handleEdit}>
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
                </div>{' '}
                <div className="form-group">
                  <label htmlFor="gender">Gender</label>
                  <select
                    id="gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    disabled={saving}
                  >
                    <option value="">Select Gender</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>{' '}
              <div className="form-group">
                <label htmlFor="address">Address</label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  disabled={saving}
                  rows="3"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="bloodType">Blood Type</label>
                  <select
                    id="bloodType"
                    name="bloodType"
                    value={formData.bloodType}
                    onChange={handleInputChange}
                    disabled={saving}
                  >
                    <option value="">Select Blood Type</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="height">Height (inches)</label>
                  <input
                    type="number"
                    id="height"
                    name="height"
                    value={formData.height}
                    onChange={handleInputChange}
                    disabled={saving}
                    min="12"
                    max="120"
                    placeholder="e.g., 70"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="weight">Weight (lbs)</label>
                  <input
                    type="number"
                    id="weight"
                    name="weight"
                    value={formData.weight}
                    onChange={handleInputChange}
                    disabled={saving}
                    min="1"
                    max="1000"
                    placeholder="e.g., 150"
                  />{' '}
                </div>
                <div className="form-group">
                  <label htmlFor="physician_id">Primary Care Physician</label>
                  <select
                    id="physician_id"
                    name="physician_id"
                    value={formData.physician_id}
                    onChange={handleInputChange}
                    disabled={saving}
                  >
                    <option value="">Select Physician (Optional)</option>
                    {console.log(
                      'Rendering practitioners dropdown, practitioners:',
                      practitioners
                    )}
                    {practitioners.map(practitioner => (
                      <option key={practitioner.id} value={practitioner.id}>
                        {practitioner.name} - {practitioner.specialty}
                      </option>
                    ))}
                  </select>
                </div>
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
                {' '}
                <div className="detail-group">
                  <label>Birth Date:</label>
                  <span>
                    {formatDate(
                      patientData?.birthDate,
                      DATE_FORMATS.DISPLAY_LONG
                    )}
                  </span>
                </div>
                <div className="detail-group">
                  <label>Gender:</label>
                  <span>{getGenderDisplay(patientData?.gender)}</span>
                </div>
              </div>{' '}
              <div className="detail-group full-width">
                <label>Address:</label>
                <span>{patientData?.address || 'Not provided'}</span>
              </div>
              <div className="detail-row">
                <div className="detail-group">
                  <label>Blood Type:</label>
                  <span>{patientData?.bloodType || 'Not provided'}</span>
                </div>
                <div className="detail-group">
                  <label>Height:</label>
                  <span>
                    {patientData?.height
                      ? `${patientData.height} inches`
                      : 'Not provided'}
                  </span>
                </div>
              </div>
              <div className="detail-row">
                {' '}
                <div className="detail-group">
                  <label>Weight:</label>
                  <span>
                    {patientData?.weight
                      ? `${patientData.weight} lbs`
                      : 'Not provided'}
                  </span>
                </div>{' '}
                <div className="detail-group">
                  <label>Primary Care Physician:</label>
                  <span>
                    {getPractitionerDisplay(patientData?.physician_id)}
                  </span>
                </div>
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
