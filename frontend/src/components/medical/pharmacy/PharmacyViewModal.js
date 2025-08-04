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
  Anchor,
  Title,
} from '@mantine/core';
import { IconEdit } from '@tabler/icons-react';
import { formatPhoneNumber } from '../../../utils/phoneUtils';
import logger from '../../../services/logger';

const PharmacyViewModal = ({
  isOpen,
  onClose,
  pharmacy,
  onEdit,
  navigate,
}) => {
  const handleError = (error) => {
    logger.error('pharmacy_view_modal_error', {
      message: 'Error in PharmacyViewModal',
      pharmacyId: pharmacy?.id,
      error: error.message,
      component: 'PharmacyViewModal',
    });
  };

  if (!isOpen || !pharmacy) return null;

  const handleEdit = () => {
    try {
      onEdit(pharmacy);
      onClose();
    } catch (error) {
      handleError(error);
    }
  };

  const handleClose = () => {
    try {
      onClose();
    } catch (error) {
      handleError(error);
    }
  };

  return (
    <Modal
      opened={isOpen}
      onClose={handleClose}
      title={
        <Group>
          <Text size="lg" fw={600}>
            Pharmacy Details
          </Text>
          {pharmacy.brand && (
            <Badge color="blue" variant="light" size="lg">
              {pharmacy.brand}
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
                <Title order={3}>{pharmacy.name}</Title>
                <Text size="sm" c="dimmed">
                  Pharmacy
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
                  LOCATION
                </Text>
                <Divider />
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Address:
                  </Text>
                  <Text
                    size="sm"
                    c={pharmacy.street_address ? 'inherit' : 'dimmed'}
                  >
                    {pharmacy.street_address || 'Not specified'}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    City:
                  </Text>
                  <Text size="sm" c={pharmacy.city ? 'inherit' : 'dimmed'}>
                    {pharmacy.city || 'Not specified'}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Store #:
                  </Text>
                  <Text
                    size="sm"
                    c={pharmacy.store_number ? 'inherit' : 'dimmed'}
                  >
                    {pharmacy.store_number || 'Not specified'}
                  </Text>
                </Group>
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={6}>
            <Card withBorder p="md" h="100%">
              <Stack gap="sm">
                <Text fw={600} size="sm" c="dimmed">
                  CONTACT INFORMATION
                </Text>
                <Divider />
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Phone:
                  </Text>
                  <Text
                    size="sm"
                    c={pharmacy.phone_number ? 'inherit' : 'dimmed'}
                  >
                    {pharmacy.phone_number
                      ? formatPhoneNumber(pharmacy.phone_number)
                      : 'Not specified'}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    Website:
                  </Text>
                  <Text size="sm" c={pharmacy.website ? 'inherit' : 'dimmed'}>
                    {pharmacy.website ? (
                      <Anchor
                        href={
                          pharmacy.website.startsWith('http')
                            ? pharmacy.website
                            : `https://${pharmacy.website}`
                        }
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
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>

        <Group justify="flex-end" mt="md">
          <Button
            variant="filled"
            size="xs"
            onClick={handleEdit}
            leftSection={<IconEdit size={16} />}
          >
            Edit Pharmacy
          </Button>
          <Button variant="filled" size="xs" onClick={handleClose}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default PharmacyViewModal;