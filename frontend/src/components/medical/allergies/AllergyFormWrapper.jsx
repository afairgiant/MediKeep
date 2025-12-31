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
import { useTranslation } from 'react-i18next';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import SubmitButton from '../../shared/SubmitButton';
import { useFormHandlers } from '../../../hooks/useFormHandlers';
import { parseDateInput, getTodayEndOfDay, formatDateInputChange } from '../../../utils/dateUtils';
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
  // Translation hooks
  const { t } = useTranslation('medical');
  const { t: tCommon } = useTranslation('common');

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
      <FormLoadingOverlay visible={isSubmitting || isLoading} message={t('allergies.messages.saving')} />

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Tabbed Content */}
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="basic" leftSection={<IconInfoCircle size={16} />}>
                {t('allergies.tabs.basicInfo')}
              </Tabs.Tab>
              <Tabs.Tab value="reaction" leftSection={<IconAlertTriangle size={16} />}>
                {t('allergies.tabs.reactionDetails')}
              </Tabs.Tab>
              {editingAllergy && (
                <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
                  {t('allergies.tabs.documents')}
                </Tabs.Tab>
              )}
              <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                {t('allergies.tabs.notes')}
              </Tabs.Tab>
            </Tabs.List>

            {/* Basic Info Tab */}
            <Tabs.Panel value="basic">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('allergies.allergen.label')}
                      value={formData.allergen || ''}
                      onChange={handleTextInputChange('allergen')}
                      placeholder={t('allergies.allergen.placeholder')}
                      required
                      description={t('allergies.allergen.description')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('allergies.allergyType.label')}
                      value={formData.allergy_type || null}
                      data={[
                        { value: 'food', label: t('allergies.allergyType.options.food') },
                        { value: 'medication', label: t('allergies.allergyType.options.medication') },
                        { value: 'environmental', label: t('allergies.allergyType.options.environmental') },
                        { value: 'insect', label: t('allergies.allergyType.options.insect') },
                        { value: 'other', label: t('allergies.allergyType.options.other') },
                      ]}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'allergy_type', value: value || '' } });
                      }}
                      placeholder={t('allergies.allergyType.placeholder')}
                      description={t('allergies.allergyType.description')}
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('common.fields.severity.label')}
                      value={formData.severity || null}
                      data={[
                        { value: 'mild', label: t('common.severity.mild') },
                        { value: 'moderate', label: t('common.severity.moderate') },
                        { value: 'severe', label: t('common.severity.severe') },
                        { value: 'life-threatening', label: t('common.severity.lifeThreatening') },
                      ]}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'severity', value: value || '' } });
                      }}
                      placeholder={t('common.fields.severity.placeholder')}
                      description={t('allergies.severity.description')}
                      withAsterisk
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('common.fields.status.label')}
                      value={formData.status || null}
                      data={[
                        { value: 'active', label: t('common.status.active') },
                        { value: 'inactive', label: t('common.status.inactive') },
                        { value: 'resolved', label: t('common.status.resolved') },
                      ]}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'status', value: value || '' } });
                      }}
                      placeholder={t('common.fields.status.placeholder')}
                      description={t('allergies.status.description')}
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInput
                      label={t('allergies.onsetDate.label')}
                      value={parseDateInput(formData.onset_date)}
                      onChange={(date) => {
                        const formattedDate = formatDateInputChange(date);
                        onInputChange({ target: { name: 'onset_date', value: formattedDate } });
                      }}
                      placeholder={t('allergies.onsetDate.placeholder')}
                      description={t('allergies.onsetDate.description')}
                      clearable
                      firstDayOfWeek={0}
                      maxDate={today}
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('allergies.relatedMedication.label')}
                      value={formData.medication_id || null}
                      data={medicationsOptions.map(med => ({
                        value: med.id.toString(),
                        label: med.medication_name || med.name || `Medication #${med.id}`,
                      }))}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'medication_id', value: value || '' } });
                      }}
                      placeholder={t('allergies.relatedMedication.placeholder')}
                      description={t('allergies.relatedMedication.description')}
                      searchable
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                      disabled={medicationsLoading}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Box>
                      <Text size="sm" fw={500} mb="xs">
                        {t('common.fields.tags.label')}
                      </Text>
                      <Text size="xs" c="dimmed" mb="xs">
                        {t('common.fields.tags.description')}
                      </Text>
                      <TagInput
                        value={formData.tags || []}
                        onChange={(tags) => {
                          onInputChange({ target: { name: 'tags', value: tags } });
                        }}
                        placeholder={t('common.fields.tags.placeholder')}
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
                      label={t('allergies.reactionType.label')}
                      value={formData.reaction_type || null}
                      data={[
                        { value: 'skin', label: t('allergies.reactionType.options.skin') },
                        { value: 'respiratory', label: t('allergies.reactionType.options.respiratory') },
                        { value: 'gastrointestinal', label: t('allergies.reactionType.options.gastrointestinal') },
                        { value: 'anaphylaxis', label: t('allergies.reactionType.options.anaphylaxis') },
                        { value: 'other', label: t('allergies.reactionType.options.other') },
                      ]}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'reaction_type', value: value || '' } });
                      }}
                      placeholder={t('allergies.reactionType.placeholder')}
                      description={t('allergies.reactionType.description')}
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Textarea
                      label={t('allergies.reaction.label')}
                      value={formData.reaction || ''}
                      onChange={handleTextInputChange('reaction')}
                      placeholder={t('allergies.reaction.placeholder')}
                      description={t('allergies.reaction.description')}
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
                  label={t('common.fields.notes.label')}
                  value={formData.notes || ''}
                  onChange={handleTextInputChange('notes')}
                  placeholder={t('common.fields.notes.placeholder')}
                  description={t('common.fields.notes.description')}
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
              {tCommon('buttons.cancel')}
            </Button>
            <SubmitButton
              loading={isLoading || isSubmitting}
              disabled={!formData.allergen?.trim()}
            >
              {editingAllergy ? tCommon('buttons.update') : tCommon('buttons.create')} {t('allergies.title')}
            </SubmitButton>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default AllergyFormWrapper;
