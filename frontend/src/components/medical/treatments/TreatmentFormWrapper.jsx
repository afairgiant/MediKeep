import { useState, useEffect } from 'react';
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
  Badge,
  Alert,
  SegmentedControl,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconInfoCircle,
  IconCalendar,
  IconFileText,
  IconNotes,
  IconLink,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import FormLoadingOverlay from '../../shared/FormLoadingOverlay';
import SubmitButton from '../../shared/SubmitButton';
import { useFormHandlers } from '../../../hooks/useFormHandlers';
import { parseDateInput, formatDateInputChange } from '../../../utils/dateUtils';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import { TagInput } from '../../common/TagInput';
import TreatmentRelationshipsManager from './TreatmentRelationshipsManager';
import TreatmentPlanSetup from './TreatmentPlanSetup';
import { apiService } from '../../../services/api';
import logger from '../../../services/logger';

const EMPTY_PENDING_RELATIONSHIPS = {
  medications: [],
  encounters: [],
  labResults: [],
  equipment: [],
};

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

  // Track relationship counts for badge display (edit mode)
  const [relationshipCount, setRelationshipCount] = useState(0);

  // Track pending relationships for creation mode
  const [pendingRelationships, setPendingRelationships] = useState(EMPTY_PENDING_RELATIONSHIPS);

  // Form handlers
  const {
    handleTextInputChange,
  } = useFormHandlers(onInputChange);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('basic');
      setPendingRelationships(EMPTY_PENDING_RELATIONSHIPS);
    }
    if (!isOpen) {
      setIsSubmitting(false);
      setRelationshipCount(0);
      setPendingRelationships(EMPTY_PENDING_RELATIONSHIPS);
    }
  }, [isOpen]);

  // Calculate pending relationship count for badge
  const pendingCount =
    (pendingRelationships.medications?.length || 0) +
    (pendingRelationships.encounters?.length || 0) +
    (pendingRelationships.labResults?.length || 0) +
    (pendingRelationships.equipment?.length || 0);

  // Handle form submission with pending relationships
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // First, create/update the treatment
      const result = await onSubmit(e);

      // If this is a new treatment and we have pending relationships, create them
      if (!editingTreatment && result?.id && pendingCount > 0) {
        const treatmentId = result.id;

        // Create all pending relationships in parallel
        const promises = [];

        // Handle medications - create each individually to preserve metadata
        const meds = pendingRelationships.medications || [];
        for (const med of meds) {
          const medData = typeof med === 'object' ? med : { id: med };
          promises.push(
            apiService.linkTreatmentMedication(treatmentId, {
              medication_id: parseInt(medData.id),
              specific_dosage: medData.specific_dosage || null,
              specific_frequency: medData.specific_frequency || null,
              specific_duration: medData.specific_duration || null,
              timing_instructions: medData.timing_instructions || null,
              relevance_note: medData.relevance_note || null,
              specific_prescriber_id: medData.specific_prescriber_id ? parseInt(medData.specific_prescriber_id) : null,
              specific_pharmacy_id: medData.specific_pharmacy_id ? parseInt(medData.specific_pharmacy_id) : null,
              specific_start_date: medData.specific_start_date || null,
              specific_end_date: medData.specific_end_date || null,
            }).catch(err => {
              logger.error('Failed to link medication', { error: err.message });
            })
          );
        }

        // Handle encounters - create each individually to preserve metadata
        const encs = pendingRelationships.encounters || [];
        for (const enc of encs) {
          const encData = typeof enc === 'object' ? enc : { id: enc };
          promises.push(
            apiService.linkTreatmentEncounter(treatmentId, {
              encounter_id: parseInt(encData.id),
              visit_label: encData.visit_label || null,
              visit_sequence: encData.visit_sequence ? parseInt(encData.visit_sequence) : null,
              relevance_note: encData.relevance_note || null,
            }).catch(err => {
              logger.error('Failed to link encounter', { error: err.message });
            })
          );
        }

        // Handle lab results - create each individually to preserve metadata
        const labs = pendingRelationships.labResults || [];
        for (const lab of labs) {
          const labData = typeof lab === 'object' ? lab : { id: lab };
          promises.push(
            apiService.linkTreatmentLabResult(treatmentId, {
              lab_result_id: parseInt(labData.id),
              purpose: labData.purpose || null,
              expected_frequency: labData.expected_frequency || null,
              relevance_note: labData.relevance_note || null,
            }).catch(err => {
              logger.error('Failed to link lab result', { error: err.message });
            })
          );
        }

        // Handle equipment - create each individually
        const equips = pendingRelationships.equipment || [];
        for (const equip of equips) {
          const equipData = typeof equip === 'object' ? equip : { id: equip };
          promises.push(
            apiService.linkTreatmentEquipment(treatmentId, {
              equipment_id: parseInt(equipData.id),
              usage_frequency: equipData.usage_frequency || null,
              specific_settings: equipData.specific_settings || null,
              relevance_note: equipData.relevance_note || null,
            }).catch(err => {
              logger.error('Failed to link equipment', { error: err.message });
            })
          );
        }

        // Wait for all relationships to be created
        await Promise.all(promises);
      }

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

  // Badge count: show pending count during creation, actual count when editing
  const badgeCount = editingTreatment ? relationshipCount : pendingCount;

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
          isSubmitting && pendingCount > 0 && !editingTreatment
            ? t('treatments.form.creatingWithLinks', 'Creating treatment and linking items...')
            : t('treatments.form.savingTreatment', 'Saving treatment...')
        }
      />

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="basic" leftSection={<IconInfoCircle size={16} />}>
                {t('treatments.form.tabs.basicInfo', 'Basic Info')}
              </Tabs.Tab>
              {formData.mode !== 'advanced' && (
                <Tabs.Tab value="schedule" leftSection={<IconCalendar size={16} />}>
                  {t('treatments.form.tabs.scheduleDosage', 'Schedule & Dosage')}
                </Tabs.Tab>
              )}
              {formData.mode === 'advanced' && (
                <Tabs.Tab
                  value="relationships"
                  leftSection={<IconLink size={16} />}
                  rightSection={badgeCount > 0 ? (
                    <Badge size="sm" variant="filled" color="blue" circle>
                      {badgeCount}
                    </Badge>
                  ) : null}
                >
                  Treatment Plan
                </Tabs.Tab>
              )}
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
                  <Grid.Col span={12}>
                    <Stack gap={4}>
                      <Text size="sm" fw={500}>
                        {t('treatments.mode.label', 'Treatment Mode')}
                      </Text>
                      <SegmentedControl
                        value={formData.mode || 'simple'}
                        onChange={(value) => {
                          onInputChange({ target: { name: 'mode', value } });
                          // Reset to basic tab when hiding current tab
                          if (value === 'simple' && activeTab === 'relationships') {
                            setActiveTab('basic');
                          }
                          if (value === 'advanced' && activeTab === 'schedule') {
                            setActiveTab('basic');
                          }
                        }}
                        data={[
                          {
                            value: 'simple',
                            label: t('treatments.mode.simple', 'Simple'),
                          },
                          {
                            value: 'advanced',
                            label: t('treatments.mode.advanced', 'Treatment Plan'),
                          },
                        ]}
                        size="sm"
                      />
                      <Text size="xs" c="dimmed">
                        {formData.mode === 'advanced'
                          ? t('treatments.mode.advancedDescription', 'Medication-centric plan with per-medication overrides')
                          : t('treatments.mode.simpleDescription', 'Basic tracking with schedule and dosage')}
                      </Text>
                    </Stack>
                  </Grid.Col>
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
                    <Select
                      label={t('treatments.form.treatmentType', 'Treatment Category')}
                      value={formData.treatment_type || null}
                      data={(() => {
                        const predefinedOptions = [
                          { value: 'medication_therapy', label: 'Medication Therapy' },
                          { value: 'physical_therapy', label: 'Physical Therapy' },
                          { value: 'surgery_procedure', label: 'Surgery / Procedure' },
                          { value: 'lifestyle_dietary', label: 'Lifestyle / Dietary' },
                          { value: 'monitoring', label: 'Monitoring / Observation' },
                          { value: 'mental_health', label: 'Mental Health / Counseling' },
                          { value: 'rehabilitation', label: 'Rehabilitation' },
                          { value: 'alternative', label: 'Alternative / Complementary' },
                          { value: 'combination', label: 'Combination Therapy' },
                          { value: 'other', label: 'Other' },
                        ];
                        // If current value is custom (not in predefined list), add it
                        const currentValue = formData.treatment_type;
                        if (currentValue && !predefinedOptions.find(o => o.value === currentValue)) {
                          return [{ value: currentValue, label: currentValue }, ...predefinedOptions];
                        }
                        return predefinedOptions;
                      })()}
                      onChange={(value) => {
                        onInputChange({ target: { name: 'treatment_type', value: value || '' } });
                      }}
                      placeholder={t('treatments.form.treatmentTypePlaceholder', 'Select or type category')}
                      description={t('treatments.form.treatmentTypeDesc', 'Select a category or type your own')}
                      clearable
                      searchable
                      creatable
                      getCreateLabel={(query) => `+ Use "${query}"`}
                      onCreate={(query) => {
                        onInputChange({ target: { name: 'treatment_type', value: query } });
                        return { value: query, label: query };
                      }}
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
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

                {/* Show relationship indicator if relationships exist (edit mode) or pending (create mode) - only in advanced mode */}
                {formData.mode === 'advanced' && badgeCount > 0 && (
                  <Alert
                    variant="light"
                    color="blue"
                    icon={<IconLink size={16} />}
                    mt="md"
                  >
                    <Group justify="space-between">
                      <Text size="sm">
                        {editingTreatment
                          ? `This treatment has ${badgeCount} linked item${badgeCount !== 1 ? 's' : ''} in the Treatment Plan`
                          : `${badgeCount} item${badgeCount !== 1 ? 's' : ''} selected to link when treatment is created`
                        }
                      </Text>
                      <Button
                        variant="subtle"
                        size="xs"
                        onClick={() => setActiveTab('relationships')}
                      >
                        {editingTreatment ? 'View' : 'Edit'}
                      </Button>
                    </Group>
                  </Alert>
                )}
              </Box>
            </Tabs.Panel>

            {/* Schedule & Dosage Tab (simple mode only) */}
            {formData.mode !== 'advanced' && (
              <Tabs.Panel value="schedule">
                <Box mt="md">
                  <Grid>
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
            )}

            {/* Treatment Plan (Relationships) Tab */}
            <Tabs.Panel value="relationships">
              <Box mt="md">
                {editingTreatment ? (
                  <TreatmentRelationshipsManager
                    treatmentId={editingTreatment.id}
                    patientId={editingTreatment.patient_id}
                    isViewMode={false}
                    onCountsChange={setRelationshipCount}
                  />
                ) : (
                  <TreatmentPlanSetup
                    pendingRelationships={pendingRelationships}
                    onRelationshipsChange={setPendingRelationships}
                  />
                )}
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
              {editingTreatment
                ? t('treatments.form.updateTreatment', 'Update Treatment')
                : pendingCount > 0
                  ? t('treatments.form.createWithLinks', `Create Treatment & Link ${pendingCount} Item${pendingCount !== 1 ? 's' : ''}`)
                  : t('treatments.form.createTreatment', 'Create Treatment')
              }
            </SubmitButton>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

export default TreatmentFormWrapper;
