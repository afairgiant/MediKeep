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
  Anchor,
} from '@mantine/core';
import { IconEdit, IconStar } from '@tabler/icons-react';
import { formatPhoneNumber } from '../../../utils/phoneUtils';
import logger from '../../../services/logger';

const PractitionerViewModal = ({
  isOpen,
  onClose,
  practitioner,
  onEdit,
  navigate
}) => {
  if (!isOpen || !practitioner) return null;

  const handleEdit = () => {
    onEdit(practitioner);
    onClose();
  };

  const getSpecialtyColor = (specialty) => {
    const specialtyColors = {
      Cardiology: 'red',
      'Emergency Medicine': 'red',
      'Family Medicine': 'green',
      'Internal Medicine': 'green',
      Pediatrics: 'blue',
      Surgery: 'orange',
      'General Surgery': 'orange',
      Psychiatry: 'purple',
      Neurology: 'yellow',
    };

    return specialtyColors[specialty] || 'gray';
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={
        <Group>
          <Text size="lg" fw={600}>
            Practitioner Details
          </Text>
          {practitioner.specialty && (
            <Badge
              color={getSpecialtyColor(practitioner.specialty)}
              variant="light"
              size="lg"
            >
              {practitioner.specialty}
            </Badge>
          )}
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
                <Title order={3}>{practitioner.name}</Title>
                <Text size="sm" c="dimmed">
                  Healthcare Practitioner
                </Text>
              </Stack>
            </Group>
          </Stack>
        </Card>

        <Grid>
          <Grid.Col span={6}>
            <Card withBorder p="md" h="100%">
              <Stack gap="sm">
                <Text fw={600} size="sm" c="dimmed">
                  PRACTICE INFORMATION
                </Text>
                <Divider />
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Practice:
                  </Text>
                  <Text
                    size="sm"
                    c={practitioner.practice ? 'inherit' : 'dimmed'}
                  >
                    {practitioner.practice || 'Not specified'}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Specialty:
                  </Text>
                  <Text
                    size="sm"
                    c={practitioner.specialty ? 'inherit' : 'dimmed'}
                  >
                    {practitioner.specialty || 'Not specified'}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Phone:
                  </Text>
                  <Text
                    size="sm"
                    c={practitioner.phone_number ? 'inherit' : 'dimmed'}
                  >
                    {practitioner.phone_number
                      ? formatPhoneNumber(practitioner.phone_number)
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
                  CONTACT & RATING
                </Text>
                <Divider />
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Website:
                  </Text>
                  <Text
                    size="sm"
                    c={practitioner.website ? 'inherit' : 'dimmed'}
                  >
                    {practitioner.website ? (
                      <Anchor
                        href={practitioner.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="sm"
                        c="blue"
                      >
                        Visit Website
                      </Anchor>
                    ) : (
                      'Not specified'
                    )}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Rating:
                  </Text>
                  <Text
                    size="sm"
                    c={
                      practitioner.rating !== null &&
                      practitioner.rating !== undefined
                        ? 'inherit'
                        : 'dimmed'
                    }
                  >
                    {practitioner.rating !== null &&
                    practitioner.rating !== undefined ? (
                      <Group gap="xs">
                        <IconStar
                          size={16}
                          color="var(--mantine-color-yellow-6)"
                          fill="var(--mantine-color-yellow-6)"
                        />
                        <Text size="sm" fw={500}>
                          {practitioner.rating}/5
                        </Text>
                      </Group>
                    ) : (
                      'Not specified'
                    )}
                  </Text>
                </Group>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Action Buttons */}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
          <Button variant="filled" onClick={handleEdit} leftSection={<IconEdit size={16} />}>
            Edit Practitioner
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default PractitionerViewModal;