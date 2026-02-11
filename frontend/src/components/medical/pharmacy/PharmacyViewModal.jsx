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
  Paper,
} from '@mantine/core';
import { IconEdit } from '@tabler/icons-react';
import logger from '../../../services/logger';
import { useTranslation } from 'react-i18next';

const PharmacyViewModal = ({
  isOpen,
  onClose,
  pharmacy,
  onEdit,
  navigate,
}) => {
  const { t } = useTranslation('common');

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
      title={t('pharmacies.viewModal.title', 'Pharmacy Details')}
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
        {/* Header Card */}
        <Paper withBorder p="md" style={{ backgroundColor: '#f8f9fa' }}>
          <Group justify="space-between" align="center">
            <div>
              <Title order={3} mb="xs">{pharmacy.name}</Title>
              <Group gap="xs">
                {pharmacy.brand && (
                  <Badge color="blue" variant="light" size="sm">
                    {pharmacy.brand}
                  </Badge>
                )}
                {pharmacy.city && (
                  <Badge variant="light" color="gray" size="sm">
                    {pharmacy.city}
                  </Badge>
                )}
              </Group>
            </div>
            {pharmacy.store_number && (
              <Badge variant="filled" color="gray" size="lg">
                #{pharmacy.store_number}
              </Badge>
            )}
          </Group>
        </Paper>

        <Grid>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Card withBorder p="md" h="100%">
              <Stack gap="sm">
                <Text fw={600} size="sm" c="dimmed">
                  {t('pharmacies.viewModal.location', 'LOCATION')}
                </Text>
                <Divider />
                <Group>
                  <Text size="sm" fw={500} w={120}>
                    {t('pharmacies.viewModal.address', 'Address')}:
                  </Text>
                  <Text
                    size="sm"
                    c={pharmacy.street_address ? 'inherit' : 'dimmed'}
                  >
                    {pharmacy.street_address || t('common.labels.notSpecified', 'Not specified')}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={120}>
                    {t('pharmacies.viewModal.city', 'City')}:
                  </Text>
                  <Text size="sm" c={pharmacy.city ? 'inherit' : 'dimmed'}>
                    {pharmacy.city || t('common.labels.notSpecified', 'Not specified')}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={120}>
                    {t('pharmacies.viewModal.stateProvince', 'State / Province')}:
                  </Text>
                  <Text size="sm" c={pharmacy.state ? 'inherit' : 'dimmed'}>
                    {pharmacy.state || t('common.labels.notSpecified', 'Not specified')}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={120}>
                    {t('pharmacies.viewModal.postalCode', 'Postal Code')}:
                  </Text>
                  <Text size="sm" c={pharmacy.zip_code ? 'inherit' : 'dimmed'}>
                    {pharmacy.zip_code || t('common.labels.notSpecified', 'Not specified')}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={120}>
                    {t('pharmacies.viewModal.country', 'Country')}:
                  </Text>
                  <Text size="sm" c={pharmacy.country ? 'inherit' : 'dimmed'}>
                    {pharmacy.country || t('common.labels.notSpecified', 'Not specified')}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={120}>
                    {t('pharmacies.viewModal.storeNumber', 'Store #')}:
                  </Text>
                  <Text
                    size="sm"
                    c={pharmacy.store_number ? 'inherit' : 'dimmed'}
                  >
                    {pharmacy.store_number || t('common.labels.notSpecified', 'Not specified')}
                  </Text>
                </Group>
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Card withBorder p="md" h="100%">
              <Stack gap="sm">
                <Text fw={600} size="sm" c="dimmed">
                  {t('pharmacies.viewModal.contact', 'CONTACT INFORMATION')}
                </Text>
                <Divider />
                <Group>
                  <Text size="sm" fw={500} w={120}>
                    {t('pharmacies.viewModal.phone', 'Phone')}:
                  </Text>
                  <Text
                    size="sm"
                    c={pharmacy.phone_number ? 'inherit' : 'dimmed'}
                  >
                    {pharmacy.phone_number || t('common.labels.notSpecified', 'Not specified')}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={120}>
                    {t('pharmacies.viewModal.website', 'Website')}:
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
                        {pharmacy.website}
                      </Anchor>
                    ) : (
                      t('common.labels.notSpecified', 'Not specified')
                    )}
                  </Text>
                </Group>
                <Group wrap="nowrap" align="flex-start">
                  <Text size="sm" fw={500} w={120} style={{ flexShrink: 0 }}>
                    {t('pharmacies.viewModal.specialtyServices', 'Specialties')}:
                  </Text>
                  <Text size="sm" c={pharmacy.specialty_services ? 'inherit' : 'dimmed'}>
                    {pharmacy.specialty_services || t('common.labels.notSpecified', 'Not specified')}
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
            {t('pharmacies.viewModal.editButton', 'Edit Pharmacy')}
          </Button>
          <Button variant="filled" size="xs" onClick={handleClose}>
            {t('common.buttons.close', 'Close')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default PharmacyViewModal;