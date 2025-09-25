import React from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  Divider,
  Grid,
  Card,
  Title,
} from '@mantine/core';
import { IconEdit } from '@tabler/icons-react';
import { formatDate } from '../../../utils/helpers';
import StatusBadge from '../StatusBadge';

const ConditionViewModal = ({
  isOpen,
  onClose,
  condition,
  onEdit,
  medications = [],
  practitioners = [],
  onMedicationClick,
  onPractitionerClick,
}) => {
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'green';
      case 'inactive': return 'gray';
      case 'resolved': return 'blue';
      case 'chronic': return 'orange';
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

    // Add appropriate suffix based on condition status
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
            Condition Details
          </Text>
          <StatusBadge status={condition.status} />
        </Group>
      }
      size="lg"
      centered
      zIndex={2000}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto'
        }
      }}
    >
      <Stack gap="md">
        {/* Main condition info */}
        <Card withBorder p="md">
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start">
              <Stack gap="xs" style={{ flex: 1 }}>
                <Title order={3}>{condition.diagnosis}</Title>
                <Text size="sm" c={condition.condition_name ? 'inherit' : 'dimmed'} fw={500}>
                  {condition.condition_name || 'No condition name specified'}
                </Text>
                <Badge
                  color={condition.severity ? getSeverityColor(condition.severity) : 'gray'}
                  variant={condition.severity ? 'filled' : 'light'}
                >
                  {condition.severity || 'No severity specified'}
                </Badge>
              </Stack>
            </Group>
          </Stack>
        </Card>

        {/* Diagnosis and Timeline information */}
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Card withBorder p="md" h="100%">
              <Stack gap="sm">
                <Text fw={600} size="sm" c="dimmed">
                  DIAGNOSIS INFORMATION
                </Text>
                <Divider />
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Diagnosis:
                  </Text>
                  <Text size="sm" c={condition.diagnosis ? 'inherit' : 'dimmed'}>
                    {condition.diagnosis || 'Not specified'}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Severity:
                  </Text>
                  <Text size="sm" c={condition.severity ? 'inherit' : 'dimmed'}>
                    {condition.severity || 'Not specified'}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Status:
                  </Text>
                  <Text size="sm" c={condition.status ? 'inherit' : 'dimmed'}>
                    {condition.status || 'Not specified'}
                  </Text>
                </Group>
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Card withBorder p="md" h="100%">
              <Stack gap="sm">
                <Text fw={600} size="sm" c="dimmed">
                  TIMELINE
                </Text>
                <Divider />
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Onset Date:
                  </Text>
                  <Text size="sm" c={condition.onset_date ? 'inherit' : 'dimmed'}>
                    {condition.onset_date
                      ? formatDate(condition.onset_date)
                      : 'Not specified'}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    End Date:
                  </Text>
                  <Text size="sm" c={condition.end_date ? 'inherit' : 'dimmed'}>
                    {condition.end_date
                      ? formatDate(condition.end_date)
                      : 'Not specified'}
                  </Text>
                </Group>
                {condition.onset_date && (
                  <Group>
                    <Text size="sm" fw={500} w={80}>
                      Duration:
                    </Text>
                    <Text size="sm" c="inherit">
                      {getConditionDuration(condition.onset_date, condition.end_date, condition.status)}
                    </Text>
                  </Group>
                )}
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Medical codes section */}
        <Card withBorder p="md">
          <Stack gap="sm">
            <Text fw={600} size="sm" c="dimmed">
              MEDICAL CODES
            </Text>
            <Divider />
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    ICD-10:
                  </Text>
                  <Text size="sm" c={condition.icd10_code ? 'inherit' : 'dimmed'}>
                    {condition.icd10_code || 'Not specified'}
                  </Text>
                </Group>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    SNOMED:
                  </Text>
                  <Text size="sm" c={condition.snomed_code ? 'inherit' : 'dimmed'}>
                    {condition.snomed_code || 'Not specified'}
                  </Text>
                </Group>
              </Grid.Col>
            </Grid>
            <Group>
              <Text size="sm" fw={500} w={80}>
                Description:
              </Text>
              <Text size="sm" c={condition.code_description ? 'inherit' : 'dimmed'}>
                {condition.code_description || 'Not specified'}
              </Text>
            </Group>
          </Stack>
        </Card>

        {/* Related Medication section */}
        <Card withBorder p="md">
          <Stack gap="sm">
            <Text fw={600} size="sm" c="dimmed">
              RELATED MEDICATION
            </Text>
            <Divider />
            <Group>
              <Text size="sm" fw={500} w={80}>
                Medication:
              </Text>
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
                <Text size="sm" c="dimmed">
                  No medication linked
                </Text>
              )}
            </Group>
          </Stack>
        </Card>

        {/* Related Practitioner section */}
        <Card withBorder p="md">
          <Stack gap="sm">
            <Text fw={600} size="sm" c="dimmed">
              PRACTITIONER
            </Text>
            <Divider />
            <Group>
              <Text size="sm" fw={500} w={80}>
                Doctor:
              </Text>
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
                <Text size="sm" c="dimmed">
                  No practitioner assigned
                </Text>
              )}
            </Group>
          </Stack>
        </Card>

        {/* Notes section */}
        <Card withBorder p="md">
          <Stack gap="sm">
            <Text fw={600} size="sm" c="dimmed">
              CLINICAL NOTES
            </Text>
            <Divider />
            <Text size="sm" c={condition.notes ? 'inherit' : 'dimmed'}>
              {condition.notes || 'No clinical notes available'}
            </Text>
          </Stack>
        </Card>

        {condition.tags && condition.tags.length > 0 && (
          <Card withBorder p="md">
            <Stack gap="sm">
              <Text fw={600} size="sm" c="dimmed">
                TAGS
              </Text>
              <Divider />
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
            </Stack>
          </Card>
        )}

        {/* Action Buttons */}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
          <Button variant="filled" onClick={handleEdit} leftSection={<IconEdit size={16} />}>
            Edit
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default ConditionViewModal;