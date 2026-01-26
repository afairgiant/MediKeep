import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  IconStethoscope,
  IconNotes,
  IconFileText,
  IconEdit,
} from '@tabler/icons-react';
import { useDateFormat } from '../../../hooks/useDateFormat';
import StatusBadge from '../StatusBadge';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';

const ConditionViewModal = ({
  isOpen,
  onClose,
  condition,
  onEdit,
  medications = [],
  practitioners = [],
  onMedicationClick,
  onPractitionerClick,
  onError,
}) => {
  const { t } = useTranslation('common');
  const { formatDate } = useDateFormat();
  const [activeTab, setActiveTab] = useState('overview');

  // Reset tab when modal opens or condition changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
    }
  }, [isOpen, condition?.id]);

  if (!isOpen || !condition) return null;

  // Helper function to get medication name from ID
  const getMedicationName = (medicationId) => {
    if (!medicationId || !medications || medications.length === 0) {
      return null;
    }
    const medication = medications.find(m => m.id === medicationId);
    return medication ? medication.medication_name || medication.name : null;
  };

  // Helper function to get practitioner name from ID
  const getPractitionerName = (practitionerId) => {
    if (!practitionerId || !practitioners || practitioners.length === 0) {
      return null;
    }
    const practitioner = practitioners.find(p => p.id === practitionerId);
    return practitioner ? practitioner.name || `${practitioner.first_name || ''} ${practitioner.last_name || ''}`.trim() : null;
  };

  const handleMedicationClick = (medicationId) => {
    if (onMedicationClick) {
      onMedicationClick(medicationId);
    }
  };

  const handlePractitionerClick = (practitionerId) => {
    if (onPractitionerClick) {
      onPractitionerClick(practitionerId);
    }
  };

  const handleEdit = () => {
    onEdit(condition);
    onClose();
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'red';
      case 'severe': return 'orange';
      case 'moderate': return 'yellow';
      case 'mild': return 'blue';
      default: return 'gray';
    }
  };

  // Helper function to calculate condition duration
  const getConditionDuration = (onsetDate, endDate, status) => {
    if (!onsetDate) return null;

    const onset = new Date(onsetDate);
    const endPoint = endDate ? new Date(endDate) : new Date();
    const diffTime = Math.abs(endPoint - onset);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let duration;
    if (diffDays < 30) {
      duration = `${diffDays} day${diffDays === 1 ? '' : 's'}`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      duration = `${months} month${months === 1 ? '' : 's'}`;
    } else {
      const years = Math.floor(diffDays / 365);
      duration = `${years} year${years === 1 ? '' : 's'}`;
    }

    if (endDate || status === 'resolved' || status === 'inactive') {
      return t('conditions.card.durationEnded', '{{duration}} (ended)', { duration });
    } else {
      return t('conditions.card.durationOngoing', '{{duration}} (ongoing)', { duration });
    }
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={t('conditions.modal.title', 'Condition Details')}
      size="xl"
      centered
      zIndex={2000}
    >
      <Stack gap="lg">
        {/* Header Card */}
        <Paper withBorder p="md" style={{ backgroundColor: '#f8f9fa' }}>
          <Group justify="space-between" align="center">
            <div>
              <Title order={3} mb="xs">{condition.diagnosis || condition.condition_name}</Title>
              <Group gap="xs">
                <StatusBadge status={condition.status} />
              </Group>
            </div>
            {condition.severity && (
              <Badge
                color={getSeverityColor(condition.severity)}
                variant="filled"
                size="lg"
              >
                {condition.severity}
              </Badge>
            )}
          </Group>
        </Paper>

        <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconInfoCircle size={16} />}>
            {t('conditions.modal.tabs.overview', 'Overview')}
          </Tabs.Tab>
          <Tabs.Tab value="clinical" leftSection={<IconStethoscope size={16} />}>
            {t('conditions.modal.tabs.clinical', 'Clinical Details')}
          </Tabs.Tab>
          <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
            {t('conditions.modal.tabs.notes', 'Notes')}
          </Tabs.Tab>
          <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
            {t('conditions.modal.tabs.documents', 'Documents')}
          </Tabs.Tab>
        </Tabs.List>

        {/* Overview Tab */}
        <Tabs.Panel value="overview">
          <Box mt="md">
            <Stack gap="lg">
              {/* Basic Information */}
              <div>
                <Title order={4} mb="sm">{t('conditions.modal.sections.basicInfo', 'Basic Information')}</Title>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('conditions.modal.labels.diagnosis', 'Diagnosis')}</Text>
                    <Text size="sm" c={condition.diagnosis ? 'inherit' : 'dimmed'}>
                      {condition.diagnosis || t('labels.notSpecified', 'Not specified')}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('conditions.modal.labels.conditionName', 'Condition Name')}</Text>
                    <Text size="sm" c={condition.condition_name ? 'inherit' : 'dimmed'}>
                      {condition.condition_name || t('labels.notSpecified', 'Not specified')}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('conditions.modal.labels.severity', 'Severity')}</Text>
                    <Badge
                      color={condition.severity ? getSeverityColor(condition.severity) : 'gray'}
                      variant={condition.severity ? 'filled' : 'light'}
                      size="sm"
                    >
                      {condition.severity || t('labels.notSpecified', 'Not specified')}
                    </Badge>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('labels.status', 'Status')}</Text>
                    <StatusBadge status={condition.status} />
                  </Stack>
                </SimpleGrid>
              </div>

              {/* Timeline */}
              <div>
                <Title order={4} mb="sm">{t('conditions.modal.sections.timeline', 'Timeline')}</Title>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('conditions.modal.labels.onsetDate', 'Onset Date')}</Text>
                    <Text size="sm" c={condition.onset_date ? 'inherit' : 'dimmed'}>
                      {condition.onset_date ? formatDate(condition.onset_date) : t('labels.notSpecified', 'Not specified')}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('conditions.modal.labels.endDate', 'End Date')}</Text>
                    <Text size="sm" c={condition.end_date ? 'inherit' : 'dimmed'}>
                      {condition.end_date ? formatDate(condition.end_date) : t('labels.notSpecified', 'Not specified')}
                    </Text>
                  </Stack>
                  {condition.onset_date && (
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('conditions.modal.labels.duration', 'Duration')}</Text>
                      <Text size="sm">{getConditionDuration(condition.onset_date, condition.end_date, condition.status)}</Text>
                    </Stack>
                  )}
                </SimpleGrid>
              </div>

              {/* Related Medication & Practitioner */}
              <div>
                <Title order={4} mb="sm">{t('conditions.modal.sections.relatedInfo', 'Related Information')}</Title>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('conditions.modal.labels.relatedMedication', 'Related Medication')}</Text>
                    {condition.medication_id ? (
                      <Text
                        size="sm"
                        fw={600}
                        style={{
                          cursor: 'pointer',
                          color: 'var(--mantine-color-blue-6)',
                          textDecoration: 'underline',
                        }}
                        onClick={() => handleMedicationClick(condition.medication_id)}
                      >
                        {condition.medication?.medication_name ||
                          getMedicationName(condition.medication_id) ||
                          `Medication #${condition.medication_id}`}
                      </Text>
                    ) : (
                      <Text size="sm" c="dimmed">{t('conditions.modal.noMedicationLinked', 'No medication linked')}</Text>
                    )}
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('conditions.modal.labels.practitioner', 'Practitioner')}</Text>
                    {condition.practitioner_id ? (
                      <Text
                        size="sm"
                        fw={600}
                        style={{
                          cursor: 'pointer',
                          color: 'var(--mantine-color-blue-6)',
                          textDecoration: 'underline',
                        }}
                        onClick={() => handlePractitionerClick(condition.practitioner_id)}
                      >
                        {condition.practitioner?.name ||
                          getPractitionerName(condition.practitioner_id) ||
                          `Practitioner #${condition.practitioner_id}`}
                      </Text>
                    ) : (
                      <Text size="sm" c="dimmed">{t('conditions.modal.noPractitionerAssigned', 'No practitioner assigned')}</Text>
                    )}
                  </Stack>
                </SimpleGrid>
              </div>

              {/* Tags Section */}
              {condition.tags && condition.tags.length > 0 && (
                <div>
                  <Title order={4} mb="sm">{t('conditions.modal.sections.tags', 'Tags')}</Title>
                  <Group gap="xs">
                    {condition.tags.map((tag, index) => (
                      <Badge
                        key={index}
                        variant="light"
                        color="blue"
                        size="sm"
                        radius="md"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </Group>
                </div>
              )}
            </Stack>
          </Box>
        </Tabs.Panel>

        {/* Clinical Details Tab */}
        <Tabs.Panel value="clinical">
          <Box mt="md">
            <Stack gap="lg">
              {/* Medical Codes */}
              <div>
                <Title order={4} mb="sm">{t('conditions.modal.sections.medicalCodes', 'Medical Codes')}</Title>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('conditions.modal.labels.icd10Code', 'ICD-10 Code')}</Text>
                    <Text size="sm" c={condition.icd10_code ? 'inherit' : 'dimmed'}>
                      {condition.icd10_code || t('labels.notSpecified', 'Not specified')}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('conditions.modal.labels.snomedCode', 'SNOMED Code')}</Text>
                    <Text size="sm" c={condition.snomed_code ? 'inherit' : 'dimmed'}>
                      {condition.snomed_code || t('labels.notSpecified', 'Not specified')}
                    </Text>
                  </Stack>
                  <Stack gap="xs" style={{ gridColumn: '1 / -1' }}>
                    <Text fw={500} size="sm" c="dimmed">{t('conditions.modal.labels.codeDescription', 'Code Description')}</Text>
                    <Text size="sm" c={condition.code_description ? 'inherit' : 'dimmed'}>
                      {condition.code_description || t('labels.notSpecified', 'Not specified')}
                    </Text>
                  </Stack>
                </SimpleGrid>
              </div>
            </Stack>
          </Box>
        </Tabs.Panel>

        {/* Notes Tab */}
        <Tabs.Panel value="notes">
          <Box mt="md">
            <Stack gap="lg">
              {/* Clinical Notes */}
              <div>
                <Title order={4} mb="sm">{t('conditions.modal.sections.clinicalNotes', 'Clinical Notes')}</Title>
                <Text size="sm" c={condition.notes ? 'inherit' : 'dimmed'}>
                  {condition.notes || t('conditions.modal.noNotesAvailable', 'No clinical notes available')}
                </Text>
              </div>
            </Stack>
          </Box>
        </Tabs.Panel>

        {/* Documents Tab */}
        <Tabs.Panel value="documents">
          <Box mt="md">
            <DocumentManagerWithProgress
              entityType="condition"
              entityId={condition.id}
              onError={onError}
            />
          </Box>
        </Tabs.Panel>
        </Tabs>

        {/* Action Buttons */}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            {t('buttons.close', 'Close')}
          </Button>
          <Button variant="filled" onClick={handleEdit} leftSection={<IconEdit size={16} />}>
            {t('buttons.edit', 'Edit')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default ConditionViewModal;
