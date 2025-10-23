/**
 * PatientForm Component - Create and edit patient records
 * Supports both self-records and records for others
 */

import React, { useState, useEffect } from 'react';
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
import { RELATIONSHIP_OPTIONS } from '../../constants/relationshipOptions';

const PatientForm = ({
  patient = null,
  onSuccess,
  onCancel,
  isModal = true,
}) => {
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
          `Updated ${result.first_name} ${result.last_name} successfully`
        );

        logger.info('patient_form_updated', {
          message: 'Patient updated successfully',
          patientId: patient.id,
          patientName: `${result.first_name} ${result.last_name}`,
        });
      } else {
        result = await patientApi.createPatient(submitData);
        toast.success(
          `Created ${result.first_name} ${result.last_name} successfully`
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
        `${isEditing ? 'Update' : 'Creation'} Failed: ${error.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    if (!formData.first_name?.trim()) {
      setError('First name is required');
      return false;
    }
    if (!formData.last_name?.trim()) {
      setError('Last name is required');
      return false;
    }
    if (!formData.birth_date) {
      setError('Birth date is required');
      return false;
    }
    const birthDate =
      formData.birth_date instanceof Date
        ? formData.birth_date
        : new Date(formData.birth_date);
    if (birthDate > new Date()) {
      setError('Birth date cannot be in the future');
      return false;
    }
    return true;
  };

  const bloodTypeOptions = [
    { value: '', label: 'Select blood type' },
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
    { value: '', label: 'Select gender' },
    { value: 'Male', label: 'Male' },
    { value: 'Female', label: 'Female' },
    { value: 'Other', label: 'Other' },
    { value: 'Prefer not to say', label: 'Prefer not to say' },
  ];


  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Title order={isModal ? 4 : 3}>
            <IconUser size="1.2rem" style={{ marginRight: 8 }} />
            {isEditing ? 'Edit Patient' : 'Create New Patient'}
          </Title>
        </Group>

        {/* Error Alert */}
        {error && (
          <Alert
            icon={<IconAlertCircle size="1rem" />}
            title="Error"
            color="red"
            variant="light"
          >
            {error}
          </Alert>
        )}

        {/* Self-record toggle for new patients */}
        {!isEditing && (
          <Box>
            <Switch
              label="This is my own medical record"
              description="Check this if you're creating a record for yourself"
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
            Basic Information
          </Text>
          <Stack gap="sm">
            <Group grow>
              <TextInput
                label="First Name"
                placeholder="Enter first name"
                required
                value={formData.first_name}
                onChange={e =>
                  setFormData({ ...formData, first_name: e.target.value })
                }
                disabled={loading}
              />
              <TextInput
                label="Last Name"
                placeholder="Enter last name"
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
                label="Birth Date"
                placeholder="Select birth date"
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
                label="Gender"
                placeholder="Select gender"
                data={genderOptions}
                value={formData.gender}
                onChange={value => setFormData({ ...formData, gender: value })}
                disabled={loading}
                clearable
              />
            </Group>

            <Select
              label="Relationship to You"
              placeholder="Select relationship (optional)"
              description="How is this person related to you?"
              data={RELATIONSHIP_OPTIONS}
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
            Medical Information
          </Text>
          <Stack gap="sm">
            <Select
              label="Blood Type"
              placeholder="Select blood type"
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
                label={`Height (${labels.heightLong})`}
                placeholder={
                  unitSystem === 'imperial'
                    ? 'Enter height in inches'
                    : 'Enter height in centimeters'
                }
                min={ranges.height.min}
                max={ranges.height.max}
                value={formData.height}
                onChange={value => setFormData({ ...formData, height: value })}
                disabled={loading}
                step={unitSystem === 'imperial' ? 0.5 : 1}
              />
              <NumberInput
                label={`Weight (${labels.weightLong})`}
                placeholder={
                  unitSystem === 'imperial'
                    ? 'Enter weight in pounds'
                    : 'Enter weight in kilograms'
                }
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
            Contact Information
          </Text>
          <Textarea
            label="Address"
            placeholder="Enter address"
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
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            color="blue"
            leftSection={<IconDeviceFloppy size="1rem" />}
            loading={loading}
          >
            {isEditing ? 'Update Patient' : 'Create Patient'}
          </Button>
        </Group>
      </Stack>
    </Box>
  );
};

export default PatientForm;
