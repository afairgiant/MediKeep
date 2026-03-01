import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  Paper,
} from '@mantine/core';
import {
  IconInfoCircle,
  IconAlertTriangle,
  IconNotes,
  IconFileText,
  IconEdit,
  IconExclamationCircle,
  IconAlertCircle,
  IconShield,
  IconShieldCheck,
} from '@tabler/icons-react';
import { navigateToEntity } from '../../../utils/linkNavigation';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { useTagColors } from '../../../hooks/useTagColors';
import { ClickableTagBadge } from '../../common/ClickableTagBadge';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
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
  const { t } = useTranslation(['medical', 'common']);
  const { formatDate } = useDateFormat();
  const { getTagColor } = useTagColors();
  const [activeTab, setActiveTab] = useState('overview');

  // Reset tab when modal opens or allergy changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
    }
  }, [isOpen, allergy?.id]);

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
        title={t('allergies.modal.title', 'Allergy Details')}
        size="xl"
        centered
        zIndex={2000}
      >
        <Stack gap="lg">
          {/* Header Card */}
          <Paper withBorder p="md" style={{ backgroundColor: '#f8f9fa' }}>
            <Group justify="space-between" align="center">
              <div>
                <Title order={3} mb="xs">{allergy.allergen}</Title>
                <Group gap="xs">
                  {allergy.allergy_type && (
                    <Badge variant="light" color="blue" size="sm">
                      {allergy.allergy_type}
                    </Badge>
                  )}
                  <Badge
                    color={getStatusColor(allergy.status)}
                    variant="light"
                    size="sm"
                  >
                    {allergy.status}
                  </Badge>
                </Group>
              </div>
              {allergy.severity && (
                <Badge
                  color={getSeverityColor(allergy.severity)}
                  variant="filled"
                  size="lg"
                  leftSection={React.createElement(SeverityIcon, { size: 16 })}
                >
                  {allergy.severity}
                </Badge>
              )}
            </Group>
          </Paper>

          <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconInfoCircle size={16} />}>
              {t('allergies.tabs.overview', 'Overview')}
            </Tabs.Tab>
            <Tabs.Tab value="reaction" leftSection={<IconAlertTriangle size={16} />}>
              {t('allergies.tabs.reactionDetails')}
            </Tabs.Tab>
            <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
              {t('allergies.tabs.notes')}
            </Tabs.Tab>
            <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
              {t('allergies.tabs.documents')}
            </Tabs.Tab>
          </Tabs.List>

          {/* Overview Tab */}
          <Tabs.Panel value="overview">
            <Box mt="md">
              <Stack gap="lg">
                {/* Basic Information */}
                <div>
                  <Title order={4} mb="sm">{t('allergies.tabs.basicInfo')}</Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('allergies.allergen.label')}</Text>
                      <Text size="sm">{allergy.allergen}</Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('allergies.allergyType.label')}</Text>
                      <Text size="sm" c={allergy.allergy_type ? 'inherit' : 'dimmed'}>
                        {allergy.allergy_type || t('common:labels.unknown', 'Not specified')}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('common:fields.severity.label')}</Text>
                      <Badge
                        color={getSeverityColor(allergy.severity)}
                        variant="filled"
                        leftSection={React.createElement(SeverityIcon, { size: 16 })}
                        size="sm"
                      >
                        {allergy.severity || t('common:labels.unknown', 'Not specified')}
                      </Badge>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('common:fields.status.label')}</Text>
                      <Badge color={getStatusColor(allergy.status)} variant="light" size="sm">
                        {allergy.status}
                      </Badge>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('allergies.onsetDate.label')}</Text>
                      <Text size="sm" c={allergy.onset_date ? 'inherit' : 'dimmed'}>
                        {allergy.onset_date ? formatDate(allergy.onset_date) : t('common:labels.unknown', 'Not specified')}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('allergies.relatedMedication.label')}</Text>
                      {medication ? (
                        <Text
                          size="sm"
                          fw={600}
                          c="blue"
                          style={{ cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => navigateToEntity('medication', medication.id, navigate)}
                          title={t('allergies.viewMedication', 'View medication details')}
                        >
                          {medication.medication_name}
                        </Text>
                      ) : (
                        <Text size="sm" c="dimmed">{t('allergies.noMedicationLinked', 'No medication linked')}</Text>
                      )}
                    </Stack>
                  </SimpleGrid>
                </div>

                {/* Tags Section */}
                {allergy.tags && allergy.tags.length > 0 && (
                  <div>
                    <Title order={4} mb="sm">{t('common:fields.tags.label')}</Title>
                    <Group gap="xs">
                      {allergy.tags.map((tag, index) => (
                        <ClickableTagBadge
                          key={index}
                          tag={tag}
                          color={getTagColor(tag)}
                        />
                      ))}
                    </Group>
                  </div>
                )}
              </Stack>
            </Box>
          </Tabs.Panel>

          {/* Reaction Details Tab */}
          <Tabs.Panel value="reaction">
            <Box mt="md">
              <Stack gap="lg">
                <div>
                  <Title order={4} mb="sm">{t('allergies.reactionInformation', 'Reaction Information')}</Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('allergies.reactionType.label')}</Text>
                      <Text size="sm" c={allergy.reaction_type ? 'inherit' : 'dimmed'}>
                        {allergy.reaction_type || t('common:labels.unknown', 'Not specified')}
                      </Text>
                    </Stack>
                    <Stack gap="xs" style={{ gridColumn: '1 / -1' }}>
                      <Text fw={500} size="sm" c="dimmed">{t('allergies.reaction.label')}</Text>
                      <Text size="sm" c={allergy.reaction ? 'inherit' : 'dimmed'}>
                        {allergy.reaction || t('common:labels.unknown', 'Not specified')}
                      </Text>
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
                  <Title order={4} mb="sm">{t('allergies.clinicalNotes', 'Clinical Notes')}</Title>
                  <Text size="sm" c={allergy.notes ? 'inherit' : 'dimmed'}>
                    {allergy.notes || t('allergies.noNotes', 'No notes available')}
                  </Text>
                </div>
              </Stack>
            </Box>
          </Tabs.Panel>

          {/* Documents Tab */}
          <Tabs.Panel value="documents">
            <Box mt="md">
              <DocumentManagerWithProgress
                entityType="allergy"
                entityId={allergy.id}
                onError={onError}
              />
            </Box>
          </Tabs.Panel>
          </Tabs>

          {/* Action Buttons */}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={onClose}>
              {t('common:buttons.close')}
            </Button>
            <Button variant="filled" onClick={handleEdit} leftSection={<IconEdit size={16} />}>
              {t('common:buttons.edit')}
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
