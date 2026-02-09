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
  NumberInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconInfoCircle,
  IconStethoscope,
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

const ProcedureFormWrapper = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingItem = null,
  practitioners = [],
  isLoading = false,
  statusMessage,
  onDocumentManagerRef,
  onFileUploadComplete,
  onError,
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

  const handleDocumentManagerRef = (methods) => {
    if (onDocumentManagerRef) {
      onDocumentManagerRef(methods);
    }
  };

  const handleDocumentError = (error) => {
    logger.error('document_manager_error', {
      message: `Document manager error in procedures ${editingItem ? 'edit' : 'create'}`,
      procedureId: editingItem?.id,
      error: error,
      component: 'ProcedureFormWrapper',
    });

    if (onError) {
      onError(error);
    }
  };

  const handleDocumentUploadComplete = (success, completedCount, failedCount) => {
    logger.info('procedures_upload_completed', {
      message: 'File upload completed in procedures form',
      procedureId: editingItem?.id,
      success,
      completedCount,
      failedCount,
      component: 'ProcedureFormWrapper',
    });

    if (onFileUploadComplete) {
      onFileUploadComplete(success, completedCount, failedCount);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit(e);
      setIsSubmitting(false);
    } catch (error) {
      logger.error('procedure_form_submit_error', {
        message: 'Error submitting procedure form',
        procedureId: editingItem?.id,
        error: error.message,
        component: 'ProcedureFormWrapper',
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
      <FormLoadingOverlay visible={isSubmitting || isLoading} message={statusMessage || t('procedures.form.savingProcedure', 'Saving procedure...')} />

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Tabbed Content */}
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="basic" leftSection={<IconInfoCircle size={16} />}>
                {t('procedures.form.tabs.basicInfo', 'Basic Info')}
              </Tabs.Tab>
              <Tabs.Tab value="clinical" leftSection={<IconStethoscope size={16} />}>
                {t('procedures.form.tabs.clinical', 'Clinical Details')}
              </Tabs.Tab>
              {editingItem && (
                <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
                  {t('procedures.form.tabs.documents', 'Documents')}
                </Tabs.Tab>
              )}
              <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                {t('procedures.form.tabs.notes', 'Notes')}
              </Tabs.Tab>
            </Tabs.List>

            {/* Basic Info Tab */}
            <Tabs.Panel value="basic">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('procedures.form.procedureName', 'Procedure Name')}
                      value={formData.procedure_name || ''}
                      onChange={handleTextInputChange('procedure_name')}
                      placeholder={t('procedures.form.procedureNamePlaceholder', 'Enter procedure name')}
                      required
                      description={t('procedures.form.procedureNameDesc', 'Name of the procedure')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('procedures.form.procedureType', 'Procedure Type')}
                      value={formData.procedure_type || ''}
                      onChange={handleTextInputChange('procedure_type')}
                      placeholder={t('procedures.form.procedureTypePlaceholder', 'e.g., Surgical, Diagnostic')}
                      description={t('procedures.form.procedureTypeDesc', 'Type or category of procedure')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('procedures.form.procedureCode', 'Procedure Code')}
                      value={formData.procedure_code || ''}
                      onChange={handleTextInputChange('procedure_code')}
                      placeholder={t('procedures.form.procedureCodePlaceholder', 'e.g., CPT code')}
                      description={t('procedures.form.procedureCodeDesc', 'Medical billing code')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInput
                      label={t('procedures.form.procedureDate', 'Procedure Date')}
                      value={parseDateInput(formData.procedure_date)}
                      onChange={(date) => {
                        const formattedDate = formatDateInputChange(date);
                        onInputChange({ target: { name: 'procedure_date', value: formattedDate } });
                      }}
                      placeholder={t('procedures.form.procedureDatePlaceholder', 'Select procedure date')}
                      description={t('procedures.form.procedureDateDesc', 'When the procedure is scheduled or was performed')}
                      clearable
                      firstDayOfWeek={0}
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('procedures.form.status', 'Status')}
                      value={formData.status || null}
                      data={[
                        { value: 'scheduled', label: t('procedures.form.statusScheduled', 'Scheduled') },
                        { value: 'in-progress', label: t('procedures.form.statusInProgress', 'In Progress') },
                        { value: 'completed', label: t('procedures.form.statusCompleted', 'Completed') },
                        { value: 'postponed', label: t('procedures.form.statusPostponed', 'Postponed') },
                        { value: 'cancelled', label: t('procedures.form.statusCancelled', 'Cancelled') },
                      ]}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'status', value: value || '' } });
                      }}
                      placeholder={t('procedures.form.statusPlaceholder', 'Select status')}
                      description={t('procedures.form.statusDesc', 'Current procedure status')}
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('procedures.form.outcome', 'Outcome')}
                      value={formData.outcome || null}
                      data={[
                        { value: 'successful', label: t('procedures.form.outcomeSuccessful', 'Successful') },
                        { value: 'abnormal', label: t('procedures.form.outcomeAbnormal', 'Abnormal') },
                        { value: 'complications', label: t('procedures.form.outcomeComplications', 'Complications') },
                        { value: 'inconclusive', label: t('procedures.form.outcomeInconclusive', 'Inconclusive') },
                        { value: 'pending', label: t('procedures.form.outcomePending', 'Pending') },
                      ]}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'outcome', value: value || '' } });
                      }}
                      placeholder={t('procedures.form.outcomePlaceholder', 'Select outcome')}
                      description={t('procedures.form.outcomeDesc', 'Result or outcome of the procedure')}
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('procedures.form.practitioner', 'Practitioner')}
                      value={formData.practitioner_id || null}
                      data={practitioners.map(prac => ({
                        value: prac.id.toString(),
                        label: `${prac.name}${prac.specialty ? ` - ${prac.specialty}` : ''}`,
                      }))}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'practitioner_id', value: value || '' } });
                      }}
                      placeholder={t('procedures.form.practitionerPlaceholder', 'Select practitioner')}
                      description={t('procedures.form.practitionerDesc', 'Healthcare provider performing procedure')}
                      searchable
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('procedures.form.setting', 'Setting')}
                      value={formData.procedure_setting || ''}
                      onChange={handleTextInputChange('procedure_setting')}
                      placeholder={t('procedures.form.settingPlaceholder', 'e.g., Inpatient, Outpatient')}
                      description={t('procedures.form.settingDesc', 'Where the procedure was performed')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('procedures.form.facility', 'Facility')}
                      value={formData.facility || ''}
                      onChange={handleTextInputChange('facility')}
                      placeholder={t('procedures.form.facilityPlaceholder', 'e.g., Hospital name')}
                      description={t('procedures.form.facilityDesc', 'Medical facility')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <NumberInput
                      label={t('procedures.form.duration', 'Duration (minutes)')}
                      value={formData.procedure_duration || ''}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'procedure_duration', value: value || '' } });
                      }}
                      placeholder={t('procedures.form.durationPlaceholder', 'Enter duration')}
                      description={t('procedures.form.durationDesc', 'How long the procedure took')}
                      min={0}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Textarea
                      label={t('procedures.form.description', 'Description')}
                      value={formData.description || ''}
                      onChange={handleTextInputChange('description')}
                      placeholder={t('procedures.form.descriptionPlaceholder', 'Describe the procedure')}
                      description={t('procedures.form.descriptionDesc', 'Brief description of the procedure')}
                      rows={3}
                      minRows={2}
                      autosize
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Box>
                      <Text size="sm" fw={500} mb="xs">
                        {t('procedures.form.tags', 'Tags')}
                      </Text>
                      <Text size="xs" c="dimmed" mb="xs">
                        {t('procedures.form.tagsDesc', 'Add tags to categorize and organize procedures')}
                      </Text>
                      <TagInput
                        value={formData.tags || []}
                        onChange={(tags) => {
                          onInputChange({ target: { name: 'tags', value: tags } });
                        }}
                        placeholder={t('procedures.form.tagsPlaceholder', 'Add tags...')}
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
                      label={t('procedures.form.anesthesiaType', 'Anesthesia Type')}
                      value={formData.anesthesia_type || ''}
                      onChange={handleTextInputChange('anesthesia_type')}
                      placeholder={t('procedures.form.anesthesiaTypePlaceholder', 'e.g., General, Local, Regional')}
                      description={t('procedures.form.anesthesiaTypeDesc', 'Type of anesthesia used')}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Textarea
                      label={t('procedures.form.anesthesiaNotes', 'Anesthesia Notes')}
                      value={formData.anesthesia_notes || ''}
                      onChange={handleTextInputChange('anesthesia_notes')}
                      placeholder={t('procedures.form.anesthesiaNotesPlaceholder', 'Enter anesthesia details and notes')}
                      description={t('procedures.form.anesthesiaNotesDesc', 'Additional anesthesia information')}
                      rows={3}
                      minRows={2}
                      autosize
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Textarea
                      label={t('procedures.form.complications', 'Complications')}
                      value={formData.procedure_complications || ''}
                      onChange={handleTextInputChange('procedure_complications')}
                      placeholder={t('procedures.form.complicationsPlaceholder', 'Document any complications')}
                      description={t('procedures.form.complicationsDesc', 'Any issues or complications that occurred')}
                      rows={3}
                      minRows={2}
                      autosize
                    />
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Documents Tab (only when editing) */}
            {editingItem && (
              <Tabs.Panel value="documents">
                <Box mt="md">
                  <DocumentManagerWithProgress
                    entityType="procedure"
                    entityId={editingItem.id}
                    mode="edit"
                    onUploadPendingFiles={handleDocumentManagerRef}
                    showProgressModal={true}
                    onUploadComplete={handleDocumentUploadComplete}
                    onError={handleDocumentError}
                  />
                </Box>
              </Tabs.Panel>
            )}

            {/* Notes Tab */}
            <Tabs.Panel value="notes">
              <Box mt="md">
                <Textarea
                  label={t('procedures.form.clinicalNotes', 'Clinical Notes')}
                  value={formData.notes || ''}
                  onChange={handleTextInputChange('notes')}
                  placeholder={t('procedures.form.clinicalNotesPlaceholder', 'Enter clinical notes, observations, or additional details')}
                  description={t('procedures.form.clinicalNotesDesc', 'Additional information about this procedure')}
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
              {t('procedures.form.cancel', 'Cancel')}
            </Button>
            <SubmitButton
              loading={isLoading || isSubmitting}
              disabled={!formData.procedure_name?.trim()}
            >
              {editingItem ? t('procedures.form.updateProcedure', 'Update Procedure') : t('procedures.form.createProcedure', 'Create Procedure')}
            </SubmitButton>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default ProcedureFormWrapper;
