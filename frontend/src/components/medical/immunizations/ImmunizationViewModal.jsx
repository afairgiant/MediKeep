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
  Paper,
  Tooltip,
} from '@mantine/core';
import {
  IconInfoCircle,
  IconNeedle,
  IconNotes,
  IconFileText,
  IconEdit,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { useTagColors } from '../../../hooks/useTagColors';
import { navigateToEntity } from '../../../utils/linkNavigation';
import { ClickableTagBadge } from '../../common/ClickableTagBadge';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import logger from '../../../services/logger';

const ImmunizationViewModal = ({
  isOpen,
  onClose,
  immunization,
  onEdit,
  practitioners = [],
  navigate,
  onError,
  disableEdit = false,
  disableEditTooltip,
}) => {
  const { t } = useTranslation(['common', 'shared']);
  const { formatDate } = useDateFormat();
  const { getTagColor } = useTagColors();
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
      title={t('immunizations.viewModal.title', 'Immunization Details')}
      size="xl"
      centered
      zIndex={2000}
    >
      <Stack gap="lg">
        {/* Header Card */}
        <Paper withBorder p="md" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
          <Group justify="space-between" align="center">
            <div>
              <Title order={3} mb="xs">{immunization.vaccine_name}</Title>
              <Group gap="xs">
                {immunization.manufacturer && (
                  <Badge variant="light" color="gray" size="sm">
                    {immunization.manufacturer}
                  </Badge>
                )}
                {immunization.date_administered && (
                  <Badge variant="light" color="blue" size="sm">
                    {formatDate(immunization.date_administered)}
                  </Badge>
                )}
              </Group>
            </div>
            {immunization.dose_number && (
              <Badge
                color={getDoseColor(immunization.dose_number)}
                variant="filled"
                size="lg"
              >
                {t('shared:labels.doseNumber', 'Dose {{number}}', { number: immunization.dose_number })}
              </Badge>
            )}
          </Group>
        </Paper>

        <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconInfoCircle size={16} />}>
            {t('shared:tabs.overview', 'Overview')}
          </Tabs.Tab>
          <Tabs.Tab value="administration" leftSection={<IconNeedle size={16} />}>
            {t('shared:tabs.administration', 'Administration')}
          </Tabs.Tab>
          <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
            {t('shared:tabs.notes', 'Notes')}
          </Tabs.Tab>
          <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
            {t('shared:tabs.documents', 'Documents')}
          </Tabs.Tab>
        </Tabs.List>

        {/* Overview Tab */}
        <Tabs.Panel value="overview">
          <Box mt="md">
            <Stack gap="lg">
              {/* Vaccine Information */}
              <div>
                <Title order={4} mb="sm">{t('immunizations.viewModal.vaccineInfo', 'Vaccine Information')}</Title>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('shared:fields.vaccineName', 'Vaccine Name')}</Text>
                    <Text size="sm">{immunization.vaccine_name}</Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('immunizations.viewModal.tradeName', 'Trade Name')}</Text>
                    <Text size="sm" c={immunization.vaccine_trade_name ? 'inherit' : 'dimmed'}>
                      {immunization.vaccine_trade_name || t('shared:labels.notSpecified', 'Not specified')}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('shared:fields.manufacturer', 'Manufacturer')}</Text>
                    <Text size="sm" c={immunization.manufacturer ? 'inherit' : 'dimmed'}>
                      {immunization.manufacturer || t('shared:labels.notSpecified', 'Not specified')}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('shared:fields.doseNumber', 'Dose Number')}</Text>
                    <Badge
                      color={getDoseColor(immunization.dose_number)}
                      variant="filled"
                      size="sm"
                    >
                      {immunization.dose_number ? t('immunizations.viewModal.doseHash', 'Dose #{{number}}', { number: immunization.dose_number }) : t('shared:labels.notSpecified', 'Not specified')}
                    </Badge>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('shared:fields.lotNumber', 'Lot Number')}</Text>
                    <Text size="sm" c={immunization.lot_number ? 'inherit' : 'dimmed'}>
                      {immunization.lot_number || t('shared:labels.notSpecified', 'Not specified')}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('shared:fields.ndcNumber', 'NDC Number')}</Text>
                    <Text size="sm" c={immunization.ndc_number ? 'inherit' : 'dimmed'}>
                      {immunization.ndc_number || t('shared:labels.notSpecified', 'Not specified')}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('shared:fields.expirationDate', 'Expiration Date')}</Text>
                    <Text size="sm" c={immunization.expiration_date ? 'inherit' : 'dimmed'}>
                      {immunization.expiration_date ? formatDate(immunization.expiration_date) : t('shared:labels.notSpecified', 'Not specified')}
                    </Text>
                  </Stack>
                </SimpleGrid>
              </div>

              {/* Tags Section */}
              {immunization.tags && immunization.tags.length > 0 && (
                <div>
                  <Title order={4} mb="sm">{t('shared:labels.tags', 'Tags')}</Title>
                  <Group gap="xs">
                    {immunization.tags.map((tag, index) => (
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

        {/* Administration Tab */}
        <Tabs.Panel value="administration">
          <Box mt="md">
            <Stack gap="lg">
              <div>
                <Title order={4} mb="sm">{t('immunizations.viewModal.adminDetails', 'Administration Details')}</Title>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('shared:fields.dateAdministered', 'Date Administered')}</Text>
                    <Text size="sm" c={immunization.date_administered ? 'inherit' : 'dimmed'}>
                      {immunization.date_administered ? formatDate(immunization.date_administered) : t('shared:labels.notSpecified', 'Not specified')}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('shared:labels.administrationSite', 'Administration Site')}</Text>
                    <Text size="sm" c={immunization.site ? 'inherit' : 'dimmed'}>
                      {immunization.site || t('shared:labels.notSpecified', 'Not specified')}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('shared:labels.route', 'Route')}</Text>
                    <Text size="sm" c={immunization.route ? 'inherit' : 'dimmed'}>
                      {immunization.route || t('shared:labels.notSpecified', 'Not specified')}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('immunizations.viewModal.locationFacility', 'Location/Facility')}</Text>
                    <Text size="sm" c={immunization.location ? 'inherit' : 'dimmed'}>
                      {immunization.location || t('shared:labels.notSpecified', 'Not specified')}
                    </Text>
                  </Stack>
                  <Stack gap="xs">
                    <Text fw={500} size="sm" c="dimmed">{t('shared:fields.practitioner', 'Practitioner')}</Text>
                    {immunization.practitioner_id ? (
                      <Text
                        size="sm"
                        fw={600}
                        c="blue"
                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => navigateToEntity('practitioner', immunization.practitioner_id, navigate)}
                        title={t('shared:labels.viewPractitionerDetails', 'View practitioner details')}
                      >
                        {practitioner?.name || t('shared:labels.practitionerId', 'Practitioner ID: {{id}}', { id: immunization.practitioner_id })}
                      </Text>
                    ) : (
                      <Text size="sm" c="dimmed">{t('shared:labels.notSpecified', 'Not specified')}</Text>
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
                <Title order={4} mb="sm">{t('shared:labels.clinicalNotes', 'Clinical Notes')}</Title>
                <Text size="sm" c={immunization.notes ? 'inherit' : 'dimmed'}>
                  {immunization.notes || t('shared:labels.noNotesAvailable', 'No notes available')}
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
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            {t('shared:labels.close', 'Close')}
          </Button>
          <Tooltip label={disableEditTooltip} disabled={!disableEdit || !disableEditTooltip}>
            <span>
              <Button variant="filled" onClick={handleEdit} leftSection={<IconEdit size={16} />} disabled={disableEdit}>
                {t('shared:labels.edit', 'Edit')}
              </Button>
            </span>
          </Tooltip>
        </Group>
      </Stack>
    </Modal>
  );
};

export default ImmunizationViewModal;
