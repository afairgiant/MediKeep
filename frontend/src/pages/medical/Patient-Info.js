// React and routing
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// API and utilities
import patientApi from '../../services/api/patientApi';
import { formatDate } from '../../utils/helpers';
import { DATE_FORMATS } from '../../utils/constants';
import { formatMeasurement, convertForDisplay } from '../../utils/unitConversion';
import { getUserFriendlyError } from '../../constants/errorMessages';
import logger from '../../services/logger';

// Hooks and contexts
import { useCurrentPatient, usePractitioners, useCacheManager } from '../../hooks/useGlobalData';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { useFormSubmissionWithUploads } from '../../hooks/useFormSubmissionWithUploads';

// Components
import { PageHeader } from '../../components';
import PatientFormWrapper from '../../components/medical/patient-info/PatientFormWrapper';

// Mantine UI
import {
  Button,
  Group,
  Stack,
  Text,
  Container,
  Alert,
  Card,
} from '@mantine/core';

// Styles
import '../../styles/shared/MedicalPageShared.css';
import '../../styles/pages/PatientInfo.css';

const PatientInfo = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const needsRefreshAfterSubmissionRef = useRef(false);
  const processedEditParamRef = useRef(false);

  // Using global state for patient and practitioners data
  const {
    patient: patientData,
    loading: patientLoading,
    error: patientError,
    refresh: refreshPatient,
  } = useCurrentPatient();
  const { practitioners, loading: practitionersLoading } = usePractitioners();
  const { invalidatePatientList, invalidatePatient } = useCacheManager();
  const { unitSystem } = useUserPreferences();

  // Combine loading states
  const loading = patientLoading || practitionersLoading;

  // State management
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [patientExists, setPatientExists] = useState(true);
  const [formData, setFormData] = useState({
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
  const [error, setError] = useState('');

  // Form submission hook
  const {
    isBlocking,
    canSubmit,
    statusMessage,
    resetSubmission,
    startSubmission,
    completeFormSubmission,
    completeFileUpload,
    handleSubmissionFailure,
  } = useFormSubmissionWithUploads({
    entityType: 'patient',
    onSuccess: () => {
      setShowModal(false);
      setEditingItem(null);
      resetFormData();
      if (needsRefreshAfterSubmissionRef.current) {
        needsRefreshAfterSubmissionRef.current = false;
        refreshPatient();
      }
    },
    onError: (error) => {
      logger.error('patient_form_error', {
        message: 'Form submission error in Patient-Info',
        error: error.message,
        component: 'Patient-Info',
      });
    },
    component: 'Patient-Info',
  });

  // Determine if this is a new user based on patient existence
  const isNewUser = !patientExists;

  // Form data reset function
  const resetFormData = useCallback(() => {
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
  }, []);

  // Populate form data from patient
  const populateFormData = useCallback((patient) => {
    setFormData({
      first_name: patient.first_name || '',
      last_name: patient.last_name || '',
      birth_date: patient.birth_date || '',
      gender: patient.gender || '',
      address: patient.address || '',
      blood_type: patient.blood_type || '',
      height: patient.height || '',
      weight: patient.weight || '',
      physician_id: patient.physician_id || '',
    });
  }, []);

  // Form handlers
  const handleEditPatient = useCallback(() => {
    resetSubmission();
    if (patientData) {
      setEditingItem(patientData);
      populateFormData(patientData);
    } else {
      setEditingItem(null);
      resetFormData();
    }
    setShowModal(true);
    setError('');
  }, [patientData, resetSubmission, populateFormData, resetFormData]);

  // Check for edit mode from URL parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const hasEditParam = urlParams.get('edit') === 'true';
    
    if (hasEditParam && !processedEditParamRef.current) {
      processedEditParamRef.current = true;
      handleEditPatient();
      
      // Remove the edit parameter from URL to clean it up
      urlParams.delete('edit');
      const newSearch = urlParams.toString();
      navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, {
        replace: true,
      });
    } else if (!hasEditParam) {
      // Reset the ref when edit param is not present
      processedEditParamRef.current = false;
    }
  }, [location.search, location.pathname, navigate, handleEditPatient]);

  // Initialize form data when patient data becomes available or changes
  useEffect(() => {
    if (patientData) {
      setPatientExists(true);
      populateFormData(patientData);
    } else if (
      patientError &&
      patientError.includes('Patient record not found')
    ) {
      setPatientExists(false);
      resetFormData();
    }
  }, [patientData, patientError, populateFormData, resetFormData]);

  // Handle global error state
  useEffect(() => {
    if (patientError && !patientError.includes('Patient record not found')) {
      setError('Failed to load patient information. Please try again.');
    } else {
      setError('');
    }
  }, [patientError]);

  // Form handlers
  const handleInputChange = e => {
    const { name, value } = e.target;
    let processedValue = value;

    // Handle physician_id - convert empty string to null or empty for Mantine
    if (name === 'physician_id') {
      processedValue = value === '' ? '' : value;
    }

    setFormData(prev => ({
      ...prev,
      [name]: processedValue,
    }));
  };


  const handleSubmit = async () => {
    try {
      if (!canSubmit) return;

      startSubmission();
      
      // Prepare data for API
      const apiData = {
        ...formData,
        physician_id: formData.physician_id
          ? parseInt(formData.physician_id)
          : null,
      };

      const isCreating = editingItem === null || !patientExists;

      if (isCreating) {
        await patientApi.createPatient(apiData);
        setPatientExists(true);
        needsRefreshAfterSubmissionRef.current = true;
      } else {
        await patientApi.updatePatient(patientData.id, apiData);
        needsRefreshAfterSubmissionRef.current = true;
      }

      // Invalidate caches
      await invalidatePatientList();
      await invalidatePatient();
      
      // Complete form submission
      const submitSuccess = completeFormSubmission(true, isCreating ? 'Patient created successfully!' : 'Patient updated successfully!');
      
      // For forms without file uploads, we need to manually complete the upload process
      // to trigger the success callback and close the modal
      if (submitSuccess) {
        completeFileUpload(true, 0, 0);
      }
      
    } catch (error) {
      const userFriendlyMessage = getUserFriendlyError(error, 'patient');
      handleSubmissionFailure(error, userFriendlyMessage);
      setError(userFriendlyMessage);
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
      <Container size="xl" py="md">
        <PageHeader title="Patient Information" icon="📋" />
        <Stack align="center" gap="md" py="xl">
          <Text size="lg">Loading patient information...</Text>
        </Stack>
      </Container>
    );
  }

  return (
    <>
      <Container size="xl" py="md">
        <PageHeader title="Patient Information" icon="📋" />

        <Stack gap="lg">
          {isNewUser && (
            <Alert
              variant="light"
              color="blue"
              title="Welcome to MediKeep!"
            >
              Your account has been created successfully. Please complete your
              patient profile below to get started with managing your medical
              records.
            </Alert>
          )}

          {/* Error Messages */}
          {error && (
            <Alert
              variant="light"
              color="red"
              title="Error"
              withCloseButton
              onClose={() => setError('')}
            >
              {error}
            </Alert>
          )}

          <Card withBorder shadow="sm" radius="md" className="patient-card">
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Text size="xl" fw={600}>Personal Information</Text>
                <Button variant="filled" size="sm" onClick={handleEditPatient}>
                  Edit Profile
                </Button>
              </Group>

              {/* Patient Summary Display */}
              {patientData ? (
                <div className="patient-details">
                  <div className="detail-row">
                    <div className="detail-group">
                      <label>First Name:</label>
                      <span>{patientData.first_name || 'Not provided'}</span>
                    </div>
                    <div className="detail-group">
                      <label>Last Name:</label>
                      <span>{patientData.last_name || 'Not provided'}</span>
                    </div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-group">
                      <label>Birth Date:</label>
                      <span>
                        {formatDate(
                          patientData.birth_date,
                          DATE_FORMATS.DISPLAY_LONG
                        )}
                      </span>
                    </div>
                    <div className="detail-group">
                      <label>Gender:</label>
                      <span>{getGenderDisplay(patientData.gender)}</span>
                    </div>
                  </div>
                  <div className="detail-group full-width">
                    <label>Address:</label>
                    <span>{patientData.address || 'Not provided'}</span>
                  </div>
                  <div className="detail-row">
                    <div className="detail-group">
                      <label>Blood Type:</label>
                      <span>{patientData.blood_type || 'Not provided'}</span>
                    </div>
                    <div className="detail-group">
                      <label>Height:</label>
                      <span>
                        {patientData.height
                          ? formatMeasurement(
                              convertForDisplay(
                                patientData.height,
                                'height',
                                unitSystem
                              ),
                              'height',
                              unitSystem
                            )
                          : 'Not provided'}
                      </span>
                    </div>
                  </div>
                  <div className="detail-row">
                    <div className="detail-group">
                      <label>Weight:</label>
                      <span>
                        {patientData.weight
                          ? formatMeasurement(
                              convertForDisplay(
                                patientData.weight,
                                'weight',
                                unitSystem
                              ),
                              'weight',
                              unitSystem
                            )
                          : 'Not provided'}
                      </span>
                    </div>
                    <div className="detail-group">
                      <label>Primary Care Physician:</label>
                      <span>
                        {getPractitionerDisplay(patientData.physician_id)}
                      </span>
                    </div>
                  </div>
                  {patientData.id && (
                    <div className="detail-group">
                      <label>Patient ID:</label>
                      <span>{patientData.id}</span>
                    </div>
                  )}
                </div>
              ) : (
                <Stack align="center" gap="md" py="xl">
                  <Text size="lg" fw={500}>No Patient Profile Found</Text>
                  <Text ta="center" c="dimmed">
                    Please create your patient profile to get started.
                  </Text>
                  <Button variant="filled" onClick={handleEditPatient}>
                    Create Profile
                  </Button>
                </Stack>
              )}
            </Stack>
          </Card>
        </Stack>
      </Container>

      {/* Edit Modal */}
      <PatientFormWrapper
        isOpen={showModal}
        onClose={() => !isBlocking && setShowModal(false)}
        title={editingItem ? 'Edit Patient Information' : 'Create Patient Profile'}
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        editingItem={editingItem}
        practitioners={practitioners}
        isLoading={isBlocking}
        statusMessage={statusMessage}
        isCreating={editingItem === null || !patientExists}
        error={error}
      />
    </>
  );
};

export default PatientInfo;