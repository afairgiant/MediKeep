import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDateFormat } from '../../../hooks/useDateFormat';
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
  MultiSelect,
} from '@mantine/core';
import { DateInput } from '../../adapters/DateInput';
import {
  IconInfoCircle,
  IconStethoscope,
  IconFileText,
  IconNotes,
  IconPill,
} from '@tabler/icons-react';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import SubmitButton from '../../shared/SubmitButton';
import { useFormHandlers } from '../../../hooks/useFormHandlers';
import { parseDateInput, getTodayEndOfDay } from '../../../utils/dateUtils';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import { TagInput } from '../../common/TagInput';
import MedicationRelationships from '../MedicationRelationships';
import logger from '../../../services/logger';

const ConditionFormWrapper = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingCondition = null,
  practitioners = [],
  isLoading = false,
  statusMessage,
  onDocumentManagerRef,
  onFileUploadComplete,
  onError,
  // Medication relationship props (only used when editing)
  medications = [],
  conditionMedications = {},
  fetchConditionMedications,
  navigate,
}) => {
  const { t } = useTranslation(['common', 'shared']);
  const { dateInputFormat } = useDateFormat();

  // Tab state management
  const [activeTab, setActiveTab] = useState('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use the standardized form handlers hook
  const { handleTextInputChange, handleSelectChange, handleDateChange } =
    useFormHandlers(onInputChange);

  // Get today's date for date picker constraints
  const today = getTodayEndOfDay();

  const handleDocumentManagerRef = methods => {
    if (onDocumentManagerRef) {
      onDocumentManagerRef(methods);
    }
  };

  const handleDocumentError = error => {
    logger.error('document_manager_error', {
      message: `Document manager error in conditions ${editingCondition ? 'edit' : 'create'}`,
      conditionId: editingCondition?.id,
      error: error,
      component: 'ConditionFormWrapper',
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
    logger.info('conditions_upload_completed', {
      message: 'File upload completed in conditions form',
      conditionId: editingCondition?.id,
      success,
      completedCount,
      failedCount,
      component: 'ConditionFormWrapper',
    });

    if (onFileUploadComplete) {
      onFileUploadComplete(success, completedCount, failedCount);
    }
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('basic');
    } else {
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Convert practitioners to options
  const practitionerOptions = practitioners.map(prac => ({
    value: prac.id.toString(),
    label:
      prac.name ||
      `Dr. ${prac.first_name || ''} ${prac.last_name || ''}`.trim() ||
      `Practitioner #${prac.id}`,
  }));

  // Handle form submission
  const handleSubmit = async e => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit(e);
    } finally {
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
        message={
          statusMessage?.title ||
          t('conditions.form.saving', 'Saving condition...')
        }
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
                {t('shared:labels.basicInformation', 'Basic Info')}
              </Tabs.Tab>
              <Tabs.Tab
                value="clinical"
                leftSection={<IconStethoscope size={16} />}
              >
                {t('shared:tabs.clinicalDetails', 'Clinical Details')}
              </Tabs.Tab>
              <Tabs.Tab
                value="medications"
                leftSection={<IconPill size={16} />}
              >
                {t('shared:categories.medications', 'Medications')}
              </Tabs.Tab>
              <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                {t('shared:tabs.notes', 'Notes')}
              </Tabs.Tab>
              <Tabs.Tab
                value="documents"
                leftSection={<IconFileText size={16} />}
              >
                {editingCondition
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
                      label={t('shared:labels.diagnosis', 'Diagnosis')}
                      value={formData.diagnosis || ''}
                      onChange={handleTextInputChange('diagnosis')}
                      placeholder={t(
                        'conditions.form.placeholders.diagnosis',
                        'Enter diagnosis'
                      )}
                      required
                      description={t(
                        'conditions.form.descriptions.diagnosis',
                        'Primary diagnosis or condition'
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('shared:fields.conditionName', 'Condition Name')}
                      value={formData.condition_name || ''}
                      onChange={handleTextInputChange('condition_name')}
                      placeholder={t(
                        'conditions.form.placeholders.conditionName',
                        'Enter condition name'
                      )}
                      description={t(
                        'conditions.form.descriptions.conditionName',
                        'Optional alternative name'
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('shared:fields.severity', 'Severity')}
                      value={formData.severity || null}
                      data={[
                        {
                          value: 'mild',
                          label: t('conditions.form.severity.mild', 'Mild'),
                        },
                        {
                          value: 'moderate',
                          label: t(
                            'conditions.form.severity.moderate',
                            'Moderate'
                          ),
                        },
                        {
                          value: 'severe',
                          label: t('conditions.form.severity.severe', 'Severe'),
                        },
                        {
                          value: 'critical',
                          label: t(
                            'conditions.form.severity.critical',
                            'Critical'
                          ),
                        },
                      ]}
                      onChange={handleSelectChange('severity')}
                      placeholder={t(
                        'conditions.form.placeholders.severity',
                        'Select severity'
                      )}
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('shared:fields.status', 'Status')}
                      value={formData.status || null}
                      data={[
                        {
                          value: 'active',
                          label: t('shared:labels.active', 'Active'),
                        },
                        {
                          value: 'inactive',
                          label: t('shared:labels.inactive', 'Inactive'),
                        },
                        {
                          value: 'resolved',
                          label: t('shared:labels.resolved', 'Resolved'),
                        },
                        {
                          value: 'chronic',
                          label: t('conditions.form.status.chronic', 'Chronic'),
                        },
                      ]}
                      onChange={handleSelectChange('status')}
                      placeholder={t(
                        'shared:fields.selectStatus',
                        'Select status'
                      )}
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInput
                      label={t('shared:fields.onsetDate', 'Onset Date')}
                      value={parseDateInput(formData.onset_date)}
                      onChange={handleDateChange('onset_date')}
                      placeholder={dateInputFormat}
                      valueFormat={dateInputFormat}
                      description={t(
                        'conditions.form.descriptions.onsetDate',
                        'When the condition started'
                      )}
                      clearable
                      firstDayOfWeek={0}
                      maxDate={today}
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInput
                      label={t('shared:labels.endDate', 'End Date')}
                      value={parseDateInput(formData.end_date)}
                      onChange={handleDateChange('end_date')}
                      placeholder={dateInputFormat}
                      valueFormat={dateInputFormat}
                      description={t(
                        'conditions.form.descriptions.endDate',
                        'When the condition ended (if applicable)'
                      )}
                      clearable
                      firstDayOfWeek={0}
                      minDate={parseDateInput(formData.onset_date) || undefined}
                      maxDate={today}
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('shared:fields.practitioner', 'Practitioner')}
                      value={formData.practitioner_id || null}
                      data={practitionerOptions}
                      onChange={handleSelectChange('practitioner_id')}
                      placeholder={t(
                        'shared:fields.selectPractitioner',
                        'Select practitioner'
                      )}
                      description={t(
                        'conditions.form.descriptions.practitioner',
                        'Associated healthcare provider'
                      )}
                      searchable
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Box>
                      <Text size="sm" fw={500} mb="xs">
                        {t('shared:labels.tags', 'Tags')}
                      </Text>
                      <Text size="xs" c="dimmed" mb="xs">
                        {t(
                          'conditions.form.descriptions.tags',
                          'Add tags to categorize and organize conditions'
                        )}
                      </Text>
                      <TagInput
                        value={formData.tags || []}
                        onChange={tags => {
                          onInputChange({
                            target: { name: 'tags', value: tags },
                          });
                        }}
                        placeholder={t('shared:fields.addTags', 'Add tags...')}
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
                      label={t('shared:fields.icd10Code', 'ICD-10 Code')}
                      value={formData.icd10_code || ''}
                      onChange={handleTextInputChange('icd10_code')}
                      placeholder={t(
                        'conditions.form.placeholders.icd10Code',
                        'e.g., E11.9'
                      )}
                      description={t(
                        'conditions.form.descriptions.icd10Code',
                        'International Classification of Diseases code'
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('shared:fields.snomedCode', 'SNOMED Code')}
                      value={formData.snomed_code || ''}
                      onChange={handleTextInputChange('snomed_code')}
                      placeholder={t(
                        'conditions.form.placeholders.snomedCode',
                        'e.g., 44054006'
                      )}
                      description={t(
                        'conditions.form.descriptions.snomedCode',
                        'SNOMED CT code'
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <TextInput
                      label={t(
                        'shared:fields.codeDescription',
                        'Code Description'
                      )}
                      value={formData.code_description || ''}
                      onChange={handleTextInputChange('code_description')}
                      placeholder={t(
                        'conditions.form.placeholders.codeDescription',
                        'Description of the medical code'
                      )}
                      description={t(
                        'conditions.form.descriptions.codeDescription',
                        'Human-readable description of the medical codes'
                      )}
                    />
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Medications Tab */}
            <Tabs.Panel value="medications">
              <Box mt="md">
                <Text size="sm" c="dimmed" mb="md">
                  {t(
                    'conditions.form.medicationsDescription',
                    'Link medications used to treat or manage this condition.'
                  )}
                </Text>
                {editingCondition ? (
                  <MedicationRelationships
                    conditionId={editingCondition.id}
                    conditionMedications={conditionMedications}
                    medications={medications}
                    fetchConditionMedications={fetchConditionMedications}
                    navigate={navigate}
                    isViewMode={false}
                  />
                ) : (
                  <MultiSelect
                    label={t('modals.selectMedications', 'Select Medications')}
                    placeholder={t(
                      'modals.chooseMedicationToLink',
                      'Choose medications to link'
                    )}
                    data={medications.map(med => ({
                      value: med.id.toString(),
                      label: `${med.medication_name}${med.dosage ? ` (${med.dosage})` : ''}${med.status ? ` - ${med.status}` : ''}`,
                    }))}
                    value={formData.pending_medication_ids || []}
                    onChange={values => {
                      onInputChange({
                        target: {
                          name: 'pending_medication_ids',
                          value: values,
                        },
                      });
                    }}
                    searchable
                    clearable
                    comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                  />
                )}
              </Box>
            </Tabs.Panel>

            {/* Notes Tab */}
            <Tabs.Panel value="notes">
              <Box mt="md">
                <Textarea
                  label={t('shared:labels.clinicalNotes', 'Clinical Notes')}
                  value={formData.notes || ''}
                  onChange={handleTextInputChange('notes')}
                  placeholder={t(
                    'conditions.form.placeholders.notes',
                    'Enter clinical notes, observations, or additional details'
                  )}
                  description={t(
                    'conditions.form.descriptions.notes',
                    'Additional information about this condition'
                  )}
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
                  entityType="condition"
                  entityId={editingCondition?.id || null}
                  mode={editingCondition ? 'edit' : 'create'}
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
              {t('shared:fields.cancel', 'Cancel')}
            </Button>
            <SubmitButton
              loading={isLoading || isSubmitting}
              disabled={!formData.diagnosis?.trim()}
            >
              {editingCondition
                ? t('conditions.form.updateCondition', 'Update Condition')
                : t('conditions.form.createCondition', 'Create Condition')}
            </SubmitButton>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default ConditionFormWrapper;
