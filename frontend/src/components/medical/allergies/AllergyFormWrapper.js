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
  IconAlertTriangle,
  IconFileText,
  IconNotes,
} from '@tabler/icons-react';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import SubmitButton from '../../shared/SubmitButton';
import { useFormHandlers } from '../../../hooks/useFormHandlers';
import { parseDateInput, getTodayEndOfDay } from '../../../utils/dateUtils';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import { TagInput } from '../../common/TagInput';
import logger from '../../../services/logger';

const AllergyFormWrapper = ({
  isOpen,
  onClose,
  title,
  editingAllergy = null,
  formData,
  onInputChange,
  onSubmit,
  medicationsOptions = [],
  medicationsLoading = false,
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
      logger.error('allergy_form_wrapper_error', {
        message: 'Error in AllergyFormWrapper',
        allergyId: editingAllergy?.id,
        error: error.message,
        component: 'AllergyFormWrapper',
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
      <FormLoadingOverlay visible={isSubmitting || isLoading} message="Saving allergy..." />

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Tabbed Content */}
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="basic" leftSection={<IconInfoCircle size={16} />}>
                Basic Info
              </Tabs.Tab>
              <Tabs.Tab value="reaction" leftSection={<IconAlertTriangle size={16} />}>
                Reaction Details
              </Tabs.Tab>
              {editingAllergy && (
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
                      label="Allergen"
                      value={formData.allergen || ''}
                      onChange={handleTextInputChange('allergen')}
                      placeholder="Enter allergen name"
                      required
                      description="Name of the allergen"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label="Allergy Type"
                      value={formData.allergy_type || null}
                      data={[
                        { value: 'food', label: 'Food' },
                        { value: 'medication', label: 'Medication' },
                        { value: 'environmental', label: 'Environmental' },
                        { value: 'insect', label: 'Insect' },
                        { value: 'other', label: 'Other' },
                      ]}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'allergy_type', value: value || '' } });
                      }}
                      placeholder="Select allergy type"
                      description="Category of allergy"
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
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
                        { value: 'life-threatening', label: 'Life-threatening' },
                      ]}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'severity', value: value || '' } });
                      }}
                      placeholder="Select severity"
                      description="Severity of allergic reaction"
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
                      ]}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'status', value: value || '' } });
                      }}
                      placeholder="Select status"
                      description="Current allergy status"
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInput
                      label="Onset Date"
                      value={parseDateInput(formData.onset_date)}
                      onChange={(value) => {
                        const dateString = value ? value.toISOString().split('T')[0] : '';
                        onInputChange({ target: { name: 'onset_date', value: dateString } });
                      }}
                      placeholder="Select onset date"
                      description="When allergy was first identified"
                      clearable
                      firstDayOfWeek={0}
                      maxDate={today}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label="Related Medication"
                      value={formData.medication_id || null}
                      data={medicationsOptions.map(med => ({
                        value: med.id.toString(),
                        label: med.medication_name || med.name || `Medication #${med.id}`,
                      }))}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'medication_id', value: value || '' } });
                      }}
                      placeholder="Select medication"
                      description="Medication that causes this allergy"
                      searchable
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                      disabled={medicationsLoading}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Box>
                      <Text size="sm" fw={500} mb="xs">
                        Tags
                      </Text>
                      <Text size="xs" c="dimmed" mb="xs">
                        Add tags to categorize and organize allergies
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

            {/* Reaction Details Tab */}
            <Tabs.Panel value="reaction">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label="Reaction Type"
                      value={formData.reaction_type || null}
                      data={[
                        { value: 'skin', label: 'Skin Reaction' },
                        { value: 'respiratory', label: 'Respiratory' },
                        { value: 'gastrointestinal', label: 'Gastrointestinal' },
                        { value: 'anaphylaxis', label: 'Anaphylaxis' },
                        { value: 'other', label: 'Other' },
                      ]}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'reaction_type', value: value || '' } });
                      }}
                      placeholder="Select reaction type"
                      description="Type of allergic reaction"
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Textarea
                      label="Reaction Description"
                      value={formData.reaction || ''}
                      onChange={handleTextInputChange('reaction')}
                      placeholder="Describe the allergic reaction"
                      description="Symptoms and details of the reaction"
                      rows={4}
                      minRows={3}
                      autosize
                    />
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Documents Tab (only when editing) */}
            {editingAllergy && (
              <Tabs.Panel value="documents">
                <Box mt="md">
                  <DocumentManagerWithProgress
                    entityType="allergy"
                    entityId={editingAllergy.id}
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
                  label="Clinical Notes"
                  value={formData.notes || ''}
                  onChange={handleTextInputChange('notes')}
                  placeholder="Enter clinical notes, observations, or additional details"
                  description="Additional information about this allergy"
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
              disabled={!formData.allergen?.trim()}
            >
              {editingAllergy ? 'Update' : 'Create'} Allergy
            </SubmitButton>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default AllergyFormWrapper;
