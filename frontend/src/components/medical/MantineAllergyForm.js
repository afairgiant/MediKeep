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

const MantineAllergyForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingAllergy = null,
  medicationsOptions = [],
  medicationsLoading = false,
}) => {
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
          {/* Basic Allergy Info */}
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Allergen"
                placeholder="e.g., Penicillin, Peanuts, Latex"
                value={formData.allergen}
                onChange={handleTextInputChange('allergen')}
                required
                withAsterisk
                description="What substance causes the allergic reaction"
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Severity"
                placeholder="Select severity level"
                value={formData.severity}
                onChange={handleSelectChange('severity')}
                required
                withAsterisk
                data={[
                  {
                    value: 'mild',
                    label: '💛 Mild - Minor discomfort',
                  },
                  {
                    value: 'moderate',
                    label: '⚡ Moderate - Noticeable symptoms',
                  },
                  {
                    value: 'severe',
                    label: '⚠️ Severe - Significant reaction',
                  },
                  {
                    value: 'life-threatening',
                    label: '🚨 Life-threatening - Anaphylaxis risk',
                  },
                ]}
                description="How severe is this allergy"
              />
            </Grid.Col>
          </Grid>

          {/* Reaction and Date */}
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Reaction"
                placeholder="e.g., Rash, Anaphylaxis, Swelling"
                value={formData.reaction}
                onChange={handleTextInputChange('reaction')}
                description="What happens when exposed to this allergen"
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <DateInput
                label="Onset Date"
                placeholder="When did this allergy first occur"
                value={
                  formData.onset_date ? new Date(formData.onset_date) : null
                }
                onChange={handleDateChange('onset_date')}
                firstDayOfWeek={0}
                clearable
                description="When this allergy was first discovered"
                maxDate={new Date()} // Can't be in the future
              />
            </Grid.Col>
          </Grid>

          {/* Related Medication */}
          <Select
            label="Related Medication (Optional)"
            placeholder={medicationsLoading ? "Loading medications..." : "Select a medication this allergy is related to"}
            value={formData.medication_id}
            onChange={handleSelectChange('medication_id')}
            data={medicationsOptions.map(med => ({
              value: med.id.toString(),
              label: med.medication_name,
            }))}
            searchable
            clearable
            disabled={medicationsLoading}
            description="Link this allergy to a specific medication if applicable"
          />

          {/* Status */}
          <Select
            label="Status"
            value={formData.status}
            onChange={handleSelectChange('status')}
            data={[
              { value: 'active', label: 'Active - Currently allergic' },
              { value: 'inactive', label: 'Inactive - No longer allergic' },
              { value: 'resolved', label: 'Resolved - Outgrown the allergy' },
            ]}
            description="Current status of this allergy"
          />

          {/* Notes */}
          <Textarea
            label="Notes"
            placeholder="Additional information about this allergy..."
            value={formData.notes}
            onChange={handleTextInputChange('notes')}
            description="Any additional details, triggers, or treatment notes"
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
              color={
                formData.severity === 'life-threatening' ? 'red' : undefined
              }
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
              {editingAllergy ? 'Update Allergy' : 'Add Allergy'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default MantineAllergyForm;
