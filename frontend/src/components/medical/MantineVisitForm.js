import React from 'react';
import {
  Modal,
  TextInput,
  Select,
  Textarea,
  Button,
  Group,
  Stack,
  Grid,
  Text,
  NumberInput,
  Divider,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';

const MantineVisitForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  practitioners = [],
  editingVisit = null,
}) => {
  // Convert practitioners to Mantine format
  const practitionerOptions = practitioners.map(practitioner => ({
    value: String(practitioner.id),
    label: `Dr. ${practitioner.name} - ${practitioner.specialty}`,
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

  // Handle NumberInput onChange (receives value directly)
  const handleNumberChange = field => value => {
    const syntheticEvent = {
      target: {
        name: field,
        value: value || '',
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
      size="xl"
      centered
      styles={{
        body: { padding: '1.5rem', paddingBottom: '2rem' },
        header: { paddingBottom: '1rem' },
      }}
      overflow="inside"
      scrollAreaComponent="div"
    >
      <form onSubmit={handleSubmit}>
        <Stack spacing="md">
          {/* Reason for Visit */}
          <TextInput
            label="Reason for Visit"
            placeholder="e.g., Annual Checkup, Follow-up, Symptoms Review"
            value={formData.reason}
            onChange={handleTextInputChange('reason')}
            required
            withAsterisk
            description="Primary purpose of this medical visit"
          />

          {/* Date and Practitioner */}
          <Grid>
            <Grid.Col span={6}>
              <DateInput
                label="Visit Date"
                placeholder="Select visit date"
                value={formData.date ? new Date(formData.date) : null}
                onChange={handleDateChange('date')}
                firstDayOfWeek={0}
                required
                withAsterisk
                description="When the visit occurred"
                clearable
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Attending Practitioner"
                placeholder="Select practitioner (optional)"
                value={
                  formData.practitioner_id
                    ? String(formData.practitioner_id)
                    : ''
                }
                onChange={handleSelectChange('practitioner_id')}
                data={practitionerOptions}
                description="Doctor who conducted the visit"
                clearable
                searchable
              />
            </Grid.Col>
          </Grid>

          {/* Visit Type and Chief Complaint */}
          <Grid>
            <Grid.Col span={6}>
              <Select
                label="Visit Type"
                placeholder="Select visit type"
                value={formData.visit_type || ''}
                onChange={handleSelectChange('visit_type')}
                data={[
                  { value: 'annual checkup', label: 'Annual Checkup' },
                  { value: 'follow-up', label: 'Follow-up' },
                  { value: 'consultation', label: 'Consultation' },
                  { value: 'emergency', label: 'Emergency' },
                  { value: 'preventive care', label: 'Preventive Care' },
                  { value: 'routine visit', label: 'Routine Visit' },
                  {
                    value: 'specialist referral',
                    label: 'Specialist Referral',
                  },
                ]}
                description="Type of medical visit"
                clearable
                searchable
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Priority"
                placeholder="Select priority level"
                value={formData.priority || ''}
                onChange={handleSelectChange('priority')}
                data={[
                  { value: 'routine', label: 'Routine' },
                  { value: 'urgent', label: 'Urgent' },
                  { value: 'emergency', label: 'Emergency' },
                ]}
                description="Priority level of the visit"
                clearable
              />
            </Grid.Col>
          </Grid>

          {/* Chief Complaint */}
          <TextInput
            label="Chief Complaint"
            placeholder="Primary concern or symptom reported"
            value={formData.chief_complaint || ''}
            onChange={handleTextInputChange('chief_complaint')}
            description="Main health concern or symptom that prompted the visit"
          />

          {/* Duration and Location */}
          <Grid>
            <Grid.Col span={6}>
              <NumberInput
                label="Duration (minutes)"
                placeholder="Visit duration"
                value={formData.duration_minutes || ''}
                onChange={handleNumberChange('duration_minutes')}
                min={1}
                max={600}
                description="How long the visit lasted"
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Location"
                placeholder="Where the visit occurred"
                value={formData.location || ''}
                onChange={handleSelectChange('location')}
                data={[
                  { value: 'office', label: "Doctor's Office" },
                  { value: 'hospital', label: 'Hospital' },
                  { value: 'clinic', label: 'Clinic' },
                  { value: 'telehealth', label: 'Telehealth/Virtual' },
                  { value: 'urgent care', label: 'Urgent Care' },
                  { value: 'emergency room', label: 'Emergency Room' },
                  { value: 'home', label: 'Home Visit' },
                ]}
                description="Where the visit took place"
                clearable
                searchable
              />
            </Grid.Col>
          </Grid>

          <Divider my="md" />

          {/* Clinical Information Section */}
          <Text size="sm" fw={600} mb="sm">
            Clinical Information
          </Text>

          {/* Diagnosis */}
          <Textarea
            label="Diagnosis/Assessment"
            placeholder="Clinical assessment or diagnosis from the visit..."
            value={formData.diagnosis || ''}
            onChange={handleTextInputChange('diagnosis')}
            description="Medical diagnosis or clinical assessment"
            minRows={2}
            maxRows={4}
          />

          {/* Treatment Plan */}
          <Textarea
            label="Treatment Plan"
            placeholder="Recommended treatment or next steps..."
            value={formData.treatment_plan || ''}
            onChange={handleTextInputChange('treatment_plan')}
            description="Treatment recommendations and prescribed interventions"
            minRows={3}
            maxRows={6}
          />

          {/* Follow-up Instructions */}
          <Textarea
            label="Follow-up Instructions"
            placeholder="Follow-up care instructions..."
            value={formData.follow_up_instructions || ''}
            onChange={handleTextInputChange('follow_up_instructions')}
            description="Instructions for ongoing care and follow-up appointments"
            minRows={2}
            maxRows={4}
          />

          <Divider my="md" />

          {/* Visit Notes */}
          <Textarea
            label="Additional Notes"
            placeholder="Any other important details about the visit..."
            value={formData.notes || ''}
            onChange={handleTextInputChange('notes')}
            description="Any additional observations, notes, or important details"
            minRows={3}
            maxRows={6}
          />

          {/* Form Actions */}
          <Group justify="flex-end" mt="lg" mb="sm">
            <Button
              variant="subtle"
              onClick={onClose}
              style={{
                minHeight: '42px',
                height: '42px',
                lineHeight: '1.2',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="filled"
              style={{
                minHeight: '42px',
                height: '42px',
                lineHeight: '1.2',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {editingVisit ? 'Update Visit' : 'Add Visit'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default MantineVisitForm;
