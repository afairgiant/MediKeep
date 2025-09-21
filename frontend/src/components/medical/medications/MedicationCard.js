import React from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
  Divider,
} from '@mantine/core';
import { formatDate } from '../../../utils/helpers';
import { navigateToEntity } from '../../../utils/linkNavigation';
import StatusBadge from '../StatusBadge';

const MedicationCard = ({
  medication,
  onView,
  onEdit,
  onDelete,
  navigate,
  onError,
}) => {
  const getMedicationPurpose = (medication) => {
    const indication = medication.indication?.trim();
    return indication || 'No indication specified';
  };

  return (
    <Card
      withBorder
      shadow="sm"
      radius="md"
      h="100%"
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      <Stack gap="sm" style={{ flex: 1 }}>
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs" style={{ flex: 1 }}>
            <Text fw={600} size="lg">
              {medication.medication_name}
            </Text>
            {medication.dosage && (
              <Badge variant="light" color="blue" size="md">
                {medication.dosage}
              </Badge>
            )}
            {medication.tags && medication.tags.length > 0 && (
              <Group gap="xs">
                <Badge
                  variant="outline"
                  color="gray"
                  size="sm"
                  style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  🏷️ {medication.tags[0]}{medication.tags.length > 1 ? ` +${medication.tags.length - 1}` : ''}
                </Badge>
              </Group>
            )}
          </Stack>
          <StatusBadge status={medication.status} />
        </Group>

        <Stack gap="xs">
          {medication.frequency && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={120}>
                Frequency:
              </Text>
              <Text size="sm">{medication.frequency}</Text>
            </Group>
          )}
          {medication.route && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={120}>
                Route:
              </Text>
              <Badge variant="light" color="cyan" size="sm">
                {medication.route}
              </Badge>
            </Group>
          )}
          <Group align="flex-start">
            <Text size="sm" fw={500} c="dimmed" w={120}>
              Purpose:
            </Text>
            <Text size="sm" style={{ flex: 1 }}>
              {getMedicationPurpose(medication)}
            </Text>
          </Group>
          {medication.practitioner && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={120}>
                Prescriber:
              </Text>
              <Text 
                size="sm" 
                c="blue"
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => navigateToEntity('practitioner', medication.practitioner.id, navigate)}
                title="View practitioner details"
              >
                {medication.practitioner.name}
              </Text>
            </Group>
          )}
          {medication.pharmacy && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={120}>
                Pharmacy:
              </Text>
              <Text 
                size="sm" 
                c="blue"
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => navigateToEntity('pharmacy', medication.pharmacy.id, navigate)}
                title="View pharmacy details"
              >
                {medication.pharmacy.name}
              </Text>
            </Group>
          )}
          {medication.effective_period_start && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={120}>
                Start Date:
              </Text>
              <Text size="sm">
                {formatDate(medication.effective_period_start)}
              </Text>
            </Group>
          )}
          {medication.effective_period_end && (
            <Group>
              <Text size="sm" fw={500} c="dimmed" w={120}>
                End Date:
              </Text>
              <Text size="sm">
                {formatDate(medication.effective_period_end)}
              </Text>
            </Group>
          )}
        </Stack>
      </Stack>

      <Stack gap={0} mt="auto">
        <Divider />
        <Group justify="flex-end" gap="xs" pt="sm">
          <Button
            variant="filled"
            size="xs"
            onClick={() => onView(medication)}
          >
            View
          </Button>
          <Button
            variant="filled"
            size="xs"
            onClick={() => onEdit(medication)}
          >
            Edit
          </Button>
          <Button
            variant="filled"
            color="red"
            size="xs"
            onClick={() => onDelete(medication.id)}
          >
            Delete
          </Button>
        </Group>
      </Stack>
    </Card>
  );
};

export default MedicationCard;