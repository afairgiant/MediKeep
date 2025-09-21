import React from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
  Grid,
  Modal,
  Title,
  Divider,
} from '@mantine/core';
import { formatDate } from '../../../utils/helpers';
import { navigateToEntity } from '../../../utils/linkNavigation';
import StatusBadge from '../StatusBadge';

const MedicationViewModal = ({
  isOpen,
  onClose,
  medication,
  onEdit,
  navigate,
  onError,
}) => {
  const getMedicationPurpose = (medication) => {
    const indication = medication?.indication?.trim();
    return indication || 'No indication specified';
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={
        <Group>
          <Text size="lg" fw={600}>
            Medication Details
          </Text>
          {medication && (
            <StatusBadge status={medication.status} />
          )}
        </Group>
      }
      size="lg"
      centered
    >
      {medication && (
        <Stack gap="md">
          <Card withBorder p="md">
            <Stack gap="sm">
              <Group justify="space-between" align="flex-start">
                <Stack gap="xs" style={{ flex: 1 }}>
                  <Title order={3}>{medication.medication_name}</Title>
                  {medication.dosage && (
                    <Badge variant="light" color="blue" size="lg">
                      {medication.dosage}
                    </Badge>
                  )}
                </Stack>
              </Group>

              <Stack gap="xs">
                <Text fw={500} c="dimmed" size="sm">
                  Purpose
                </Text>
                <Text>
                  {getMedicationPurpose(medication)}
                </Text>
              </Stack>
            </Stack>
          </Card>

          <Grid>
            <Grid.Col span={6}>
              <Card withBorder p="md" h="100%">
                <Stack gap="sm">
                  <Text fw={600} size="sm" c="dimmed">
                    DOSAGE & FREQUENCY
                  </Text>
                  <Divider />
                  <Group>
                    <Text size="sm" fw={500} w={80}>
                      Dosage:
                    </Text>
                    <Text
                      size="sm"
                      c={medication.dosage ? 'inherit' : 'dimmed'}
                    >
                      {medication.dosage || 'Not specified'}
                    </Text>
                  </Group>
                  <Group>
                    <Text size="sm" fw={500} w={80}>
                      Frequency:
                    </Text>
                    <Text
                      size="sm"
                      c={medication.frequency ? 'inherit' : 'dimmed'}
                    >
                      {medication.frequency || 'Not specified'}
                    </Text>
                  </Group>
                  <Group>
                    <Text size="sm" fw={500} w={80}>
                      Route:
                    </Text>
                    {medication.route ? (
                      <Badge variant="light" color="cyan" size="sm">
                        {medication.route}
                      </Badge>
                    ) : (
                      <Text size="sm" c="dimmed">
                        Not specified
                      </Text>
                    )}
                  </Group>
                </Stack>
              </Card>
            </Grid.Col>

            <Grid.Col span={6}>
              <Card withBorder p="md" h="100%">
                <Stack gap="sm">
                  <Text fw={600} size="sm" c="dimmed">
                    PRESCRIBER & PHARMACY
                  </Text>
                  <Divider />
                  <Group>
                    <Text size="sm" fw={500} w={80}>
                      Prescriber:
                    </Text>
                    {medication.practitioner ? (
                      <Text
                        size="sm"
                        c="blue"
                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => navigateToEntity('practitioner', medication.practitioner.id, navigate)}
                        title="View practitioner details"
                      >
                        {medication.practitioner.name}
                      </Text>
                    ) : (
                      <Text size="sm" c="dimmed">
                        Not specified
                      </Text>
                    )}
                  </Group>
                  <Group>
                    <Text size="sm" fw={500} w={80}>
                      Pharmacy:
                    </Text>
                    {medication.pharmacy ? (
                      <Text
                        size="sm"
                        c="blue"
                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => navigateToEntity('pharmacy', medication.pharmacy.id, navigate)}
                        title="View pharmacy details"
                      >
                        {medication.pharmacy.name}
                      </Text>
                    ) : (
                      <Text size="sm" c="dimmed">
                        Not specified
                      </Text>
                    )}
                  </Group>
                </Stack>
              </Card>
            </Grid.Col>
          </Grid>

          <Card withBorder p="md">
            <Stack gap="sm">
              <Text fw={600} size="sm" c="dimmed">
                EFFECTIVE PERIOD
              </Text>
              <Divider />
              <Grid>
                <Grid.Col span={6}>
                  <Group>
                    <Text size="sm" fw={500} w={80}>
                      Start Date:
                    </Text>
                    <Text
                      size="sm"
                      c={
                        medication.effective_period_start
                          ? 'inherit'
                          : 'dimmed'
                      }
                    >
                      {medication.effective_period_start
                        ? formatDate(medication.effective_period_start)
                        : 'Not specified'}
                    </Text>
                  </Group>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Group>
                    <Text size="sm" fw={500} w={80}>
                      End Date:
                    </Text>
                    <Text
                      size="sm"
                      c={
                        medication.effective_period_end
                          ? 'inherit'
                          : 'dimmed'
                      }
                    >
                      {medication.effective_period_end
                        ? formatDate(medication.effective_period_end)
                        : 'Not specified'}
                    </Text>
                  </Group>
                </Grid.Col>
              </Grid>
            </Stack>
          </Card>

          {medication.tags && medication.tags.length > 0 && (
            <Card withBorder p="md">
              <Stack gap="sm">
                <Text fw={600} size="sm" c="dimmed">
                  TAGS
                </Text>
                <Divider />
                <Group gap="xs">
                  {medication.tags.map((tag, index) => (
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

          <Group justify="flex-end" mt="md">
            <Button
              variant="light"
              onClick={() => {
                onClose();
                onEdit(medication);
              }}
            >
              Edit Medication
            </Button>
            <Button variant="filled" onClick={onClose}>
              Close
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
};

export default MedicationViewModal;