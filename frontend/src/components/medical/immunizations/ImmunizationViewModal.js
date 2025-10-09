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
  IconNeedle,
  IconNotes,
  IconFileText,
  IconEdit,
} from '@tabler/icons-react';
import { formatDate } from '../../../utils/helpers';
import { navigateToEntity } from '../../../utils/linkNavigation';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
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
  const [activeTab, setActiveTab] = useState('overview');

  // Reset tab when modal opens or immunization changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
    }
  }, [isOpen, immunization?.id]);

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
            {immunization.vaccine_name || 'Immunization Details'}
          </Text>
          {immunization.dose_number && (
            <Badge
              color={getDoseColor(immunization.dose_number)}
              variant="filled"
              size="sm"
            >
              Dose {immunization.dose_number}
            </Badge>
          )}
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
          <Tabs.Tab value="administration" leftSection={<IconNeedle size={16} />}>
            Administration
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
              {/* Vaccine Information */}
              <div>
                <Title order={4} mb="sm">Vaccine Information</Title>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">Vaccine Name</Text>
                    <Text size="sm">{immunization.vaccine_name}</Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">Trade Name</Text>
                    <Text size="sm" c={immunization.vaccine_trade_name ? 'inherit' : 'dimmed'}>
                      {immunization.vaccine_trade_name || 'Not specified'}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">Manufacturer</Text>
                    <Text size="sm" c={immunization.manufacturer ? 'inherit' : 'dimmed'}>
                      {immunization.manufacturer || 'Not specified'}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">Dose Number</Text>
                    <Badge
                      color={getDoseColor(immunization.dose_number)}
                      variant="filled"
                      size="sm"
                    >
                      {immunization.dose_number ? `Dose #${immunization.dose_number}` : 'Not specified'}
                    </Badge>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">Lot Number</Text>
                    <Text size="sm" c={immunization.lot_number ? 'inherit' : 'dimmed'}>
                      {immunization.lot_number || 'Not specified'}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">NDC Number</Text>
                    <Text size="sm" c={immunization.ndc_number ? 'inherit' : 'dimmed'}>
                      {immunization.ndc_number || 'Not specified'}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">Expiration Date</Text>
                    <Text size="sm" c={immunization.expiration_date ? 'inherit' : 'dimmed'}>
                      {immunization.expiration_date ? formatDate(immunization.expiration_date) : 'Not specified'}
                    </Text>
                  </Stack>
                </SimpleGrid>
              </div>

              {/* Tags Section */}
              {immunization.tags && immunization.tags.length > 0 && (
                <div>
                  <Title order={4} mb="sm">Tags</Title>
                  <Group gap="xs">
                    {immunization.tags.map((tag, index) => (
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

        {/* Administration Tab */}
        <Tabs.Panel value="administration">
          <Box mt="md">
            <Stack gap="lg">
              <div>
                <Title order={4} mb="sm">Administration Details</Title>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">Date Administered</Text>
                    <Text size="sm" c={immunization.date_administered ? 'inherit' : 'dimmed'}>
                      {immunization.date_administered ? formatDate(immunization.date_administered) : 'Not specified'}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">Administration Site</Text>
                    <Text size="sm" c={immunization.site ? 'inherit' : 'dimmed'}>
                      {immunization.site || 'Not specified'}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">Route</Text>
                    <Text size="sm" c={immunization.route ? 'inherit' : 'dimmed'}>
                      {immunization.route || 'Not specified'}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">Location/Facility</Text>
                    <Text size="sm" c={immunization.location ? 'inherit' : 'dimmed'}>
                      {immunization.location || 'Not specified'}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">Practitioner</Text>
                    {immunization.practitioner_id ? (
                      <Text
                        size="sm"
                        fw={600}
                        c="blue"
                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => navigateToEntity('practitioner', immunization.practitioner_id, navigate)}
                        title="View practitioner details"
                      >
                        {practitioner?.name || `Practitioner ID: ${immunization.practitioner_id}`}
                      </Text>
                    ) : (
                      <Text size="sm" c="dimmed">Not specified</Text>
                    )}
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
              <div>
                <Title order={4} mb="sm">Clinical Notes</Title>
                <Text size="sm" c={immunization.notes ? 'inherit' : 'dimmed'}>
                  {immunization.notes || 'No notes available'}
                </Text>
              </div>
            </Stack>
          </Box>
        </Tabs.Panel>

        {/* Documents Tab */}
        <Tabs.Panel value="documents">
          <Box mt="md">
            <DocumentManagerWithProgress
              entityType="immunization"
              entityId={immunization.id}
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

export default ImmunizationViewModal;
