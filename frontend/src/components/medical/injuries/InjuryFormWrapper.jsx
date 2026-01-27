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
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconInfoCircle,
  IconBandage,
  IconFileText,
  IconNotes,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import SubmitButton from '../../shared/SubmitButton';
import { useFormHandlers } from '../../../hooks/useFormHandlers';
import {
  parseDateInput,
  getTodayEndOfDay,
} from '../../../utils/dateUtils';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import { TagInput } from '../../common/TagInput';
import InjuryTypeSelect from './InjuryTypeSelect';
import logger from '../../../services/logger';

const InjuryFormWrapper = ({
  isOpen,
  onClose,
  title,
  editingInjury = null,
  formData,
  onInputChange,
  onSubmit,
  practitionersOptions = [],
  practitionersLoading = false,
  injuryTypes = [],
  injuryTypesLoading = false,
  isLoading = false,
}) => {
  // Translation hooks
  const { t } = useTranslation('medical');
  const { t: tCommon } = useTranslation('common');

  // Tab state management
  const [activeTab, setActiveTab] = useState('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form handlers
  const { handleTextInputChange, handleSelectChange, handleDateChange } = useFormHandlers(onInputChange);

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
      logger.error('injury_form_wrapper_error', {
        message: 'Error in InjuryFormWrapper',
        injuryId: editingInjury?.id,
        error: error.message,
        component: 'InjuryFormWrapper',
      });
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Prepare practitioners options
  const practitionerSelectData = practitionersOptions.map((prac) => ({
    value: String(prac.id),
    label: prac.name,
  }));

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
        message={t('injuries.messages.saving', 'Saving injury...')}
      />

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Tabbed Content */}
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="basic" leftSection={<IconInfoCircle size={16} />}>
                {t('injuries.tabs.basicInfo', 'Basic Info')}
              </Tabs.Tab>
              <Tabs.Tab value="treatment" leftSection={<IconBandage size={16} />}>
                {t('injuries.tabs.treatment', 'Treatment')}
              </Tabs.Tab>
              {editingInjury && (
                <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
                  {t('injuries.tabs.documents', 'Documents')}
                </Tabs.Tab>
              )}
              <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                {t('injuries.tabs.notes', 'Notes')}
              </Tabs.Tab>
            </Tabs.List>

            {/* Basic Info Tab */}
            <Tabs.Panel value="basic">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('injuries.injuryName.label', 'Injury Name')}
                      value={formData.injury_name || ''}
                      onChange={handleTextInputChange('injury_name')}
                      placeholder={t(
                        'injuries.injuryName.placeholder',
                        'e.g., Right ankle sprain'
                      )}
                      required
                      description={t(
                        'injuries.injuryName.description',
                        'A descriptive name for this injury'
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <InjuryTypeSelect
                      value={formData.injury_type_id}
                      onChange={(value) => {
                        onInputChange({
                          target: { name: 'injury_type_id', value: value || null },
                        });
                      }}
                      injuryTypes={injuryTypes}
                      loading={injuryTypesLoading}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('injuries.bodyPart.label', 'Body Part')}
                      value={formData.body_part || ''}
                      onChange={handleTextInputChange('body_part')}
                      placeholder={t(
                        'injuries.bodyPart.placeholder',
                        'e.g., Ankle, Wrist, Knee'
                      )}
                      required
                      description={t(
                        'injuries.bodyPart.description',
                        'The affected body part or area'
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('injuries.laterality.label', 'Side')}
                      value={formData.laterality || null}
                      data={[
                        { value: 'left', label: t('injuries.laterality.options.left', 'Left') },
                        { value: 'right', label: t('injuries.laterality.options.right', 'Right') },
                        {
                          value: 'bilateral',
                          label: t('injuries.laterality.options.bilateral', 'Both Sides'),
                        },
                        {
                          value: 'not_applicable',
                          label: t('injuries.laterality.options.notApplicable', 'Not Applicable'),
                        },
                      ]}
                      onChange={handleSelectChange('laterality')}
                      placeholder={t('injuries.laterality.placeholder', 'Select side')}
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                      description={t(
                        'injuries.laterality.description',
                        'Which side of the body is affected'
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInput
                      label={t('injuries.dateOfInjury.label', 'Date of Injury')}
                      value={parseDateInput(formData.date_of_injury)}
                      onChange={handleDateChange('date_of_injury')}
                      placeholder={t(
                        'injuries.dateOfInjury.placeholder',
                        'When the injury occurred'
                      )}
                      maxDate={today}
                      clearable
                      firstDayOfWeek={0}
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                      description={t(
                        'injuries.dateOfInjury.description',
                        'The date when the injury happened (optional if unknown)'
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('injuries.severity.label', 'Severity')}
                      value={formData.severity || null}
                      data={[
                        {
                          value: 'mild',
                          label: t('injuries.severity.options.mild', 'Mild - Minor discomfort'),
                        },
                        {
                          value: 'moderate',
                          label: t('injuries.severity.options.moderate', 'Moderate - Noticeable impact'),
                        },
                        {
                          value: 'severe',
                          label: t('injuries.severity.options.severe', 'Severe - Significant impact'),
                        },
                        {
                          value: 'life-threatening',
                          label: t(
                            'injuries.severity.options.lifeThreatening',
                            'Life-threatening - Emergency care needed'
                          ),
                        },
                      ]}
                      onChange={handleSelectChange('severity')}
                      placeholder={t('injuries.severity.placeholder', 'Select severity')}
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                      description={t(
                        'injuries.severity.description',
                        'How severe is this injury'
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('injuries.status.label', 'Status')}
                      value={formData.status || 'active'}
                      data={[
                        {
                          value: 'active',
                          label: t('injuries.status.options.active', 'Active - Currently being treated'),
                        },
                        {
                          value: 'healing',
                          label: t('injuries.status.options.healing', 'Healing - In recovery'),
                        },
                        {
                          value: 'resolved',
                          label: t('injuries.status.options.resolved', 'Resolved - Fully healed'),
                        },
                        {
                          value: 'chronic',
                          label: t(
                            'injuries.status.options.chronic',
                            'Chronic - Long-term effects'
                          ),
                        },
                      ]}
                      onChange={handleSelectChange('status')}
                      required
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                      description={t(
                        'injuries.status.description',
                        'Current status of this injury'
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('injuries.practitioner.label', 'Treating Practitioner')}
                      value={
                        formData.practitioner_id ? String(formData.practitioner_id) : null
                      }
                      data={practitionerSelectData}
                      onChange={(value) => {
                        onInputChange({
                          target: {
                            name: 'practitioner_id',
                            value: value ? parseInt(value, 10) : null,
                          },
                        });
                      }}
                      placeholder={t(
                        'injuries.practitioner.placeholder',
                        'Select practitioner'
                      )}
                      clearable
                      searchable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                      nothingFoundMessage={tCommon('noResults', 'No practitioners found')}
                      description={t(
                        'injuries.practitioner.description',
                        'The healthcare provider treating this injury'
                      )}
                    />
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Treatment Tab */}
            <Tabs.Panel value="treatment">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={12}>
                    <Textarea
                      label={t('injuries.mechanism.label', 'How It Happened')}
                      value={formData.mechanism || ''}
                      onChange={handleTextInputChange('mechanism')}
                      placeholder={t(
                        'injuries.mechanism.placeholder',
                        'e.g., Fell while hiking'
                      )}
                      minRows={3}
                      maxRows={6}
                      description={t(
                        'injuries.mechanism.description',
                        'Describe how the injury occurred'
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Textarea
                      label={t('injuries.treatmentReceived.label', 'Treatment Received')}
                      value={formData.treatment_received || ''}
                      onChange={handleTextInputChange('treatment_received')}
                      placeholder={t(
                        'injuries.treatmentReceived.placeholder',
                        'e.g., RICE protocol, cast applied'
                      )}
                      minRows={3}
                      maxRows={6}
                      description={t(
                        'injuries.treatmentReceived.description',
                        'Description of treatment received'
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <Textarea
                      label={t('injuries.recoveryNotes.label', 'Recovery Notes')}
                      value={formData.recovery_notes || ''}
                      onChange={handleTextInputChange('recovery_notes')}
                      placeholder={t(
                        'injuries.recoveryNotes.placeholder',
                        'Progress updates, milestones, or observations'
                      )}
                      minRows={3}
                      maxRows={6}
                      description={t(
                        'injuries.recoveryNotes.description',
                        'Notes about recovery progress'
                      )}
                    />
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Documents Tab */}
            {editingInjury && (
              <Tabs.Panel value="documents">
                <Box mt="md">
                  <DocumentManagerWithProgress
                    entityType="injury"
                    entityId={editingInjury.id}
                    readOnly={false}
                  />
                </Box>
              </Tabs.Panel>
            )}

            {/* Notes Tab */}
            <Tabs.Panel value="notes">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={12}>
                    <Textarea
                      label={t('injuries.notes.label', 'Additional Notes')}
                      value={formData.notes || ''}
                      onChange={handleTextInputChange('notes')}
                      placeholder={t(
                        'injuries.notes.placeholder',
                        'Any other relevant information...'
                      )}
                      minRows={3}
                      maxRows={6}
                      description={t(
                        'injuries.notes.description',
                        'General notes or additional details'
                      )}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <TagInput
                      label={tCommon('fields.tags.label', 'Tags')}
                      value={formData.tags || []}
                      onChange={(tags) => {
                        onInputChange({
                          target: { name: 'tags', value: tags },
                        });
                      }}
                      placeholder={tCommon(
                        'fields.tags.placeholder',
                        'Add tags to organize...'
                      )}
                      description={tCommon(
                        'fields.tags.description',
                        'Add tags to help organize and search'
                      )}
                      maxTags={15}
                    />
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>
          </Tabs>

          {/* Form Actions */}
          <Group justify="flex-end" mt="xl">
            <Button variant="subtle" onClick={onClose} disabled={isSubmitting}>
              {tCommon('buttons.cancel', 'Cancel')}
            </Button>
            <SubmitButton isLoading={isSubmitting}>
              {editingInjury
                ? tCommon('buttons.saveChanges', 'Save Changes')
                : tCommon('buttons.create', 'Create')}
            </SubmitButton>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default InjuryFormWrapper;
