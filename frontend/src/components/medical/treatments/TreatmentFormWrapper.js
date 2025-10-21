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
  IconCalendar,
  IconFileText,
  IconNotes,
} from '@tabler/icons-react';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import SubmitButton from '../../shared/SubmitButton';
import { useFormHandlers } from '../../../hooks/useFormHandlers';
import { parseDateInput, getTodayEndOfDay, formatDateInputChange } from '../../../utils/dateUtils';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import { TagInput } from '../../common/TagInput';
import logger from '../../../services/logger';

const TreatmentFormWrapper = ({
  isOpen,
  onClose,
  title,
  editingTreatment = null,
  formData,
  onInputChange,
  onSubmit,
  conditionsOptions = [],
  conditionsLoading = false,
  practitionersOptions = [],
  practitionersLoading = false,
  isLoading = false,
}) => {
  // Tab state management
  const [activeTab, setActiveTab] = useState('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form handlers
  const {
    handleTextInputChange,
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

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit(e);
      setIsSubmitting(false);
    } catch (error) {
      logger.error('treatment_form_wrapper_error', {
        message: 'Error in TreatmentFormWrapper',
        treatmentId: editingTreatment?.id,
        error: error.message,
        component: 'TreatmentFormWrapper',
      });
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
      <FormLoadingOverlay visible={isSubmitting || isLoading} message="Saving treatment..." />

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Tabbed Content */}
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="basic" leftSection={<IconInfoCircle size={16} />}>
                Basic Info
              </Tabs.Tab>
              <Tabs.Tab value="schedule" leftSection={<IconCalendar size={16} />}>
                Schedule & Dosage
              </Tabs.Tab>
              {editingTreatment && (
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
                      label="Treatment Name"
                      value={formData.treatment_name || ''}
                      onChange={handleTextInputChange('treatment_name')}
                      placeholder="Enter treatment name"
                      required
                      description="Name of the treatment"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Treatment Type"
                      value={formData.treatment_type || ''}
                      onChange={handleTextInputChange('treatment_type')}
                      placeholder="e.g., Physical Therapy, Surgery"
                      description="Type or category of treatment"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label="Status"
                      value={formData.status || null}
                      data={[
                        { value: 'planned', label: 'Planned' },
                        { value: 'active', label: 'Active' },
                        { value: 'on-hold', label: 'On Hold' },
                        { value: 'completed', label: 'Completed' },
                        { value: 'cancelled', label: 'Cancelled' },
                      ]}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'status', value: value || '' } });
                      }}
                      placeholder="Select status"
                      description="Current treatment status"
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label="Related Condition"
                      value={formData.condition_id || null}
                      data={conditionsOptions.map(condition => ({
                        value: condition.id.toString(),
                        label: `${condition.diagnosis}${condition.severity ? ` (${condition.severity})` : ''}`,
                      }))}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'condition_id', value: value || '' } });
                      }}
                      placeholder="Select condition"
                      description="Link this treatment to a condition"
                      searchable
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                      disabled={conditionsLoading}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label="Practitioner"
                      value={formData.practitioner_id || null}
                      data={practitionersOptions.map(prac => ({
                        value: prac.id.toString(),
                        label: `${prac.name}${prac.specialty ? ` - ${prac.specialty}` : ''}`,
                      }))}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'practitioner_id', value: value || '' } });
                      }}
                      placeholder="Select practitioner"
                      description="Healthcare provider administering treatment"
                      searchable
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                      disabled={practitionersLoading}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Textarea
                      label="Description"
                      value={formData.description || ''}
                      onChange={handleTextInputChange('description')}
                      placeholder="Describe the treatment"
                      description="Brief description of the treatment"
                      rows={3}
                      minRows={2}
                      autosize
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Box>
                      <Text size="sm" fw={500} mb="xs">
                        Tags
                      </Text>
                      <Text size="xs" c="dimmed" mb="xs">
                        Add tags to categorize and organize treatments
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

            {/* Schedule & Dosage Tab */}
            <Tabs.Panel value="schedule">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInput
                      label="Start Date"
                      value={parseDateInput(formData.start_date)}
                      onChange={(date) => {
                        const formattedDate = formatDateInputChange(date);
                        onInputChange({ target: { name: 'start_date', value: formattedDate } });
                      }}
                      placeholder="Select start date"
                      description="When treatment begins"
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
                      onChange={(date) => {
                        const formattedDate = formatDateInputChange(date);
                        onInputChange({ target: { name: 'end_date', value: formattedDate } });
                      }}
                      placeholder="Select end date"
                      description="When treatment ends (if applicable)"
                      clearable
                      firstDayOfWeek={0}
                      minDate={parseDateInput(formData.start_date) || undefined}
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Dosage/Amount"
                      value={formData.dosage || ''}
                      onChange={handleTextInputChange('dosage')}
                      placeholder="e.g., 10mg, 1 session"
                      description="Amount or dosage per treatment"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Frequency"
                      value={formData.frequency || ''}
                      onChange={handleTextInputChange('frequency')}
                      placeholder="e.g., Daily, Twice weekly"
                      description="How often treatment is administered"
                    />
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Documents Tab (only when editing) */}
            {editingTreatment && (
              <Tabs.Panel value="documents">
                <Box mt="md">
                  <DocumentManagerWithProgress
                    entityType="treatment"
                    entityId={editingTreatment.id}
                    onError={(error) => {
                      logger.error('Document upload error', { error });
                    }}
                  />
                </Box>
              </Tabs.Panel>
            )}

            {/* Notes Tab */}
            <Tabs.Panel value="notes">
              <Box mt="md">
                <Textarea
                  label="Treatment Notes"
                  value={formData.notes || ''}
                  onChange={handleTextInputChange('notes')}
                  placeholder="Enter treatment notes, observations, or additional details"
                  description="Additional information about this treatment"
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
              disabled={!formData.treatment_name?.trim()}
            >
              {editingTreatment ? 'Update' : 'Create'} Treatment
            </SubmitButton>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default TreatmentFormWrapper;
