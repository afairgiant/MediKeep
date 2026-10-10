import { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  ActionIcon,
  Badge,
  Stack,
  Box,
  Select,
  Paper,
  Text,
  TextInput,
  Textarea,
  LoadingOverlay,
  Group,
  Collapse,
  UnstyledButton,
} from '@mantine/core';
import { DateInput } from '../../adapters/DateInput';
import {
  IconPill,
  IconStethoscope,
  IconTestPipe,
  IconDeviceDesktop,
  IconChevronDown,
  IconChevronRight,
  IconTrash,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { apiService } from '../../../services/api';
import logger from '../../../services/logger';
import {
  parseDateInput,
  formatDateInputChange,
} from '../../../utils/dateUtils';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { useTreatmentInlineCreate } from '../../../hooks/useTreatmentInlineCreate';
import TreatmentPlanLinkSection from './TreatmentPlanLinkSection';
import {
  createDateSortedOptions,
  formatDateDisplay,
} from './RelationshipComponents';

// Options for select fields
const VISIT_LABEL_OPTIONS = [
  { value: 'initial', label: 'Initial Visit' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'review', label: 'Review' },
  { value: 'final', label: 'Final Visit' },
  { value: 'other', label: 'Other' },
];

const PURPOSE_OPTIONS = [
  { value: 'baseline', label: 'Baseline' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'outcome', label: 'Outcome' },
  { value: 'safety', label: 'Safety' },
  { value: 'other', label: 'Other' },
];

/**
 * Collapsible item card for showing/editing relationship details
 */
const ItemDetailsCard = ({
  label,
  color,
  icon: Icon,
  children,
  defaultOpen = false,
  onRemove,
}) => {
  const { t } = useTranslation(['common']);
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Paper withBorder p="xs">
      <Group justify="space-between" wrap="nowrap">
        <UnstyledButton
          onClick={() => setIsOpen(!isOpen)}
          style={{ flex: 1 }}
          aria-expanded={isOpen}
        >
          <Group justify="space-between">
            <Group gap="xs">
              <Badge
                size="sm"
                variant="light"
                color={color}
                leftSection={<Icon size={12} />}
              >
                {label}
              </Badge>
            </Group>
            {isOpen ? (
              <IconChevronDown size={14} />
            ) : (
              <IconChevronRight size={14} />
            )}
          </Group>
        </UnstyledButton>
        {onRemove && (
          <ActionIcon
            type="button"
            variant="light"
            color="red"
            size="sm"
            aria-label={t('common:visits.relationships.removeLink')}
            onClick={onRemove}
          >
            <IconTrash size={14} />
          </ActionIcon>
        )}
      </Group>
      <Collapse in={isOpen}>
        <Stack gap="xs" mt="xs">
          {children}
        </Stack>
      </Collapse>
    </Paper>
  );
};

ItemDetailsCard.propTypes = {
  label: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  children: PropTypes.node.isRequired,
  defaultOpen: PropTypes.bool,
  onRemove: PropTypes.func,
};

/**
 * Treatment Plan Setup for creation mode.
 * Allows selecting relationships before the treatment exists.
 * Selections are stored locally and passed to parent for bulk creation after treatment is created.
 */
const TreatmentPlanSetup = ({
  activeSection = 'medications',
  pendingRelationships,
  onRelationshipsChange,
  patientId,
}) => {
  const { t } = useTranslation('medical');
  const { dateInputFormat, dateParser } = useDateFormat();
  const [loading, setLoading] = useState(true);

  // Available entities for selection
  const [medications, setMedications] = useState([]);
  const [encounters, setEncounters] = useState([]);
  const [labResults, setLabResults] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [practitioners, setPractitioners] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);

  const isMountedRef = useRef(true);

  // Fetch available entities
  const fetchEntities = useCallback(async signal => {
    setLoading(true);
    try {
      const [
        medsData,
        encountersData,
        labsData,
        equipmentData,
        practitionersData,
        pharmaciesData,
      ] = await Promise.all([
        apiService.getMedications(signal).catch(() => []),
        apiService.getEncounters(signal).catch(() => []),
        apiService.getLabResults(signal).catch(() => []),
        apiService.getMedicalEquipment(signal).catch(() => []),
        apiService.getPractitioners(signal).catch(() => []),
        apiService.getPharmacies(signal).catch(() => []),
      ]);

      if (!signal?.aborted && isMountedRef.current) {
        setMedications(Array.isArray(medsData) ? medsData : []);
        setEncounters(Array.isArray(encountersData) ? encountersData : []);
        setLabResults(Array.isArray(labsData) ? labsData : []);
        setEquipment(Array.isArray(equipmentData) ? equipmentData : []);
        setPractitioners(
          Array.isArray(practitionersData) ? practitionersData : []
        );
        setPharmacies(Array.isArray(pharmaciesData) ? pharmaciesData : []);
        setLoading(false);
      }
    } catch (err) {
      if (err.name !== 'AbortError' && isMountedRef.current) {
        logger.error('treatment_plan_setup_fetch_error', {
          error: err.message,
        });
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    const controller = new AbortController();
    fetchEntities(controller.signal);

    return () => {
      isMountedRef.current = false;
      controller.abort();
    };
  }, [fetchEntities]);

  // Format functions for select options
  const formatMedicationLabel = med => {
    let label = med.medication_name;
    if (med.dosage) label += ` (${med.dosage})`;
    if (med.status) label += ` - ${med.status}`;
    return label;
  };

  const formatEncounterLabel = enc => {
    const date = formatDateDisplay(enc.date);
    const type = enc.visit_type || 'Visit';
    let label = `${date} - ${type}`;
    if (enc.reason) label += ` (${enc.reason})`;
    return label;
  };

  const formatLabResultLabel = lab => {
    const dateValue = lab.completed_date || lab.ordered_date;
    const date = dateValue ? formatDateDisplay(dateValue) : null;
    let label = date ? `${date} - ${lab.test_name}` : lab.test_name;
    if (lab.labs_result) label += ` (${lab.labs_result})`;
    return label;
  };

  const formatEquipmentLabel = eq => {
    let label = eq.equipment_name;
    if (eq.equipment_type) label += ` (${eq.equipment_type})`;
    if (eq.status) label += ` - ${eq.status}`;
    return label;
  };

  // Create options for MultiSelect
  const medicationOptions = medications.map(m => ({
    value: m.id.toString(),
    label: formatMedicationLabel(m),
  }));

  const encounterOptions = createDateSortedOptions(
    encounters,
    formatEncounterLabel,
    'date'
  );
  const labResultOptions = createDateSortedOptions(
    labResults,
    formatLabResultLabel,
    'completed_date'
  );

  const equipmentOptions = equipment.map(e => ({
    value: e.id.toString(),
    label: formatEquipmentLabel(e),
  }));

  // Get selected IDs from pending relationships
  const getSelectedIds = type => {
    const items = pendingRelationships[type] || [];
    return items.map(item => (typeof item === 'object' ? item.id : item));
  };

  // Get metadata for a specific item
  const getItemMetadata = (type, itemId) => {
    const items = pendingRelationships[type] || [];
    const item = items.find(i => (typeof i === 'object' ? i.id : i) === itemId);
    return typeof item === 'object' ? item : { id: itemId };
  };

  // Get label for a specific item by ID
  const getItemLabel = (type, itemId) => {
    const options = {
      medications: medicationOptions,
      encounters: encounterOptions,
      labResults: labResultOptions,
      equipment: equipmentOptions,
    };
    const option = options[type]?.find(o => o.value === itemId);
    return option?.label || itemId;
  };

  // Handle selection change - preserve metadata for existing selections
  const handleSelectionChange = (type, values) => {
    const existingItems = pendingRelationships[type] || [];

    // Create new items array, preserving metadata for items that were already selected
    const newItems = values.map(id => {
      const existing = existingItems.find(
        item => (typeof item === 'object' ? item.id : item) === id
      );
      return existing || { id };
    });

    onRelationshipsChange({
      ...pendingRelationships,
      [type]: newItems,
    });
  };

  // Update metadata for a specific item
  const updateItemMetadata = (type, itemId, field, value) => {
    const items = pendingRelationships[type] || [];
    const updatedItems = items.map(item => {
      const id = typeof item === 'object' ? item.id : item;
      if (id === itemId) {
        return typeof item === 'object'
          ? { ...item, [field]: value }
          : { id, [field]: value };
      }
      return item;
    });

    onRelationshipsChange({
      ...pendingRelationships,
      [type]: updatedItems,
    });
  };

  // Get selected IDs for rendering
  const selectedMedIds = getSelectedIds('medications');
  const selectedEncIds = getSelectedIds('encounters');
  const selectedLabIds = getSelectedIds('labResults');
  const selectedEquipIds = getSelectedIds('equipment');

  // A record created here is offered in the list and held as selected, like a picked one,
  // until the treatment is saved (ids are strings, as the select's values are)
  const holdCreated = (type, setList) => async record => {
    setList(prev =>
      prev.some(item => item.id === record.id) ? prev : [...prev, record]
    );
    onRelationshipsChange(prev => ({
      ...prev,
      [type]: [...(prev[type] || []), { id: String(record.id) }],
    }));
    return 'pending';
  };
  const medicationCreate = useTreatmentInlineCreate({
    createType: 'medications',
    patientId,
    onCreated: holdCreated('medications', setMedications),
  });
  const encounterCreate = useTreatmentInlineCreate({
    createType: 'visits',
    patientId,
    onCreated: holdCreated('encounters', setEncounters),
  });
  const labResultCreate = useTreatmentInlineCreate({
    createType: 'labResults',
    patientId,
    onCreated: holdCreated('labResults', setLabResults),
  });
  const equipmentCreate = useTreatmentInlineCreate({
    createType: 'equipment',
    patientId,
    onCreated: holdCreated('equipment', setEquipment),
  });

  return (
    <Box pos="relative">
      <LoadingOverlay
        visible={loading}
        zIndex={1000}
        overlayProps={{ radius: 'sm', blur: 2 }}
      />

      <Stack gap="md">
        {/* Medications Section */}
        <Box
          style={{
            display: activeSection === 'medications' ? 'block' : 'none',
          }}
        >
          <TreatmentPlanLinkSection
            items="medications"
            options={medicationOptions}
            selectedIds={selectedMedIds}
            onSelectedChange={values =>
              handleSelectionChange('medications', values)
            }
            onCreateNew={medicationCreate.onCreateNew}
            createLabel={medicationCreate.createLabel}
            loading={loading}
          >
            {/* Show detail fields for each selected medication */}
            {selectedMedIds.length > 0 && (
              <Stack gap="xs">
                <Text size="xs" c="dimmed">
                  {t('treatmentPlan.clickToExpand')}
                </Text>
                {selectedMedIds.map(medId => {
                  const metadata = getItemMetadata('medications', medId);
                  return (
                    <ItemDetailsCard
                      key={medId}
                      onRemove={() =>
                        handleSelectionChange(
                          'medications',
                          selectedMedIds.filter(id => id !== medId)
                        )
                      }
                      label={getItemLabel('medications', medId)}
                      color="teal"
                      icon={IconPill}
                    >
                      <TextInput
                        size="xs"
                        placeholder="Specific dosage (e.g., 400mg 3x daily)"
                        value={metadata.specific_dosage || ''}
                        onChange={e =>
                          updateItemMetadata(
                            'medications',
                            medId,
                            'specific_dosage',
                            e.target.value
                          )
                        }
                      />
                      <TextInput
                        size="xs"
                        placeholder="Frequency (e.g., Every 8 hours)"
                        value={metadata.specific_frequency || ''}
                        onChange={e =>
                          updateItemMetadata(
                            'medications',
                            medId,
                            'specific_frequency',
                            e.target.value
                          )
                        }
                      />
                      <TextInput
                        size="xs"
                        placeholder="Duration (e.g., 2 weeks)"
                        value={metadata.specific_duration || ''}
                        onChange={e =>
                          updateItemMetadata(
                            'medications',
                            medId,
                            'specific_duration',
                            e.target.value
                          )
                        }
                      />
                      <TextInput
                        size="xs"
                        placeholder="Timing instructions"
                        value={metadata.timing_instructions || ''}
                        onChange={e =>
                          updateItemMetadata(
                            'medications',
                            medId,
                            'timing_instructions',
                            e.target.value
                          )
                        }
                      />
                      <Group grow gap="xs">
                        <Select
                          size="xs"
                          placeholder="Treatment prescriber"
                          data={practitioners.map(p => ({
                            value: p.id.toString(),
                            label: `${p.name}${p.specialty ? ` - ${p.specialty}` : ''}`,
                          }))}
                          value={metadata.specific_prescriber_id || ''}
                          onChange={value =>
                            updateItemMetadata(
                              'medications',
                              medId,
                              'specific_prescriber_id',
                              value || ''
                            )
                          }
                          clearable
                          searchable
                          comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                        />
                        <Select
                          size="xs"
                          placeholder="Treatment pharmacy"
                          data={pharmacies.map(p => ({
                            value: p.id.toString(),
                            label: p.name || p.brand || `Pharmacy #${p.id}`,
                          }))}
                          value={metadata.specific_pharmacy_id || ''}
                          onChange={value =>
                            updateItemMetadata(
                              'medications',
                              medId,
                              'specific_pharmacy_id',
                              value || ''
                            )
                          }
                          clearable
                          searchable
                          comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                        />
                      </Group>
                      <Group grow gap="xs">
                        <DateInput
                          size="xs"
                          label={t(
                            'treatments.medications.specificStartDate',
                            'Treatment Start Date'
                          )}
                          placeholder={dateInputFormat}
                          value={parseDateInput(metadata.specific_start_date)}
                          onChange={date =>
                            updateItemMetadata(
                              'medications',
                              medId,
                              'specific_start_date',
                              formatDateInputChange(date)
                            )
                          }
                          valueFormat={dateInputFormat}
                          dateParser={dateParser}
                          clearable
                          firstDayOfWeek={0}
                          popoverProps={{ withinPortal: true, zIndex: 4000 }}
                        />
                        <DateInput
                          size="xs"
                          label={t(
                            'treatments.medications.specificEndDate',
                            'Treatment End Date'
                          )}
                          placeholder={dateInputFormat}
                          value={parseDateInput(metadata.specific_end_date)}
                          onChange={date =>
                            updateItemMetadata(
                              'medications',
                              medId,
                              'specific_end_date',
                              formatDateInputChange(date)
                            )
                          }
                          valueFormat={dateInputFormat}
                          dateParser={dateParser}
                          clearable
                          firstDayOfWeek={0}
                          minDate={
                            parseDateInput(metadata.specific_start_date) ||
                            undefined
                          }
                          popoverProps={{ withinPortal: true, zIndex: 4000 }}
                        />
                      </Group>
                      <Textarea
                        size="xs"
                        placeholder="Relevance note"
                        value={metadata.relevance_note || ''}
                        onChange={e =>
                          updateItemMetadata(
                            'medications',
                            medId,
                            'relevance_note',
                            e.target.value
                          )
                        }
                        autosize
                        minRows={1}
                      />
                    </ItemDetailsCard>
                  );
                })}
              </Stack>
            )}

            {medicationOptions.length === 0 && !loading && (
              <Text size="sm" c="dimmed" ta="center">
                {t('treatmentPlan.noMedications')}
              </Text>
            )}
          </TreatmentPlanLinkSection>
        </Box>

        {/* Visits Section */}
        <Box
          style={{ display: activeSection === 'encounters' ? 'block' : 'none' }}
        >
          <TreatmentPlanLinkSection
            items="visits"
            options={encounterOptions}
            selectedIds={selectedEncIds}
            onSelectedChange={values =>
              handleSelectionChange('encounters', values)
            }
            onCreateNew={encounterCreate.onCreateNew}
            createLabel={encounterCreate.createLabel}
            loading={loading}
          >
            {/* Show detail fields for each selected visit */}
            {selectedEncIds.length > 0 && (
              <Stack gap="xs">
                <Text size="xs" c="dimmed">
                  {t('treatmentPlan.clickToExpand')}
                </Text>
                {selectedEncIds.map(encId => {
                  const metadata = getItemMetadata('encounters', encId);
                  return (
                    <ItemDetailsCard
                      key={encId}
                      onRemove={() =>
                        handleSelectionChange(
                          'encounters',
                          selectedEncIds.filter(id => id !== encId)
                        )
                      }
                      label={getItemLabel('encounters', encId)}
                      color="blue"
                      icon={IconStethoscope}
                    >
                      <Select
                        size="xs"
                        placeholder="Visit label"
                        data={VISIT_LABEL_OPTIONS}
                        value={metadata.visit_label || ''}
                        onChange={value =>
                          updateItemMetadata(
                            'encounters',
                            encId,
                            'visit_label',
                            value || ''
                          )
                        }
                        clearable
                        comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                      />
                      <TextInput
                        size="xs"
                        placeholder="Visit sequence (1, 2, 3...)"
                        type="number"
                        value={metadata.visit_sequence || ''}
                        onChange={e =>
                          updateItemMetadata(
                            'encounters',
                            encId,
                            'visit_sequence',
                            e.target.value
                          )
                        }
                      />
                      <Textarea
                        size="xs"
                        placeholder="Relevance note"
                        value={metadata.relevance_note || ''}
                        onChange={e =>
                          updateItemMetadata(
                            'encounters',
                            encId,
                            'relevance_note',
                            e.target.value
                          )
                        }
                        autosize
                        minRows={1}
                      />
                    </ItemDetailsCard>
                  );
                })}
              </Stack>
            )}

            {encounterOptions.length === 0 && !loading && (
              <Text size="sm" c="dimmed" ta="center">
                {t('treatmentPlan.noVisits')}
              </Text>
            )}
          </TreatmentPlanLinkSection>
        </Box>

        {/* Labs Section */}
        <Box style={{ display: activeSection === 'labs' ? 'block' : 'none' }}>
          <TreatmentPlanLinkSection
            items="labResults"
            options={labResultOptions}
            selectedIds={selectedLabIds}
            onSelectedChange={values =>
              handleSelectionChange('labResults', values)
            }
            onCreateNew={labResultCreate.onCreateNew}
            createLabel={labResultCreate.createLabel}
            loading={loading}
          >
            {/* Show detail fields for each selected lab */}
            {selectedLabIds.length > 0 && (
              <Stack gap="xs">
                <Text size="xs" c="dimmed">
                  {t('treatmentPlan.clickToExpand')}
                </Text>
                {selectedLabIds.map(labId => {
                  const metadata = getItemMetadata('labResults', labId);
                  return (
                    <ItemDetailsCard
                      key={labId}
                      onRemove={() =>
                        handleSelectionChange(
                          'labResults',
                          selectedLabIds.filter(id => id !== labId)
                        )
                      }
                      label={getItemLabel('labResults', labId)}
                      color="violet"
                      icon={IconTestPipe}
                    >
                      <Select
                        size="xs"
                        placeholder="Purpose"
                        data={PURPOSE_OPTIONS}
                        value={metadata.purpose || ''}
                        onChange={value =>
                          updateItemMetadata(
                            'labResults',
                            labId,
                            'purpose',
                            value || ''
                          )
                        }
                        clearable
                        comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                      />
                      <TextInput
                        size="xs"
                        placeholder="Expected frequency (e.g., Monthly)"
                        value={metadata.expected_frequency || ''}
                        onChange={e =>
                          updateItemMetadata(
                            'labResults',
                            labId,
                            'expected_frequency',
                            e.target.value
                          )
                        }
                      />
                      <Textarea
                        size="xs"
                        placeholder="Relevance note"
                        value={metadata.relevance_note || ''}
                        onChange={e =>
                          updateItemMetadata(
                            'labResults',
                            labId,
                            'relevance_note',
                            e.target.value
                          )
                        }
                        autosize
                        minRows={1}
                      />
                    </ItemDetailsCard>
                  );
                })}
              </Stack>
            )}

            {labResultOptions.length === 0 && !loading && (
              <Text size="sm" c="dimmed" ta="center">
                {t('treatmentPlan.noLabResults')}
              </Text>
            )}
          </TreatmentPlanLinkSection>
        </Box>

        {/* Equipment Section */}
        <Box
          style={{ display: activeSection === 'equipment' ? 'block' : 'none' }}
        >
          <TreatmentPlanLinkSection
            items="equipment"
            options={equipmentOptions}
            selectedIds={selectedEquipIds}
            onSelectedChange={values =>
              handleSelectionChange('equipment', values)
            }
            onCreateNew={equipmentCreate.onCreateNew}
            createLabel={equipmentCreate.createLabel}
            loading={loading}
          >
            {/* Show detail fields for each selected equipment */}
            {selectedEquipIds.length > 0 && (
              <Stack gap="xs">
                <Text size="xs" c="dimmed">
                  {t('treatmentPlan.clickToExpand')}
                </Text>
                {selectedEquipIds.map(equipId => {
                  const metadata = getItemMetadata('equipment', equipId);
                  return (
                    <ItemDetailsCard
                      key={equipId}
                      onRemove={() =>
                        handleSelectionChange(
                          'equipment',
                          selectedEquipIds.filter(id => id !== equipId)
                        )
                      }
                      label={getItemLabel('equipment', equipId)}
                      color="orange"
                      icon={IconDeviceDesktop}
                    >
                      <TextInput
                        size="xs"
                        placeholder="Usage frequency (e.g., Nightly)"
                        value={metadata.usage_frequency || ''}
                        onChange={e =>
                          updateItemMetadata(
                            'equipment',
                            equipId,
                            'usage_frequency',
                            e.target.value
                          )
                        }
                      />
                      <TextInput
                        size="xs"
                        placeholder="Specific settings (e.g., Pressure: 10 cmH2O)"
                        value={metadata.specific_settings || ''}
                        onChange={e =>
                          updateItemMetadata(
                            'equipment',
                            equipId,
                            'specific_settings',
                            e.target.value
                          )
                        }
                      />
                      <Textarea
                        size="xs"
                        placeholder="Relevance note"
                        value={metadata.relevance_note || ''}
                        onChange={e =>
                          updateItemMetadata(
                            'equipment',
                            equipId,
                            'relevance_note',
                            e.target.value
                          )
                        }
                        autosize
                        minRows={1}
                      />
                    </ItemDetailsCard>
                  );
                })}
              </Stack>
            )}

            {equipmentOptions.length === 0 && !loading && (
              <Text size="sm" c="dimmed" ta="center">
                {t('treatmentPlan.noEquipment')}
              </Text>
            )}
          </TreatmentPlanLinkSection>
        </Box>
      </Stack>
    </Box>
  );
};

TreatmentPlanSetup.propTypes = {
  activeSection: PropTypes.oneOf([
    'medications',
    'encounters',
    'labs',
    'equipment',
  ]),
  pendingRelationships: PropTypes.shape({
    medications: PropTypes.array,
    encounters: PropTypes.array,
    labResults: PropTypes.array,
    equipment: PropTypes.array,
  }).isRequired,
  onRelationshipsChange: PropTypes.func.isRequired,
  patientId: PropTypes.number,
};

export default TreatmentPlanSetup;
