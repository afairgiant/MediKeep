import { useState, useEffect, useCallback } from 'react';
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
  Paper,
  Title,
  Badge,
  ActionIcon,
} from '@mantine/core';
import { DateInput } from '../../adapters/DateInput';
import {
  IconInfoCircle,
  IconChartBar,
  IconFileText,
  IconLink,
  IconNotes,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useDateFormat } from '../../../hooks/useDateFormat';
import SubmitButton from '../../shared/SubmitButton';
import { useFormHandlers } from '../../../hooks/useFormHandlers';
import {
  parseDateInput,
  formatDateInputChange,
} from '../../../utils/dateUtils';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import { TagInput } from '../../common/TagInput';
import InlineTestComponentEntry from './InlineTestComponentEntry';
import ConditionRelationships from '../ConditionRelationships';
import LabResultEncounterRelationships from './LabResultEncounterRelationships';
import { PURPOSE_OPTIONS } from '../../../constants/encounterLabResultConstants';
import logger from '../../../services/logger';

/**
 * Inline picker for selecting conditions/encounters to link during lab result creation.
 * Selections are stored locally and submitted after the lab result is saved.
 */
const PendingRelationshipsPicker = ({
  conditions,
  encounters,
  pendingConditions,
  pendingEncounters,
  onAddCondition,
  onRemoveCondition,
  onAddEncounter,
  onRemoveEncounter,
}) => {
  const { t } = useTranslation(['medical', 'common', 'shared']);
  const [selectedCondition, setSelectedCondition] = useState('');
  const [conditionNote, setConditionNote] = useState('');
  const [selectedEncounter, setSelectedEncounter] = useState('');
  const [encounterPurpose, setEncounterPurpose] = useState('');
  const [encounterNote, setEncounterNote] = useState('');

  const pendingConditionIds = pendingConditions.map(pc =>
    pc.condition_id.toString()
  );
  const availableConditions = conditions
    .filter(c => !pendingConditionIds.includes(c.id.toString()))
    .map(c => ({
      value: c.id.toString(),
      label: `${c.diagnosis}${c.status ? ` (${c.status})` : ''}`,
    }));

  const pendingEncounterIds = pendingEncounters.map(pe =>
    pe.encounter_id.toString()
  );
  const availableEncounters = encounters
    .filter(e => !pendingEncounterIds.includes(e.id.toString()))
    .map(e => ({
      value: e.id.toString(),
      label: `${e.reason}${e.date ? ` (${e.date})` : ''}${e.visit_type ? ` - ${e.visit_type}` : ''}`,
    }));

  const handleAddCondition = () => {
    if (!selectedCondition) return;
    onAddCondition(selectedCondition, conditionNote);
    setSelectedCondition('');
    setConditionNote('');
  };

  const handleAddEncounter = () => {
    if (!selectedEncounter) return;
    onAddEncounter(selectedEncounter, encounterPurpose, encounterNote);
    setSelectedEncounter('');
    setEncounterPurpose('');
    setEncounterNote('');
  };

  const getConditionLabel = conditionId => {
    const c = conditions.find(cond => cond.id === conditionId);
    return c ? c.diagnosis : `Condition #${conditionId}`;
  };

  const getEncounterLabel = encounterId => {
    const e = encounters.find(enc => enc.id === encounterId);
    return e
      ? `${e.reason}${e.date ? ` (${e.date})` : ''}`
      : `Visit #${encounterId}`;
  };

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        {t('labresults:messages.relationshipsSaveFirst')}
      </Text>

      {/* Conditions section */}
      {conditions.length > 0 && (
        <Paper withBorder p="md">
          <Stack gap="sm">
            <Title order={6}>{t('labresults:form.linkConditionsTitle')}</Title>

            {/* Already-added pending conditions */}
            {pendingConditions.map((pc, index) => (
              <Paper key={index} withBorder p="xs">
                <Group justify="space-between">
                  <Stack gap={2}>
                    <Badge variant="light" color="blue" size="sm">
                      {getConditionLabel(pc.condition_id)}
                    </Badge>
                    {pc.relevance_note && (
                      <Text size="xs" c="dimmed" fs="italic">
                        {pc.relevance_note}
                      </Text>
                    )}
                  </Stack>
                  <ActionIcon
                    variant="light"
                    color="red"
                    size="sm"
                    onClick={() => onRemoveCondition(index)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              </Paper>
            ))}

            {/* Add new condition */}
            {availableConditions.length > 0 && (
              <Group gap="sm" align="flex-end">
                <Select
                  style={{ flex: 1 }}
                  placeholder={t('common:modals.chooseConditionToLink')}
                  data={availableConditions}
                  value={selectedCondition}
                  onChange={val => setSelectedCondition(val || '')}
                  searchable
                  clearable
                  size="sm"
                  comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                />
                <TextInput
                  style={{ flex: 1 }}
                  placeholder={t('common:modals.relevanceNoteOptional')}
                  value={conditionNote}
                  onChange={e => setConditionNote(e.target.value)}
                  size="sm"
                />
                <ActionIcon
                  variant="filled"
                  color="blue"
                  size="lg"
                  onClick={handleAddCondition}
                  disabled={!selectedCondition}
                >
                  <IconPlus size={16} />
                </ActionIcon>
              </Group>
            )}
          </Stack>
        </Paper>
      )}

      {/* Encounters section */}
      {encounters.length > 0 && (
        <Paper withBorder p="md">
          <Stack gap="sm">
            <Title order={6}>
              {t('common:labResults.form.linkVisitsTitle', 'Link to Visits')}
            </Title>

            {/* Already-added pending encounters */}
            {pendingEncounters.map((pe, index) => (
              <Paper key={index} withBorder p="xs">
                <Group justify="space-between">
                  <Stack gap={2}>
                    <Badge variant="light" color="indigo" size="sm">
                      {getEncounterLabel(pe.encounter_id)}
                    </Badge>
                    {pe.purpose && (
                      <Badge variant="outline" size="xs">
                        {PURPOSE_OPTIONS.find(o => o.value === pe.purpose)
                          ?.label || pe.purpose}
                      </Badge>
                    )}
                    {pe.relevance_note && (
                      <Text size="xs" c="dimmed" fs="italic">
                        {pe.relevance_note}
                      </Text>
                    )}
                  </Stack>
                  <ActionIcon
                    variant="light"
                    color="red"
                    size="sm"
                    onClick={() => onRemoveEncounter(index)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              </Paper>
            ))}

            {/* Add new encounter */}
            {availableEncounters.length > 0 && (
              <Stack gap="xs">
                <Group gap="sm" align="flex-end">
                  <Select
                    style={{ flex: 2 }}
                    placeholder={t(
                      'common:modals.chooseVisitToLink',
                      'Choose a visit to link'
                    )}
                    data={availableEncounters}
                    value={selectedEncounter}
                    onChange={val => setSelectedEncounter(val || '')}
                    searchable
                    clearable
                    size="sm"
                    comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                  />
                  <Select
                    style={{ flex: 1 }}
                    placeholder={t(
                      'common:modals.selectPurpose',
                      'Select purpose'
                    )}
                    data={PURPOSE_OPTIONS}
                    value={encounterPurpose}
                    onChange={val => setEncounterPurpose(val || '')}
                    clearable
                    size="sm"
                    comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                  />
                  <ActionIcon
                    variant="filled"
                    color="blue"
                    size="lg"
                    onClick={handleAddEncounter}
                    disabled={!selectedEncounter}
                  >
                    <IconPlus size={16} />
                  </ActionIcon>
                </Group>
                {selectedEncounter && (
                  <TextInput
                    placeholder={t(
                      'common:modals.relevanceNoteOptional',
                      'Relevance note (optional)'
                    )}
                    value={encounterNote}
                    onChange={e => setEncounterNote(e.target.value)}
                    size="sm"
                  />
                )}
              </Stack>
            )}
          </Stack>
        </Paper>
      )}

      {conditions.length === 0 && encounters.length === 0 && (
        <Paper withBorder p="md" ta="center">
          <Text c="dimmed">
            {t('labresults:messages.relationshipsCreateInfo')}
          </Text>
        </Paper>
      )}
    </Stack>
  );
};

const LabResultFormWrapper = ({
  isOpen,
  onClose,
  title,
  formData,
  onInputChange,
  onSubmit,
  editingItem,
  practitioners = [],
  isLoading = false,
  onDocumentManagerRef,
  onTestComponentRef,
  onPendingRelationshipsRef,
  onFileUploadComplete,
  onError,
  // Condition relationship props
  conditions = [],
  labResultConditions = {},
  fetchLabResultConditions,
  // Encounter relationship props
  encounters = [],
  labResultEncounters = {},
  fetchLabResultEncounters,
  navigate,
  children,
}) => {
  const { t } = useTranslation(['medical', 'common']);
  const { dateInputFormat, dateParser } = useDateFormat();
  const [activeTab, setActiveTab] = useState('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { handleTextInputChange } = useFormHandlers(onInputChange);

  // Pending relationships for create mode (stored locally until lab result is saved)
  const [pendingConditions, setPendingConditions] = useState([]);
  const [pendingEncounters, setPendingEncounters] = useState([]);

  const statusOptions = [
    { value: 'ordered', label: t('labresults:status.ordered') },
    { value: 'in-progress', label: t('labresults:status.inProgress') },
    { value: 'completed', label: t('labresults:status.completed') },
    { value: 'cancelled', label: t('labresults:status.cancelled') },
  ];

  const categoryOptions = [
    { value: 'blood work', label: t('labresults:category.bloodWork') },
    { value: 'imaging', label: t('labresults:category.imaging') },
    { value: 'pathology', label: t('labresults:category.pathology') },
    { value: 'microbiology', label: t('labresults:category.microbiology') },
    { value: 'chemistry', label: t('labresults:category.chemistry') },
    { value: 'hematology', label: t('labresults:category.hematology') },
    { value: 'hepatology', label: t('labresults:category.hepatology') },
    { value: 'immunology', label: t('labresults:category.immunology') },
    { value: 'genetics', label: t('labresults:category.genetics') },
    { value: 'cardiology', label: t('labresults:category.cardiology') },
    { value: 'pulmonology', label: t('labresults:category.pulmonology') },
    { value: 'hearing', label: t('labresults:category.hearing') },
    { value: 'stomatology', label: t('labresults:category.stomatology') },
    { value: 'other', label: t('shared:fields.other') },
  ];

  const testTypeOptions = [
    { value: 'routine', label: t('labresults:testType.routine') },
    { value: 'urgent', label: t('labresults:testType.urgent') },
    { value: 'emergency', label: t('labresults:testType.emergency') },
    { value: 'follow-up', label: t('labresults:testType.followUp') },
    { value: 'screening', label: t('labresults:testType.screening') },
  ];

  const labResultOptions = [
    { value: 'normal', label: t('labresults:result.normal'), color: 'green' },
    { value: 'abnormal', label: t('labresults:result.abnormal'), color: 'red' },
    { value: 'critical', label: t('labresults:result.critical'), color: 'red' },
    { value: 'high', label: t('labresults:result.high'), color: 'orange' },
    { value: 'low', label: t('labresults:result.low'), color: 'orange' },
    {
      value: 'borderline',
      label: t('labresults:result.borderline'),
      color: 'yellow',
    },
    {
      value: 'inconclusive',
      label: t('labresults:result.inconclusive'),
      color: 'gray',
    },
  ];

  const practitionerOptions = practitioners.map(p => ({
    value: String(p.id),
    label: `${p.name} - ${p.specialty}`,
  }));

  const getStatusColor = status => {
    switch (status) {
      case 'ordered':
        return 'blue';
      case 'in-progress':
        return 'yellow';
      case 'completed':
        return 'green';
      case 'cancelled':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getResultBadge = result => {
    const option = labResultOptions.find(opt => opt.value === result);
    if (!option) return null;
    return (
      <Badge color={option.color} variant="light" size="sm">
        {option.label}
      </Badge>
    );
  };

  const handleDocumentManagerRef = methods => {
    if (onDocumentManagerRef) onDocumentManagerRef(methods);
  };

  const handleDocumentError = error => {
    logger.error('document_manager_error', {
      message: `Document manager error in lab results ${editingItem ? 'edit' : 'create'}`,
      labResultId: editingItem?.id,
      error,
      component: 'LabResultFormWrapper',
    });
    if (onError) onError(error);
  };

  const handleDocumentUploadComplete = (
    success,
    completedCount,
    failedCount
  ) => {
    logger.info('lab_results_upload_completed', {
      message: 'File upload completed in lab results form',
      labResultId: editingItem?.id,
      success,
      completedCount,
      failedCount,
      component: 'LabResultFormWrapper',
    });
    if (onFileUploadComplete)
      onFileUploadComplete(success, completedCount, failedCount);
  };

  useEffect(() => {
    if (isOpen) setActiveTab('basic');
    if (!isOpen) {
      setIsSubmitting(false);
      setPendingConditions([]);
      setPendingEncounters([]);
    }
  }, [isOpen]);

  // Expose pending relationships ref to parent (same pattern as onTestComponentRef)
  useEffect(() => {
    if (onPendingRelationshipsRef) {
      onPendingRelationshipsRef({
        hasPendingRelationships: () =>
          pendingConditions.length > 0 || pendingEncounters.length > 0,
        getPendingRelationships: () => ({
          conditions: pendingConditions,
          encounters: pendingEncounters,
        }),
      });
    }
  }, [onPendingRelationshipsRef, pendingConditions, pendingEncounters]);

  // Pending condition helpers
  const addPendingCondition = useCallback((conditionId, relevanceNote) => {
    setPendingConditions(prev => [
      ...prev,
      {
        condition_id: parseInt(conditionId),
        relevance_note: relevanceNote || null,
      },
    ]);
  }, []);

  const removePendingCondition = useCallback(index => {
    setPendingConditions(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Pending encounter helpers
  const addPendingEncounter = useCallback(
    (encounterId, purpose, relevanceNote) => {
      setPendingEncounters(prev => [
        ...prev,
        {
          encounter_id: parseInt(encounterId),
          purpose: purpose || null,
          relevance_note: relevanceNote || null,
        },
      ]);
    },
    []
  );

  const removePendingEncounter = useCallback(index => {
    setPendingEncounters(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(e);
      setIsSubmitting(false);
    } catch (error) {
      logger.error('lab_result_form_wrapper_error', {
        message: 'Error in LabResultFormWrapper',
        labResultId: editingItem?.id,
        error: error.message,
        component: 'LabResultFormWrapper',
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
      closeOnClickOutside={!isLoading && !isSubmitting}
      closeOnEscape={!isLoading && !isSubmitting}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab
                value="basic"
                leftSection={<IconInfoCircle size={16} />}
              >
                {t('shared:tabs.basicInfo')}
              </Tabs.Tab>
              <Tabs.Tab
                value="results"
                leftSection={<IconChartBar size={16} />}
              >
                {t('labresults:tabs.resultsStatus')}
              </Tabs.Tab>
              <Tabs.Tab
                value="documents"
                leftSection={<IconFileText size={16} />}
              >
                {editingItem
                  ? t('shared:tabs.documents')
                  : t('shared:tabs.addFiles')}
              </Tabs.Tab>
              <Tabs.Tab
                value="relationships"
                leftSection={<IconLink size={16} />}
              >
                {t('labresults:tabs.relationships')}
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
                      label={t('shared:fields.testName')}
                      value={formData.test_name || ''}
                      onChange={handleTextInputChange('test_name')}
                      placeholder={t('labresults:testName.placeholder')}
                      description={t('labresults:testName.description')}
                      required
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <TextInput
                      label={t('shared:fields.testCode')}
                      value={formData.test_code || ''}
                      onChange={handleTextInputChange('test_code')}
                      placeholder={t('labresults:testCode.placeholder')}
                      description={t('labresults:testCode.description')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('labresults:testCategory.label')}
                      value={formData.test_category || null}
                      data={categoryOptions}
                      onChange={value => {
                        onInputChange({
                          target: { name: 'test_category', value: value || '' },
                        });
                      }}
                      placeholder={t('shared:labels.selectCategory')}
                      description={t('labresults:testCategory.description')}
                      searchable
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('labresults:testTypeField.label')}
                      value={formData.test_type || null}
                      data={testTypeOptions}
                      onChange={value => {
                        onInputChange({
                          target: { name: 'test_type', value: value || '' },
                        });
                      }}
                      placeholder={t('labresults:testTypeField.placeholder')}
                      description={t('labresults:testTypeField.description')}
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label={t('labresults:testingFacility.label')}
                      value={formData.facility || ''}
                      onChange={handleTextInputChange('facility')}
                      placeholder={t('labresults:testingFacility.placeholder')}
                      description={t('labresults:testingFacility.description')}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('shared:labels.orderingPractitioner')}
                      value={
                        formData.practitioner_id
                          ? String(formData.practitioner_id)
                          : null
                      }
                      data={practitionerOptions}
                      onChange={value => {
                        onInputChange({
                          target: {
                            name: 'practitioner_id',
                            value: value || '',
                          },
                        });
                      }}
                      placeholder={t('shared:fields.selectPractitioner')}
                      description={t(
                        'labresults:orderingPractitioner.description'
                      )}
                      searchable
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
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

            {/* Results & Status Tab (includes Test Components) */}
            <Tabs.Panel value="results">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('labresults:testStatus.label')}
                      value={formData.status || null}
                      data={statusOptions}
                      onChange={value => {
                        onInputChange({
                          target: { name: 'status', value: value || '' },
                        });
                      }}
                      placeholder={t('shared:fields.selectStatus')}
                      description={t('labresults:testStatus.description')}
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Select
                      label={t('shared:labels.labResult')}
                      value={formData.labs_result || null}
                      data={labResultOptions}
                      onChange={value => {
                        onInputChange({
                          target: { name: 'labs_result', value: value || '' },
                        });
                      }}
                      placeholder={t('labresults:labResult.placeholder')}
                      description={t('labresults:labResult.description')}
                      clearable
                      comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInput
                      label={t('shared:labels.orderedDate')}
                      value={parseDateInput(formData.ordered_date)}
                      onChange={date => {
                        const formattedDate = formatDateInputChange(date);
                        onInputChange({
                          target: {
                            name: 'ordered_date',
                            value: formattedDate,
                          },
                        });
                      }}
                      placeholder={dateInputFormat}
                      valueFormat={dateInputFormat}
                      dateParser={dateParser}
                      description={t('labresults:orderedDate.description')}
                      clearable
                      firstDayOfWeek={0}
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <DateInput
                      label={t('shared:labels.completedDate')}
                      value={parseDateInput(formData.completed_date)}
                      onChange={date => {
                        const formattedDate = formatDateInputChange(date);
                        onInputChange({
                          target: {
                            name: 'completed_date',
                            value: formattedDate,
                          },
                        });
                      }}
                      placeholder={dateInputFormat}
                      valueFormat={dateInputFormat}
                      dateParser={dateParser}
                      description={t('labresults:completedDate.description')}
                      clearable
                      firstDayOfWeek={0}
                      popoverProps={{ withinPortal: true, zIndex: 3000 }}
                    />
                  </Grid.Col>
                  {formData.status && (
                    <Grid.Col span={12}>
                      <Box>
                        <Text size="sm" fw={500} mb="xs">
                          {t('labresults:form.statusIndicator')}
                        </Text>
                        <Badge
                          color={getStatusColor(formData.status)}
                          variant="light"
                          size="sm"
                        >
                          {statusOptions.find(
                            opt => opt.value === formData.status
                          )?.label || formData.status}
                        </Badge>
                      </Box>
                    </Grid.Col>
                  )}
                  {formData.labs_result && (
                    <Grid.Col span={12}>
                      <Box>
                        <Text size="sm" fw={500} mb="xs">
                          {t('labresults:form.resultIndicator')}
                        </Text>
                        {getResultBadge(formData.labs_result)}
                      </Box>
                    </Grid.Col>
                  )}
                  <Grid.Col span={12}>
                    {!editingItem ? (
                      <InlineTestComponentEntry
                        onRef={onTestComponentRef}
                        disabled={isLoading || isSubmitting}
                      />
                    ) : (
                      <Paper withBorder p="md">
                        <Text size="sm" c="dimmed">
                          {t('labresults:messages.testComponentsEditInfo')}
                        </Text>
                      </Paper>
                    )}
                  </Grid.Col>
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Documents Tab */}
            <Tabs.Panel value="documents">
              <Box mt="md">
                <DocumentManagerWithProgress
                  entityType="lab-result"
                  entityId={editingItem?.id || null}
                  mode={editingItem ? 'edit' : 'create'}
                  onUploadPendingFiles={handleDocumentManagerRef}
                  showProgressModal={true}
                  onUploadComplete={handleDocumentUploadComplete}
                  onError={handleDocumentError}
                />
              </Box>
            </Tabs.Panel>

            {/* Relationships Tab */}
            <Tabs.Panel value="relationships">
              <Box mt="md">
                {editingItem ? (
                  /* Edit mode: use full relationship components with API calls */
                  <Stack gap="md">
                    {conditions.length > 0 && (
                      <Paper withBorder p="md" bg="var(--color-bg-secondary)">
                        <Stack gap="md">
                          <Title order={5}>
                            {t('labresults:form.linkConditionsTitle')}
                          </Title>
                          <Text size="sm" c="dimmed">
                            {t('labresults:form.linkConditionsDescription')}
                          </Text>
                          <ConditionRelationships
                            labResultId={editingItem.id}
                            labResultConditions={labResultConditions}
                            conditions={conditions}
                            fetchLabResultConditions={fetchLabResultConditions}
                            navigate={navigate}
                          />
                        </Stack>
                      </Paper>
                    )}
                    {encounters.length > 0 && (
                      <Paper withBorder p="md" bg="var(--color-bg-secondary)">
                        <Stack gap="md">
                          <Title order={5}>
                            {t(
                              'common:labResults.form.linkVisitsTitle',
                              'Link to Visits'
                            )}
                          </Title>
                          <Text size="sm" c="dimmed">
                            {t(
                              'common:labResults.form.linkVisitsDescription',
                              'Associate this lab result with visits where it was ordered or reviewed.'
                            )}
                          </Text>
                          <LabResultEncounterRelationships
                            labResultId={editingItem.id}
                            labResultEncounters={labResultEncounters}
                            encounters={encounters}
                            fetchLabResultEncounters={fetchLabResultEncounters}
                            navigate={navigate}
                          />
                        </Stack>
                      </Paper>
                    )}
                    {conditions.length === 0 && encounters.length === 0 && (
                      <Paper withBorder p="md" ta="center">
                        <Text c="dimmed">
                          {t('labresults:messages.relationshipsCreateInfo')}
                        </Text>
                      </Paper>
                    )}
                  </Stack>
                ) : (
                  /* Create mode: pending relationship picker (saved after lab result is created) */
                  <PendingRelationshipsPicker
                    conditions={conditions}
                    encounters={encounters}
                    pendingConditions={pendingConditions}
                    pendingEncounters={pendingEncounters}
                    onAddCondition={addPendingCondition}
                    onRemoveCondition={removePendingCondition}
                    onAddEncounter={addPendingEncounter}
                    onRemoveEncounter={removePendingEncounter}
                  />
                )}
              </Box>
            </Tabs.Panel>

            {/* Notes Tab */}
            <Tabs.Panel value="notes">
              <Box mt="md">
                <Textarea
                  label={t('shared:fields.additionalNotes')}
                  value={formData.notes || ''}
                  onChange={handleTextInputChange('notes')}
                  placeholder={t('labresults:additionalNotes.placeholder')}
                  description={t('labresults:additionalNotes.description')}
                  rows={5}
                  minRows={3}
                  autosize
                  maxLength={5000}
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
              disabled={!formData.test_name?.trim()}
            >
              {editingItem
                ? t('common:buttons.update')
                : t('common:buttons.create')}{' '}
              {t('shared:categories.lab_results')}
            </SubmitButton>
          </Group>
        </Stack>
      </form>

      {children}
    </Modal>
  );
};

export default LabResultFormWrapper;
