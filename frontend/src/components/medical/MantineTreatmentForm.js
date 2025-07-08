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
  Badge,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';

const MantineTreatmentForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingTreatment = null,
  conditionsOptions = [], // Dropdown conditions data
  conditionsLoading = false, // Loading state for conditions
  practitionersOptions = [], // Dropdown practitioners data
  practitionersLoading = false, // Loading state for practitioners
}) => {
  // Treatment status options with workflow indicators
  const statusOptions = [
    { value: 'planned', label: 'Planned - Treatment scheduled for future' },
    { value: 'active', label: 'Active - Currently undergoing treatment' },
    { value: 'on-hold', label: 'On Hold - Temporarily paused' },
    {
      value: 'completed',
      label: 'Completed - Treatment finished successfully',
    },
    { value: 'cancelled', label: 'Cancelled - Treatment discontinued' },
  ];

  // Treatment type options with medical categories
  const treatmentTypeOptions = [
    { value: 'Surgery', label: 'Surgery - Surgical procedure' },
    { value: 'Medication', label: 'Medication - Drug therapy' },
    {
      value: 'Physical Therapy',
      label: 'Physical Therapy - Rehabilitation',
    },
    { value: 'Chemotherapy', label: 'Chemotherapy - Cancer treatment' },
    { value: 'Radiation', label: 'Radiation - Radiation therapy' },
    {
      value: 'Immunotherapy',
      label: 'Immunotherapy - Immune system treatment',
    },
    {
      value: 'Occupational Therapy',
      label: 'Occupational Therapy - Functional improvement',
    },
    {
      value: 'Speech Therapy',
      label: 'Speech Therapy - Communication improvement',
    },
    {
      value: 'Behavioral Therapy',
      label: 'Behavioral Therapy - Mental health treatment',
    },
    { value: 'Dialysis', label: 'Dialysis - Kidney function support' },
    { value: 'Other', label: 'Other - Specify in description' },
  ];

  // Frequency options for treatment scheduling
  const frequencyOptions = [
    { value: 'Once daily', label: 'Once daily' },
    { value: 'Twice daily', label: 'Twice daily (BID)' },
    { value: 'Three times daily', label: 'Three times daily (TID)' },
    { value: 'Four times daily', label: 'Four times daily (QID)' },
    { value: 'Weekly', label: 'Weekly' },
    { value: 'Bi-weekly', label: 'Bi-weekly (every 2 weeks)' },
    { value: 'Monthly', label: 'Monthly' },
    { value: 'As needed', label: 'As needed (PRN)' },
    { value: 'One time', label: 'One time only' },
    { value: 'Continuous', label: 'Continuous/ongoing' },
  ];

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

  // Get status color for visual feedback
  const getStatusColor = status => {
    switch (status) {
      case 'planned':
        return 'blue';
      case 'active':
        return 'green';
      case 'on-hold':
        return 'yellow';
      case 'completed':
        return 'teal';
      case 'cancelled':
        return 'red';
      default:
        return 'gray';
    }
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
          {/* Treatment Name and Type */}
          <Grid>
            <Grid.Col span={7}>
              <TextInput
                label="Treatment Name"
                placeholder="e.g., Physical Therapy for Lower Back Pain"
                value={formData.treatment_name || ''}
                onChange={handleTextInputChange('treatment_name')}
                required
                withAsterisk
                description="Specific name or description of the treatment"
              />
            </Grid.Col>
            <Grid.Col span={5}>
              <Select
                label="Treatment Type"
                placeholder="Select type"
                value={formData.treatment_type || ''}
                onChange={handleSelectChange('treatment_type')}
                data={treatmentTypeOptions}
                description="Category of treatment"
                searchable
                required
                withAsterisk
              />
            </Grid.Col>
          </Grid>

          {/* Related Condition and Practitioner Selection */}
          <Grid>
            <Grid.Col span={6}>
              <Select
                label="Related Condition"
                placeholder={
                  conditionsLoading
                    ? 'Loading conditions...'
                    : 'Select condition (optional)'
                }
                value={
                  formData.condition_id ? String(formData.condition_id) : ''
                }
                onChange={handleSelectChange('condition_id')}
                data={conditionsOptions.map(condition => ({
                  value: String(condition.id),
                  label: `${condition.diagnosis}${condition.severity ? ` (${condition.severity})` : ''}${condition.status ? ` - ${condition.status}` : ''}`,
                }))}
                description="Link this treatment to a specific medical condition"
                searchable
                clearable
                disabled={conditionsLoading}
                nothingFound={
                  conditionsLoading ? 'Loading...' : 'No conditions found'
                }
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Practitioner"
                placeholder={
                  practitionersLoading
                    ? 'Loading practitioners...'
                    : 'Select practitioner (optional)'
                }
                value={
                  formData.practitioner_id
                    ? String(formData.practitioner_id)
                    : ''
                }
                onChange={handleSelectChange('practitioner_id')}
                data={practitionersOptions.map(practitioner => ({
                  value: String(practitioner.id),
                  label: `${practitioner.name}${practitioner.specialty ? ` - ${practitioner.specialty}` : ''}${practitioner.practice ? ` (${practitioner.practice})` : ''}`,
                }))}
                description="Assign a practitioner to this treatment"
                searchable
                clearable
                disabled={practitionersLoading}
                nothingFound={
                  practitionersLoading ? 'Loading...' : 'No practitioners found'
                }
              />
            </Grid.Col>
          </Grid>

          {/* Status with Visual Indicator */}
          <div>
            <Select
              label="Treatment Status"
              placeholder="Select status"
              value={formData.status || 'planned'}
              onChange={handleSelectChange('status')}
              data={statusOptions}
              description="Current stage in treatment workflow"
            />
            {formData.status && (
              <div style={{ marginTop: '8px' }}>
                <Badge
                  color={getStatusColor(formData.status)}
                  variant="light"
                  size="sm"
                >
                  {statusOptions
                    .find(opt => opt.value === formData.status)
                    ?.label.split(' - ')[0] || formData.status}
                </Badge>
              </div>
            )}
          </div>

          {/* Start Date and End Date */}
          <Grid>
            <Grid.Col span={6}>
              <DateInput
                label="Start Date"
                placeholder="Select start date"
                value={
                  formData.start_date ? new Date(formData.start_date) : null
                }
                onChange={handleDateChange('start_date')}
                firstDayOfWeek={0}
                required
                withAsterisk
                description="When treatment begins/began"
                clearable
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <DateInput
                label="End Date"
                placeholder="Select end date (if known)"
                value={formData.end_date ? new Date(formData.end_date) : null}
                onChange={handleDateChange('end_date')}
                firstDayOfWeek={0}
                description="Expected or actual completion date"
                clearable
              />
            </Grid.Col>
          </Grid>

          {/* Dosage and Frequency */}
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Amount"
                placeholder="e.g., 500mg, 2 tablets, 30 minutes"
                value={formData.dosage || ''}
                onChange={handleTextInputChange('dosage')}
                description="Amount or intensity per session"
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Frequency"
                placeholder="Select frequency"
                value={formData.frequency || ''}
                onChange={handleSelectChange('frequency')}
                data={frequencyOptions}
                description="How often treatment occurs"
                searchable
                clearable
              />
            </Grid.Col>
          </Grid>

          {/* Treatment Description */}
          <Textarea
            label="Treatment Description"
            placeholder="Detailed description of the treatment plan..."
            value={formData.description || ''}
            onChange={handleTextInputChange('description')}
            description="Comprehensive details about the treatment approach"
            minRows={3}
            maxRows={5}
          />

          {/* Additional Notes */}
          <Textarea
            label="Additional Notes"
            placeholder="Progress notes, side effects, adjustments, outcomes..."
            value={formData.notes || ''}
            onChange={handleTextInputChange('notes')}
            description="Progress updates, observations, or important notes"
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
              {editingTreatment ? 'Update Treatment' : 'Add Treatment'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default MantineTreatmentForm;
