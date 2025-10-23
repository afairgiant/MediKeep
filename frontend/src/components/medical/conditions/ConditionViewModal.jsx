import React, { useState, useEffect } from 'react';
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
} from '@mantine/core';
import {
  IconInfoCircle,
  IconStethoscope,
  IconNotes,
  IconFileText,
  IconEdit,
} from '@tabler/icons-react';
import { formatDate } from '../../../utils/helpers';
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
    return practitioner ? practitioner.name || `Dr. ${practitioner.first_name || ''} ${practitioner.last_name || ''}`.trim() : null;
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
      return `${duration} (ended)`;
    } else {
      return `${duration} (ongoing)`;
    }
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={
        <Group>
          <Text fw={600} size="lg">
            {condition.diagnosis || 'Condition Details'}
          </Text>
          <StatusBadge status={condition.status} />
        </Group>
      }
      size="xl"
      centered
      zIndex={2000}
    >
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconInfoCircle size={16} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="clinical" leftSection={<IconStethoscope size={16} />}>
            Clinical Details
          </Tabs.Tab>
          <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
            Notes
          </Tabs.Tab>
          <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
            Documents
          </Tabs.Tab>
        </Tabs.List>

        {/* Overview Tab */}
        <Tabs.Panel value="overview">
          <Box mt="md">
            <Stack gap="lg">
              {/* Basic Information */}
              <div>
                <Title order={4} mb="sm">Basic Information</Title>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">Diagnosis</Text>
                    <Text size="sm" c={condition.diagnosis ? 'inherit' : 'dimmed'}>
                      {condition.diagnosis || 'Not specified'}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">Condition Name</Text>
                    <Text size="sm" c={condition.condition_name ? 'inherit' : 'dimmed'}>
                      {condition.condition_name || 'Not specified'}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">Severity</Text>
                    <Badge
                      color={condition.severity ? getSeverityColor(condition.severity) : 'gray'}
                      variant={condition.severity ? 'filled' : 'light'}
                      size="sm"
                    >
                      {condition.severity || 'Not specified'}
                    </Badge>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">Status</Text>
                    <StatusBadge status={condition.status} />
                  </Stack>
                </SimpleGrid>
              </div>

              {/* Timeline */}
              <div>
                <Title order={4} mb="sm">Timeline</Title>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">Onset Date</Text>
                    <Text size="sm" c={condition.onset_date ? 'inherit' : 'dimmed'}>
                      {condition.onset_date ? formatDate(condition.onset_date) : 'Not specified'}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">End Date</Text>
                    <Text size="sm" c={condition.end_date ? 'inherit' : 'dimmed'}>
                      {condition.end_date ? formatDate(condition.end_date) : 'Not specified'}
                    </Text>
                  </Stack>
                  {condition.onset_date && (
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Duration</Text>
                      <Text size="sm">{getConditionDuration(condition.onset_date, condition.end_date, condition.status)}</Text>
                    </Stack>
                  )}
                </SimpleGrid>
              </div>

              {/* Related Medication & Practitioner */}
              <div>
                <Title order={4} mb="sm">Related Information</Title>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">Related Medication</Text>
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
                      <Text size="sm" c="dimmed">No medication linked</Text>
                    )}
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">Practitioner</Text>
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
                      <Text size="sm" c="dimmed">No practitioner assigned</Text>
                    )}
                  </Stack>
                </SimpleGrid>
              </div>

              {/* Tags Section */}
              {condition.tags && condition.tags.length > 0 && (
                <div>
                  <Title order={4} mb="sm">Tags</Title>
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
                <Title order={4} mb="sm">Medical Codes</Title>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">ICD-10 Code</Text>
                    <Text size="sm" c={condition.icd10_code ? 'inherit' : 'dimmed'}>
                      {condition.icd10_code || 'Not specified'}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">SNOMED Code</Text>
                    <Text size="sm" c={condition.snomed_code ? 'inherit' : 'dimmed'}>
                      {condition.snomed_code || 'Not specified'}
                    </Text>
                  </Stack>
                  <Stack gap="xs" style={{ gridColumn: '1 / -1' }}>
                    <Text fw={500} size="sm" c="dimmed">Code Description</Text>
                    <Text size="sm" c={condition.code_description ? 'inherit' : 'dimmed'}>
                      {condition.code_description || 'Not specified'}
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
                <Title order={4} mb="sm">Clinical Notes</Title>
                <Text size="sm" c={condition.notes ? 'inherit' : 'dimmed'}>
                  {condition.notes || 'No clinical notes available'}
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
      <Group justify="flex-end" gap="sm" mt="lg">
        <Button variant="default" onClick={onClose}>
          Close
        </Button>
        <Button variant="filled" onClick={handleEdit} leftSection={<IconEdit size={16} />}>
          Edit
        </Button>
      </Group>
    </Modal>
  );
};

export default ConditionViewModal;
