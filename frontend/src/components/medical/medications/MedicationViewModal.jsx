import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Badge,
  Button,
  Group,
  Stack,
  Text,
  Title,
  Tabs,
  Box,
  SimpleGrid,
  Paper,
} from '@mantine/core';
import {
  IconInfoCircle,
  IconPill,
  IconNotes,
  IconFileText,
} from '@tabler/icons-react';
import { navigateToEntity } from '../../../utils/linkNavigation';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { useTagColors } from '../../../hooks/useTagColors';
import StatusBadge from '../StatusBadge';
import { ClickableTagBadge } from '../../common/ClickableTagBadge';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import MedicationTreatmentsList from './MedicationTreatmentsList';
import MedicationRelationships from '../MedicationRelationships';
import logger from '../../../services/logger';

const MedicationViewModal = ({
  isOpen,
  onClose,
  medication,
  onEdit,
  navigate,
  onError,
  onFileUploadComplete,
  practitioners = [],
  conditions = [],
}) => {
  const { t } = useTranslation('common');
  const { formatDate } = useDateFormat();
  const { getTagColor } = useTagColors();

  // Tab state management
  const [activeTab, setActiveTab] = useState('overview');

  // Reset tab when modal opens with new medication
  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
    }
  }, [isOpen, medication?.id]);

  const getMedicationPurpose = (medication) => {
    const indication = medication?.indication?.trim();
    return indication || t('medications.fields.noIndication', 'No indication specified');
  };

  const getPractitionerDisplay = (medication) => {
    // Check if practitioner object exists
    if (medication.practitioner) {
      return `${medication.practitioner.name}${medication.practitioner.specialty ? ` - ${medication.practitioner.specialty}` : ''}`;
    }

    // Check if prescribing_doctor string exists (legacy)
    if (medication.prescribing_doctor) {
      return medication.prescribing_doctor;
    }

    // Try to find practitioner by ID
    if (medication.practitioner_id && practitioners.length > 0) {
      const practitioner = practitioners.find(p => p.id === parseInt(medication.practitioner_id));
      if (practitioner) {
        return `${practitioner.name}${practitioner.specialty ? ` - ${practitioner.specialty}` : ''}`;
      }
    }

    return null;
  };

  if (!medication) return null;

  const practitionerDisplay = getPractitionerDisplay(medication);

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={`${medication.medication_name} - ${t('medications.modal.details', 'Details')}`}
      size="xl"
      centered
      zIndex={2000}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto'
        }
      }}
    >
      <Stack gap="lg">
        {/* Header Card */}
        <Paper withBorder p="md" style={{ backgroundColor: '#f8f9fa' }}>
          <Group justify="space-between" align="center">
            <div>
              <Title order={3} mb="xs">
                {medication.medication_name}
              </Title>
              <Group gap="xs">
                <StatusBadge status={medication.status} />
                {medication.dosage && (
                  <Badge variant="light" color="blue" size="md">
                    {medication.dosage}
                  </Badge>
                )}
                {medication.medication_type && (
                  <Badge variant="outline" color="gray" size="sm">
                    {medication.medication_type}
                  </Badge>
                )}
              </Group>
            </div>
          </Group>
        </Paper>

        {/* Tabbed Content */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconInfoCircle size={16} />}>
              {t('medications.modal.tabs.overview', 'Overview')}
            </Tabs.Tab>
            <Tabs.Tab value="details" leftSection={<IconPill size={16} />}>
              {t('medications.modal.tabs.dosageRefills', 'Dosage & Refills')}
            </Tabs.Tab>
            <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
              {t('medications.modal.tabs.notes', 'Notes')}
            </Tabs.Tab>
            <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
              {t('medications.modal.tabs.documents', 'Documents')}
            </Tabs.Tab>
          </Tabs.List>

          {/* Overview Tab */}
          <Tabs.Panel value="overview">
            <Box mt="md">
              <Stack gap="lg">
                <div>
                  <Title order={4} mb="sm">{t('medications.modal.sections.basicInfo', 'Basic Information')}</Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('medications.modal.labels.medicationName', 'Medication Name')}</Text>
                      <Text size="sm">{medication.medication_name}</Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('medications.modal.labels.purposeIndication', 'Purpose/Indication')}</Text>
                      <Text size="sm" c={medication.indication ? 'inherit' : 'dimmed'}>
                        {getMedicationPurpose(medication)}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('labels.status', 'Status')}</Text>
                      <div>
                        <StatusBadge status={medication.status} />
                      </div>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('medications.modal.labels.medicationType', 'Medication Type')}</Text>
                      <Text size="sm" c={medication.medication_type ? 'inherit' : 'dimmed'}>
                        {medication.medication_type || t('medications.modal.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                  </SimpleGrid>
                </div>

                {/* Dates Section */}
                <div>
                  <Title order={4} mb="sm">{t('medications.modal.sections.timeline', 'Timeline')}</Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('medications.fields.startDate', 'Start Date')}</Text>
                      <Text size="sm" c={medication.effective_period_start ? 'inherit' : 'dimmed'}>
                        {medication.effective_period_start ? formatDate(medication.effective_period_start) : t('medications.modal.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('medications.fields.endDate', 'End Date')}</Text>
                      <Text size="sm" c={medication.effective_period_end ? 'inherit' : 'dimmed'}>
                        {medication.effective_period_end ? formatDate(medication.effective_period_end) : t('medications.modal.ongoing', 'Ongoing')}
                      </Text>
                    </Stack>
                  </SimpleGrid>
                </div>

                {/* Prescriber Section */}
                <div>
                  <Title order={4} mb="sm">{t('medications.modal.sections.prescriberPharmacy', 'Prescriber & Pharmacy')}</Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('medications.fields.prescriber', 'Prescriber')}</Text>
                      <Text size="sm" c={practitionerDisplay ? 'inherit' : 'dimmed'}>
                        {practitionerDisplay || t('medications.modal.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('medications.fields.pharmacy', 'Pharmacy')}</Text>
                      <Text size="sm" c={medication.pharmacy ? 'inherit' : 'dimmed'}>
                        {medication.pharmacy
                          ? (typeof medication.pharmacy === 'object'
                              ? medication.pharmacy.name || medication.pharmacy.brand || 'Pharmacy'
                              : medication.pharmacy)
                          : t('medications.modal.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                  </SimpleGrid>
                </div>

                {/* Tags Section */}
                {medication.tags && medication.tags.length > 0 && (
                  <div>
                    <Title order={4} mb="sm">{t('medications.modal.sections.tags', 'Tags')}</Title>
                    <Group gap="xs">
                      {medication.tags.map((tag, index) => (
                        <ClickableTagBadge
                          key={index}
                          tag={tag}
                          color={getTagColor(tag)}
                        />
                      ))}
                    </Group>
                  </div>
                )}

                {/* Related Conditions */}
                <div>
                  <Title order={4} mb="sm">{t('medications.modal.sections.relatedConditions', 'Related Conditions')}</Title>
                  <MedicationRelationships
                    direction="medication"
                    medicationId={medication.id}
                    conditions={conditions}
                    navigate={navigate}
                    isViewMode={true}
                  />
                </div>

                {/* Used in Treatments */}
                <div>
                  <Title order={4} mb="sm">{t('medications.modal.sections.usedInTreatments', 'Used in Treatments')}</Title>
                  <MedicationTreatmentsList
                    medicationId={medication.id}
                    onTreatmentClick={(treatmentId) => {
                      if (navigate) {
                        onClose();
                        navigateToEntity('treatment', treatmentId, navigate);
                      }
                    }}
                  />
                </div>
              </Stack>
            </Box>
          </Tabs.Panel>

          {/* Dosage & Refills Tab */}
          <Tabs.Panel value="details">
            <Box mt="md">
              <Stack gap="lg">
                <div>
                  <Title order={4} mb="sm">{t('medications.modal.sections.dosageInfo', 'Dosage Information')}</Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('medications.modal.labels.dosage', 'Dosage')}</Text>
                      <Text size="sm" c={medication.dosage ? 'inherit' : 'dimmed'}>
                        {medication.dosage || t('medications.modal.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('medications.fields.frequency', 'Frequency')}</Text>
                      <Text size="sm" c={medication.frequency ? 'inherit' : 'dimmed'}>
                        {medication.frequency || t('medications.modal.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('medications.fields.route', 'Route')}</Text>
                      <Text size="sm" c={medication.route ? 'inherit' : 'dimmed'}>
                        {medication.route || t('medications.modal.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('medications.modal.labels.form', 'Form')}</Text>
                      <Text size="sm" c={medication.form ? 'inherit' : 'dimmed'}>
                        {medication.form || t('medications.modal.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                  </SimpleGrid>
                </div>

                {/* Refill Information - TODO: Enable when refill functionality is implemented */}
                {/* <div>
                  <Title order={4} mb="sm">Refill Information</Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Quantity</Text>
                      <Text c={medication.quantity ? 'inherit' : 'dimmed'}>
                        {medication.quantity || 'Not specified'}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Refills Remaining</Text>
                      <Text c={medication.refills !== undefined ? 'inherit' : 'dimmed'}>
                        {medication.refills !== undefined ? medication.refills : 'Not specified'}
                      </Text>
                    </Stack>
                    {medication.last_refill_date && (
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">Last Refill Date</Text>
                        <Text>{formatDate(medication.last_refill_date)}</Text>
                      </Stack>
                    )}
                  </SimpleGrid>
                </div> */}
              </Stack>
            </Box>
          </Tabs.Panel>

          {/* Notes Tab */}
          <Tabs.Panel value="notes">
            <Box mt="md">
              <Stack gap="lg">
                <div>
                  <Title order={4} mb="sm">{t('medications.modal.sections.additionalNotes', 'Additional Notes')}</Title>
                  <Paper withBorder p="sm" bg="gray.1">
                    <Text
                      size="sm"
                      style={{ whiteSpace: 'pre-wrap' }}
                      c={medication.notes ? 'inherit' : 'dimmed'}
                    >
                      {medication.notes || t('medications.modal.noNotes', 'No notes available')}
                    </Text>
                  </Paper>
                </div>

                <div>
                  <Title order={4} mb="sm">{t('medications.modal.sections.sideEffects', 'Side Effects')}</Title>
                  <Paper withBorder p="sm" bg="gray.1">
                    <Text
                      size="sm"
                      style={{ whiteSpace: 'pre-wrap' }}
                      c={medication.side_effects ? 'inherit' : 'dimmed'}
                    >
                      {medication.side_effects || t('medications.modal.noSideEffects', 'No side effects reported')}
                    </Text>
                  </Paper>
                </div>
              </Stack>
            </Box>
          </Tabs.Panel>

          {/* Documents Tab */}
          <Tabs.Panel value="documents">
            <Box mt="md">
              <Stack gap="md">
                <Title order={4}>{t('medications.modal.sections.attachedDocuments', 'Attached Documents')}</Title>
                <DocumentManagerWithProgress
                  entityType="medication"
                  entityId={medication.id}
                  mode="view"
                  onUploadComplete={(success, completedCount, failedCount) => {
                    if (onFileUploadComplete) {
                      onFileUploadComplete(success, completedCount, failedCount);
                    }
                  }}
                  onError={(error) => {
                    logger.error('Document manager error in medication view:', error);
                    if (onError) {
                      onError(error);
                    }
                  }}
                  showProgressModal={true}
                />
              </Stack>
            </Box>
          </Tabs.Panel>
        </Tabs>

        {/* Action Buttons */}
        <Group justify="flex-end" mt="md">
          <Button
            variant="light"
            onClick={() => {
              onClose();
              setTimeout(() => {
                onEdit(medication);
              }, 100);
            }}
          >
            {t('medications.modal.editMedication', 'Edit Medication')}
          </Button>
          <Button variant="filled" onClick={onClose}>
            {t('buttons.close', 'Close')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default MedicationViewModal;
