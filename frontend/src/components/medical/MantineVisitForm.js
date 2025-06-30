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
        body: { padding: '1.5rem', paddingBottom: '2rem' },
        header: { paddingBottom: '1rem' },
      }}
      overflow="inside"
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

          {/* Visit Notes */}
          <Textarea
            label="Visit Notes"
            placeholder="Additional details about the visit..."
            value={formData.notes}
            onChange={handleTextInputChange('notes')}
            description="Any important details, observations, or follow-up notes"
            minRows={4}
            maxRows={8}
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
