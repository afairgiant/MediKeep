import React, { useState, useEffect } from 'react';
import {
  Stack,
  Grid,
  TextInput,
  Select,
  NumberInput,
  Button,
  Group,
  Text,
  Textarea,
  Divider,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useTranslation } from 'react-i18next';
import { useFormHandlers } from '../../hooks/useFormHandlers';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import {
  unitLabels,
  validationRanges,
  convertForDisplay,
  convertForStorage,
} from '../../utils/unitConversion';
import { RELATIONSHIP_OPTIONS } from '../../constants/relationshipOptions';
import PatientPhotoUpload from './PatientPhotoUpload';
import patientApi from '../../services/api/patientApi';
import logger from '../../services/logger';

const MantinePatientForm = ({
  formData,
  onInputChange,
  onSave,
  onCancel,
  practitioners = [],
  saving = false,
  isCreating = false,
  onPhotoChange, // New callback for photo changes
}) => {
  const { unitSystem } = useUserPreferences();

  // Photo state
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoKey, setPhotoKey] = useState(0); // Force re-render of photo component

  // Load existing photo when form loads (for editing)
  useEffect(() => {
    const loadPhoto = async () => {
      if (!isCreating && formData.id) {
        try {
          const hasPhoto = await patientApi.hasPhoto(formData.id);
          if (hasPhoto) {
            const photoUrl = await patientApi.getPhotoUrl(formData.id);
            setPhotoUrl(photoUrl);
          }
        } catch (error) {
          logger.debug('photo_load_error', 'Failed to load patient photo', {
            component: 'MantinePatientForm',
            patientId: formData.id,
            error: error.message
          });
        }
      }
    };

    loadPhoto();
  }, [formData.id, isCreating]);

  // Handle photo upload
  const handlePhotoUpload = async (file) => {
    if (!formData.id) {
      throw new Error('Please save the patient first before uploading a photo');
    }

    try {
      await patientApi.uploadPhoto(formData.id, file);
      // Update photo URL after upload
      const photoUrl = await patientApi.getPhotoUrl(formData.id);
      setPhotoUrl(photoUrl);
      setPhotoKey(prev => prev + 1); // Force component re-render

      // Notify parent component about photo change
      if (onPhotoChange) {
        onPhotoChange(photoUrl);
      }
    } catch (error) {
      logger.error('photo_upload_error', 'Failed to upload photo in form', {
        component: 'MantinePatientForm',
        patientId: formData.id,
        error: error.message
      });
      throw error;
    }
  };

  // Handle photo deletion
  const handlePhotoDelete = async () => {
    if (!formData.id) return;

    try {
      await patientApi.deletePhoto(formData.id);
      setPhotoUrl(null);
      setPhotoKey(prev => prev + 1); // Force component re-render

      // Notify parent component about photo deletion
      if (onPhotoChange) {
        onPhotoChange(null);
      }
    } catch (error) {
      logger.error('photo_delete_error', 'Failed to delete photo in form', {
        component: 'MantinePatientForm',
        patientId: formData.id,
        error: error.message
      });
      throw error;
    }
  };

  // Get unit labels and validation ranges for current system
  const labels = unitLabels[unitSystem];
  const ranges = validationRanges[unitSystem];

  // Convert practitioners to Mantine format
  const practitionerOptions = practitioners.map(practitioner => ({
    value: String(practitioner.id),
    label: `${practitioner.name} - ${practitioner.specialty}`,
  }));

  const { t } = useTranslation('common');

  const {
    handleTextInputChange,
    handleSelectChange,
    handleDateChange,
    handleNumberChange,
  } = useFormHandlers(onInputChange);

  return (
    <Stack spacing="md">
      <Text size="lg" fw={600} mb="sm">
        {isCreating ? t('patients.form.createTitle') : t('patients.form.editTitle')}
      </Text>

      {/* Patient Photo Section */}
      {!isCreating && formData.id && (
        <>
          <PatientPhotoUpload
            key={photoKey}
            patientId={formData.id}
            currentPhotoUrl={photoUrl}
            onPhotoChange={handlePhotoUpload}
            onPhotoDelete={handlePhotoDelete}
            disabled={saving}
          />
          <Divider />
        </>
      )}

      {/* Show note for new patients */}
      {isCreating && (
        <>
          <Text size="sm" c="dimmed" ta="center" style={{ fontStyle: 'italic' }}>
            {t('patients.form.saveFirstMessage')}
          </Text>
          <Divider />
        </>
      )}

      {/* Basic Information */}
      <Grid>
        <Grid.Col span={6}>
          <TextInput
            label={t('patients.form.firstName.label')}
            placeholder={t('patients.form.firstName.placeholder')}
            value={formData.first_name}
            onChange={handleTextInputChange('first_name')}
            required
            withAsterisk
            disabled={saving}
            description={t('patients.form.firstName.description')}
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput
            label={t('patients.form.lastName.label')}
            placeholder={t('patients.form.lastName.placeholder')}
            value={formData.last_name}
            onChange={handleTextInputChange('last_name')}
            required
            withAsterisk
            disabled={saving}
            description={t('patients.form.lastName.description')}
          />
        </Grid.Col>
      </Grid>

      {/* Birth Date and Gender */}
      <Grid>
        <Grid.Col span={6}>
          <DateInput
            label={t('patients.form.birthDate.label')}
            placeholder={t('patients.form.birthDate.placeholder')}
            value={
              formData.birth_date
                ? (() => {
                    if (
                      typeof formData.birth_date === 'string' &&
                      /^\d{4}-\d{2}-\d{2}$/.test(formData.birth_date.trim())
                    ) {
                      const [year, month, day] = formData.birth_date
                        .trim()
                        .split('-')
                        .map(Number);
                      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                        return new Date(year, month - 1, day); // month is 0-indexed
                      }
                    }
                    return new Date(formData.birth_date);
                  })()
                : null
            }
            onChange={handleDateChange('birth_date')}
            firstDayOfWeek={0}
            required
            withAsterisk
            disabled={saving}
            description={t('patients.form.birthDate.description')}
            maxDate={new Date()} // Can't be in the future
            popoverProps={{ withinPortal: true, zIndex: 3000 }}
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <Select
            label={t('patients.form.gender.label')}
            placeholder={t('patients.form.gender.placeholder')}
            value={formData.gender}
            onChange={handleSelectChange('gender')}
            disabled={saving}
            data={[
              { value: 'M', label: t('patients.form.gender.options.male') },
              { value: 'F', label: t('patients.form.gender.options.female') },
              { value: 'OTHER', label: t('patients.form.gender.options.other') },
            ]}
            description={t('patients.form.gender.description')}
            clearable
          />
        </Grid.Col>
      </Grid>

      {/* Relationship to You */}
      <Select
        label={t('patients.form.relationship.label')}
        placeholder={t('patients.form.relationship.placeholder')}
        value={formData.relationship_to_self}
        onChange={handleSelectChange('relationship_to_self')}
        disabled={saving}
        data={RELATIONSHIP_OPTIONS}
        description={t('patients.form.relationship.description')}
        clearable
        searchable
      />

      {/* Address */}
      <Textarea
        label={t('patients.form.address.label')}
        placeholder={t('patients.form.address.placeholder')}
        value={formData.address}
        onChange={handleTextInputChange('address')}
        disabled={saving}
        description={t('patients.form.address.description')}
        minRows={2}
        maxRows={4}
      />

      {/* Medical Information */}
      <Text size="md" fw={500} mt="lg" mb="xs">
        {t('patients.form.medicalInfoHeading')}
      </Text>

      <Grid>
        <Grid.Col span={4}>
          <Select
            label={t('patients.form.bloodType.label')}
            placeholder={t('patients.form.bloodType.placeholder')}
            value={formData.blood_type}
            onChange={handleSelectChange('blood_type')}
            disabled={saving}
            data={[
              { value: 'A+', label: 'A+' },
              { value: 'A-', label: 'A-' },
              { value: 'B+', label: 'B+' },
              { value: 'B-', label: 'B-' },
              { value: 'AB+', label: 'AB+' },
              { value: 'AB-', label: 'AB-' },
              { value: 'O+', label: 'O+' },
              { value: 'O-', label: 'O-' },
            ]}
            description={t('patients.form.bloodType.description')}
            clearable
            searchable
          />
        </Grid.Col>
        <Grid.Col span={4}>
          <NumberInput
            label={t('patients.form.height.label')}
            placeholder={unitSystem === 'imperial' ? 'e.g., 70' : 'e.g., 178'}
            value={
              formData.height
                ? convertForDisplay(formData.height, 'height', unitSystem)
                : ''
            }
            onChange={value => {
              const convertedValue = convertForStorage(
                value,
                'height',
                unitSystem
              );
              handleNumberChange('height')(convertedValue);
            }}
            disabled={saving}
            description={t('patients.form.height.description', { unit: labels.heightLong })}
            min={ranges.height.min}
            max={ranges.height.max}
            step={unitSystem === 'imperial' ? 0.5 : 1}
          />
        </Grid.Col>
        <Grid.Col span={4}>
          <NumberInput
            label={t('patients.form.weight.label')}
            placeholder={unitSystem === 'imperial' ? 'e.g., 150' : 'e.g., 68'}
            value={
              formData.weight
                ? convertForDisplay(formData.weight, 'weight', unitSystem)
                : ''
            }
            onChange={value => {
              const convertedValue = convertForStorage(
                value,
                'weight',
                unitSystem
              );
              handleNumberChange('weight')(convertedValue);
            }}
            disabled={saving}
            description={t('patients.form.weight.description', { unit: labels.weightLong })}
            min={ranges.weight.min}
            max={ranges.weight.max}
            step={0.1}
          />
        </Grid.Col>
      </Grid>

      {/* Primary Care Physician */}
      <Select
        label={t('patients.form.physician.label')}
        placeholder={t('patients.form.physician.placeholder')}
        value={formData.physician_id ? String(formData.physician_id) : ''}
        onChange={handleSelectChange('physician_id')}
        disabled={saving}
        data={practitionerOptions}
        description={t('patients.form.physician.description')}
        clearable
        searchable
      />

      {/* Form Actions */}
      <Group justify="flex-end" mt="xl">
        <Button variant="subtle" onClick={onCancel} disabled={saving}>
          {t('buttons.cancel')}
        </Button>
        <Button
          variant="filled"
          onClick={onSave}
          disabled={saving}
          loading={saving}
        >
          {saving
            ? t('patients.form.buttons.saving')
            : isCreating
              ? t('patients.form.buttons.createPatient')
              : t('patients.form.buttons.saveChanges')}
        </Button>
      </Group>
    </Stack>
  );
};

export default MantinePatientForm;
