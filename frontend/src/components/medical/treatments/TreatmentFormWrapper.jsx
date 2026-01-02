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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('common');

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
      <FormLoadingOverlay visible={isSubmitting || isLoading} message={t('treatments.form.savingTreatment', 'Saving treatment...')} />

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Tabbed Content */}
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="basic" leftSection={<IconInfoCircle size={16} />}>
                {t('treatments.form.tabs.basicInfo', 'Basic Info')}
              </Tabs.Tab>
              <Tabs.Tab value="schedule" leftSection={<IconCalendar size={16} />}>
                {t('treatments.form.tabs.scheduleDosage', 'Schedule & Dosage')}
              </Tabs.Tab>
              {editingTreatment && (
                <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
                  {t('treatments.form.tabs.documents', 'Documents')}
                </Tabs.Tab>
              )}
              <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                {t('treatments.form.tabs.notes', 'Notes')}
              </Tabs.Tab>
            </Tabs.List>

            {/* Basic Info Tab */}
            <Tabs.Panel value="basic">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('treatments.form.treatmentName', 'Treatment Name')}
                      value={formData.treatment_name || ''}
                      onChange={handleTextInputChange('treatment_name')}
                      placeholder={t('treatments.form.enterTreatmentName', 'Enter treatment name')}
                      required
                      description={t('treatments.form.treatmentNameDesc', 'Name of the treatment')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('treatments.form.treatmentType', 'Treatment Type')}
                      value={formData.treatment_type || ''}
                      onChange={handleTextInputChange('treatment_type')}
                      placeholder={t('treatments.form.treatmentTypePlaceholder', 'e.g., Physical Therapy, Surgery')}
                      description={t('treatments.form.treatmentTypeDesc', 'Type or category of treatment')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('treatments.form.status', 'Status')}
                      value={formData.status || null}
                      data={[
                        { value: 'planned', label: t('treatments.form.statusPlanned', 'Planned') },
                        { value: 'active', label: t('treatments.form.statusActive', 'Active') },
                        { value: 'on-hold', label: t('treatments.form.statusOnHold', 'On Hold') },
                        { value: 'completed', label: t('treatments.form.statusCompleted', 'Completed') },
                        { value: 'cancelled', label: t('treatments.form.statusCancelled', 'Cancelled') },
                      ]}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'status', value: value || '' } });
                      }}
                      placeholder={t('treatments.form.selectStatus', 'Select status')}
                      description={t('treatments.form.statusDesc', 'Current treatment status')}
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('treatments.form.relatedCondition', 'Related Condition')}
                      value={formData.condition_id || null}
                      data={conditionsOptions.map(condition => ({
                        value: condition.id.toString(),
                        label: `${condition.diagnosis}${condition.severity ? ` (${condition.severity})` : ''}`,
                      }))}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'condition_id', value: value || '' } });
                      }}
                      placeholder={t('treatments.form.selectCondition', 'Select condition')}
                      description={t('treatments.form.relatedConditionDesc', 'Link this treatment to a condition')}
                      searchable
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                      disabled={conditionsLoading}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('treatments.form.practitioner', 'Practitioner')}
                      value={formData.practitioner_id || null}
                      data={practitionersOptions.map(prac => ({
                        value: prac.id.toString(),
                        label: `${prac.name}${prac.specialty ? ` - ${prac.specialty}` : ''}`,
                      }))}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'practitioner_id', value: value || '' } });
                      }}
                      placeholder={t('treatments.form.selectPractitioner', 'Select practitioner')}
                      description={t('treatments.form.practitionerDesc', 'Healthcare provider administering treatment')}
                      searchable
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                      disabled={practitionersLoading}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Textarea
                      label={t('treatments.form.description', 'Description')}
                      value={formData.description || ''}
                      onChange={handleTextInputChange('description')}
                      placeholder={t('treatments.form.descriptionPlaceholder', 'Describe the treatment')}
                      description={t('treatments.form.descriptionDesc', 'Brief description of the treatment')}
                      rows={3}
                      minRows={2}
                      autosize
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Box>
                      <Text size="sm" fw={500} mb="xs">
                        {t('treatments.form.tags', 'Tags')}
                      </Text>
                      <Text size="xs" c="dimmed" mb="xs">
                        {t('treatments.form.tagsDesc', 'Add tags to categorize and organize treatments')}
                      </Text>
                      <TagInput
                        value={formData.tags || []}
                        onChange={(tags) => {
                          onInputChange({ target: { name: 'tags', value: tags } });
                        }}
                        placeholder={t('treatments.form.tagsPlaceholder', 'Add tags...')}
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
                      label={t('treatments.form.startDate', 'Start Date')}
                      value={parseDateInput(formData.start_date)}
                      onChange={(date) => {
                        const formattedDate = formatDateInputChange(date);
                        onInputChange({ target: { name: 'start_date', value: formattedDate } });
                      }}
                      placeholder={t('treatments.form.selectStartDate', 'Select start date')}
                      description={t('treatments.form.startDateDesc', 'When treatment is planned to begin or began')}
                      clearable
                      firstDayOfWeek={0}
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInput
                      label={t('treatments.form.endDate', 'End Date')}
                      value={parseDateInput(formData.end_date)}
                      onChange={(date) => {
                        const formattedDate = formatDateInputChange(date);
                        onInputChange({ target: { name: 'end_date', value: formattedDate } });
                      }}
                      placeholder={t('treatments.form.selectEndDate', 'Select end date')}
                      description={t('treatments.form.endDateDesc', 'When treatment ends (if applicable)')}
                      clearable
                      firstDayOfWeek={0}
                      minDate={parseDateInput(formData.start_date) || undefined}
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('treatments.form.dosageAmount', 'Dosage/Amount')}
                      value={formData.dosage || ''}
                      onChange={handleTextInputChange('dosage')}
                      placeholder={t('treatments.form.dosagePlaceholder', 'e.g., 10mg, 1 session')}
                      description={t('treatments.form.dosageDesc', 'Amount or dosage per treatment')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('treatments.form.frequency', 'Frequency')}
                      value={formData.frequency || ''}
                      onChange={handleTextInputChange('frequency')}
                      placeholder={t('treatments.form.frequencyPlaceholder', 'e.g., Daily, Twice weekly')}
                      description={t('treatments.form.frequencyDesc', 'How often treatment is administered')}
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
                  label={t('treatments.form.treatmentNotes', 'Treatment Notes')}
                  value={formData.notes || ''}
                  onChange={handleTextInputChange('notes')}
                  placeholder={t('treatments.form.notesPlaceholder', 'Enter treatment notes, observations, or additional details')}
                  description={t('treatments.form.notesDesc', 'Additional information about this treatment')}
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
              {t('treatments.form.cancel', 'Cancel')}
            </Button>
            <SubmitButton
              loading={isLoading || isSubmitting}
              disabled={!formData.treatment_name?.trim()}
            >
              {editingTreatment ? t('treatments.form.updateTreatment', 'Update Treatment') : t('treatments.form.createTreatment', 'Create Treatment')}
            </SubmitButton>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default TreatmentFormWrapper;
