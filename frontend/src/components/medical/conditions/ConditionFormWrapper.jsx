import React, { useState, useEffect } from 'react';
import {
  Modal,
  Tabs,
  Box,
  Stack,
  Group,
  Button,
  Grid,
  TextInput,
  Textarea,
  Select,
  Text,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconInfoCircle,
  IconStethoscope,
  IconFileText,
  IconNotes,
} from '@tabler/icons-react';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import SubmitButton from '../../shared/SubmitButton';
import { useFormHandlers } from '../../../hooks/useFormHandlers';
import { parseDateInput, getTodayEndOfDay } from '../../../utils/dateUtils';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import { TagInput } from '../../common/TagInput';

const ConditionFormWrapper = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingCondition = null,
  medications = [],
  practitioners = [],
  isLoading = false,
  statusMessage,
}) => {
  // Tab state management
  const [activeTab, setActiveTab] = useState('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use the standardized form handlers hook
  const {
    handleTextInputChange,
    handleSelectChange,
    handleDateChange,
  } = useFormHandlers(onInputChange);

  // Get today's date for date picker constraints
  const today = getTodayEndOfDay();

  // Reset tab when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('basic');
    }
    if (!isOpen) {
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Convert medications to options
  const medicationOptions = medications.map(med => ({
    value: med.id.toString(),
    label: med.medication_name || med.name || `Medication #${med.id}`,
  }));

  // Convert practitioners to options
  const practitionerOptions = practitioners.map(prac => ({
    value: prac.id.toString(),
    label: prac.name || `Dr. ${prac.first_name || ''} ${prac.last_name || ''}`.trim() || `Practitioner #${prac.id}`,
  }));

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit(e);
      setIsSubmitting(false);
    } catch (error) {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={title}
      size="xl"
      centered
      zIndex={2000}
      closeOnClickOutside={!isLoading}
      closeOnEscape={!isLoading}
    >
      <FormLoadingOverlay visible={isSubmitting || isLoading} message={statusMessage || "Saving condition..."} />

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Tabbed Content */}
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="basic" leftSection={<IconInfoCircle size={16} />}>
                Basic Info
              </Tabs.Tab>
              <Tabs.Tab value="clinical" leftSection={<IconStethoscope size={16} />}>
                Clinical Details
              </Tabs.Tab>
              {editingCondition && (
                <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
                  Documents
                </Tabs.Tab>
              )}
              <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                Notes
              </Tabs.Tab>
            </Tabs.List>

            {/* Basic Info Tab */}
            <Tabs.Panel value="basic">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Diagnosis"
                      value={formData.diagnosis || ''}
                      onChange={handleTextInputChange('diagnosis')}
                      placeholder="Enter diagnosis"
                      required
                      description="Primary diagnosis or condition"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Condition Name"
                      value={formData.condition_name || ''}
                      onChange={handleTextInputChange('condition_name')}
                      placeholder="Enter condition name"
                      description="Optional alternative name"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label="Severity"
                      value={formData.severity || null}
                      data={[
                        { value: 'mild', label: 'Mild' },
                        { value: 'moderate', label: 'Moderate' },
                        { value: 'severe', label: 'Severe' },
                        { value: 'critical', label: 'Critical' },
                      ]}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'severity', value: value || '' } });
                      }}
                      placeholder="Select severity"
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label="Status"
                      value={formData.status || null}
                      data={[
                        { value: 'active', label: 'Active' },
                        { value: 'inactive', label: 'Inactive' },
                        { value: 'resolved', label: 'Resolved' },
                        { value: 'chronic', label: 'Chronic' },
                      ]}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'status', value: value || '' } });
                      }}
                      placeholder="Select status"
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInput
                      label="Onset Date"
                      value={parseDateInput(formData.onset_date)}
                      onChange={handleDateChange('onset_date')}
                      placeholder="Select onset date"
                      description="When the condition started"
                      clearable
                      firstDayOfWeek={0}
                      maxDate={today}
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInput
                      label="End Date"
                      value={parseDateInput(formData.end_date)}
                      onChange={handleDateChange('end_date')}
                      placeholder="Select end date"
                      description="When the condition ended (if applicable)"
                      clearable
                      firstDayOfWeek={0}
                      minDate={parseDateInput(formData.onset_date) || undefined}
                      maxDate={today}
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label="Related Medication"
                      value={formData.medication_id || null}
                      data={medicationOptions}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'medication_id', value: value || '' } });
                      }}
                      placeholder="Select medication"
                      description="Link this condition to a medication"
                      searchable
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label="Practitioner"
                      value={formData.practitioner_id || null}
                      data={practitionerOptions}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'practitioner_id', value: value || '' } });
                      }}
                      placeholder="Select practitioner"
                      description="Associated healthcare provider"
                      searchable
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Box>
                      <Text size="sm" fw={500} mb="xs">
                        Tags
                      </Text>
                      <Text size="xs" c="dimmed" mb="xs">
                        Add tags to categorize and organize conditions
                      </Text>
                      <TagInput
                        value={formData.tags || []}
                        onChange={(tags) => {
                          onInputChange({ target: { name: 'tags', value: tags } });
                        }}
                        placeholder="Add tags..."
                      />
                    </Box>
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Clinical Details Tab */}
            <Tabs.Panel value="clinical">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="ICD-10 Code"
                      value={formData.icd10_code || ''}
                      onChange={handleTextInputChange('icd10_code')}
                      placeholder="e.g., E11.9"
                      description="International Classification of Diseases code"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="SNOMED Code"
                      value={formData.snomed_code || ''}
                      onChange={handleTextInputChange('snomed_code')}
                      placeholder="e.g., 44054006"
                      description="SNOMED CT code"
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <TextInput
                      label="Code Description"
                      value={formData.code_description || ''}
                      onChange={handleTextInputChange('code_description')}
                      placeholder="Description of the medical code"
                      description="Human-readable description of the medical codes"
                    />
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Documents Tab (only when editing) */}
            {editingCondition && (
              <Tabs.Panel value="documents">
                <Box mt="md">
                  <DocumentManagerWithProgress
                    entityType="condition"
                    entityId={editingCondition.id}
                    onError={(error) => {
                      // Error handling can be passed up through onError prop if needed
                    }}
                  />
                </Box>
              </Tabs.Panel>
            )}

            {/* Notes Tab */}
            <Tabs.Panel value="notes">
              <Box mt="md">
                <Textarea
                  label="Clinical Notes"
                  value={formData.notes || ''}
                  onChange={handleTextInputChange('notes')}
                  placeholder="Enter clinical notes, observations, or additional details"
                  description="Additional information about this condition"
                  rows={5}
                  minRows={3}
                  autosize
                />
              </Box>
            </Tabs.Panel>
          </Tabs>

          {/* Form Actions */}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={onClose} disabled={isLoading || isSubmitting}>
              Cancel
            </Button>
            <SubmitButton
              loading={isLoading || isSubmitting}
              disabled={!formData.diagnosis?.trim()}
            >
              {editingCondition ? 'Update' : 'Create'} Condition
            </SubmitButton>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default ConditionFormWrapper;