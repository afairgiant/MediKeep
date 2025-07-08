import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { DATE_FORMATS } from '../../utils/constants';
import { useCurrentPatient, usePractitioners } from '../../hooks/useGlobalData';
import { PageHeader } from '../../components';
import { Button } from '../../components/ui';
import MantinePatientForm from '../../components/medical/MantinePatientForm';
import frontendLogger from '../../services/frontendLogger';
import '../../styles/shared/MedicalPageShared.css';
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
    birth_date: '',
    gender: '',
    address: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Initialize form data when patient data becomes available or changes
  useEffect(() => {
    if (patientData) {
      setPatientExists(true);
      setFormData({
        first_name: patientData.first_name || '',
        last_name: patientData.last_name || '',
        birth_date: patientData.birth_date || '',
        gender: patientData.gender || '',
        address: patientData.address || '',
        blood_type: patientData.blood_type || '',
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
        birth_date: '',
        gender: '',
        address: '',
        blood_type: '',
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
        birth_date: patientData.birth_date || '',
        gender: patientData.gender || '',
        address: patientData.address || '',
        blood_type: patientData.blood_type || '',
        height: patientData.height || '',
        weight: patientData.weight || '',
        physician_id: patientData.physician_id || '',
      });
    } else {
      setFormData({
        first_name: '',
        last_name: '',
        birth_date: '',
        gender: '',
        address: '',
        blood_type: '',
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
        setIsNewUser(false); // No longer a new user
        setSuccessMessage('Patient information created successfully!');
      } else {
        // Use the correct API method for updating current patient
        updatedData = await apiService.updateCurrentPatient(apiData);
        setIsEditing(false);
        setIsNewUser(false); // No longer a new user
        setSuccessMessage('Patient information updated successfully!');
      }

      // Refresh global patient data to reflect changes across the app
      await refreshPatient();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      frontendLogger.logError('Error saving patient data', {
        error: error.message,
        component: 'Patient-Info',
      });
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
      <div className="medical-page-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading patient information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="medical-page-container">
      <PageHeader title="Patient Information" icon="📋" />

      <div className="medical-page-content">
        {isNewUser && (
          <div
            className="welcome-message"
            style={{
              background: '#e8f4fd',
              border: '1px solid #2196f3',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px',
              color: '#1976d2',
            }}
          >
            <h3 style={{ margin: '0 0 8px 0', color: '#1976d2' }}>
              Welcome to Your Medical Records!
            </h3>
            <p style={{ margin: '0', lineHeight: '1.4' }}>
              Your account has been created successfully. Please complete your
              patient profile below to get started with managing your medical
              records.
            </p>
          </div>
        )}
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
            <MantinePatientForm
              formData={formData}
              onInputChange={handleInputChange}
              onSave={handleSave}
              onCancel={handleCancel}
              practitioners={practitioners}
              saving={saving}
              isCreating={isCreating}
            />
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
                      patientData?.birth_date,
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
                  <span>{patientData?.blood_type || 'Not provided'}</span>
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
