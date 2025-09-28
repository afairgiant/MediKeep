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
import { useFormHandlers } from '../../hooks/useFormHandlers';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import {
  unitLabels,
  validationRanges,
  convertForDisplay,
  convertForStorage,
} from '../../utils/unitConversion';
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

  const {
    handleTextInputChange,
    handleSelectChange,
    handleDateChange,
    handleNumberChange,
  } = useFormHandlers(onInputChange);

  return (
    <Stack spacing="md">
      <Text size="lg" fw={600} mb="sm">
        {isCreating ? 'Create Patient Information' : 'Edit Patient Information'}
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
            Save patient information first, then you can add a photo
          </Text>
          <Divider />
        </>
      )}

      {/* Basic Information */}
      <Grid>
        <Grid.Col span={6}>
          <TextInput
            label="First Name"
            placeholder="Enter first name"
            value={formData.first_name}
            onChange={handleTextInputChange('first_name')}
            required
            withAsterisk
            disabled={saving}
            description="Patient's first name"
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput
            label="Last Name"
            placeholder="Enter last name"
            value={formData.last_name}
            onChange={handleTextInputChange('last_name')}
            required
            withAsterisk
            disabled={saving}
            description="Patient's last name"
          />
        </Grid.Col>
      </Grid>

      {/* Birth Date and Gender */}
      <Grid>
        <Grid.Col span={6}>
          <DateInput
            label="Birth Date"
            placeholder="Select birth date"
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
            description="Patient's date of birth"
            maxDate={new Date()} // Can't be in the future
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <Select
            label="Gender"
            placeholder="Select gender"
            value={formData.gender}
            onChange={handleSelectChange('gender')}
            disabled={saving}
            data={[
              { value: 'M', label: 'Male' },
              { value: 'F', label: 'Female' },
              { value: 'OTHER', label: 'Other' },
            ]}
            description="Patient's gender"
            clearable
          />
        </Grid.Col>
      </Grid>

      {/* Address */}
      <Textarea
        label="Address"
        placeholder="Enter patient's address"
        value={formData.address}
        onChange={handleTextInputChange('address')}
        disabled={saving}
        description="Full address for medical records (optional)"
        minRows={2}
        maxRows={4}
      />

      {/* Medical Information */}
      <Text size="md" fw={500} mt="lg" mb="xs">
        Medical Information
      </Text>

      <Grid>
        <Grid.Col span={4}>
          <Select
            label="Blood Type"
            placeholder="Select blood type"
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
            description="Important for emergencies"
            clearable
            searchable
          />
        </Grid.Col>
        <Grid.Col span={4}>
          <NumberInput
            label="Height"
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
            description={`Height in ${labels.heightLong}`}
            min={ranges.height.min}
            max={ranges.height.max}
            step={unitSystem === 'imperial' ? 0.5 : 1}
          />
        </Grid.Col>
        <Grid.Col span={4}>
          <NumberInput
            label="Weight"
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
            description={`Weight in ${labels.weightLong}`}
            min={ranges.weight.min}
            max={ranges.weight.max}
            step={0.1}
          />
        </Grid.Col>
      </Grid>

      {/* Primary Care Physician */}
      <Select
        label="Primary Care Physician"
        placeholder="Select physician (optional)"
        value={formData.physician_id ? String(formData.physician_id) : ''}
        onChange={handleSelectChange('physician_id')}
        disabled={saving}
        data={practitionerOptions}
        description="Your primary doctor for ongoing care"
        clearable
        searchable
      />

      {/* Form Actions */}
      <Group justify="flex-end" mt="xl">
        <Button variant="subtle" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="filled"
          onClick={onSave}
          disabled={saving}
          loading={saving}
        >
          {saving
            ? 'Saving...'
            : isCreating
              ? 'Create Patient'
              : 'Save Changes'}
        </Button>
      </Group>
    </Stack>
  );
};

export default MantinePatientForm;
