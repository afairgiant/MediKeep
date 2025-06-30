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

const MantineConditionForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingCondition = null,
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
          {/* Diagnosis */}
          <TextInput
            label="Diagnosis"
            placeholder="e.g., Hypertension, Diabetes Type 2, Asthma"
            value={formData.diagnosis}
            onChange={handleTextInputChange('diagnosis')}
            required
            withAsterisk
            description="Medical condition or diagnosis name"
          />

          {/* Status and Onset Date */}
          <Grid>
            <Grid.Col span={6}>
              <Select
                label="Status"
                value={formData.status}
                onChange={handleSelectChange('status')}
                data={[
                  {
                    value: 'active',
                    label: 'Active - Currently being treated',
                  },
                  { value: 'chronic', label: 'Chronic - Long-term condition' },
                  { value: 'resolved', label: 'Resolved - No longer an issue' },
                  {
                    value: 'inactive',
                    label: 'Inactive - Not currently treated',
                  },
                ]}
                description="Current status of this condition"
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <DateInput
                label="Onset Date"
                placeholder="When did this condition start"
                value={formData.onsetDate ? new Date(formData.onsetDate) : null}
                onChange={handleDateChange('onsetDate')}
                firstDayOfWeek={0}
                clearable
                description="When this condition was first diagnosed"
                maxDate={new Date()} // Can't be in the future
              />
            </Grid.Col>
          </Grid>

          {/* Notes */}
          <Textarea
            label="Notes"
            placeholder="Additional information about this condition..."
            value={formData.notes}
            onChange={handleTextInputChange('notes')}
            description="Treatment notes, symptoms, or other relevant details"
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
              {editingCondition ? 'Update Condition' : 'Add Condition'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default MantineConditionForm;
