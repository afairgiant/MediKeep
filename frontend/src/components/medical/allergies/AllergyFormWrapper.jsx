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
import { useDateFormat } from '../../../hooks/useDateFormat';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import SubmitButton from '../../shared/SubmitButton';
import { useFormHandlers } from '../../../hooks/useFormHandlers';
import {
  parseDateInput,
  getTodayEndOfDay,
  formatDateInputChange,
} from '../../../utils/dateUtils';
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
  statusMessage,
  onDocumentManagerRef,
  onFileUploadComplete,
  onError,
}) => {
  // Translation hooks
  const { t } = useTranslation(['medical', 'common', 'shared']);
  const { dateInputFormat } = useDateFormat();

  // Tab state management
  const [activeTab, setActiveTab] = useState('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form handlers
  const { handleTextInputChange } = useFormHandlers(onInputChange);

  // Get today's date for date picker constraints
  const today = getTodayEndOfDay();

  const handleDocumentManagerRef = methods => {
    if (onDocumentManagerRef) {
      onDocumentManagerRef(methods);
    }
  };

  const handleDocumentError = error => {
    logger.error('document_manager_error', {
      message: `Document manager error in allergies ${editingAllergy ? 'edit' : 'create'}`,
      allergyId: editingAllergy?.id,
      error: error,
      component: 'AllergyFormWrapper',
    });

    if (onError) {
      onError(error);
    }
  };

  const handleDocumentUploadComplete = (
    success,
    completedCount,
    failedCount
  ) => {
    logger.info('allergies_upload_completed', {
      message: 'File upload completed in allergies form',
      allergyId: editingAllergy?.id,
      success,
      completedCount,
      failedCount,
      component: 'AllergyFormWrapper',
    });

    if (onFileUploadComplete) {
      onFileUploadComplete(success, completedCount, failedCount);
    }
  };

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
  const handleSubmit = async e => {
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
      <FormLoadingOverlay
        visible={isSubmitting || isLoading}
        message={statusMessage?.title || t('allergies.messages.saving')}
        submessage={statusMessage?.message}
        type={statusMessage?.type || 'loading'}
      />

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Tabbed Content */}
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab
                value="basic"
                leftSection={<IconInfoCircle size={16} />}
              >
                {t('shared:tabs.basicInfo')}
              </Tabs.Tab>
              <Tabs.Tab
                value="reaction"
                leftSection={<IconAlertTriangle size={16} />}
              >
                {t('allergies.tabs.reactionDetails')}
              </Tabs.Tab>
              <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                {t('shared:tabs.notes')}
              </Tabs.Tab>
              <Tabs.Tab
                value="documents"
                leftSection={<IconFileText size={16} />}
              >
                {editingAllergy
                  ? t('shared:tabs.documents', 'Documents')
                  : t('shared:tabs.addFiles', 'Add Files')}
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
                        {
                          value: 'food',
                          label: t('allergies.allergyType.options.food'),
                        },
                        {
                          value: 'medication',
                          label: t('allergies.allergyType.options.medication'),
                        },
                        {
                          value: 'environmental',
                          label: t(
                            'allergies.allergyType.options.environmental'
                          ),
                        },
                        {
                          value: 'insect',
                          label: t('allergies.allergyType.options.insect'),
                        },
                        { value: 'other', label: t('shared:fields.other') },
                      ]}
                      onChange={value => {
                        onInputChange({
                          target: { name: 'allergy_type', value: value || '' },
                        });
                      }}
                      placeholder={t('allergies.allergyType.placeholder')}
                      description={t('allergies.allergyType.description')}
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('shared:fields.severity')}
                      value={formData.severity || null}
                      data={[
                        { value: 'mild', label: t('common:severity.mild') },
                        {
                          value: 'moderate',
                          label: t('common:severity.moderate'),
                        },
                        { value: 'severe', label: t('common:severity.severe') },
                        {
                          value: 'life-threatening',
                          label: t('common:severity.lifeThreatening'),
                        },
                      ]}
                      onChange={value => {
                        onInputChange({
                          target: { name: 'severity', value: value || '' },
                        });
                      }}
                      placeholder={t('shared:labels.selectSeverityLevel')}
                      description={t('allergies.severity.description')}
                      withAsterisk
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('shared:fields.status')}
                      value={formData.status || null}
                      data={[
                        { value: 'active', label: t('shared:labels.active') },
                        {
                          value: 'inactive',
                          label: t('shared:labels.inactive'),
                        },
                        {
                          value: 'resolved',
                          label: t('shared:labels.resolved'),
                        },
                      ]}
                      onChange={value => {
                        onInputChange({
                          target: { name: 'status', value: value || '' },
                        });
                      }}
                      placeholder={t('shared:fields.selectStatus')}
                      description={t('allergies.status.description')}
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInput
                      label={t('shared:fields.onsetDate')}
                      value={parseDateInput(formData.onset_date)}
                      onChange={date => {
                        const formattedDate = formatDateInputChange(date);
                        onInputChange({
                          target: { name: 'onset_date', value: formattedDate },
                        });
                      }}
                      placeholder={dateInputFormat}
                      valueFormat={dateInputFormat}
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
                        label:
                          med.medication_name ||
                          med.name ||
                          `Medication #${med.id}`,
                      }))}
                      onChange={value => {
                        onInputChange({
                          target: { name: 'medication_id', value: value || '' },
                        });
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
                        {t('shared:labels.tags')}
                      </Text>
                      <Text size="xs" c="dimmed" mb="xs">
                        {t('common:fields.tags.description')}
                      </Text>
                      <TagInput
                        value={formData.tags || []}
                        onChange={tags => {
                          onInputChange({
                            target: { name: 'tags', value: tags },
                          });
                        }}
                        placeholder={t('common:fields.tags.placeholder')}
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
                        {
                          value: 'skin',
                          label: t('allergies.reactionType.options.skin'),
                        },
                        {
                          value: 'respiratory',
                          label: t(
                            'allergies.reactionType.options.respiratory'
                          ),
                        },
                        {
                          value: 'gastrointestinal',
                          label: t(
                            'allergies.reactionType.options.gastrointestinal'
                          ),
                        },
                        {
                          value: 'anaphylaxis',
                          label: t(
                            'allergies.reactionType.options.anaphylaxis'
                          ),
                        },
                        { value: 'other', label: t('shared:fields.other') },
                      ]}
                      onChange={value => {
                        onInputChange({
                          target: { name: 'reaction_type', value: value || '' },
                        });
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

            {/* Notes Tab */}
            <Tabs.Panel value="notes">
              <Box mt="md">
                <Textarea
                  label={t('shared:tabs.notes')}
                  value={formData.notes || ''}
                  onChange={handleTextInputChange('notes')}
                  placeholder={t('common:fields.notes.placeholder')}
                  description={t('common:fields.notes.description')}
                  rows={5}
                  minRows={3}
                  autosize
                />
              </Box>
            </Tabs.Panel>

            {/* Documents Tab */}
            <Tabs.Panel value="documents">
              <Box mt="md">
                <DocumentManagerWithProgress
                  entityType="allergy"
                  entityId={editingAllergy?.id || null}
                  mode={editingAllergy ? 'edit' : 'create'}
                  onUploadPendingFiles={handleDocumentManagerRef}
                  showProgressModal={true}
                  onUploadComplete={handleDocumentUploadComplete}
                  onError={handleDocumentError}
                />
              </Box>
            </Tabs.Panel>
          </Tabs>

          {/* Form Actions */}
          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              onClick={onClose}
              disabled={isLoading || isSubmitting}
            >
              {t('shared:fields.cancel')}
            </Button>
            <SubmitButton
              loading={isLoading || isSubmitting}
              disabled={!formData.allergen?.trim()}
            >
              {editingAllergy
                ? t('common:buttons.update')
                : t('common:buttons.create')}{' '}
              {t('shared:categories.allergies')}
            </SubmitButton>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default AllergyFormWrapper;
