import React from 'react';
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
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useFormHandlers } from '../../hooks/useFormHandlers';

const MantinePatientForm = ({
  formData,
  onInputChange,
  onSave,
  onCancel,
  practitioners = [],
  saving = false,
  isCreating = false,
}) => {
  // Convert practitioners to Mantine format
  const practitionerOptions = practitioners.map(practitioner => ({
    value: String(practitioner.id),
    label: `${practitioner.name} - ${practitioner.specialty}`,
  }));

  const { handleTextInputChange, handleSelectChange, handleDateChange, handleNumberChange } = useFormHandlers(onInputChange);

  return (
    <Stack spacing="md">
      <Text size="lg" fw={600} mb="sm">
        {isCreating ? 'Create Patient Information' : 'Edit Patient Information'}
      </Text>

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
            value={formData.birth_date ? (() => {
              if (typeof formData.birth_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(formData.birth_date.trim())) {
                const [year, month, day] = formData.birth_date.trim().split('-').map(Number);
                if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                  return new Date(year, month - 1, day); // month is 0-indexed
                }
              }
              return new Date(formData.birth_date);
            })() : null}
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
            placeholder="e.g., 70"
            value={formData.height || ''}
            onChange={handleNumberChange('height')}
            disabled={saving}
            description="Height in inches"
            min={12}
            max={96}
            step={0.5}
          />
        </Grid.Col>
        <Grid.Col span={4}>
          <NumberInput
            label="Weight"
            placeholder="e.g., 150"
            value={formData.weight || ''}
            onChange={handleNumberChange('weight')}
            disabled={saving}
            description="Weight in pounds"
            min={1}
            max={1000}
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
