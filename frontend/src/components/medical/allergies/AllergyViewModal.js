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
import {
  IconAlertTriangle,
  IconExclamationCircle,
  IconAlertCircle,
  IconShield,
  IconShieldCheck,
  IconEdit,
} from '@tabler/icons-react';
import { formatDate } from '../../../utils/helpers';
import { navigateToEntity } from '../../../utils/linkNavigation';
import logger from '../../../services/logger';

const AllergyViewModal = ({
  isOpen,
  onClose,
  allergy,
  onEdit,
  medications = [],
  navigate,
  onError
}) => {
  const handleError = (error) => {
    logger.error('allergy_view_modal_error', {
      message: 'Error in AllergyViewModal',
      allergyId: allergy?.id,
      error: error.message,
      component: 'AllergyViewModal',
    });

    if (onError) {
      onError(error);
    }
  };

  if (!isOpen || !allergy) return null;

  // Helper function to get severity icon
  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'life-threatening':
        return IconExclamationCircle;
      case 'severe':
        return IconAlertTriangle;
      case 'moderate':
        return IconAlertCircle;
      case 'mild':
        return IconShield;
      default:
        return IconShieldCheck;
    }
  };

  // Helper function to get severity color
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'life-threatening':
        return 'red';
      case 'severe':
        return 'orange';
      case 'moderate':
        return 'yellow';
      case 'mild':
        return 'blue';
      default:
        return 'gray';
    }
  };

  // Helper function to get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'green';
      case 'inactive':
        return 'gray';
      case 'resolved':
        return 'blue';
      default:
        return 'gray';
    }
  };

  // Helper function to get medication details
  const getMedicationDetails = (medicationId) => {
    if (!medicationId || medications.length === 0) return null;
    return medications.find(med => med.id === medicationId);
  };

  const handleEdit = () => {
    try {
      onEdit(allergy);
      onClose();
    } catch (error) {
      handleError(error);
    }
  };

  try {
    const SeverityIcon = getSeverityIcon(allergy.severity);
    const medication = getMedicationDetails(allergy.medication_id);

    return (
      <Modal
        opened={isOpen}
        onClose={onClose}
        title={
          <Group>
            <Text size="lg" fw={600}>
              Allergy Details
            </Text>
            {allergy && (
              <Badge
                color={getStatusColor(allergy.status)}
                variant="light"
              >
                {allergy.status}
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
                  <Title order={3}>{allergy.allergen}</Title>
                  {allergy.severity && (
                    <Badge
                      color={getSeverityColor(allergy.severity)}
                      variant="filled"
                      leftSection={React.createElement(SeverityIcon, { size: 16 })}
                    >
                      {allergy.severity}
                    </Badge>
                  )}
                </Stack>
              </Group>
            </Stack>
          </Card>

          <Grid>
            <Grid.Col span={6}>
              <Card withBorder p="md" h="100%">
                <Stack gap="sm">
                  <Text fw={600} size="sm" c="dimmed">
                    ALLERGY INFORMATION
                  </Text>
                  <Divider />
                  <Group>
                    <Text size="sm" fw={500} w={80}>
                      Allergen:
                    </Text>
                    <Text
                      size="sm"
                      c={allergy.allergen ? 'inherit' : 'dimmed'}
                    >
                      {allergy.allergen || 'Not specified'}
                    </Text>
                  </Group>
                  <Group>
                    <Text size="sm" fw={500} w={80}>
                      Severity:
                    </Text>
                    <Text
                      size="sm"
                      c={allergy.severity ? 'inherit' : 'dimmed'}
                    >
                      {allergy.severity || 'Not specified'}
                    </Text>
                  </Group>
                  <Group>
                    <Text size="sm" fw={500} w={80}>
                      Reaction:
                    </Text>
                    <Text
                      size="sm"
                      c={allergy.reaction ? 'inherit' : 'dimmed'}
                    >
                      {allergy.reaction || 'Not specified'}
                    </Text>
                  </Group>
                  {medication && (
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Medication:
                      </Text>
                      <Text
                        size="sm"
                        c="blue"
                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => navigateToEntity('medication', medication.id, navigate)}
                        title="View medication details"
                      >
                        {medication.medication_name}
                      </Text>
                    </Group>
                  )}
                </Stack>
              </Card>
            </Grid.Col>

            <Grid.Col span={6}>
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
                    <Text
                      size="sm"
                      c={allergy.onset_date ? 'inherit' : 'dimmed'}
                    >
                      {allergy.onset_date
                        ? formatDate(allergy.onset_date)
                        : 'Not specified'}
                    </Text>
                  </Group>
                  <Group>
                    <Text size="sm" fw={500} w={80}>
                      Status:
                    </Text>
                    <Text
                      size="sm"
                      c={allergy.status ? 'inherit' : 'dimmed'}
                    >
                      {allergy.status || 'Not specified'}
                    </Text>
                  </Group>
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
                c={allergy.notes ? 'inherit' : 'dimmed'}
              >
                {allergy.notes || 'No notes available'}
              </Text>
            </Stack>
          </Card>

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
              Edit Allergy
            </Button>
          </Group>
        </Stack>
      </Modal>
    );
  } catch (error) {
    handleError(error);
    return null;
  }
};

export default AllergyViewModal;