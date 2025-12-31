/**
 * PatientForm Component - Create and edit patient records
 * Supports both self-records and records for others
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Stack,
  Group,
  TextInput,
  Select,
  NumberInput,
  Textarea,
  Button,
  Switch,
  Alert,
  Title,
  Text,
  Box,
  Divider,
} from '@mantine/core';
import {
  IconUser,
  IconCalendar,
  IconMapPin,
  IconAlertCircle,
  IconCheck,
  IconDeviceFloppy,
  IconX,
} from '@tabler/icons-react';
import { DateInput } from '@mantine/dates';
import { toast } from 'react-toastify';
import patientApi from '../../services/api/patientApi';
import logger from '../../services/logger';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import {
  unitLabels,
  validationRanges,
  convertForDisplay,
  convertForStorage,
} from '../../utils/unitConversion';

const PatientForm = ({
  patient = null,
  onSuccess,
  onCancel,
  isModal = true,
}) => {
  const { t } = useTranslation(['common', 'errors']);
  const { unitSystem } = useUserPreferences();
  const labels = unitLabels[unitSystem];
  const ranges = validationRanges[unitSystem];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    birth_date: null,
    gender: '',
    blood_type: '',
    height: null,
    weight: null,
    address: '',
    physician_id: null,
    is_self_record: false,
    relationship_to_self: '',
  });

  const isEditing = !!patient;

  // Populate form when editing
  useEffect(() => {
    if (patient) {
      setFormData({
        first_name: patient.first_name || '',
        last_name: patient.last_name || '',
        birth_date: patient.birth_date ? new Date(patient.birth_date) : null,
        gender: patient.gender || '',
        blood_type: patient.blood_type || '',
        // Convert stored imperial values to display format
        height: patient.height
          ? convertForDisplay(patient.height, 'height', unitSystem)
          : null,
        weight: patient.weight
          ? convertForDisplay(patient.weight, 'weight', unitSystem)
          : null,
        address: patient.address || '',
        physician_id: patient.physician_id || null,
        is_self_record: patient.is_self_record || false,
        relationship_to_self: patient.relationship_to_self || '',
      });
    }
  }, [patient]);

  const handleSubmit = async e => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Prepare data for API
      const submitData = {
        ...formData,
        birth_date: formData.birth_date
          ? formData.birth_date instanceof Date
            ? formData.birth_date.toISOString().split('T')[0]
            : formData.birth_date
          : null,
        // Convert display values back to storage format (imperial)
        height: formData.height
          ? convertForStorage(formData.height, 'height', unitSystem)
          : null,
        weight: formData.weight
          ? convertForStorage(formData.weight, 'weight', unitSystem)
          : null,
      };

      let result;
      if (isEditing) {
        result = await patientApi.updatePatient(patient.id, submitData);
        toast.success(
          t('patients.form.messages.updateSuccess', {
            firstName: result.first_name,
            lastName: result.last_name
          })
        );

        logger.info('patient_form_updated', {
          message: 'Patient updated successfully',
          patientId: patient.id,
          patientName: `${result.first_name} ${result.last_name}`,
        });
      } else {
        result = await patientApi.createPatient(submitData);
        toast.success(
          t('patients.form.messages.createSuccess', {
            firstName: result.first_name,
            lastName: result.last_name
          })
        );

        logger.info('patient_form_created', {
          message: 'Patient created successfully',
          patientId: result.id,
          patientName: `${result.first_name} ${result.last_name}`,
          isSelfRecord: submitData.is_self_record,
        });
      }

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (error) {
      logger.error('patient_form_error', {
        message: `Failed to ${isEditing ? 'update' : 'create'} patient`,
        error: error.message,
        patientId: patient?.id,
      });

      setError(error.message);
      toast.error(
        t(isEditing ? 'errors:patientForm.updateFailed' : 'errors:patientForm.createFailed', {
          message: error.message
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    if (!formData.first_name?.trim()) {
      setError(t('errors:patientForm.firstNameRequired'));
      return false;
    }
    if (!formData.last_name?.trim()) {
      setError(t('errors:patientForm.lastNameRequired'));
      return false;
    }
    if (!formData.birth_date) {
      setError(t('errors:patientForm.birthDateRequired'));
      return false;
    }
    const birthDate =
      formData.birth_date instanceof Date
        ? formData.birth_date
        : new Date(formData.birth_date);
    if (birthDate > new Date()) {
      setError(t('errors:patientForm.birthDateFuture'));
      return false;
    }
    return true;
  };

  const bloodTypeOptions = [
    { value: '', label: t('patients.form.bloodType.placeholder') },
    { value: 'A+', label: 'A+' },
    { value: 'A-', label: 'A-' },
    { value: 'B+', label: 'B+' },
    { value: 'B-', label: 'B-' },
    { value: 'AB+', label: 'AB+' },
    { value: 'AB-', label: 'AB-' },
    { value: 'O+', label: 'O+' },
    { value: 'O-', label: 'O-' },
  ];

  const genderOptions = [
    { value: '', label: t('patients.form.gender.options.select') },
    { value: 'Male', label: t('patients.form.gender.options.male') },
    { value: 'Female', label: t('patients.form.gender.options.female') },
    { value: 'Other', label: t('patients.form.gender.options.other') },
    { value: 'Prefer not to say', label: t('patients.form.gender.options.preferNotToSay') },
  ];

  const relationshipOptions = [
    { value: '', label: t('patients.form.relationship.options.select') },
    { value: 'self', label: t('patients.form.relationship.options.self') },
    { value: 'spouse', label: t('patients.form.relationship.options.spouse') },
    { value: 'partner', label: t('patients.form.relationship.options.partner') },
    { value: 'child', label: t('patients.form.relationship.options.child') },
    { value: 'son', label: t('patients.form.relationship.options.son') },
    { value: 'daughter', label: t('patients.form.relationship.options.daughter') },
    { value: 'parent', label: t('patients.form.relationship.options.parent') },
    { value: 'father', label: t('patients.form.relationship.options.father') },
    { value: 'mother', label: t('patients.form.relationship.options.mother') },
    { value: 'sibling', label: t('patients.form.relationship.options.sibling') },
    { value: 'brother', label: t('patients.form.relationship.options.brother') },
    { value: 'sister', label: t('patients.form.relationship.options.sister') },
    { value: 'grandparent', label: t('patients.form.relationship.options.grandparent') },
    { value: 'grandchild', label: t('patients.form.relationship.options.grandchild') },
    { value: 'other_family', label: t('patients.form.relationship.options.otherFamily') },
    { value: 'friend', label: t('patients.form.relationship.options.friend') },
    { value: 'other', label: t('patients.form.relationship.options.other') },
  ];


  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Title order={isModal ? 4 : 3}>
            <IconUser size="1.2rem" style={{ marginRight: 8 }} />
            {t(isEditing ? 'patients.form.editTitle' : 'patients.form.createTitle')}
          </Title>
        </Group>

        {/* Error Alert */}
        {error && (
          <Alert
            icon={<IconAlertCircle size="1rem" />}
            title={t('errors:patientForm.error')}
            color="red"
            variant="light"
            style={{ whiteSpace: 'pre-line' }}
          >
            {error}
          </Alert>
        )}

        {/* Self-record toggle for new patients */}
        {!isEditing && (
          <Box>
            <Switch
              label={t('patients.form.selfRecord.label')}
              description={t('patients.form.selfRecord.description')}
              checked={formData.is_self_record}
              onChange={event =>
                setFormData({
                  ...formData,
                  is_self_record: event.currentTarget.checked,
                })
              }
            />
          </Box>
        )}

        {/* Basic Information */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            {t('patients.form.sections.basicInformation')}
          </Text>
          <Stack gap="sm">
            <Group grow>
              <TextInput
                label={t('patients.form.firstName.label')}
                placeholder={t('patients.form.firstName.placeholder')}
                required
                value={formData.first_name}
                onChange={e =>
                  setFormData({ ...formData, first_name: e.target.value })
                }
                disabled={loading}
              />
              <TextInput
                label={t('patients.form.lastName.label')}
                placeholder={t('patients.form.lastName.placeholder')}
                required
                value={formData.last_name}
                onChange={e =>
                  setFormData({ ...formData, last_name: e.target.value })
                }
                disabled={loading}
              />
            </Group>

            <Group grow>
              <DateInput
                label={t('patients.form.birthDate.label')}
                placeholder={t('patients.form.birthDate.placeholder')}
                required
                leftSection={<IconCalendar size="1rem" />}
                value={formData.birth_date}
                onChange={date =>
                  setFormData({ ...formData, birth_date: date })
                }
                disabled={loading}
                maxDate={new Date()}
                popoverProps={{ withinPortal: true, zIndex: 3000 }}
              />
              <Select
                label={t('patients.form.gender.label')}
                placeholder={t('patients.form.gender.placeholder')}
                data={genderOptions}
                value={formData.gender}
                onChange={value => setFormData({ ...formData, gender: value })}
                disabled={loading}
                clearable
              />
            </Group>

            <Select
              label={t('patients.form.relationship.label')}
              placeholder={t('patients.form.relationship.placeholder')}
              description={t('patients.form.relationship.description')}
              data={relationshipOptions}
              value={formData.relationship_to_self}
              onChange={value =>
                setFormData({ ...formData, relationship_to_self: value })
              }
              disabled={loading}
              clearable
            />
          </Stack>
        </div>

        <Divider />

        {/* Medical Information */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            {t('patients.form.sections.medicalInformation')}
          </Text>
          <Stack gap="sm">
            <Select
              label={t('patients.form.bloodType.label')}
              placeholder={t('patients.form.bloodType.placeholder')}
              data={bloodTypeOptions}
              value={formData.blood_type}
              onChange={value =>
                setFormData({ ...formData, blood_type: value })
              }
              disabled={loading}
              clearable
            />

            <Group grow>
              <NumberInput
                label={`${t('patients.form.height.label')} (${labels.heightLong})`}
                placeholder={t(
                  unitSystem === 'imperial'
                    ? 'patients.form.height.placeholder.imperial'
                    : 'patients.form.height.placeholder.metric'
                )}
                min={ranges.height.min}
                max={ranges.height.max}
                value={formData.height}
                onChange={value => setFormData({ ...formData, height: value })}
                disabled={loading}
                step={unitSystem === 'imperial' ? 0.5 : 1}
              />
              <NumberInput
                label={`${t('patients.form.weight.label')} (${labels.weightLong})`}
                placeholder={t(
                  unitSystem === 'imperial'
                    ? 'patients.form.weight.placeholder.imperial'
                    : 'patients.form.weight.placeholder.metric'
                )}
                min={ranges.weight.min}
                max={ranges.weight.max}
                value={formData.weight}
                onChange={value => setFormData({ ...formData, weight: value })}
                disabled={loading}
                step={0.1}
              />
            </Group>
          </Stack>
        </div>

        <Divider />

        {/* Contact Information */}
        <div>
          <Text size="sm" fw={500} mb="xs">
            {t('patients.form.sections.contactInformation')}
          </Text>
          <Textarea
            label={t('patients.form.address.label')}
            placeholder={t('patients.form.address.placeholder')}
            leftSection={<IconMapPin size="1rem" />}
            value={formData.address}
            onChange={e =>
              setFormData({ ...formData, address: e.target.value })
            }
            disabled={loading}
            autosize
            minRows={2}
            maxRows={4}
          />
        </div>

        {/* Form Actions */}
        <Group justify="flex-end" mt="md">
          {onCancel && (
            <Button
              variant="light"
              color="gray"
              leftSection={<IconX size="1rem" />}
              onClick={onCancel}
              disabled={loading}
            >
              {t('patients.form.buttons.cancel')}
            </Button>
          )}
          <Button
            type="submit"
            color="blue"
            leftSection={<IconDeviceFloppy size="1rem" />}
            loading={loading}
          >
            {t(isEditing ? 'patients.form.buttons.updatePatient' : 'patients.form.buttons.createPatient')}
          </Button>
        </Group>
      </Stack>
    </Box>
  );
};

export default PatientForm;
