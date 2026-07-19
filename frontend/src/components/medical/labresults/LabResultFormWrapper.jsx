import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Modal,
  Tabs,
  Box,
  Stack,
  Group,
  Button,
  Grid,
  TextInput,
  NumberInput,
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
  IconFlask,
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
import PractitionerSelectWithCreate from '../practitioners/PractitionerSelectWithCreate';
import ConditionRelationships from '../ConditionRelationships';
import LabResultEncounterRelationships from './LabResultEncounterRelationships';
import LabResultMedicationRelationships from './LabResultMedicationRelationships';
import LabResultProcedureRelationships from './LabResultProcedureRelationships';
import LabResultTreatmentRelationships from './LabResultTreatmentRelationships';
import TestComponentsTab from './TestComponentsTab';
import AdvancedModeSwitch from './AdvancedModeSwitch';
import { PURPOSE_OPTIONS } from '../../../constants/encounterLabResultConstants';
import {
  PURPOSE_OPTIONS as TREATMENT_PURPOSE_OPTIONS,
  getPurposeLabel as getTreatmentPurposeLabel,
} from '../../../constants/treatmentLabResultConstants';
import logger from '../../../services/logger';

/**
 * Inline picker for selecting conditions/encounters to link during lab result creation.
 * Selections are stored locally and submitted after the lab result is saved.
 */
const PendingRelationshipsPicker = ({
  conditions,
  encounters,
  medications,
  procedures,
  treatments,
  pendingConditions,
  pendingEncounters,
  pendingMedications,
  pendingProcedures,
  pendingTreatments,
  onAddCondition,
  onRemoveCondition,
  onAddEncounter,
  onRemoveEncounter,
  onAddMedication,
  onRemoveMedication,
  onAddProcedure,
  onRemoveProcedure,
  onAddTreatment,
  onRemoveTreatment,
}) => {
  const { t } = useTranslation(['medical', 'common', 'shared']);
  const [selectedCondition, setSelectedCondition] = useState('');
  const [conditionNote, setConditionNote] = useState('');
  const [selectedEncounter, setSelectedEncounter] = useState('');
  const [encounterPurpose, setEncounterPurpose] = useState('');
  const [encounterNote, setEncounterNote] = useState('');
  const [selectedMedication, setSelectedMedication] = useState('');
  const [medicationNote, setMedicationNote] = useState('');
  const [selectedProcedure, setSelectedProcedure] = useState('');
  const [procedureNote, setProcedureNote] = useState('');
  const [selectedTreatment, setSelectedTreatment] = useState('');
  const [treatmentPurpose, setTreatmentPurpose] = useState('');
  const [treatmentFrequency, setTreatmentFrequency] = useState('');
  const [treatmentNote, setTreatmentNote] = useState('');

  const availableConditions = useMemo(() => {
    const pendingConditionIds = pendingConditions.map(pc =>
      pc.condition_id.toString()
    );
    return conditions
      .filter(c => !pendingConditionIds.includes(c.id.toString()))
      .map(c => ({
        value: c.id.toString(),
        label: `${c.diagnosis}${c.status ? ` (${c.status})` : ''}`,
      }));
  }, [conditions, pendingConditions]);

  const availableEncounters = useMemo(() => {
    const pendingEncounterIds = pendingEncounters.map(pe =>
      pe.encounter_id.toString()
    );
    return encounters
      .filter(e => !pendingEncounterIds.includes(e.id.toString()))
      .map(e => ({
        value: e.id.toString(),
        label: `${e.reason}${e.date ? ` (${e.date})` : ''}${e.visit_type ? ` - ${e.visit_type}` : ''}`,
      }));
  }, [encounters, pendingEncounters]);

  const availableMedications = useMemo(() => {
    const pendingMedicationIds = pendingMedications.map(pm =>
      pm.medication_id.toString()
    );
    return medications
      .filter(m => !pendingMedicationIds.includes(m.id.toString()))
      .map(m => ({
        value: m.id.toString(),
        label: `${m.medication_name}${m.dosage ? ` (${m.dosage})` : ''}`,
      }));
  }, [medications, pendingMedications]);

  const availableProcedures = useMemo(() => {
    const pendingProcedureIds = pendingProcedures.map(pp =>
      pp.procedure_id.toString()
    );
    return procedures
      .filter(p => !pendingProcedureIds.includes(p.id.toString()))
      .map(p => ({
        value: p.id.toString(),
        label: `${p.procedure_name}${p.date ? ` (${p.date})` : ''}`,
      }));
  }, [procedures, pendingProcedures]);

  const availableTreatments = useMemo(() => {
    const pendingTreatmentIds = pendingTreatments.map(pt =>
      pt.treatment_id.toString()
    );
    return treatments
      .filter(tr => !pendingTreatmentIds.includes(tr.id.toString()))
      .map(tr => ({
        value: tr.id.toString(),
        label: tr.treatment_name,
      }));
  }, [treatments, pendingTreatments]);

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

  const handleAddMedication = () => {
    if (!selectedMedication) return;
    onAddMedication(selectedMedication, medicationNote);
    setSelectedMedication('');
    setMedicationNote('');
  };

  const handleAddProcedure = () => {
    if (!selectedProcedure) return;
    onAddProcedure(selectedProcedure, procedureNote);
    setSelectedProcedure('');
    setProcedureNote('');
  };

  const handleAddTreatment = () => {
    if (!selectedTreatment) return;
    onAddTreatment(
      selectedTreatment,
      treatmentPurpose,
      treatmentFrequency,
      treatmentNote
    );
    setSelectedTreatment('');
    setTreatmentPurpose('');
    setTreatmentFrequency('');
    setTreatmentNote('');
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

  const getMedicationLabel = medicationId => {
    const m = medications.find(med => med.id === medicationId);
    return m ? m.medication_name : `Medication #${medicationId}`;
  };

  const getProcedureLabel = procedureId => {
    const p = procedures.find(proc => proc.id === procedureId);
    return p ? p.procedure_name : `Procedure #${procedureId}`;
  };

  const getTreatmentLabel = treatmentId => {
    const tr = treatments.find(t2 => t2.id === treatmentId);
    return tr ? tr.treatment_name : `Treatment #${treatmentId}`;
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
                    aria-label={t('labresults:pendingRelationships.removeCondition')}
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
                  aria-label={t('labresults:pendingRelationships.addCondition')}
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
                    aria-label={t('labresults:pendingRelationships.removeVisit')}
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
                    aria-label={t('labresults:pendingRelationships.addVisit')}
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

      {/* Medications section */}
      {medications.length > 0 && (
        <Paper withBorder p="md">
          <Stack gap="sm">
            <Title order={6}>
              {t(
                'labresults:form.linkMedicationsTitle',
                'Link to Medications'
              )}
            </Title>

            {/* Already-added pending medications */}
            {pendingMedications.map((pm, index) => (
              <Paper key={index} withBorder p="xs">
                <Group justify="space-between">
                  <Stack gap={2}>
                    <Badge variant="light" color="teal" size="sm">
                      {getMedicationLabel(pm.medication_id)}
                    </Badge>
                    {pm.relevance_note && (
                      <Text size="xs" c="dimmed" fs="italic">
                        {pm.relevance_note}
                      </Text>
                    )}
                  </Stack>
                  <ActionIcon
                    variant="light"
                    color="red"
                    size="sm"
                    onClick={() => onRemoveMedication(index)}
                    aria-label={t(
                      'labresults:pendingRelationships.removeMedication'
                    )}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              </Paper>
            ))}

            {/* Add new medication */}
            {availableMedications.length > 0 && (
              <Group gap="sm" align="flex-end">
                <Select
                  style={{ flex: 1 }}
                  placeholder={t('common:modals.chooseOneMedicationToLink')}
                  data={availableMedications}
                  value={selectedMedication}
                  onChange={val => setSelectedMedication(val || '')}
                  searchable
                  clearable
                  size="sm"
                  comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                />
                <TextInput
                  style={{ flex: 1 }}
                  placeholder={t('common:modals.relevanceNoteOptional')}
                  value={medicationNote}
                  onChange={e => setMedicationNote(e.target.value)}
                  size="sm"
                />
                <ActionIcon
                  variant="filled"
                  color="blue"
                  size="lg"
                  onClick={handleAddMedication}
                  disabled={!selectedMedication}
                  aria-label={t(
                    'labresults:pendingRelationships.addMedication'
                  )}
                >
                  <IconPlus size={16} />
                </ActionIcon>
              </Group>
            )}
          </Stack>
        </Paper>
      )}

      {/* Procedures section */}
      {procedures.length > 0 && (
        <Paper withBorder p="md">
          <Stack gap="sm">
            <Title order={6}>
              {t(
                'labresults:form.linkProceduresTitle',
                'Link to Procedures'
              )}
            </Title>

            {/* Already-added pending procedures */}
            {pendingProcedures.map((pp, index) => (
              <Paper key={index} withBorder p="xs">
                <Group justify="space-between">
                  <Stack gap={2}>
                    <Badge variant="light" color="grape" size="sm">
                      {getProcedureLabel(pp.procedure_id)}
                    </Badge>
                    {pp.relevance_note && (
                      <Text size="xs" c="dimmed" fs="italic">
                        {pp.relevance_note}
                      </Text>
                    )}
                  </Stack>
                  <ActionIcon
                    variant="light"
                    color="red"
                    size="sm"
                    onClick={() => onRemoveProcedure(index)}
                    aria-label={t(
                      'labresults:pendingRelationships.removeProcedure'
                    )}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              </Paper>
            ))}

            {/* Add new procedure */}
            {availableProcedures.length > 0 && (
              <Group gap="sm" align="flex-end">
                <Select
                  style={{ flex: 1 }}
                  placeholder={t('common:modals.chooseProcedureToLink')}
                  data={availableProcedures}
                  value={selectedProcedure}
                  onChange={val => setSelectedProcedure(val || '')}
                  searchable
                  clearable
                  size="sm"
                  comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                />
                <TextInput
                  style={{ flex: 1 }}
                  placeholder={t('common:modals.relevanceNoteOptional')}
                  value={procedureNote}
                  onChange={e => setProcedureNote(e.target.value)}
                  size="sm"
                />
                <ActionIcon
                  variant="filled"
                  color="blue"
                  size="lg"
                  onClick={handleAddProcedure}
                  disabled={!selectedProcedure}
                  aria-label={t(
                    'labresults:pendingRelationships.addProcedure'
                  )}
                >
                  <IconPlus size={16} />
                </ActionIcon>
              </Group>
            )}
          </Stack>
        </Paper>
      )}

      {/* Treatments section */}
      {treatments.length > 0 && (
        <Paper withBorder p="md">
          <Stack gap="sm">
            <Title order={6}>
              {t(
                'labresults:form.linkTreatmentsTitle',
                'Link to Treatments'
              )}
            </Title>

            {/* Already-added pending treatments */}
            {pendingTreatments.map((pt, index) => (
              <Paper key={index} withBorder p="xs">
                <Group justify="space-between">
                  <Stack gap={2}>
                    <Badge variant="light" color="orange" size="sm">
                      {getTreatmentLabel(pt.treatment_id)}
                    </Badge>
                    {pt.purpose && (
                      <Badge variant="outline" size="xs">
                        {getTreatmentPurposeLabel(pt.purpose)}
                      </Badge>
                    )}
                    {pt.expected_frequency && (
                      <Text size="xs" c="dimmed">
                        {pt.expected_frequency}
                      </Text>
                    )}
                    {pt.relevance_note && (
                      <Text size="xs" c="dimmed" fs="italic">
                        {pt.relevance_note}
                      </Text>
                    )}
                  </Stack>
                  <ActionIcon
                    variant="light"
                    color="red"
                    size="sm"
                    onClick={() => onRemoveTreatment(index)}
                    aria-label={t(
                      'labresults:pendingRelationships.removeTreatment'
                    )}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              </Paper>
            ))}

            {/* Add new treatment */}
            {availableTreatments.length > 0 && (
              <Stack gap="xs">
                <Group gap="sm" align="flex-end">
                  <Select
                    style={{ flex: 2 }}
                    placeholder={t(
                      'common:modals.chooseTreatmentToLink',
                      'Choose a treatment to link'
                    )}
                    data={availableTreatments}
                    value={selectedTreatment}
                    onChange={val => setSelectedTreatment(val || '')}
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
                    data={TREATMENT_PURPOSE_OPTIONS}
                    value={treatmentPurpose}
                    onChange={val => setTreatmentPurpose(val || '')}
                    clearable
                    size="sm"
                    comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                  />
                  <ActionIcon
                    variant="filled"
                    color="blue"
                    size="lg"
                    onClick={handleAddTreatment}
                    disabled={!selectedTreatment}
                    aria-label={t(
                      'labresults:pendingRelationships.addTreatment'
                    )}
                  >
                    <IconPlus size={16} />
                  </ActionIcon>
                </Group>
                {selectedTreatment && (
                  <Group gap="sm">
                    <TextInput
                      style={{ flex: 1 }}
                      placeholder={t(
                        'common:labels.expectedFrequency',
                        'Expected frequency'
                      )}
                      value={treatmentFrequency}
                      onChange={e => setTreatmentFrequency(e.target.value)}
                      size="sm"
                    />
                    <TextInput
                      style={{ flex: 1 }}
                      placeholder={t(
                        'common:modals.relevanceNoteOptional',
                        'Relevance note (optional)'
                      )}
                      value={treatmentNote}
                      onChange={e => setTreatmentNote(e.target.value)}
                      size="sm"
                    />
                  </Group>
                )}
              </Stack>
            )}
          </Stack>
        </Paper>
      )}

      {conditions.length === 0 &&
        encounters.length === 0 &&
        medications.length === 0 &&
        procedures.length === 0 &&
        treatments.length === 0 && (
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
  // Medication relationship props
  medications = [],
  labResultMedications = {},
  fetchLabResultMedications,
  // Procedure relationship props
  procedures = [],
  labResultProcedures = {},
  fetchLabResultProcedures,
  // Treatment relationship props
  treatments = [],
  labResultTreatments = {},
  fetchLabResultTreatments,
  navigate,
  isGroupedResult = false,
  postCreate = false,
  advancedCreate = false,
  onAdvancedModeChange,
  children,
}) => {
  const { t } = useTranslation(['medical', 'common', 'shared']);
  const { dateInputFormat, dateParser } = useDateFormat();
  const [activeTab, setActiveTab] = useState('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { handleTextInputChange } = useFormHandlers(onInputChange);

  // Pending relationships for create mode (stored locally until lab result is saved)
  const [pendingConditions, setPendingConditions] = useState([]);
  const [pendingEncounters, setPendingEncounters] = useState([]);
  const [pendingMedications, setPendingMedications] = useState([]);
  const [pendingProcedures, setPendingProcedures] = useState([]);
  const [pendingTreatments, setPendingTreatments] = useState([]);

  // Notes and create-mode relationship linking are only shown once the record exists
  // (edit mode) or when the user has opted into the advanced create form.
  const showAdvancedTabs = !!editingItem || advancedCreate;
  // The mode toggle itself only makes sense during a true create (not edit/post-create).
  const showAdvancedToggle = !editingItem && !!onAdvancedModeChange;

  const statusOptions = [
    { value: 'ordered', label: t('labresults:status.ordered') },
    { value: 'in-progress', label: t('labresults:status.inProgress') },
    { value: 'completed', label: t('labresults:status.completed') },
    { value: 'cancelled', label: t('labresults:status.cancelled') },
  ];

  const categoryOptions = [
    { value: 'blood work', label: t('labresults:category.bloodWork') },
    { value: 'hematology', label: t('labresults:category.hematology') },
    { value: 'imaging', label: t('labresults:category.imaging') },
    { value: 'pathology', label: t('labresults:category.pathology') },
    { value: 'microbiology', label: t('labresults:category.microbiology') },
    { value: 'chemistry', label: t('labresults:category.chemistry') },
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
      setPendingMedications([]);
      setPendingProcedures([]);
      setPendingTreatments([]);
    }
  }, [isOpen]);

  // Latest pending relationships, read live by the methods object below so that
  // adding/removing an item doesn't re-notify the parent (which would re-render it).
  const pendingRelationshipsRef = useRef({
    pendingConditions,
    pendingEncounters,
    pendingMedications,
    pendingProcedures,
    pendingTreatments,
  });
  pendingRelationshipsRef.current = {
    pendingConditions,
    pendingEncounters,
    pendingMedications,
    pendingProcedures,
    pendingTreatments,
  };

  // Expose pending relationships ref to parent (same pattern as onDocumentManagerRef).
  // Only re-registers when the callback identity changes, not on every pending edit.
  useEffect(() => {
    if (onPendingRelationshipsRef) {
      onPendingRelationshipsRef({
        hasPendingRelationships: () =>
          pendingRelationshipsRef.current.pendingConditions.length > 0 ||
          pendingRelationshipsRef.current.pendingEncounters.length > 0 ||
          pendingRelationshipsRef.current.pendingMedications.length > 0 ||
          pendingRelationshipsRef.current.pendingProcedures.length > 0 ||
          pendingRelationshipsRef.current.pendingTreatments.length > 0,
        getPendingRelationships: () => ({
          conditions: pendingRelationshipsRef.current.pendingConditions,
          encounters: pendingRelationshipsRef.current.pendingEncounters,
          medications: pendingRelationshipsRef.current.pendingMedications,
          procedures: pendingRelationshipsRef.current.pendingProcedures,
          treatments: pendingRelationshipsRef.current.pendingTreatments,
        }),
      });
    }
  }, [onPendingRelationshipsRef]);

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

  // Pending medication helpers
  const addPendingMedication = useCallback((medicationId, relevanceNote) => {
    setPendingMedications(prev => [
      ...prev,
      {
        medication_id: parseInt(medicationId),
        relevance_note: relevanceNote || null,
      },
    ]);
  }, []);

  const removePendingMedication = useCallback(index => {
    setPendingMedications(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Pending procedure helpers
  const addPendingProcedure = useCallback((procedureId, relevanceNote) => {
    setPendingProcedures(prev => [
      ...prev,
      {
        procedure_id: parseInt(procedureId),
        relevance_note: relevanceNote || null,
      },
    ]);
  }, []);

  const removePendingProcedure = useCallback(index => {
    setPendingProcedures(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Pending treatment helpers
  const addPendingTreatment = useCallback(
    (treatmentId, purpose, expectedFrequency, relevanceNote) => {
      setPendingTreatments(prev => [
        ...prev,
        {
          treatment_id: parseInt(treatmentId),
          purpose: purpose || null,
          expected_frequency: expectedFrequency || null,
          relevance_note: relevanceNote || null,
        },
      ]);
    },
    []
  );

  const removePendingTreatment = useCallback(index => {
    setPendingTreatments(prev => prev.filter((_, i) => i !== index));
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
              {isGroupedResult && editingItem && (
                <Tabs.Tab
                  value="test-results"
                  leftSection={<IconFlask size={16} />}
                >
                  {t('labresults:modal.tabs.testComponents', 'Test Results')}
                </Tabs.Tab>
              )}
              {!isGroupedResult && (
                <Tabs.Tab
                  value="results"
                  leftSection={<IconChartBar size={16} />}
                >
                  {t('labresults:tabs.resultsStatus')}
                </Tabs.Tab>
              )}
              <Tabs.Tab
                value="documents"
                leftSection={<IconFileText size={16} />}
              >
                {editingItem
                  ? t('shared:tabs.documents')
                  : t('shared:tabs.addFiles')}
              </Tabs.Tab>
              {showAdvancedTabs && (
                <Tabs.Tab
                  value="relationships"
                  leftSection={<IconLink size={16} />}
                >
                  {t('labresults:tabs.relationships')}
                </Tabs.Tab>
              )}
              {showAdvancedTabs && (
                <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                  {t('shared:tabs.notes')}
                </Tabs.Tab>
              )}
            </Tabs.List>

            {/* Basic Info Tab */}
            <Tabs.Panel value="basic">
              <Box mt="md">
                <Grid>
                  <Grid.Col span={{ base: 12, sm: isGroupedResult ? 12 : 8 }}>
                    <TextInput
                      label={t('shared:fields.testName')}
                      value={formData.test_name || ''}
                      onChange={handleTextInputChange('test_name')}
                      placeholder={t('labresults:testName.placeholder')}
                      description={t('labresults:testName.description')}
                      required
                    />
                  </Grid.Col>
                  {!isGroupedResult && (
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <TextInput
                        label={t('shared:fields.testCode')}
                        value={formData.test_code || ''}
                        onChange={handleTextInputChange('test_code')}
                        placeholder={t('labresults:testCode.placeholder')}
                        description={t('labresults:testCode.description')}
                      />
                    </Grid.Col>
                  )}
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
                  {!isGroupedResult && (
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
                  )}
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
                    <PractitionerSelectWithCreate
                      value={
                        formData.practitioner_id
                          ? String(formData.practitioner_id)
                          : null
                      }
                      onChange={value => {
                        onInputChange({
                          target: {
                            name: 'practitioner_id',
                            value: value || '',
                          },
                        });
                      }}
                      practitioners={practitioners}
                      label={t('shared:labels.orderingPractitioner')}
                      placeholder={t('shared:fields.selectPractitioner')}
                      description={t(
                        'labresults:orderingPractitioner.description'
                      )}
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
                </Grid>
              </Box>
            </Tabs.Panel>

            {/* Test Results Tab — panels only, edit mode only */}
            {isGroupedResult && editingItem && (
              <Tabs.Panel value="test-results">
                <Box mt="md">
                  <TestComponentsTab
                    key={`test-components-${editingItem.id}`}
                    labResultId={editingItem.id}
                    isViewMode={false}
                    onError={onError}
                  />
                </Box>
              </Tabs.Panel>
            )}

            {/* Results & Status Tab — not shown for panels */}
            {!isGroupedResult && <Tabs.Panel value="results">
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
                  {!isGroupedResult && (
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
                  )}
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
                  {!isGroupedResult && formData.labs_result && (
                    <Grid.Col span={12}>
                      <Box>
                        <Text size="sm" fw={500} mb="xs">
                          {t('labresults:form.resultIndicator')}
                        </Text>
                        {getResultBadge(formData.labs_result)}
                      </Box>
                    </Grid.Col>
                  )}
                  {/* Numeric result section — not applicable for grouped (PDF-master) results */}
                  {!isGroupedResult && <Grid.Col span={12}>
                    <Paper withBorder p="sm" radius="md">
                      <Text size="sm" fw={500} mb="sm">
                        {t('labresults:numericResult.sectionLabel', 'Numeric Result (optional)')}
                      </Text>
                      <Text size="xs" c="dimmed" mb="sm">
                        {t(
                          'labresults:numericResult.sectionDescription',
                          'Enter a measured value and reference range to enable trend charting for stacked results.'
                        )}
                      </Text>
                      <Grid>
                        <Grid.Col span={{ base: 12, sm: 6 }}>
                          <NumberInput
                            label={t('labresults:numericResult.valueLabel', 'Value')}
                            value={formData.value ?? ''}
                            onChange={val =>
                              onInputChange({
                                target: {
                                  name: 'value',
                                  value: val === '' ? null : val,
                                },
                              })
                            }
                            placeholder={t('labresults:numericResult.valuePlaceholder', 'e.g. 6.2')}
                            decimalScale={6}
                            allowDecimal
                            clearable
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 6 }}>
                          <TextInput
                            label={t('labresults:numericResult.unitLabel', 'Unit')}
                            value={formData.unit || ''}
                            onChange={e =>
                              onInputChange({
                                target: { name: 'unit', value: e.target.value },
                              })
                            }
                            placeholder={t('labresults:numericResult.unitPlaceholder', 'e.g. mg/dL, mmol/L')}
                            maxLength={50}
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 4 }}>
                          <NumberInput
                            label={t('labresults:numericResult.refMinLabel', 'Range min')}
                            value={formData.ref_range_min ?? ''}
                            onChange={val =>
                              onInputChange({
                                target: {
                                  name: 'ref_range_min',
                                  value: val === '' ? null : val,
                                },
                              })
                            }
                            placeholder={t('labresults:numericResult.refMinPlaceholder', 'e.g. 4.0')}
                            decimalScale={6}
                            allowDecimal
                            clearable
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 4 }}>
                          <NumberInput
                            label={t('labresults:numericResult.refMaxLabel', 'Range max')}
                            value={formData.ref_range_max ?? ''}
                            onChange={val =>
                              onInputChange({
                                target: {
                                  name: 'ref_range_max',
                                  value: val === '' ? null : val,
                                },
                              })
                            }
                            placeholder={t('labresults:numericResult.refMaxPlaceholder', 'e.g. 5.6')}
                            decimalScale={6}
                            allowDecimal
                            clearable
                          />
                        </Grid.Col>
                        <Grid.Col span={{ base: 12, sm: 4 }}>
                          <TextInput
                            label={t('labresults:numericResult.refTextLabel', 'Range text')}
                            value={formData.ref_range_text || ''}
                            onChange={e =>
                              onInputChange({
                                target: { name: 'ref_range_text', value: e.target.value },
                              })
                            }
                            placeholder={t('labresults:numericResult.refTextPlaceholder', 'e.g. 4.0-5.6 or <200')}
                            description={t('labresults:numericResult.refTextDescription', 'Overrides min/max in display')}
                            maxLength={100}
                          />
                        </Grid.Col>
                      </Grid>
                    </Paper>
                  </Grid.Col>}
                </Grid>
              </Box>
            </Tabs.Panel>}

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

            {/* Relationships Tab — edit mode, or create mode when advanced */}
            {showAdvancedTabs && (
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
                      {medications.length > 0 && (
                        <Paper withBorder p="md" bg="var(--color-bg-secondary)">
                          <Stack gap="md">
                            <Title order={5}>
                              {t(
                                'labresults:form.linkMedicationsTitle',
                                'Link to Medications'
                              )}
                            </Title>
                            <LabResultMedicationRelationships
                              labResultId={editingItem.id}
                              labResultMedications={labResultMedications}
                              medications={medications}
                              fetchLabResultMedications={
                                fetchLabResultMedications
                              }
                              navigate={navigate}
                            />
                          </Stack>
                        </Paper>
                      )}
                      {procedures.length > 0 && (
                        <Paper withBorder p="md" bg="var(--color-bg-secondary)">
                          <Stack gap="md">
                            <Title order={5}>
                              {t(
                                'labresults:form.linkProceduresTitle',
                                'Link to Procedures'
                              )}
                            </Title>
                            <LabResultProcedureRelationships
                              labResultId={editingItem.id}
                              labResultProcedures={labResultProcedures}
                              procedures={procedures}
                              fetchLabResultProcedures={
                                fetchLabResultProcedures
                              }
                              navigate={navigate}
                            />
                          </Stack>
                        </Paper>
                      )}
                      {treatments.length > 0 && (
                        <Paper withBorder p="md" bg="var(--color-bg-secondary)">
                          <Stack gap="md">
                            <Title order={5}>
                              {t(
                                'labresults:form.linkTreatmentsTitle',
                                'Link to Treatments'
                              )}
                            </Title>
                            <LabResultTreatmentRelationships
                              labResultId={editingItem.id}
                              labResultTreatments={labResultTreatments}
                              treatments={treatments}
                              fetchLabResultTreatments={
                                fetchLabResultTreatments
                              }
                              navigate={navigate}
                            />
                          </Stack>
                        </Paper>
                      )}
                      {conditions.length === 0 &&
                        encounters.length === 0 &&
                        medications.length === 0 &&
                        procedures.length === 0 &&
                        treatments.length === 0 && (
                          <Paper withBorder p="md" ta="center">
                            <Text c="dimmed">
                              {t(
                                'labresults:messages.noRelationshipsAvailable',
                                'No medical conditions or visits on record. Add them first to link them here.'
                              )}
                            </Text>
                          </Paper>
                        )}
                    </Stack>
                  ) : (
                    /* Create mode (advanced): pending relationship picker, saved after the lab result is created */
                    <PendingRelationshipsPicker
                      conditions={conditions}
                      encounters={encounters}
                      medications={medications}
                      procedures={procedures}
                      treatments={treatments}
                      pendingConditions={pendingConditions}
                      pendingEncounters={pendingEncounters}
                      pendingMedications={pendingMedications}
                      pendingProcedures={pendingProcedures}
                      pendingTreatments={pendingTreatments}
                      onAddCondition={addPendingCondition}
                      onRemoveCondition={removePendingCondition}
                      onAddEncounter={addPendingEncounter}
                      onRemoveEncounter={removePendingEncounter}
                      onAddMedication={addPendingMedication}
                      onRemoveMedication={removePendingMedication}
                      onAddProcedure={addPendingProcedure}
                      onRemoveProcedure={removePendingProcedure}
                      onAddTreatment={addPendingTreatment}
                      onRemoveTreatment={removePendingTreatment}
                    />
                  )}
                </Box>
              </Tabs.Panel>
            )}

            {/* Notes Tab */}
            {showAdvancedTabs && (
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
            )}

          </Tabs>

          {/* Form Actions */}
          <Group
            justify={showAdvancedToggle ? 'space-between' : 'flex-end'}
            gap="sm"
          >
            {showAdvancedToggle && (
              <AdvancedModeSwitch
                checked={advancedCreate}
                onChange={onAdvancedModeChange}
                disabled={isLoading || isSubmitting}
              />
            )}
            <Group gap="sm">
              <Button
                variant="default"
                onClick={onClose}
                disabled={isLoading || isSubmitting}
              >
                {postCreate
                  ? t('shared:labels.close')
                  : t('shared:fields.cancel')}
              </Button>
              <SubmitButton
                loading={isLoading || isSubmitting}
                disabled={!formData.test_name?.trim()}
              >
                {postCreate
                  ? t('common:buttons.save')
                  : `${editingItem ? t('common:buttons.update') : t('common:buttons.create')} ${t('shared:categories.lab_results')}`}
              </SubmitButton>
            </Group>
          </Group>
        </Stack>
      </form>

      {children}
    </Modal>
  );
};

export default LabResultFormWrapper;
