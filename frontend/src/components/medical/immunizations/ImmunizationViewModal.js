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
import { IconEdit, IconX } from '@tabler/icons-react';
import { formatDate } from '../../../utils/helpers';
import { navigateToEntity } from '../../../utils/linkNavigation';
import logger from '../../../services/logger';

const ImmunizationViewModal = ({
  isOpen,
  onClose,
  immunization,
  onEdit,
  practitioners = [],
  navigate,
  onError
}) => {
  if (!isOpen || !immunization) return null;

  const handleEdit = () => {
    onEdit(immunization);
    onClose();
  };

  // Helper function to get dose color
  const getDoseColor = (doseNumber) => {
    switch (doseNumber) {
      case 1: return 'blue';
      case 2: return 'green';
      case 3: return 'orange';
      case 4: return 'red';
      default: return 'gray';
    }
  };

  const practitioner = practitioners.find(p => p.id === immunization.practitioner_id);

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={
        <Group>
          <Text fw={600} size="lg">
            Immunization Details
          </Text>
          {immunization.dose_number && (
            <Badge
              color={getDoseColor(immunization.dose_number)}
              variant="filled"
              size="lg"
            >
              Dose {immunization.dose_number}
            </Badge>
          )}
        </Group>
      }
      size="lg"
    >
      <Stack gap="md">
        {/* Main immunization info */}
        <Card withBorder p="md">
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start">
              <Stack gap="xs" style={{ flex: 1 }}>
                <Title order={3}>{immunization.vaccine_name}</Title>
                {immunization.vaccine_trade_name && (
                  <Text size="sm" fw={500}>
                    {immunization.vaccine_trade_name}
                  </Text>
                )}
                {immunization.manufacturer && (
                  <Text size="sm" c="dimmed">
                    Manufactured by: {immunization.manufacturer}
                  </Text>
                )}
              </Stack>
            </Group>
          </Stack>
        </Card>

        {/* Vaccine and Administration information */}
        <Grid>
          <Grid.Col span={6}>
            <Card withBorder p="md" h="100%">
              <Stack gap="sm">
                <Text fw={600} size="sm" c="dimmed">
                  VACCINE INFORMATION
                </Text>
                <Divider />
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Vaccine:
                  </Text>
                  <Text size="sm" c={immunization.vaccine_name ? 'inherit' : 'dimmed'}>
                    {immunization.vaccine_name || 'Not specified'}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Dose:
                  </Text>
                  <Text size="sm" c={immunization.dose_number ? 'inherit' : 'dimmed'}>
                    {immunization.dose_number ? `#${immunization.dose_number}` : 'Not specified'}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Lot Number:
                  </Text>
                  <Text size="sm" c={immunization.lot_number ? 'inherit' : 'dimmed'}>
                    {immunization.lot_number || 'Not specified'}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    NDC:
                  </Text>
                  <Text size="sm" c={immunization.ndc_number ? 'inherit' : 'dimmed'}>
                    {immunization.ndc_number || 'Not specified'}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Manufacturer:
                  </Text>
                  <Text size="sm" c={immunization.manufacturer ? 'inherit' : 'dimmed'}>
                    {immunization.manufacturer || 'Not specified'}
                  </Text>
                </Group>
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={6}>
            <Card withBorder p="md" h="100%">
              <Stack gap="sm">
                <Text fw={600} size="sm" c="dimmed">
                  ADMINISTRATION
                </Text>
                <Divider />
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Date:
                  </Text>
                  <Text size="sm" c={immunization.date_administered ? 'inherit' : 'dimmed'}>
                    {immunization.date_administered
                      ? formatDate(immunization.date_administered)
                      : 'Not specified'}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Site:
                  </Text>
                  <Text size="sm" c={immunization.site ? 'inherit' : 'dimmed'}>
                    {immunization.site || 'Not specified'}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Route:
                  </Text>
                  <Text size="sm" c={immunization.route ? 'inherit' : 'dimmed'}>
                    {immunization.route || 'Not specified'}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Location:
                  </Text>
                  <Text size="sm" c={immunization.location ? 'inherit' : 'dimmed'}>
                    {immunization.location || 'Not specified'}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Practitioner:
                  </Text>
                  {immunization.practitioner_id ? (
                    <Text
                      size="sm"
                      c="blue"
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => navigateToEntity('practitioner', immunization.practitioner_id, navigate)}
                    >
                      {practitioner?.name || `ID: ${immunization.practitioner_id}`}
                    </Text>
                  ) : (
                    <Text size="sm" c="dimmed">Not specified</Text>
                  )}
                </Group>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Expiration date section */}
        {immunization.expiration_date && (
          <Card withBorder p="md">
            <Stack gap="sm">
              <Text fw={600} size="sm" c="dimmed">
                EXPIRATION
              </Text>
              <Divider />
              <Group>
                <Text size="sm" fw={500} w={80}>
                  Expires:
                </Text>
                <Text size="sm" c={immunization.expiration_date ? 'inherit' : 'dimmed'}>
                  {immunization.expiration_date
                    ? formatDate(immunization.expiration_date)
                    : 'Not specified'}
                </Text>
              </Group>
            </Stack>
          </Card>
        )}

        {/* Notes section */}
        {immunization.notes && (
          <>
            <Divider />
            <Stack gap="xs">
              <Text size="sm" fw={500} c="dimmed">Notes</Text>
              <Text size="sm">{immunization.notes}</Text>
            </Stack>
          </>
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

export default ImmunizationViewModal;