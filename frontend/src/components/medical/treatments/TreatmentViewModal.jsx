import { useState, useEffect } from 'react';
import {
  Modal,
  Tabs,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  Box,
  SimpleGrid,
  Title,
  Paper,
} from '@mantine/core';
import {
  IconInfoCircle,
  IconCalendar,
  IconNotes,
  IconFileText,
  IconEdit,
  IconPill,
  IconStethoscope,
  IconTestPipe,
  IconDeviceDesktop,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import StatusBadge from '../StatusBadge';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { useTagColors } from '../../../hooks/useTagColors';
import { ClickableTagBadge } from '../../common/ClickableTagBadge';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import TreatmentMedicationsViewTab from './TreatmentMedicationsViewTab';
import TreatmentEncounterRelationships from './TreatmentEncounterRelationships';
import TreatmentLabResultRelationships from './TreatmentLabResultRelationships';
import TreatmentEquipmentRelationships from './TreatmentEquipmentRelationships';

const TreatmentViewModal = ({
  isOpen,
  onClose,
  treatment,
  onEdit,
  conditions = [],
  practitioners = [],
  onConditionClick,
  onMedicationClick,
  onEncounterClick,
  onLabResultClick,
  onEquipmentClick,
  onError,
}) => {
  const { t } = useTranslation('common');
  const { formatDate } = useDateFormat();
  const { getTagColor } = useTagColors();
  const [activeTab, setActiveTab] = useState('overview');

  // Reset tab when modal opens or treatment changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
    }
  }, [isOpen, treatment?.id]);

  if (!isOpen || !treatment) return null;

  const handleEdit = () => {
    onEdit(treatment);
    onClose();
  };

  // Helper function to get condition data from ID (using conditions array prop)
  const getConditionById = (conditionId) => {
    if (!conditionId || !conditions || conditions.length === 0) {
      return null;
    }
    return conditions.find(c => c.id === conditionId) || null;
  };

  // Helper function to get condition name from ID
  const getConditionName = (conditionId) => {
    const condition = getConditionById(conditionId);
    return condition ? condition.diagnosis || condition.name : null;
  };

  // Helper function to get practitioner information from ID
  const getPractitionerInfo = (practitionerId) => {
    if (!practitionerId || !practitioners || practitioners.length === 0) {
      return null;
    }
    const practitioner = practitioners.find(p => p.id === practitionerId);
    return practitioner;
  };

  // Treatment category labels mapping
  const TREATMENT_CATEGORY_LABELS = {
    medication_therapy: 'Medication Therapy',
    physical_therapy: 'Physical Therapy',
    surgery_procedure: 'Surgery / Procedure',
    lifestyle_dietary: 'Lifestyle / Dietary',
    monitoring: 'Monitoring / Observation',
    mental_health: 'Mental Health / Counseling',
    rehabilitation: 'Rehabilitation',
    alternative: 'Alternative / Complementary',
    combination: 'Combination Therapy',
    other: 'Other',
  };

  // Get display label for treatment type (supports both predefined and custom values)
  const getTreatmentTypeLabel = (type) => {
    if (!type) return null;
    return TREATMENT_CATEGORY_LABELS[type] || type; // Return mapped label or raw value for custom entries
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={t('treatments.viewModal.title', 'Treatment Details')}
      size="xl"
      centered
      zIndex={2000}
    >
      <Stack gap="lg">
        {/* Header Card */}
        <Paper withBorder p="md" style={{ backgroundColor: '#f8f9fa' }}>
          <Group justify="space-between" align="center">
            <div>
              <Title order={3} mb="xs">{treatment.treatment_name}</Title>
              <Group gap="xs">
                {treatment.treatment_type && (
                  <Badge variant="light" color="blue" size="sm">
                    {getTreatmentTypeLabel(treatment.treatment_type)}
                  </Badge>
                )}
                <StatusBadge status={treatment.status} />
              </Group>
            </div>
            {treatment.start_date && (
              <Badge variant="light" color="gray" size="lg">
                {formatDate(treatment.start_date)}
              </Badge>
            )}
          </Group>
        </Paper>

        <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconInfoCircle size={16} />}>
            {t('treatments.viewModal.tabs.overview', 'Overview')}
          </Tabs.Tab>
          {treatment.mode !== 'advanced' && (
            <Tabs.Tab value="schedule" leftSection={<IconCalendar size={16} />}>
              {t('treatments.viewModal.tabs.schedule', 'Schedule & Dosage')}
            </Tabs.Tab>
          )}
          {treatment.mode === 'advanced' && (
            <>
              <Tabs.Tab value="medications" leftSection={<IconPill size={16} />}>
                {t('treatments.viewModal.tabs.medications', 'Medications')}
              </Tabs.Tab>
              <Tabs.Tab value="visits" leftSection={<IconStethoscope size={16} />}>
                {t('treatments.viewModal.tabs.visits', 'Visits')}
              </Tabs.Tab>
              <Tabs.Tab value="labs" leftSection={<IconTestPipe size={16} />}>
                {t('treatments.viewModal.tabs.labs', 'Labs')}
              </Tabs.Tab>
              <Tabs.Tab value="equipment" leftSection={<IconDeviceDesktop size={16} />}>
                {t('treatments.viewModal.tabs.equipment', 'Equipment')}
              </Tabs.Tab>
            </>
          )}
          <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
            {t('treatments.viewModal.tabs.documents', 'Documents')}
          </Tabs.Tab>
          <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
            {t('treatments.viewModal.tabs.notes', 'Notes')}
          </Tabs.Tab>
        </Tabs.List>

        {/* Overview Tab */}
        <Tabs.Panel value="overview">
          <Box mt="md">
            <Stack gap="lg">
              {/* Basic Information */}
              <div>
                <Title order={4} mb="sm">{t('treatments.viewModal.basicInformation', 'Basic Information')}</Title>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('treatments.viewModal.treatmentName', 'Treatment Name')}</Text>
                    <Text size="sm">{treatment.treatment_name}</Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('treatments.viewModal.treatmentType', 'Treatment Category')}</Text>
                    <Text size="sm" c={treatment.treatment_type ? 'inherit' : 'dimmed'}>
                      {getTreatmentTypeLabel(treatment.treatment_type) || t('treatments.viewModal.notSpecified', 'Not specified')}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('treatments.viewModal.status', 'Status')}</Text>
                    <StatusBadge status={treatment.status} />
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('treatments.viewModal.startDate', 'Start Date')}</Text>
                    <Text size="sm" c={treatment.start_date ? 'inherit' : 'dimmed'}>
                      {treatment.start_date ? formatDate(treatment.start_date) : t('treatments.viewModal.notSpecified', 'Not specified')}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('treatments.viewModal.endDate', 'End Date')}</Text>
                    <Text size="sm" c={treatment.end_date ? 'inherit' : 'dimmed'}>
                      {treatment.end_date ? formatDate(treatment.end_date) : t('treatments.viewModal.ongoing', 'Ongoing')}
                    </Text>
                  </Stack>
                  <Stack gap="xs" style={{ gridColumn: '1 / -1' }}>
                    <Text fw={500} size="sm" c="dimmed">{t('treatments.viewModal.description', 'Description')}</Text>
                    <Text size="sm" c={treatment.description ? 'inherit' : 'dimmed'}>
                      {treatment.description || t('treatments.viewModal.notSpecified', 'Not specified')}
                    </Text>
                  </Stack>
                </SimpleGrid>
              </div>

              {/* Practitioner Information */}
              <div>
                <Title order={4} mb="sm">{t('treatments.viewModal.practitioner', 'Practitioner')}</Title>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('treatments.viewModal.doctor', 'Doctor')}</Text>
                    <Text size="sm" c={treatment.practitioner_id ? 'inherit' : 'dimmed'}>
                      {treatment.practitioner_id
                        ? (treatment.practitioner?.name ||
                            getPractitionerInfo(treatment.practitioner_id)?.name ||
                            t('treatments.viewModal.practitionerId', 'Practitioner #{{id}}', { id: treatment.practitioner_id }))
                        : t('treatments.viewModal.notSpecified', 'Not specified')}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('treatments.viewModal.specialty', 'Specialty')}</Text>
                    {(treatment.practitioner?.specialty || getPractitionerInfo(treatment.practitioner_id)?.specialty) ? (
                      <Badge variant="light" color="green" size="sm">
                        {treatment.practitioner?.specialty ||
                          getPractitionerInfo(treatment.practitioner_id)?.specialty}
                      </Badge>
                    ) : (
                      <Text size="sm" c="dimmed">{t('treatments.viewModal.notSpecified', 'Not specified')}</Text>
                    )}
                  </Stack>
                  <Stack gap="xs" style={{ gridColumn: '1 / -1' }}>
                    <Text fw={500} size="sm" c="dimmed">{t('treatments.viewModal.practice', 'Practice')}</Text>
                    <Text size="sm" c={(treatment.practitioner?.practice || getPractitionerInfo(treatment.practitioner_id)?.practice) ? 'inherit' : 'dimmed'}>
                      {treatment.practitioner?.practice ||
                        getPractitionerInfo(treatment.practitioner_id)?.practice ||
                        t('treatments.viewModal.notSpecified', 'Not specified')}
                    </Text>
                  </Stack>
                </SimpleGrid>
              </div>

              {/* Related Condition */}
              <div>
                <Title order={4} mb="sm">{t('treatments.viewModal.relatedCondition', 'Related Condition')}</Title>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('treatments.viewModal.diagnosis', 'Diagnosis')}</Text>
                    {treatment.condition_id ? (
                      <Text
                        size="sm"
                        fw={600}
                        style={{
                          cursor: 'pointer',
                          color: 'var(--mantine-color-blue-6)',
                          textDecoration: 'underline',
                        }}
                        onClick={() => onConditionClick?.(treatment.condition_id)}
                      >
                        {treatment.condition?.diagnosis ||
                          getConditionName(treatment.condition_id) ||
                          t('treatments.viewModal.conditionId', 'Condition #{{id}}', { id: treatment.condition_id })}
                      </Text>
                    ) : (
                      <Text size="sm" c="dimmed">{t('treatments.viewModal.noConditionLinked', 'No condition linked')}</Text>
                    )}
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('treatments.viewModal.severity', 'Severity')}</Text>
                    {(treatment.condition?.severity || getConditionById(treatment.condition_id)?.severity) ? (
                      <Badge variant="light" color="orange" size="sm">
                        {treatment.condition?.severity || getConditionById(treatment.condition_id)?.severity}
                      </Badge>
                    ) : (
                      <Text size="sm" c="dimmed">{t('treatments.viewModal.notSpecified', 'Not specified')}</Text>
                    )}
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('treatments.viewModal.conditionStatus', 'Condition Status')}</Text>
                    {(treatment.condition?.status || getConditionById(treatment.condition_id)?.status) ? (
                      <Badge variant="light" color="blue" size="sm">
                        {treatment.condition?.status || getConditionById(treatment.condition_id)?.status}
                      </Badge>
                    ) : (
                      <Text size="sm" c="dimmed">{t('treatments.viewModal.notSpecified', 'Not specified')}</Text>
                    )}
                  </Stack>
                </SimpleGrid>
              </div>

              {/* Tags Section */}
              {treatment.tags && treatment.tags.length > 0 && (
                <div>
                  <Title order={4} mb="sm">{t('treatments.viewModal.tags', 'Tags')}</Title>
                  <Group gap="xs">
                    {treatment.tags.map((tag, index) => (
                      <ClickableTagBadge
                        key={index}
                        tag={tag}
                        color={getTagColor(tag)}
                      />
                    ))}
                  </Group>
                </div>
              )}
            </Stack>
          </Box>
        </Tabs.Panel>

        {/* Schedule & Dosage Tab (simple mode only) */}
        {treatment.mode !== 'advanced' && (
          <Tabs.Panel value="schedule">
            <Box mt="md">
              <Stack gap="lg">
                <div>
                  <Title order={4} mb="sm">{t('treatments.viewModal.schedule', 'Schedule')}</Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('treatments.viewModal.startDate', 'Start Date')}</Text>
                      <Text size="sm" c={treatment.start_date ? 'inherit' : 'dimmed'}>
                        {treatment.start_date ? formatDate(treatment.start_date) : t('treatments.viewModal.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('treatments.viewModal.endDate', 'End Date')}</Text>
                      <Text size="sm" c={treatment.end_date ? 'inherit' : 'dimmed'}>
                        {treatment.end_date ? formatDate(treatment.end_date) : t('treatments.viewModal.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                  </SimpleGrid>
                </div>
                <div>
                  <Title order={4} mb="sm">{t('treatments.viewModal.dosageFrequency', 'Dosage & Frequency')}</Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('treatments.viewModal.amountDosage', 'Amount/Dosage')}</Text>
                      <Text size="sm" c={treatment.dosage ? 'inherit' : 'dimmed'}>
                        {treatment.dosage || t('treatments.viewModal.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('treatments.viewModal.frequency', 'Frequency')}</Text>
                      <Text size="sm" c={treatment.frequency ? 'inherit' : 'dimmed'}>
                        {treatment.frequency || t('treatments.viewModal.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                  </SimpleGrid>
                </div>
              </Stack>
            </Box>
          </Tabs.Panel>
        )}

        {/* Advanced mode: Relationship Tabs */}
        {treatment.mode === 'advanced' && (
          <>
            <Tabs.Panel value="medications">
              <Box mt="md">
                <TreatmentMedicationsViewTab
                  treatmentId={treatment.id}
                  onMedicationClick={onMedicationClick}
                />
              </Box>
            </Tabs.Panel>

            <Tabs.Panel value="visits">
              <Box mt="md">
                <TreatmentEncounterRelationships
                  treatmentId={treatment.id}
                  encounters={[]}
                  isViewMode={true}
                  onEntityClick={onEncounterClick}
                />
              </Box>
            </Tabs.Panel>

            <Tabs.Panel value="labs">
              <Box mt="md">
                <TreatmentLabResultRelationships
                  treatmentId={treatment.id}
                  labResults={[]}
                  isViewMode={true}
                  onEntityClick={onLabResultClick}
                />
              </Box>
            </Tabs.Panel>

            <Tabs.Panel value="equipment">
              <Box mt="md">
                <TreatmentEquipmentRelationships
                  treatmentId={treatment.id}
                  equipment={[]}
                  isViewMode={true}
                  onEntityClick={onEquipmentClick}
                />
              </Box>
            </Tabs.Panel>
          </>
        )}

        {/* Notes Tab */}
        <Tabs.Panel value="notes">
          <Box mt="md">
            <Stack gap="lg">
              <div>
                <Title order={4} mb="sm">{t('treatments.viewModal.treatmentNotes', 'Treatment Notes')}</Title>
                <Text size="sm" c={treatment.notes ? 'inherit' : 'dimmed'}>
                  {treatment.notes || t('treatments.viewModal.noNotesAvailable', 'No notes available')}
                </Text>
              </div>
            </Stack>
          </Box>
        </Tabs.Panel>

        {/* Documents Tab */}
        <Tabs.Panel value="documents">
          <Box mt="md">
            <DocumentManagerWithProgress
              entityType="treatment"
              entityId={treatment.id}
              onError={onError}
            />
          </Box>
        </Tabs.Panel>

        </Tabs>

        {/* Action Buttons */}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            {t('treatments.viewModal.close', 'Close')}
          </Button>
          <Button variant="filled" onClick={handleEdit} leftSection={<IconEdit size={16} />}>
            {t('treatments.viewModal.edit', 'Edit')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default TreatmentViewModal;
