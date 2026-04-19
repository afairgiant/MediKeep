import { useState, useEffect } from 'react';
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
  Box,
  ThemeIcon,
} from '@mantine/core';
import { DateInput } from '../adapters/DateInput';
import {
  IconUser,
  IconStethoscope,
  IconHome,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useFormHandlers } from '../../hooks/useFormHandlers';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { useDateFormat } from '../../hooks/useDateFormat';
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
  const { dateInputFormat } = useDateFormat();

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
            error: error.message,
          });
        }
      }
    };

    loadPhoto();
  }, [formData.id, isCreating]);

  // Handle photo upload
  const handlePhotoUpload = async file => {
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
        error: error.message,
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
        error: error.message,
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

  const { t } = useTranslation(['common', 'shared']);

  const {
    handleTextInputChange,
    handleSelectChange,
    handleDateChange,
    handleNumberChange,
  } = useFormHandlers(onInputChange);

  const SectionHeader = ({ icon: Icon, color, children }) => (
    <Group gap="xs" mb="sm">
      <ThemeIcon variant="light" size="sm" radius="md" color={color}>
        <Icon size={14} />
      </ThemeIcon>
      <Text size="sm" fw={600} tt="uppercase" c="dimmed">
        {children}
      </Text>
    </Group>
  );

  return (
    <Stack gap="lg">
      {/* Patient Photo Section */}
      {!isCreating && formData.id && (
        <PatientPhotoUpload
          key={photoKey}
          patientId={formData.id}
          currentPhotoUrl={photoUrl}
          onPhotoChange={handlePhotoUpload}
          onPhotoDelete={handlePhotoDelete}
          disabled={saving}
        />
      )}

      {/* Show note for new patients */}
      {isCreating && (
        <Text size="sm" c="dimmed" ta="center" fs="italic">
          {t('patients.form.saveFirstMessage')}
        </Text>
      )}

      {/* Personal Information Section */}
      <Box>
        <SectionHeader icon={IconUser} color="blue">
          {t('patientInfo.personalInfo', 'Personal Information')}
        </SectionHeader>

        <Stack gap="sm">
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label={t('shared:labels.firstName')}
                placeholder={t('patients.form.firstName.placeholder')}
                value={formData.first_name}
                onChange={handleTextInputChange('first_name')}
                required
                withAsterisk
                disabled={saving}
                radius="md"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label={t('shared:labels.lastName')}
                placeholder={t('patients.form.lastName.placeholder')}
                value={formData.last_name}
                onChange={handleTextInputChange('last_name')}
                required
                withAsterisk
                disabled={saving}
                radius="md"
              />
            </Grid.Col>
          </Grid>

          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <DateInput
                label={t('patients.form.birthDate.label')}
                placeholder={dateInputFormat}
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
                            return new Date(year, month - 1, day);
                          }
                        }
                        return new Date(formData.birth_date);
                      })()
                    : null
                }
                onChange={handleDateChange('birth_date')}
                valueFormat={dateInputFormat}
                firstDayOfWeek={0}
                required
                withAsterisk
                disabled={saving}
                maxDate={new Date()}
                popoverProps={{ withinPortal: true, zIndex: 3000 }}
                radius="md"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label={t('shared:fields.gender')}
                placeholder={t('shared:fields.selectGender')}
                value={formData.gender}
                onChange={handleSelectChange('gender')}
                disabled={saving}
                data={[
                  { value: 'M', label: t('shared:fields.male') },
                  { value: 'F', label: t('shared:fields.female') },
                  { value: 'OTHER', label: t('shared:fields.other') },
                ]}
                clearable
                radius="md"
              />
            </Grid.Col>
          </Grid>

          <Select
            label={t('patients.form.relationship.label')}
            placeholder={t('patients.form.relationship.placeholder')}
            value={formData.relationship_to_self}
            onChange={handleSelectChange('relationship_to_self')}
            disabled={saving}
            data={RELATIONSHIP_OPTIONS}
            clearable
            searchable
            radius="md"
          />
        </Stack>
      </Box>

      {/* Address Section */}
      <Box>
        <SectionHeader icon={IconHome} color="teal">
          {t('shared:labels.address', 'Address')}
        </SectionHeader>

        <Textarea
          placeholder={t('patients.form.address.placeholder')}
          value={formData.address}
          onChange={handleTextInputChange('address')}
          disabled={saving}
          minRows={2}
          maxRows={4}
          radius="md"
        />
      </Box>

      {/* Medical Information Section */}
      <Box>
        <SectionHeader icon={IconStethoscope} color="violet">
          {t('shared:fields.medicalInformation', 'Medical Information')}
        </SectionHeader>

        <Stack gap="sm">
          <Grid>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Select
                label={t('shared:labels.bloodType')}
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
                clearable
                searchable
                radius="md"
                description={'\u00A0'}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 4 }}>
              <NumberInput
                label={t('shared:labels.height')}
                placeholder={
                  unitSystem === 'imperial' ? 'e.g., 70' : 'e.g., 178'
                }
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
                description={labels.heightLong}
                min={ranges.height.min}
                max={ranges.height.max}
                step={unitSystem === 'imperial' ? 0.5 : 1}
                radius="md"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 6, sm: 4 }}>
              <NumberInput
                label={t('shared:labels.weight')}
                placeholder={
                  unitSystem === 'imperial' ? 'e.g., 150' : 'e.g., 68'
                }
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
                description={labels.weightLong}
                min={ranges.weight.min}
                max={ranges.weight.max}
                step={0.1}
                radius="md"
              />
            </Grid.Col>
          </Grid>

          <Select
            label={t('patients.form.physician.label')}
            placeholder={t('patients.form.physician.placeholder')}
            value={formData.physician_id ? String(formData.physician_id) : ''}
            onChange={handleSelectChange('physician_id')}
            disabled={saving}
            data={practitionerOptions}
            clearable
            searchable
            radius="md"
          />
        </Stack>
      </Box>

      {/* Form Actions */}
      <Group
        justify="flex-end"
        mt="sm"
        pt="md"
        style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
      >
        <Button
          variant="subtle"
          color="gray"
          onClick={onCancel}
          disabled={saving}
          leftSection={<IconX size={16} />}
          radius="md"
        >
          {t('shared:fields.cancel')}
        </Button>
        <Button
          variant="filled"
          onClick={onSave}
          disabled={saving}
          loading={saving}
          leftSection={!saving && <IconCheck size={16} />}
          radius="md"
        >
          {saving
            ? t('shared:labels.saving')
            : isCreating
              ? t('patients.form.buttons.createPatient')
              : t('patients.form.buttons.saveChanges')}
        </Button>
      </Group>
    </Stack>
  );
};

export default MantinePatientForm;
