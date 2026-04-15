// React and routing
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// API and utilities
import patientApi from '../../services/api/patientApi';
import { useDateFormat } from '../../hooks/useDateFormat';
import {
  formatMeasurement,
  convertForDisplay,
} from '../../utils/unitConversion';
import { getUserFriendlyError } from '../../constants/errorMessages';
import logger from '../../services/logger';

// Hooks and contexts
import {
  useCurrentPatient,
  usePractitioners,
  useCacheManager,
} from '../../hooks/useGlobalData';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { useFormSubmissionWithUploads } from '../../hooks/useFormSubmissionWithUploads';

// Components
import { PageHeader } from '../../components';
import PatientFormWrapper from '../../components/medical/patient-info/PatientFormWrapper';
import PatientAvatar from '../../components/shared/PatientAvatar';
import MedicalPageLoading from '../../components/shared/MedicalPageLoading';

// Mantine UI
import {
  Button,
  Group,
  Stack,
  Text,
  Container,
  Alert,
  Card,
  SimpleGrid,
  ThemeIcon,
} from '@mantine/core';
import { IconUser, IconStethoscope, IconPencil } from '@tabler/icons-react';

// Hooks
import { useViewport } from '../../hooks/useViewport';

// Styles
import '../../styles/shared/MedicalPageShared.css';
import '../../styles/pages/PatientInfo.css';

const PatientInfo = () => {
  const { t } = useTranslation(['common', 'shared']);
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
  const { formatLongDate } = useDateFormat();
  const { isMobile, isTablet } = useViewport();

  // Combine loading states
  const loading = patientLoading || practitionersLoading;

  // State management
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [patientExists, setPatientExists] = useState(true);
  const [formData, setFormData] = useState({
    id: null,
    first_name: '',
    last_name: '',
    birth_date: '',
    gender: '',
    address: '',
    blood_type: '',
    height: '',
    weight: '',
    physician_id: '',
    relationship_to_self: '',
  });
  const [error, setError] = useState('');

  // Photo state
  const [photoUrl, setPhotoUrl] = useState(null);

  // Handle photo changes from form modal
  const handlePhotoChange = useCallback(newPhotoUrl => {
    logger.debug('photo_change_callback', 'Photo changed from form modal', {
      component: 'Patient-Info',
      hasNewPhoto: !!newPhotoUrl,
    });
    setPhotoUrl(newPhotoUrl);
  }, []);

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
        // Photo will be refreshed automatically when patient data updates
      }
    },
    onError: error => {
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
      id: null,
      first_name: '',
      last_name: '',
      birth_date: '',
      gender: '',
      address: '',
      blood_type: '',
      height: '',
      weight: '',
      physician_id: '',
      relationship_to_self: '',
    });
  }, []);

  // Populate form data from patient
  const populateFormData = useCallback(patient => {
    setFormData({
      id: patient.id, // Include patient ID for photo upload
      first_name: patient.first_name || '',
      last_name: patient.last_name || '',
      birth_date: patient.birth_date || '',
      gender: patient.gender || '',
      address: patient.address || '',
      blood_type: patient.blood_type || '',
      height: patient.height || '',
      weight: patient.weight || '',
      physician_id: patient.physician_id || '',
      relationship_to_self: patient.relationship_to_self || '',
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientData, resetSubmission]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientData, patientError]);

  // Handle global error state
  useEffect(() => {
    if (patientError && !patientError.includes('Patient record not found')) {
      setError('Failed to load patient information. Please try again.');
    } else {
      setError('');
    }
  }, [patientError]);

  // Load patient photo when patient data changes
  useEffect(() => {
    const loadPatientPhoto = async () => {
      if (patientData?.id) {
        try {
          logger.debug('photo_load_start', 'Loading patient photo', {
            component: 'Patient-Info',
            patientId: patientData.id,
          });

          const photoInfo = await patientApi.getPhotoInfo(patientData.id);
          logger.debug('photo_info_result', 'Photo info result', {
            component: 'Patient-Info',
            patientId: patientData.id,
            hasPhoto: !!photoInfo,
          });

          if (photoInfo) {
            const photoUrl = await patientApi.getPhotoUrl(patientData.id);
            logger.debug('photo_url_set', 'Setting photo URL', {
              component: 'Patient-Info',
              patientId: patientData.id,
              hasPhotoUrl: !!photoUrl,
            });
            setPhotoUrl(photoUrl);
          } else {
            logger.debug('photo_not_found', 'No photo found for patient', {
              component: 'Patient-Info',
              patientId: patientData.id,
            });
            setPhotoUrl(null);
          }
        } catch (error) {
          logger.error('photo_load_error', 'Failed to load patient photo', {
            component: 'Patient-Info',
            patientId: patientData.id,
            error: error.message,
          });
          setPhotoUrl(null);
        }
      } else {
        setPhotoUrl(null);
      }
    };

    loadPatientPhoto();
  }, [patientData?.id]);

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
      const submitSuccess = completeFormSubmission(
        true,
        isCreating
          ? 'Patient created successfully!'
          : 'Patient updated successfully!'
      );

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
        return t('shared:fields.male', 'Male');
      case 'F':
        return t('shared:fields.female', 'Female');
      case 'OTHER':
        return t('shared:fields.other', 'Other');
      default:
        return t('shared:labels.notSpecified', 'Not specified');
    }
  };

  const getPractitionerDisplay = physicianId => {
    if (!physicianId) return t('patientInfo.notAssigned', 'Not assigned');

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
      <MedicalPageLoading
        message={t('patientInfo.loading', 'Loading patient information...')}
      />
    );
  }

  return (
    <>
      <Container size="xl" py="md">
        <PageHeader
          title={t('shared:labels.patientInformation', 'Patient Information')}
          icon="📋"
          variant="dashboard"
        />

        <Stack gap="xl" mt="lg">
          {isNewUser && (
            <Alert
              variant="light"
              color="blue"
              title={t('patientInfo.welcome.title', 'Welcome to MediKeep!')}
            >
              {t(
                'patientInfo.welcome.message',
                'Your account has been created successfully. Please complete your patient profile below to get started with managing your medical records.'
              )}
            </Alert>
          )}

          {/* Error Messages */}
          {error && (
            <Alert
              variant="light"
              color="red"
              title={t('shared:labels.error', 'Error')}
              withCloseButton
              onClose={() => setError('')}
              style={{ whiteSpace: 'pre-line' }}
            >
              {error}
            </Alert>
          )}

          <Card
            withBorder
            shadow="sm"
            radius="md"
            className="patient-card"
            p={0}
          >
            {/* Patient Summary Display */}
            {patientData ? (
              <div className="patient-details">
                {/* Hero Section */}
                <div className="patient-hero-wrapper">
                  <div className="patient-hero" />
                  <div className="patient-hero-actions">
                    <Button
                      variant="subtle"
                      color="white"
                      size="compact-sm"
                      onClick={handleEditPatient}
                      leftSection={<IconPencil size={14} />}
                    >
                      {t('patientInfo.editProfile', 'Edit Profile')}
                    </Button>
                  </div>

                  <div className="patient-hero-profile">
                    <div className="patient-hero-avatar">
                      <PatientAvatar
                        photoUrl={photoUrl}
                        patient={patientData}
                        size={isMobile ? 64 : isTablet ? 76 : 88}
                        radius="xl"
                      />
                    </div>
                    <div className="patient-hero-info">
                      <Text
                        size={isMobile ? 'lg' : 'xl'}
                        fw={700}
                        className="patient-hero-name-text"
                        lh={1.2}
                      >
                        {patientData.first_name} {patientData.last_name}
                      </Text>
                      {patientData.relationship_to_self && (
                        <div className="patient-hero-badge">
                          <Text
                            size="xs"
                            fw={500}
                            className="patient-hero-badge-text"
                          >
                            {patientData.relationship_to_self
                              .split('_')
                              .map(
                                word =>
                                  word.charAt(0).toUpperCase() + word.slice(1)
                              )
                              .join(' ')}
                          </Text>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Stack
                  gap="lg"
                  p={isMobile ? 'md' : 'xl'}
                  pt={isMobile ? 'sm' : 'lg'}
                >
                  {/* Personal Details Section */}
                  <div className="patient-section">
                    <div className="patient-section-header">
                      <ThemeIcon variant="light" size="sm">
                        <IconUser size={14} />
                      </ThemeIcon>
                      <Text size="sm" fw={600} tt="uppercase">
                        {t('patientInfo.personalInfo', 'Personal Information')}
                      </Text>
                    </div>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                      <div className="detail-group">
                        <label>
                          {t('shared:labels.firstName', 'First Name')}:
                        </label>
                        <span>
                          {patientData.first_name ||
                            t('patientInfo.notProvided', 'Not provided')}
                        </span>
                      </div>
                      <div className="detail-group">
                        <label>
                          {t('shared:labels.lastName', 'Last Name')}:
                        </label>
                        <span>
                          {patientData.last_name ||
                            t('patientInfo.notProvided', 'Not provided')}
                        </span>
                      </div>
                      <div className="detail-group">
                        <label>
                          {t('patientInfo.fields.birthDate', 'Birth Date')}:
                        </label>
                        <span>
                          {formatLongDate(patientData.birth_date, true)}
                        </span>
                      </div>
                      <div className="detail-group">
                        <label>{t('shared:fields.gender', 'Gender')}:</label>
                        <span>{getGenderDisplay(patientData.gender)}</span>
                      </div>
                    </SimpleGrid>
                    <div
                      className="detail-group full-width"
                      style={{ marginTop: 16 }}
                    >
                      <label>{t('shared:labels.address', 'Address')}:</label>
                      <span>
                        {patientData.address ||
                          t('patientInfo.notProvided', 'Not provided')}
                      </span>
                    </div>
                  </div>

                  {/* Medical Details Section */}
                  <div className="patient-section">
                    <div className="patient-section-header">
                      <ThemeIcon variant="light" size="sm">
                        <IconStethoscope size={14} />
                      </ThemeIcon>
                      <Text size="sm" fw={600} tt="uppercase">
                        {t(
                          'shared:fields.medicalInformation',
                          'Medical Information'
                        )}
                      </Text>
                    </div>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                      <div className="detail-group">
                        <label>
                          {t('shared:labels.bloodType', 'Blood Type')}:
                        </label>
                        <span>
                          {patientData.blood_type ||
                            t('patientInfo.notProvided', 'Not provided')}
                        </span>
                      </div>
                      <div className="detail-group">
                        <label>{t('shared:labels.height', 'Height')}:</label>
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
                            : t('patientInfo.notProvided', 'Not provided')}
                        </span>
                      </div>
                      <div className="detail-group">
                        <label>{t('shared:labels.weight', 'Weight')}:</label>
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
                            : t('patientInfo.notProvided', 'Not provided')}
                        </span>
                      </div>
                      <div className="detail-group">
                        <label>
                          {t(
                            'patientInfo.fields.physician',
                            'Primary Care Physician'
                          )}
                          :
                        </label>
                        <span>
                          {getPractitionerDisplay(patientData.physician_id)}
                        </span>
                      </div>
                    </SimpleGrid>
                  </div>

                  {/* De-emphasized Patient ID */}
                  {patientData.id && (
                    <Text size="xs" c="dimmed" ta="right" mt="md">
                      {t('patientInfo.fields.patientId', 'Patient ID')}:{' '}
                      {patientData.id}
                    </Text>
                  )}
                </Stack>
              </div>
            ) : (
              <Stack align="center" gap="md" py="xl" px="md">
                <Text size="lg" fw={500}>
                  {t('patientInfo.noProfile', 'No Patient Profile Found')}
                </Text>
                <Text ta="center" c="dimmed">
                  {t(
                    'patientInfo.createPrompt',
                    'Please create your patient profile to get started.'
                  )}
                </Text>
                <Button variant="filled" onClick={handleEditPatient}>
                  {t('patientInfo.createProfile', 'Create Profile')}
                </Button>
              </Stack>
            )}
          </Card>
        </Stack>
      </Container>

      {/* Edit Modal */}
      <PatientFormWrapper
        isOpen={showModal}
        onClose={() => !isBlocking && setShowModal(false)}
        title={
          editingItem
            ? t('patientInfo.editTitle', 'Edit Patient Information')
            : t('patientInfo.createTitle', 'Create Patient Profile')
        }
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        editingItem={editingItem}
        practitioners={practitioners}
        isLoading={isBlocking}
        statusMessage={statusMessage}
        isCreating={editingItem === null || !patientExists}
        error={error}
        onPhotoChange={handlePhotoChange}
      />
    </>
  );
};

export default PatientInfo;
