import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Tabs,
  Badge,
  Stack,
  Box,
  MultiSelect,
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
import {
  IconPill,
  IconStethoscope,
  IconTestPipe,
  IconDeviceDesktop,
  IconChevronDown,
  IconChevronRight,
} from '@tabler/icons-react';
import { apiService } from '../../../services/api';
import logger from '../../../services/logger';
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
const ItemDetailsCard = ({ label, color, icon: Icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Paper withBorder p="xs">
      <UnstyledButton onClick={() => setIsOpen(!isOpen)} style={{ width: '100%' }}>
        <Group justify="space-between">
          <Group gap="xs">
            <Badge size="sm" variant="light" color={color} leftSection={<Icon size={12} />}>
              {label}
            </Badge>
          </Group>
          {isOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </Group>
      </UnstyledButton>
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
};

/**
 * Treatment Plan Setup for creation mode.
 * Allows selecting relationships before the treatment exists.
 * Selections are stored locally and passed to parent for bulk creation after treatment is created.
 */
const TreatmentPlanSetup = ({
  pendingRelationships,
  onRelationshipsChange,
}) => {
  const [activeTab, setActiveTab] = useState('medications');
  const [loading, setLoading] = useState(true);

  // Available entities for selection
  const [medications, setMedications] = useState([]);
  const [encounters, setEncounters] = useState([]);
  const [labResults, setLabResults] = useState([]);
  const [equipment, setEquipment] = useState([]);

  const isMountedRef = useRef(true);

  // Fetch available entities
  const fetchEntities = useCallback(async (signal) => {
    setLoading(true);
    try {
      const [medsData, encountersData, labsData, equipmentData] = await Promise.all([
        apiService.getMedications(signal).catch(() => []),
        apiService.getEncounters(signal).catch(() => []),
        apiService.getLabResults(signal).catch(() => []),
        apiService.getMedicalEquipment(signal).catch(() => []),
      ]);

      if (!signal?.aborted && isMountedRef.current) {
        setMedications(Array.isArray(medsData) ? medsData : []);
        setEncounters(Array.isArray(encountersData) ? encountersData : []);
        setLabResults(Array.isArray(labsData) ? labsData : []);
        setEquipment(Array.isArray(equipmentData) ? equipmentData : []);
        setLoading(false);
      }
    } catch (err) {
      if (err.name !== 'AbortError' && isMountedRef.current) {
        logger.error('treatment_plan_setup_fetch_error', { error: err.message });
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
  const formatMedicationLabel = (med) => {
    let label = med.medication_name;
    if (med.dosage) label += ` (${med.dosage})`;
    if (med.status) label += ` - ${med.status}`;
    return label;
  };

  const formatEncounterLabel = (enc) => {
    const date = formatDateDisplay(enc.date);
    const type = enc.visit_type || 'Visit';
    let label = `${date} - ${type}`;
    if (enc.reason) label += ` (${enc.reason})`;
    return label;
  };

  const formatLabResultLabel = (lab) => {
    const dateValue = lab.completed_date || lab.ordered_date;
    const date = dateValue ? formatDateDisplay(dateValue) : null;
    let label = date ? `${date} - ${lab.test_name}` : lab.test_name;
    if (lab.labs_result) label += ` (${lab.labs_result})`;
    return label;
  };

  const formatEquipmentLabel = (eq) => {
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

  const encounterOptions = createDateSortedOptions(encounters, formatEncounterLabel, 'date');
  const labResultOptions = createDateSortedOptions(labResults, formatLabResultLabel, 'completed_date');

  const equipmentOptions = equipment.map(e => ({
    value: e.id.toString(),
    label: formatEquipmentLabel(e),
  }));

  // Get selected IDs from pending relationships
  const getSelectedIds = (type) => {
    const items = pendingRelationships[type] || [];
    return items.map(item => typeof item === 'object' ? item.id : item);
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
      const existing = existingItems.find(item =>
        (typeof item === 'object' ? item.id : item) === id
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

  // Counts for badges
  const medicationCount = (pendingRelationships.medications || []).length;
  const encounterCount = (pendingRelationships.encounters || []).length;
  const labResultCount = (pendingRelationships.labResults || []).length;
  const equipmentCount = (pendingRelationships.equipment || []).length;

  // Get selected IDs for rendering
  const selectedMedIds = getSelectedIds('medications');
  const selectedEncIds = getSelectedIds('encounters');
  const selectedLabIds = getSelectedIds('labResults');
  const selectedEquipIds = getSelectedIds('equipment');

  return (
    <Box pos="relative">
      <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ radius: 'sm', blur: 2 }} />

      <Stack gap="md">
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab
              value="medications"
              leftSection={<IconPill size={16} />}
              rightSection={medicationCount > 0 ? (
                <Badge size="sm" variant="filled" color="teal" circle>
                  {medicationCount}
                </Badge>
              ) : null}
            >
              Medications
            </Tabs.Tab>
            <Tabs.Tab
              value="encounters"
              leftSection={<IconStethoscope size={16} />}
              rightSection={encounterCount > 0 ? (
                <Badge size="sm" variant="filled" color="blue" circle>
                  {encounterCount}
                </Badge>
              ) : null}
            >
              Visits
            </Tabs.Tab>
            <Tabs.Tab
              value="labs"
              leftSection={<IconTestPipe size={16} />}
              rightSection={labResultCount > 0 ? (
                <Badge size="sm" variant="filled" color="violet" circle>
                  {labResultCount}
                </Badge>
              ) : null}
            >
              Labs
            </Tabs.Tab>
            <Tabs.Tab
              value="equipment"
              leftSection={<IconDeviceDesktop size={16} />}
              rightSection={equipmentCount > 0 ? (
                <Badge size="sm" variant="filled" color="orange" circle>
                  {equipmentCount}
                </Badge>
              ) : null}
            >
              Equipment
            </Tabs.Tab>
          </Tabs.List>

          <Box mt="md">
            {/* Medications Tab */}
            <Tabs.Panel value="medications">
              <Stack gap="md">
                <MultiSelect
                  label="Medications to Link"
                  placeholder={medicationOptions.length > 0 ? "Select medications..." : "No medications available"}
                  data={medicationOptions}
                  value={selectedMedIds}
                  onChange={(values) => handleSelectionChange('medications', values)}
                  searchable
                  clearable
                  disabled={medicationOptions.length === 0}
                  comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                />

                {/* Show detail fields for each selected medication */}
                {selectedMedIds.length > 0 && (
                  <Stack gap="xs">
                    <Text size="xs" c="dimmed">Click to expand and add details (optional)</Text>
                    {selectedMedIds.map((medId) => {
                      const metadata = getItemMetadata('medications', medId);
                      return (
                        <ItemDetailsCard
                          key={medId}
                          label={getItemLabel('medications', medId)}
                          color="teal"
                          icon={IconPill}
                        >
                          <TextInput
                            size="xs"
                            placeholder="Specific dosage (e.g., 400mg 3x daily)"
                            value={metadata.specific_dosage || ''}
                            onChange={(e) => updateItemMetadata('medications', medId, 'specific_dosage', e.target.value)}
                          />
                          <TextInput
                            size="xs"
                            placeholder="Frequency (e.g., Every 8 hours)"
                            value={metadata.specific_frequency || ''}
                            onChange={(e) => updateItemMetadata('medications', medId, 'specific_frequency', e.target.value)}
                          />
                          <TextInput
                            size="xs"
                            placeholder="Duration (e.g., 2 weeks)"
                            value={metadata.specific_duration || ''}
                            onChange={(e) => updateItemMetadata('medications', medId, 'specific_duration', e.target.value)}
                          />
                          <TextInput
                            size="xs"
                            placeholder="Timing instructions"
                            value={metadata.timing_instructions || ''}
                            onChange={(e) => updateItemMetadata('medications', medId, 'timing_instructions', e.target.value)}
                          />
                          <Textarea
                            size="xs"
                            placeholder="Relevance note"
                            value={metadata.relevance_note || ''}
                            onChange={(e) => updateItemMetadata('medications', medId, 'relevance_note', e.target.value)}
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
                    No medications found. Create medications first to link them here.
                  </Text>
                )}
              </Stack>
            </Tabs.Panel>

            {/* Visits Tab */}
            <Tabs.Panel value="encounters">
              <Stack gap="md">
                <MultiSelect
                  label="Visits to Link"
                  placeholder={encounterOptions.length > 0 ? "Select visits..." : "No visits available"}
                  data={encounterOptions}
                  value={selectedEncIds}
                  onChange={(values) => handleSelectionChange('encounters', values)}
                  searchable
                  clearable
                  disabled={encounterOptions.length === 0}
                  comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                />

                {/* Show detail fields for each selected visit */}
                {selectedEncIds.length > 0 && (
                  <Stack gap="xs">
                    <Text size="xs" c="dimmed">Click to expand and add details (optional)</Text>
                    {selectedEncIds.map((encId) => {
                      const metadata = getItemMetadata('encounters', encId);
                      return (
                        <ItemDetailsCard
                          key={encId}
                          label={getItemLabel('encounters', encId)}
                          color="blue"
                          icon={IconStethoscope}
                        >
                          <Select
                            size="xs"
                            placeholder="Visit label"
                            data={VISIT_LABEL_OPTIONS}
                            value={metadata.visit_label || ''}
                            onChange={(value) => updateItemMetadata('encounters', encId, 'visit_label', value || '')}
                            clearable
                            comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                          />
                          <TextInput
                            size="xs"
                            placeholder="Visit sequence (1, 2, 3...)"
                            type="number"
                            value={metadata.visit_sequence || ''}
                            onChange={(e) => updateItemMetadata('encounters', encId, 'visit_sequence', e.target.value)}
                          />
                          <Textarea
                            size="xs"
                            placeholder="Relevance note"
                            value={metadata.relevance_note || ''}
                            onChange={(e) => updateItemMetadata('encounters', encId, 'relevance_note', e.target.value)}
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
                    No visits found. Create visits first to link them here.
                  </Text>
                )}
              </Stack>
            </Tabs.Panel>

            {/* Labs Tab */}
            <Tabs.Panel value="labs">
              <Stack gap="md">
                <MultiSelect
                  label="Lab Results to Link"
                  placeholder={labResultOptions.length > 0 ? "Select lab results..." : "No lab results available"}
                  data={labResultOptions}
                  value={selectedLabIds}
                  onChange={(values) => handleSelectionChange('labResults', values)}
                  searchable
                  clearable
                  disabled={labResultOptions.length === 0}
                  comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                />

                {/* Show detail fields for each selected lab */}
                {selectedLabIds.length > 0 && (
                  <Stack gap="xs">
                    <Text size="xs" c="dimmed">Click to expand and add details (optional)</Text>
                    {selectedLabIds.map((labId) => {
                      const metadata = getItemMetadata('labResults', labId);
                      return (
                        <ItemDetailsCard
                          key={labId}
                          label={getItemLabel('labResults', labId)}
                          color="violet"
                          icon={IconTestPipe}
                        >
                          <Select
                            size="xs"
                            placeholder="Purpose"
                            data={PURPOSE_OPTIONS}
                            value={metadata.purpose || ''}
                            onChange={(value) => updateItemMetadata('labResults', labId, 'purpose', value || '')}
                            clearable
                            comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                          />
                          <TextInput
                            size="xs"
                            placeholder="Expected frequency (e.g., Monthly)"
                            value={metadata.expected_frequency || ''}
                            onChange={(e) => updateItemMetadata('labResults', labId, 'expected_frequency', e.target.value)}
                          />
                          <Textarea
                            size="xs"
                            placeholder="Relevance note"
                            value={metadata.relevance_note || ''}
                            onChange={(e) => updateItemMetadata('labResults', labId, 'relevance_note', e.target.value)}
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
                    No lab results found. Create lab results first to link them here.
                  </Text>
                )}
              </Stack>
            </Tabs.Panel>

            {/* Equipment Tab */}
            <Tabs.Panel value="equipment">
              <Stack gap="md">
                <MultiSelect
                  label="Equipment to Link"
                  placeholder={equipmentOptions.length > 0 ? "Select equipment..." : "No equipment available"}
                  data={equipmentOptions}
                  value={selectedEquipIds}
                  onChange={(values) => handleSelectionChange('equipment', values)}
                  searchable
                  clearable
                  disabled={equipmentOptions.length === 0}
                  comboboxProps={{ withinPortal: true, zIndex: 4000 }}
                />

                {/* Show detail fields for each selected equipment */}
                {selectedEquipIds.length > 0 && (
                  <Stack gap="xs">
                    <Text size="xs" c="dimmed">Click to expand and add details (optional)</Text>
                    {selectedEquipIds.map((equipId) => {
                      const metadata = getItemMetadata('equipment', equipId);
                      return (
                        <ItemDetailsCard
                          key={equipId}
                          label={getItemLabel('equipment', equipId)}
                          color="orange"
                          icon={IconDeviceDesktop}
                        >
                          <TextInput
                            size="xs"
                            placeholder="Usage frequency (e.g., Nightly)"
                            value={metadata.usage_frequency || ''}
                            onChange={(e) => updateItemMetadata('equipment', equipId, 'usage_frequency', e.target.value)}
                          />
                          <TextInput
                            size="xs"
                            placeholder="Specific settings (e.g., Pressure: 10 cmH2O)"
                            value={metadata.specific_settings || ''}
                            onChange={(e) => updateItemMetadata('equipment', equipId, 'specific_settings', e.target.value)}
                          />
                          <Textarea
                            size="xs"
                            placeholder="Relevance note"
                            value={metadata.relevance_note || ''}
                            onChange={(e) => updateItemMetadata('equipment', equipId, 'relevance_note', e.target.value)}
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
                    No equipment found. Equipment can be added after creating the treatment.
                  </Text>
                )}
              </Stack>
            </Tabs.Panel>
          </Box>
        </Tabs>
      </Stack>
    </Box>
  );
};

TreatmentPlanSetup.propTypes = {
  pendingRelationships: PropTypes.shape({
    medications: PropTypes.array,
    encounters: PropTypes.array,
    labResults: PropTypes.array,
    equipment: PropTypes.array,
  }).isRequired,
  onRelationshipsChange: PropTypes.func.isRequired,
};

export default TreatmentPlanSetup;
