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
  Divider,
  Badge,
  Title,
  Paper,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import ConditionRelationships from './ConditionRelationships';
import { useFormHandlers } from '../../hooks/useFormHandlers';

const MantineLabResultForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  practitioners = [],
  editingLabResult = null,
  children, // For file management section in edit mode
  // Condition relationship props
  conditions = [],
  labResultConditions = {},
  fetchLabResultConditions,
  navigate,
}) => {
  // Status options with visual indicators
  const statusOptions = [
    { value: 'ordered', label: 'Ordered - Test has been requested' },
    { value: 'in-progress', label: 'In Progress - Sample being processed' },
    { value: 'completed', label: 'Completed - Results available' },
    { value: 'cancelled', label: 'Cancelled - Test was cancelled' },
  ];

  // Test category options
  const categoryOptions = [
    { value: 'blood work', label: 'Blood Work' },
    { value: 'imaging', label: 'Imaging (X-ray, MRI, CT)' },
    { value: 'pathology', label: 'Pathology' },
    { value: 'microbiology', label: 'Microbiology' },
    { value: 'chemistry', label: 'Chemistry' },
    { value: 'hematology', label: 'Hematology' },
    { value: 'immunology', label: 'Immunology' },
    { value: 'genetics', label: 'Genetics' },
    { value: 'cardiology', label: 'Cardiology' },
    { value: 'pulmonology', label: 'Pulmonology' },
    { value: 'other', label: 'Other' },
  ];

  // Test type options with urgency levels
  const testTypeOptions = [
    { value: 'routine', label: 'Routine - Standard processing' },
    { value: 'urgent', label: 'Urgent - Expedited processing' },
    { value: 'emergency', label: 'Emergency - Critical priority' },
    { value: 'follow-up', label: 'Follow-up - Repeat testing' },
    { value: 'screening', label: 'Screening - Preventive testing' },
  ];

  // Lab result options with color coding
  const labResultOptions = [
    {
      value: 'normal',
      label: 'Normal - Within reference range',
      color: 'green',
    },
    {
      value: 'abnormal',
      label: 'Abnormal - Outside reference range',
      color: 'red',
    },
    {
      value: 'critical',
      label: 'Critical - Requires immediate attention',
      color: 'red',
    },
    { value: 'high', label: 'High - Above normal range', color: 'orange' },
    { value: 'low', label: 'Low - Below normal range', color: 'orange' },
    {
      value: 'borderline',
      label: 'Borderline - Near threshold',
      color: 'yellow',
    },
    {
      value: 'inconclusive',
      label: 'Inconclusive - Needs repeat',
      color: 'gray',
    },
  ];

  // Convert practitioners to Mantine format
  const practitionerOptions = [
    { value: '', label: 'Select practitioner' },
    ...practitioners.map(practitioner => ({
      value: String(practitioner.id),
      label: `${practitioner.name} - ${practitioner.specialty}`,
    })),
  ];

  const { handleTextInputChange, handleSelectChange, handleDateChange } = useFormHandlers(onInputChange);

  const handleSubmit = e => {
    e.preventDefault();
    onSubmit(e);
  };

  // Get status color
  const getStatusColor = status => {
    switch (status) {
      case 'ordered':
        return 'blue';
      case 'in-progress':
        return 'yellow';
      case 'completed':
        return 'green';
      case 'cancelled':
        return 'red';
      default:
        return 'gray';
    }
  };

  // Get result badge
  const getResultBadge = result => {
    const option = labResultOptions.find(opt => opt.value === result);
    if (!option) return null;
    return (
      <Badge color={option.color} variant="light" size="sm">
        {option.value.charAt(0).toUpperCase() + option.value.slice(1)}
      </Badge>
    );
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
    >
      <form onSubmit={handleSubmit}>
        <Stack spacing="md">
          {/* Test Information */}
          <Grid>
            <Grid.Col span={8}>
              <TextInput
                label="Test Name"
                placeholder="e.g., Complete Blood Count (CBC)"
                value={formData.test_name || ''}
                onChange={handleTextInputChange('test_name')}
                required
                withAsterisk
                description="Name or description of the laboratory test"
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                label="Test Code"
                placeholder="e.g., CBC, 85025"
                value={formData.test_code || ''}
                onChange={handleTextInputChange('test_code')}
                description="Lab code or LOINC"
              />
            </Grid.Col>
          </Grid>

          {/* Category and Type */}
          <Grid>
            <Grid.Col span={6}>
              <Select
                label="Test Category"
                placeholder="Select category"
                value={formData.test_category || ''}
                onChange={handleSelectChange('test_category')}
                data={categoryOptions}
                description="Type of laboratory test"
                searchable
                clearable
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Test Type"
                placeholder="Select urgency level"
                value={formData.test_type || ''}
                onChange={handleSelectChange('test_type')}
                data={testTypeOptions}
                description="Priority or urgency of the test"
                clearable
              />
            </Grid.Col>
          </Grid>

          <Divider label="Test Details" labelPosition="center" />

          {/* Facility and Practitioner */}
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Testing Facility"
                placeholder="e.g., Main Hospital Laboratory"
                value={formData.facility || ''}
                onChange={handleTextInputChange('facility')}
                description="Where the test is/was performed"
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Ordering Practitioner"
                placeholder="Select practitioner"
                value={
                  formData.practitioner_id
                    ? String(formData.practitioner_id)
                    : ''
                }
                onChange={handleSelectChange('practitioner_id')}
                data={practitionerOptions}
                description="Doctor who ordered the test"
                searchable
                clearable
              />
            </Grid.Col>
          </Grid>

          {/* Status and Result */}
          <Grid>
            <Grid.Col span={6}>
              <div>
                <Select
                  label="Test Status"
                  placeholder="Select status"
                  value={formData.status || 'ordered'}
                  onChange={handleSelectChange('status')}
                  data={statusOptions}
                  description="Current status of the lab test"
                />
                {formData.status && (
                  <div style={{ marginTop: '8px' }}>
                    <Badge
                      color={getStatusColor(formData.status)}
                      variant="light"
                      size="sm"
                    >
                      {formData.status.charAt(0).toUpperCase() +
                        formData.status.slice(1)}
                    </Badge>
                  </div>
                )}
              </div>
            </Grid.Col>
            <Grid.Col span={6}>
              <div>
                <Select
                  label="Lab Result"
                  placeholder="Select result (if available)"
                  value={formData.labs_result || ''}
                  onChange={handleSelectChange('labs_result')}
                  data={labResultOptions}
                  description="Test result classification"
                  clearable
                />
                {formData.labs_result && (
                  <div style={{ marginTop: '8px' }}>
                    {getResultBadge(formData.labs_result)}
                  </div>
                )}
              </div>
            </Grid.Col>
          </Grid>

          {/* Dates */}
          <Grid>
            <Grid.Col span={6}>
              <DateInput
                label="Ordered Date"
                placeholder="When test was ordered"
                value={
                  formData.ordered_date ? new Date(formData.ordered_date) : null
                }
                onChange={handleDateChange('ordered_date')}
                firstDayOfWeek={0}
                description="Date the test was requested"
                clearable
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <DateInput
                label="Completed Date"
                placeholder="When results were available"
                value={
                  formData.completed_date
                    ? new Date(formData.completed_date)
                    : null
                }
                onChange={handleDateChange('completed_date')}
                firstDayOfWeek={0}
                description="Date the results were finalized"
                clearable
              />
            </Grid.Col>
          </Grid>

          {/* Notes */}
          <Textarea
            label="Additional Notes"
            placeholder="Any additional information about the test, special instructions, or observations..."
            value={formData.notes || ''}
            onChange={handleTextInputChange('notes')}
            description="Clinical notes or special instructions"
            minRows={3}
            maxRows={6}
          />

          {/* Condition Relationships Section for Edit Mode */}
          {editingLabResult && conditions.length > 0 && (
            <>
              <Divider label="Related Conditions" labelPosition="center" mt="lg" />
              <Paper withBorder p="md" bg="gray.0">
                <Stack gap="md">
                  <Title order={5}>Link Medical Conditions</Title>
                  <Text size="sm" c="dimmed">
                    Associate this lab result with relevant medical conditions for better tracking and organization.
                  </Text>
                  <ConditionRelationships 
                    labResultId={editingLabResult.id}
                    labResultConditions={labResultConditions}
                    conditions={conditions}
                    fetchLabResultConditions={fetchLabResultConditions}
                    navigate={navigate}
                  />
                </Stack>
              </Paper>
            </>
          )}

          {/* File Management Section (passed as children for edit mode) */}
          {children}

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
              {editingLabResult ? 'Update Lab Result' : 'Add Lab Result'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default MantineLabResultForm;
