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
import StatusBadge from '../StatusBadge';
import { formatDate } from '../../../utils/helpers';

const TreatmentViewModal = ({
  isOpen,
  onClose,
  treatment,
  onEdit,
  conditions = [],
  practitioners = [],
  onConditionClick,
  navigate
}) => {
  if (!isOpen || !treatment) return null;

  const handleEdit = () => {
    onEdit(treatment);
    onClose();
  };

  // Helper function to get condition name from ID
  const getConditionName = (conditionId) => {
    if (!conditionId || !conditions || conditions.length === 0) {
      return null;
    }
    const condition = conditions.find(c => c.id === conditionId);
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

  const handleConditionClick = (conditionId) => {
    if (onConditionClick) {
      onConditionClick(conditionId);
    }
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={
        <Group>
          <Text size="lg" fw={600}>
            Treatment Details
          </Text>
          <StatusBadge status={treatment.status} />
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        <Card withBorder p="md">
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start">
              <Stack gap="xs" style={{ flex: 1 }}>
                <Title order={3}>{treatment.treatment_name}</Title>
                <Group gap="xs">
                  {treatment.treatment_type && (
                    <Badge variant="light" color="blue" size="lg">
                      {treatment.treatment_type}
                    </Badge>
                  )}
                  {treatment.condition_id && (
                    <Group gap="xs">
                      <Text size="sm" c="dimmed">
                        Related to:
                      </Text>
                      <Text
                        size="sm"
                        fw={500}
                        c="blue"
                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => handleConditionClick(treatment.condition_id)}
                        title="View condition details"
                      >
                        {treatment.condition?.diagnosis ||
                          getConditionName(treatment.condition_id) ||
                          `Condition #${treatment.condition_id}`}
                      </Text>
                    </Group>
                  )}
                </Group>
              </Stack>
            </Group>

            <Stack gap="xs">
              <Text fw={500} c="dimmed" size="sm">
                Description
              </Text>
              <Text c={treatment.description ? 'inherit' : 'dimmed'}>
                {treatment.description || 'Not specified'}
              </Text>
            </Stack>
          </Stack>
        </Card>

        <Grid>
          <Grid.Col span={6}>
            <Card withBorder p="md" h="100%">
              <Stack gap="sm">
                <Text fw={600} size="sm" c="dimmed">
                  SCHEDULE
                </Text>
                <Divider />
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Start:
                  </Text>
                  <Text
                    size="sm"
                    c={treatment.start_date ? 'inherit' : 'dimmed'}
                  >
                    {treatment.start_date
                      ? formatDate(treatment.start_date)
                      : 'Not specified'}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    End:
                  </Text>
                  <Text
                    size="sm"
                    c={treatment.end_date ? 'inherit' : 'dimmed'}
                  >
                    {treatment.end_date
                      ? formatDate(treatment.end_date)
                      : 'Not specified'}
                  </Text>
                </Group>
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={6}>
            <Card withBorder p="md" h="100%">
              <Stack gap="sm">
                <Text fw={600} size="sm" c="dimmed">
                  AMOUNT & FREQUENCY
                </Text>
                <Divider />
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Amount:
                  </Text>
                  <Text
                    size="sm"
                    c={treatment.dosage ? 'inherit' : 'dimmed'}
                  >
                    {treatment.dosage || 'Not specified'}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Frequency:
                  </Text>
                  <Text
                    size="sm"
                    c={treatment.frequency ? 'inherit' : 'dimmed'}
                  >
                    {treatment.frequency || 'Not specified'}
                  </Text>
                </Group>
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={6}>
            <Card withBorder p="md">
              <Stack gap="sm">
                <Text fw={600} size="sm" c="dimmed">
                  PRACTITIONER
                </Text>
                <Divider />
                {treatment.practitioner_id ? (
                  <Stack gap="xs">
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Doctor:
                      </Text>
                      <Text size="sm" fw={600}>
                        {treatment.practitioner?.name ||
                          getPractitionerInfo(treatment.practitioner_id)?.name ||
                          `Practitioner #${treatment.practitioner_id}`}
                      </Text>
                    </Group>
                    {(treatment.practitioner?.practice ||
                      getPractitionerInfo(treatment.practitioner_id)?.practice) && (
                      <Group>
                        <Text size="sm" fw={500} w={80}>
                          Practice:
                        </Text>
                        <Text size="sm">
                          {treatment.practitioner?.practice ||
                            getPractitionerInfo(treatment.practitioner_id)?.practice}
                        </Text>
                      </Group>
                    )}
                    {(treatment.practitioner?.specialty ||
                      getPractitionerInfo(treatment.practitioner_id)?.specialty) && (
                      <Group>
                        <Text size="sm" fw={500} w={80}>
                          Specialty:
                        </Text>
                        <Badge variant="light" color="green" size="sm">
                          {treatment.practitioner?.specialty ||
                            getPractitionerInfo(treatment.practitioner_id)?.specialty}
                        </Badge>
                      </Group>
                    )}
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed">
                    No practitioner assigned
                  </Text>
                )}
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={6}>
            <Card withBorder p="md">
              <Stack gap="sm">
                <Text fw={600} size="sm" c="dimmed">
                  RELATED CONDITION
                </Text>
                <Divider />
                {treatment.condition_id ? (
                  <Stack gap="xs">
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Diagnosis:
                      </Text>
                      <Text
                        size="sm"
                        fw={600}
                        style={{
                          cursor: 'pointer',
                          color: 'var(--mantine-color-blue-6)',
                          textDecoration: 'underline',
                        }}
                        onClick={() => handleConditionClick(treatment.condition_id)}
                      >
                        {treatment.condition?.diagnosis ||
                          getConditionName(treatment.condition_id) ||
                          `Condition #${treatment.condition_id}`}
                      </Text>
                    </Group>
                    {treatment.condition?.severity && (
                      <Group>
                        <Text size="sm" fw={500} w={80}>
                          Severity:
                        </Text>
                        <Badge variant="light" color="orange" size="sm">
                          {treatment.condition.severity}
                        </Badge>
                      </Group>
                    )}
                    {treatment.condition?.status && (
                      <Group>
                        <Text size="sm" fw={500} w={80}>
                          Status:
                        </Text>
                        <Badge variant="light" color="blue" size="sm">
                          {treatment.condition.status}
                        </Badge>
                      </Group>
                    )}
                  </Stack>
                ) : (
                  <Text size="sm" c="dimmed">
                    No condition linked
                  </Text>
                )}
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>

        <Card withBorder p="md">
          <Stack gap="sm">
            <Text fw={600} size="sm" c="dimmed">
              NOTES
            </Text>
            <Divider />
            <Text
              size="sm"
              c={treatment.notes ? 'inherit' : 'dimmed'}
            >
              {treatment.notes || 'No notes available'}
            </Text>
          </Stack>
        </Card>

        {treatment.tags && treatment.tags.length > 0 && (
          <Card withBorder p="md">
            <Stack gap="sm">
              <Text fw={600} size="sm" c="dimmed">
                TAGS
              </Text>
              <Divider />
              <Group gap="xs">
                {treatment.tags.map((tag, index) => (
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
          <Button 
            variant="filled" 
            onClick={handleEdit} 
            leftSection={<IconEdit size={16} />}
          >
            Edit Treatment
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default TreatmentViewModal;