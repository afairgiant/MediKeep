import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { DATE_FORMATS } from '../../utils/constants';
import { useCurrentPatient, usePractitioners } from '../../hooks/useGlobalData';
import { PageHeader } from '../../components';
import { FormInput, FormSelect } from '../../components/forms';
import { Button, DateInput } from '../../components/ui';
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
    let processedValue = value;

    // Handle physician_id - convert empty string to null or empty for Mantine
    if (name === 'physician_id') {
      if (value === '') {
        processedValue = '';
      } else {
        processedValue = value; // Keep as string for Mantine compatibility
      }
    }

    setFormData(prev => ({
      ...prev,
      [name]: processedValue,
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
      // Prepare data for API - convert physician_id to number if present
      const apiData = {
        ...formData,
        physician_id: formData.physician_id
          ? parseInt(formData.physician_id)
          : null,
      };

      if (isCreating || !patientExists) {
        updatedData = await apiService.createCurrentPatient(apiData);
        setPatientExists(true);
        setIsCreating(false);
        setSuccessMessage('Patient information created successfully!');
      } else {
        // Use the correct API method for updating current patient
        updatedData = await apiService.updateCurrentPatient(apiData);
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
              <Button variant="primary" onClick={handleEdit}>
                ✏️ Edit
              </Button>
            )}
          </div>

          {isEditing ? (
            <form className="patient-form">
              <div className="form-row">
                <FormInput
                  label="First Name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  required={true}
                  disabled={saving}
                  placeholder="Enter first name"
                />
                <FormInput
                  label="Last Name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  required={true}
                  disabled={saving}
                  placeholder="Enter last name"
                />
              </div>
              <div className="form-row">
                <DateInput
                  label="Birth Date"
                  name="birthDate"
                  value={formData.birthDate}
                  onChange={handleInputChange}
                  firstDayOfWeek={0}
                  required={true}
                  disabled={saving}
                  placeholder="Select birth date"
                />
                <FormSelect
                  useMantine={true}
                  label="Gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  disabled={saving}
                  placeholder="Select Gender"
                  options={[
                    { value: 'M', label: 'Male' },
                    { value: 'F', label: 'Female' },
                    { value: 'OTHER', label: 'Other' },
                  ]}
                />
              </div>
              <FormInput
                label="Address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                disabled={saving}
                placeholder="Enter your address"
                helpText="Optional: Full address for medical records"
              />
              <div className="form-row">
                <FormSelect
                  useMantine={true}
                  label="Blood Type"
                  name="bloodType"
                  value={formData.bloodType}
                  onChange={handleInputChange}
                  disabled={saving}
                  placeholder="Select Blood Type"
                  options={[
                    { value: 'A+', label: 'A+' },
                    { value: 'A-', label: 'A-' },
                    { value: 'B+', label: 'B+' },
                    { value: 'B-', label: 'B-' },
                    { value: 'AB+', label: 'AB+' },
                    { value: 'AB-', label: 'AB-' },
                    { value: 'O+', label: 'O+' },
                    { value: 'O-', label: 'O-' },
                  ]}
                  helpText="Important for medical emergencies"
                />
                <FormInput
                  label="Height"
                  name="height"
                  type="number"
                  value={formData.height}
                  onChange={handleInputChange}
                  disabled={saving}
                  placeholder="e.g., 70"
                  helpText="Height in inches"
                />
              </div>
              <div className="form-row">
                <FormInput
                  label="Weight"
                  name="weight"
                  type="number"
                  value={formData.weight}
                  onChange={handleInputChange}
                  disabled={saving}
                  placeholder="e.g., 150"
                  helpText="Weight in pounds"
                />
                <FormSelect
                  useMantine={true}
                  label="Primary Care Physician"
                  name="physician_id"
                  value={
                    formData.physician_id ? String(formData.physician_id) : ''
                  }
                  onChange={handleInputChange}
                  disabled={saving}
                  placeholder="Select Physician (Optional)"
                  options={practitioners.map(practitioner => ({
                    value: String(practitioner.id),
                    label: `${practitioner.name} - ${practitioner.specialty}`,
                  }))}
                  helpText="Your primary doctor for ongoing care"
                />
              </div>
              <div className="form-actions">
                <Button
                  variant="secondary"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  disabled={saving}
                  loading={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
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
