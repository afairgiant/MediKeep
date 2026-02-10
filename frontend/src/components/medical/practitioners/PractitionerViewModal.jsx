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
  Paper,
} from '@mantine/core';
import { IconEdit, IconStar } from '@tabler/icons-react';
import logger from '../../../services/logger';
import { useTranslation } from 'react-i18next';

const PractitionerViewModal = ({
  isOpen,
  onClose,
  practitioner,
  onEdit,
  navigate
}) => {
  const { t } = useTranslation('common');

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
      title={t('practitioners.viewModal.title', 'Practitioner Details')}
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
              <Title order={3} mb="xs">{practitioner.name}</Title>
              <Group gap="xs">
                {practitioner.specialty && (
                  <Badge
                    color={getSpecialtyColor(practitioner.specialty)}
                    variant="light"
                    size="sm"
                  >
                    {practitioner.specialty}
                  </Badge>
                )}
                {practitioner.practice && (
                  <Badge variant="light" color="gray" size="sm">
                    {practitioner.practice}
                  </Badge>
                )}
              </Group>
            </div>
            {practitioner.rating !== null && practitioner.rating !== undefined && (
              <Badge variant="filled" color="yellow" size="lg" leftSection={<IconStar size={14} />}>
                {practitioner.rating}/5
              </Badge>
            )}
          </Group>
        </Paper>

        <Grid>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Card withBorder p="md" h="100%">
              <Stack gap="sm">
                <Text fw={600} size="sm" c="dimmed">
                  {t('practitioners.viewModal.practiceInfo', 'PRACTICE INFORMATION')}
                </Text>
                <Divider />
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    {t('practitioners.viewModal.practice', 'Practice')}:
                  </Text>
                  <Text
                    size="sm"
                    c={practitioner.practice ? 'inherit' : 'dimmed'}
                  >
                    {practitioner.practice || t('common.labels.notSpecified', 'Not specified')}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    {t('practitioners.viewModal.specialty', 'Specialty')}:
                  </Text>
                  <Text
                    size="sm"
                    c={practitioner.specialty ? 'inherit' : 'dimmed'}
                  >
                    {practitioner.specialty || t('common.labels.notSpecified', 'Not specified')}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    {t('practitioners.viewModal.phone', 'Phone')}:
                  </Text>
                  <Text
                    size="sm"
                    c={practitioner.phone_number ? 'inherit' : 'dimmed'}
                  >
                    {practitioner.phone_number || t('common.labels.notSpecified', 'Not specified')}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    {t('practitioners.viewModal.email', 'Email')}:
                  </Text>
                  <Text
                    size="sm"
                    c={practitioner.email ? 'inherit' : 'dimmed'}
                  >
                    {practitioner.email ? (
                      <Anchor
                        href={`mailto:${practitioner.email}`}
                        size="sm"
                        c="blue"
                      >
                        {practitioner.email}
                      </Anchor>
                    ) : (
                      t('common.labels.notSpecified', 'Not specified')
                    )}
                  </Text>
                </Group>
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Card withBorder p="md" h="100%">
              <Stack gap="sm">
                <Text fw={600} size="sm" c="dimmed">
                  {t('practitioners.viewModal.contactRating', 'CONTACT & RATING')}
                </Text>
                <Divider />
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    {t('practitioners.viewModal.website', 'Website')}:
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
                        {t('practitioners.viewModal.visitWebsite', 'Visit Website')}
                      </Anchor>
                    ) : (
                      t('common.labels.notSpecified', 'Not specified')
                    )}
                  </Text>
                </Group>
                <Group>
                  <Text size="sm" fw={500} w={80}>
                    {t('practitioners.viewModal.rating', 'Rating')}:
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
                      t('common.labels.notSpecified', 'Not specified')
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
            {t('common.buttons.close', 'Close')}
          </Button>
          <Button variant="filled" onClick={handleEdit} leftSection={<IconEdit size={16} />}>
            {t('practitioners.viewModal.editButton', 'Edit Practitioner')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default PractitionerViewModal;