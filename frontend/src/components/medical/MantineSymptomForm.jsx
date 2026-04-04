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
  Checkbox,
  Text,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconInfoCircle, IconClipboard, IconFileText, IconNotes } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useDateFormat } from '../../hooks/useDateFormat';
import FormLoadingOverlay from '../shared/FormLoadingOverlay';
import SubmitButton from '../shared/SubmitButton';
import { useFormHandlers } from '../../hooks/useFormHandlers';
import { parseDateInput, getTodayEndOfDay, formatDateInputChange } from '../../utils/dateUtils';
import DocumentManagerWithProgress from '../shared/DocumentManagerWithProgress';
import { TagInput } from '../common/TagInput';
import logger from '../../services/logger';

/**
 * Form for creating/editing a symptom definition (parent record).
 * Uses a tabbed layout with document support, matching the AllergyFormWrapper pattern.
 *
 * Usage:
 *   <MantineSymptomForm
 *     isOpen={showForm}
 *     onClose={handleClose}
 *     title="Add New Symptom"
 *     formData={symptomFormData}
 *     onInputChange={handleInputChange}
 *     onSubmit={handleSubmit}
 *     editingSymptom={null}
 *     isLoading={isBlocking}
 *     statusMessage={statusMessage}
 *     onDocumentManagerRef={setDocumentManagerMethods}
 *     onFileUploadComplete={(success) => { if (success) fetchSymptoms(); }}
 *     onError={(error) => logger.error('symptom_document_error', { error })}
 *   />
 */
const MantineSymptomForm = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingSymptom = null,
  isLoading = false,
  statusMessage,
  onDocumentManagerRef,
  onFileUploadComplete,
  onError,
}) => {
  const { t } = useTranslation(['medical', 'common', 'shared']);
  const { dateInputFormat } = useDateFormat();

  const [activeTab, setActiveTab] = useState('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { handleTextInputChange } = useFormHandlers(onInputChange);

  const today = getTodayEndOfDay();

  const handleDocumentManagerRef = (methods) => {
    if (onDocumentManagerRef) {
      onDocumentManagerRef(methods);
    }
  };

  const handleDocumentError = (error) => {
    logger.error('document_manager_error', {
      message: `Document manager error in symptoms ${editingSymptom ? 'edit' : 'create'}`,
      symptomId: editingSymptom?.id,
      error: error,
      component: 'MantineSymptomForm',
    });

    if (onError) {
      onError(error);
    }
  };

  const handleDocumentUploadComplete = (success, completedCount, failedCount) => {
    logger.info('symptoms_upload_completed', {
      message: 'File upload completed in symptoms form',
      symptomId: editingSymptom?.id,
      success,
      completedCount,
      failedCount,
      component: 'MantineSymptomForm',
    });

    if (onFileUploadComplete) {
      onFileUploadComplete(success, completedCount, failedCount);
    }
  };

  // Reset tab when modal opens; clear submitting flag when it closes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('basic');
    }
    if (!isOpen) {
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit(e);
      setIsSubmitting(false);
    } catch (error) {
      logger.error('symptom_form_wrapper_error', {
        message: 'Error in MantineSymptomForm',
        symptomId: editingSymptom?.id,
        error: error.message,
        component: 'MantineSymptomForm',
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
        message={statusMessage?.title || t('symptoms.messages.saving')}
        submessage={statusMessage?.message}
        type={statusMessage?.type || 'loading'}
      />

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="basic" leftSection={<IconInfoCircle size={16} />}>
                {t('shared:tabs.basicInfo')}
              </Tabs.Tab>
              <Tabs.Tab value="details" leftSection={<IconClipboard size={16} />}>
                {t('shared:tabs.details')}
              </Tabs.Tab>
              <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
                {editingSymptom
                  ? t('shared:tabs.documents')
                  : t('shared:tabs.addFiles')}
              </Tabs.Tab>
              <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                {t('shared:tabs.notes')}
              </Tabs.Tab>
            </Tabs.List>

            {/* Basic Info Tab */}
            <Tabs.Panel value="basic">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 8 }}>
                    <TextInput
                      label={t('shared:labels.symptomName')}
                      value={formData.symptom_name || ''}
                      onChange={handleTextInputChange('symptom_name')}
                      placeholder={t('symptoms.parent.symptomName.placeholder')}
                      description={t('symptoms.parent.symptomName.description')}
                      required
                      maxLength={200}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <TextInput
                      label={t('shared:labels.category')}
                      value={formData.category || ''}
                      onChange={handleTextInputChange('category')}
                      placeholder={t('symptoms.parent.category.placeholder')}
                      description={t('symptoms.parent.category.description')}
                      maxLength={100}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInput
                      label={t('symptoms.parent.firstOccurrenceDate.label')}
                      value={parseDateInput(formData.first_occurrence_date)}
                      onChange={(date) => {
                        const formattedDate = formatDateInputChange(date);
                        onInputChange({ target: { name: 'first_occurrence_date', value: formattedDate } });
                      }}
                      placeholder={dateInputFormat}
                      valueFormat={dateInputFormat}
                      required
                      maxDate={today}
                      clearable
                      firstDayOfWeek={0}
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('symptoms.parent.status.label')}
                      value={formData.status || null}
                      data={[
                        { value: 'active', label: t('symptoms.parent.statusOptions.active') },
                        { value: 'resolved', label: t('symptoms.parent.statusOptions.resolved') },
                        { value: 'recurring', label: t('symptoms.parent.statusOptions.recurring') },
                      ]}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'status', value: value || '' } });
                      }}
                      placeholder={t('shared:fields.selectStatus')}
                      required
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Details Tab */}
            <Tabs.Panel value="details">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInput
                      label={t('symptoms.parent.resolvedDate.label')}
                      value={parseDateInput(formData.resolved_date)}
                      onChange={(date) => {
                        const formattedDate = formatDateInputChange(date);
                        onInputChange({ target: { name: 'resolved_date', value: formattedDate } });
                      }}
                      placeholder={dateInputFormat}
                      valueFormat={dateInputFormat}
                      maxDate={today}
                      clearable
                      firstDayOfWeek={0}
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Checkbox
                      label={t('symptoms.parent.isChronic.label')}
                      description={t('symptoms.parent.isChronic.description')}
                      checked={formData.is_chronic || false}
                      onChange={(e) =>
                        onInputChange({ target: { name: 'is_chronic', value: e.currentTarget.checked } })
                      }
                      mt="xl"
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Box>
                      <Text size="sm" fw={500} mb="xs">
                        {t('symptoms.parent.typicalTriggers.label')}
                      </Text>
                      <TagInput
                        value={formData.typical_triggers || []}
                        onChange={(tags) => {
                          onInputChange({ target: { name: 'typical_triggers', value: tags } });
                        }}
                        placeholder={t('symptoms.parent.typicalTriggers.placeholder')}
                      />
                    </Box>
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Documents Tab */}
            <Tabs.Panel value="documents">
              <Box mt="md">
                <DocumentManagerWithProgress
                  entityType="symptom"
                  entityId={editingSymptom?.id || null}
                  mode={editingSymptom ? 'edit' : 'create'}
                  onUploadPendingFiles={handleDocumentManagerRef}
                  showProgressModal={true}
                  onUploadComplete={handleDocumentUploadComplete}
                  onError={handleDocumentError}
                />
              </Box>
            </Tabs.Panel>

            {/* Notes Tab */}
            <Tabs.Panel value="notes">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={12}>
                    <Textarea
                      label={t('symptoms.parent.generalNotes.label')}
                      value={formData.general_notes || ''}
                      onChange={handleTextInputChange('general_notes')}
                      placeholder={t('symptoms.parent.generalNotes.placeholder')}
                      rows={5}
                      minRows={3}
                      autosize
                      maxLength={2000}
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
                        onChange={(tags) => {
                          onInputChange({ target: { name: 'tags', value: tags } });
                        }}
                        placeholder={t('common:fields.tags.placeholder')}
                      />
                    </Box>
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>
          </Tabs>

          {/* Form Actions */}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={onClose} disabled={isLoading || isSubmitting}>
              {t('shared:fields.cancel')}
            </Button>
            <SubmitButton
              loading={isLoading || isSubmitting}
              disabled={!formData.symptom_name?.trim()}
            >
              {editingSymptom ? t('common:buttons.update') : t('common:buttons.create')}{' '}
              {t('shared:categories.symptoms')}
            </SubmitButton>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default MantineSymptomForm;
