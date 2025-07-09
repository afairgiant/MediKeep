import React from 'react';
import {
  Modal,
  TextInput,
  Select,
  Button,
  Group,
  Stack,
  Grid,
  Text,
  Divider,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';

const MantineMedicalForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  practitioners = [],
  pharmacies = [],
  conditions = [],
  editingMedication = null,
}) => {
  // Convert practitioners to Mantine format
  const practitionerOptions = practitioners.map(practitioner => ({
    value: String(practitioner.id),
    label: `${practitioner.name} - ${practitioner.specialty}`,
  }));

  // Convert pharmacies to Mantine format
  const pharmacyOptions = pharmacies.map(pharmacy => ({
    value: String(pharmacy.id),
    label: `${pharmacy.name}${pharmacy.city ? ` - ${pharmacy.city}` : ''}${pharmacy.state ? `, ${pharmacy.state}` : ''}`,
  }));

  // Convert conditions to Mantine format
  const conditionOptions = conditions.map(condition => ({
    value: String(condition.id),
    label: condition.diagnosis || condition.condition_name || `Condition #${condition.id}`,
  }));

  // Handle TextInput onChange (receives event object)
  const handleTextInputChange = field => event => {
    const syntheticEvent = {
      target: {
        name: field,
        value: event.target.value || '',
      },
    };
    onInputChange(syntheticEvent);
  };

  // Handle Select onChange (receives value directly)
  const handleSelectChange = field => value => {
    const syntheticEvent = {
      target: {
        name: field,
        value: value || '',
      },
    };
    onInputChange(syntheticEvent);
  };

  // Handle date changes
  const handleDateChange = field => date => {
    let formattedDate = '';

    if (date) {
      // Check if it's already a Date object, if not try to create one
      const dateObj = date instanceof Date ? date : new Date(date);

      // Verify we have a valid date
      if (!isNaN(dateObj.getTime())) {
        formattedDate = dateObj.toISOString().split('T')[0];
      }
    }

    const syntheticEvent = {
      target: {
        name: field,
        value: formattedDate,
      },
    };
    onInputChange(syntheticEvent);
  };

  const handleSubmit = e => {
    e.preventDefault();
    onSubmit(e);
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={
        <Text size="lg" fw={600}>
          {title}
        </Text>
      }
      size="lg"
      centered
      styles={{
        body: { padding: '1.5rem' },
        header: { paddingBottom: '1rem' },
      }}
    >
      <form onSubmit={handleSubmit}>
        <Stack spacing="md">
          {/* Basic Medication Info */}
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Medication Name"
                placeholder="e.g., Lisinopril, Metformin"
                value={formData.medication_name}
                onChange={handleTextInputChange('medication_name')}
                required
                withAsterisk
                description="Generic or brand name of the medication"
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Dosage"
                placeholder="e.g., 10mg, 1 tablet"
                value={formData.dosage}
                onChange={handleTextInputChange('dosage')}
                description="Strength and amount per dose"
              />
            </Grid.Col>
          </Grid>

          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Frequency"
                placeholder="e.g., Once daily, Twice daily"
                value={formData.frequency}
                onChange={handleTextInputChange('frequency')}
                description="How often the medication is taken"
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Route"
                placeholder="Select Route"
                value={formData.route}
                onChange={handleSelectChange('route')}
                data={[
                  { value: 'oral', label: 'Oral' },
                  { value: 'injection', label: 'Injection' },
                  { value: 'topical', label: 'Topical' },
                  { value: 'intravenous', label: 'Intravenous' },
                  { value: 'intramuscular', label: 'Intramuscular' },
                  { value: 'subcutaneous', label: 'Subcutaneous' },
                  { value: 'inhalation', label: 'Inhalation' },
                  { value: 'nasal', label: 'Nasal' },
                  { value: 'rectal', label: 'Rectal' },
                  { value: 'sublingual', label: 'Sublingual' },
                ]}
                searchable
                clearable
                description="How the medication is administered"
              />
            </Grid.Col>
          </Grid>

          {/* Indication and Condition Linking */}
          <Stack spacing="xs">
            <Text size="sm" fw={500} c="dimmed">
              What is this medication for?
            </Text>
            
            <TextInput
              label="Indication"
              placeholder="e.g., High blood pressure, As needed for pain"
              value={formData.indication}
              onChange={handleTextInputChange('indication')}
              description="Describe the reason in your own words"
            />
            
            <Text size="xs" c="dimmed" ta="center">
              — OR —
            </Text>
            
            <Select
              label="Link to Condition (Optional)"
              placeholder="Choose from patient's conditions..."
              value={formData.condition_id}
              onChange={handleSelectChange('condition_id')}
              data={conditionOptions}
              searchable
              clearable
              description="Link to a formal diagnosis if applicable"
            />
            
            <Text size="xs" c="dimmed" style={{ fontStyle: 'italic' }}>
              💡 You can use either approach, or both together for more detail
            </Text>
          </Stack>

          {/* Status and Dates */}
          <Grid>
            <Grid.Col span={4}>
              <Select
                label="Status"
                value={formData.status}
                onChange={handleSelectChange('status')}
                data={[
                  { value: 'active', label: 'Active' },
                  { value: 'stopped', label: 'Stopped' },
                  { value: 'on-hold', label: 'On Hold' },
                  { value: 'completed', label: 'Completed' },
                ]}
                description="Current status of the medication"
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <DateInput
                label="Start Date"
                placeholder="Select start date"
                value={
                  formData.effective_period_start
                    ? new Date(formData.effective_period_start)
                    : null
                }
                onChange={handleDateChange('effective_period_start')}

                firstDayOfWeek={0}
                clearable
                description="When the medication was started"
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <DateInput
                label="End Date"
                placeholder="Select end date"
                value={
                  formData.effective_period_end
                    ? new Date(formData.effective_period_end)
                    : null
                }
                onChange={handleDateChange('effective_period_end')}

                firstDayOfWeek={0}
                clearable
                description="When discontinued (if applicable)"
              />
            </Grid.Col>
          </Grid>

          {/* Provider and Pharmacy */}
          <Grid>
            <Grid.Col span={6}>
              <Select
                label="Prescribing Provider"
                placeholder="Select Provider"
                value={
                  formData.practitioner_id
                    ? String(formData.practitioner_id)
                    : ''
                }
                onChange={handleSelectChange('practitioner_id')}
                data={practitionerOptions}
                searchable
                clearable
                description="Doctor who prescribed this medication"
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Pharmacy"
                placeholder="Select Pharmacy"
                value={formData.pharmacy_id ? String(formData.pharmacy_id) : ''}
                onChange={handleSelectChange('pharmacy_id')}
                data={pharmacyOptions}
                searchable
                clearable
                description="Pharmacy where medication is filled"
              />
            </Grid.Col>
          </Grid>

          {/* Form Actions */}
          <Group justify="flex-end" mt="lg">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="filled">
              {editingMedication ? 'Update Medication' : 'Add Medication'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default MantineMedicalForm;
