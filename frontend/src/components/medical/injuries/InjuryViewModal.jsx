import React, { useState } from 'react';
import {
  Modal,
  Tabs,
  Box,
  Stack,
  Group,
  Button,
  Text,
  Badge,
  Grid,
  Paper,
  Divider,
} from '@mantine/core';
import {
  IconInfoCircle,
  IconBandage,
  IconFileText,
  IconNotes,
  IconEdit,
  IconCalendar,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { navigateToEntity } from '../../../utils/linkNavigation';

const InjuryViewModal = ({
  isOpen,
  onClose,
  injury,
  onEdit,
  practitioners = [],
  injuryTypes = [],
  navigate,
}) => {
  const { t } = useTranslation('medical');
  const { t: tCommon } = useTranslation('common');
  const { formatLongDate } = useDateFormat();

  const [activeTab, setActiveTab] = useState('overview');

  if (!isOpen || !injury) return null;

  // Get practitioner details
  const practitioner = injury.practitioner_id
    ? practitioners.find((p) => p.id === injury.practitioner_id)
    : null;

  // Get injury type details
  const injuryType = injury.injury_type_id
    ? injuryTypes.find((t) => t.id === injury.injury_type_id)
    : null;

  // Format laterality display
  const formatLaterality = (laterality) => {
    if (!laterality) return null;
    const map = {
      left: t('injuries.laterality.options.left', 'Left'),
      right: t('injuries.laterality.options.right', 'Right'),
      bilateral: t('injuries.laterality.options.bilateral', 'Both Sides'),
      not_applicable: t('injuries.laterality.options.notApplicable', 'Not Applicable'),
    };
    return map[laterality] || laterality;
  };

  // Format status display
  const formatStatus = (status) => {
    const map = {
      active: t('injuries.status.options.active', 'Active'),
      healing: t('injuries.status.options.healing', 'Healing'),
      resolved: t('injuries.status.options.resolved', 'Resolved'),
      chronic: t('injuries.status.options.chronic', 'Chronic'),
    };
    return map[status] || status;
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      active: 'red',
      healing: 'yellow',
      resolved: 'green',
      chronic: 'orange',
    };
    return colors[status] || 'gray';
  };

  // Format severity display
  const formatSeverity = (severity) => {
    const map = {
      mild: t('common.severity.mild', 'Mild'),
      moderate: t('common.severity.moderate', 'Moderate'),
      severe: t('common.severity.severe', 'Severe'),
      'life-threatening': t('common.severity.lifeThreatening', 'Life-threatening'),
    };
    return map[severity] || severity;
  };

  // Get severity color
  const getSeverityColor = (severity) => {
    const colors = {
      mild: 'blue',
      moderate: 'yellow',
      severe: 'orange',
      'life-threatening': 'red',
    };
    return colors[severity] || 'gray';
  };

  // Field display component
  const FieldDisplay = ({ label, value, children }) => (
    <Box mb="sm">
      <Text size="xs" c="dimmed" mb={2}>
        {label}
      </Text>
      {children || (
        <Text size="sm" fw={500}>
          {value || tCommon('labels.notSpecified', 'Not specified')}
        </Text>
      )}
    </Box>
  );

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconBandage size={24} />
          <Text fw={600} size="lg">
            {injury.injury_name}
          </Text>
        </Group>
      }
      size="xl"
      centered
      zIndex={2000}
    >
      <Stack gap="md">
        {/* Header with status and severity badges */}
        <Group gap="xs">
          <Badge color={getStatusColor(injury.status)} variant="filled">
            {formatStatus(injury.status)}
          </Badge>
          {injury.severity && (
            <Badge color={getSeverityColor(injury.severity)} variant="light">
              {formatSeverity(injury.severity)}
            </Badge>
          )}
          {injuryType && (
            <Badge color="gray" variant="outline">
              {injuryType.name}
            </Badge>
          )}
        </Group>

        {/* Tabbed Content */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconInfoCircle size={16} />}>
              {t('injuries.tabs.overview', 'Overview')}
            </Tabs.Tab>
            <Tabs.Tab value="treatment" leftSection={<IconBandage size={16} />}>
              {t('injuries.tabs.treatment', 'Treatment')}
            </Tabs.Tab>
            <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
              {t('injuries.tabs.documents', 'Documents')}
            </Tabs.Tab>
            <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
              {t('injuries.tabs.notes', 'Notes')}
            </Tabs.Tab>
          </Tabs.List>

          {/* Overview Tab */}
          <Tabs.Panel value="overview">
            <Box mt="md">
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Paper p="md" withBorder>
                    <Text fw={600} mb="md">
                      {t('injuries.viewModal.injuryDetails', 'Injury Details')}
                    </Text>
                    <FieldDisplay
                      label={t('injuries.bodyPart.label', 'Body Part')}
                      value={injury.body_part}
                    />
                    <FieldDisplay
                      label={t('injuries.laterality.label', 'Side')}
                      value={formatLaterality(injury.laterality)}
                    />
                    <FieldDisplay label={t('injuries.dateOfInjury.label', 'Date of Injury')}>
                      <Group gap="xs">
                        <IconCalendar size={14} />
                        <Text size="sm" fw={500}>
                          {injury.date_of_injury
                            ? formatLongDate(injury.date_of_injury)
                            : tCommon('labels.notSpecified', 'Not specified')}
                        </Text>
                      </Group>
                    </FieldDisplay>
                  </Paper>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Paper p="md" withBorder>
                    <Text fw={600} mb="md">
                      {t('injuries.viewModal.additionalInfo', 'Additional Info')}
                    </Text>
                    <FieldDisplay
                      label={t('injuries.injuryType.label', 'Type')}
                      value={injuryType?.name}
                    />
                    <FieldDisplay label={t('injuries.practitioner.label', 'Treating Practitioner')}>
                      {practitioner ? (
                        <Text
                          size="sm"
                          fw={500}
                          c="blue"
                          style={{ cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() =>
                            navigateToEntity('practitioner', practitioner.id, navigate)
                          }
                        >
                          {practitioner.name}
                        </Text>
                      ) : (
                        <Text size="sm" fw={500}>
                          {tCommon('labels.notSpecified', 'Not specified')}
                        </Text>
                      )}
                    </FieldDisplay>
                    {/* Tags */}
                    {injury.tags && injury.tags.length > 0 && (
                      <Box mt="sm">
                        <Text size="xs" c="dimmed" mb={4}>
                          {tCommon('fields.tags.label', 'Tags')}
                        </Text>
                        <Group gap="xs">
                          {injury.tags.map((tag, index) => (
                            <Badge key={index} variant="outline" size="sm">
                              {tag}
                            </Badge>
                          ))}
                        </Group>
                      </Box>
                    )}
                  </Paper>
                </Grid.Col>
              </Grid>
            </Box>
          </Tabs.Panel>

          {/* Treatment Tab */}
          <Tabs.Panel value="treatment">
            <Box mt="md">
              <Paper p="md" withBorder>
                <FieldDisplay
                  label={t('injuries.mechanism.label', 'How It Happened')}
                  value={injury.mechanism}
                />
                <Divider my="md" />
                <FieldDisplay
                  label={t('injuries.treatmentReceived.label', 'Treatment Received')}
                  value={injury.treatment_received}
                />
                <Divider my="md" />
                <FieldDisplay
                  label={t('injuries.recoveryNotes.label', 'Recovery Notes')}
                  value={injury.recovery_notes}
                />
              </Paper>
            </Box>
          </Tabs.Panel>

          {/* Documents Tab */}
          <Tabs.Panel value="documents">
            <Box mt="md">
              <DocumentManagerWithProgress
                entityType="injury"
                entityId={injury.id}
                readOnly={true}
              />
            </Box>
          </Tabs.Panel>

          {/* Notes Tab */}
          <Tabs.Panel value="notes">
            <Box mt="md">
              <Paper p="md" withBorder>
                <FieldDisplay
                  label={t('injuries.notes.label', 'Additional Notes')}
                  value={injury.notes}
                />
              </Paper>
            </Box>
          </Tabs.Panel>
        </Tabs>

        {/* Actions */}
        <Divider />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            {tCommon('buttons.close', 'Close')}
          </Button>
          <Button leftSection={<IconEdit size={16} />} onClick={() => onEdit(injury)}>
            {tCommon('buttons.edit', 'Edit')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default InjuryViewModal;
