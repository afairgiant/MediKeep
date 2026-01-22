import React, { useState, useEffect } from 'react';
import {
  Modal,
  Tabs,
  Stack,
  Group,
  Text,
  Title,
  Badge,
  Button,
  Box,
  SimpleGrid,
  Paper,
} from '@mantine/core';
import {
  IconInfoCircle,
  IconStethoscope,
  IconNotes,
  IconFileText,
  IconEdit,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import StatusBadge from '../StatusBadge';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import { formatDate } from '../../../utils/helpers';
import { navigateToEntity } from '../../../utils/linkNavigation';
import logger from '../../../services/logger';

const ProcedureViewModal = ({
  isOpen,
  onClose,
  procedure,
  onEdit,
  practitioners = [],
  navigate,
  onFileUploadComplete,
  onError
}) => {
  const { t } = useTranslation('common');
  const [activeTab, setActiveTab] = useState('overview');

  // Reset tab when modal opens or procedure changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
    }
  }, [isOpen, procedure?.id]);

  const handleError = (error, context) => {
    logger.error('procedure_view_modal_error', {
      message: `Error in ProcedureViewModal during ${context}`,
      procedureId: procedure?.id,
      error: error.message,
      component: 'ProcedureViewModal',
    });

    if (onError) {
      onError(error);
    }
  };

  const handleDocumentError = (error) => {
    handleError(error, 'document_management');
  };

  const handleDocumentUploadComplete = (success, completedCount, failedCount) => {
    logger.info('procedures_view_upload_completed', {
      message: 'File upload completed in procedures view',
      procedureId: procedure?.id,
      success,
      completedCount,
      failedCount,
      component: 'ProcedureViewModal',
    });

    if (onFileUploadComplete) {
      onFileUploadComplete(success, completedCount, failedCount);
    }
  };

  const handleEditClick = () => {
    try {
      onClose();
      onEdit(procedure);
    } catch (error) {
      handleError(error, 'edit_navigation');
    }
  };

  if (!isOpen || !procedure) {
    return null;
  }

  try {
    // Find practitioner for this procedure
    const practitioner = practitioners.find(p => p.id === procedure.practitioner_id);

    return (
      <Modal
        opened={isOpen}
        onClose={onClose}
        title={t('procedures.viewModal.title', 'Procedure Details')}
        size="xl"
        centered
        zIndex={2000}
      >
        <Stack gap="lg">
          {/* Header Card */}
          <Paper withBorder p="md" style={{ backgroundColor: '#f8f9fa' }}>
            <Group justify="space-between" align="center">
              <div>
                <Title order={3} mb="xs">{procedure.procedure_name}</Title>
                <Group gap="xs">
                  {procedure.procedure_type && (
                    <Badge variant="light" color="blue" size="sm">
                      {procedure.procedure_type}
                    </Badge>
                  )}
                  <StatusBadge status={procedure.status} />
                </Group>
              </div>
              {procedure.date && (
                <Badge variant="light" color="gray" size="lg">
                  {formatDate(procedure.date)}
                </Badge>
              )}
            </Group>
          </Paper>

          <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconInfoCircle size={16} />}>
              {t('procedures.viewModal.tabs.overview', 'Overview')}
            </Tabs.Tab>
            <Tabs.Tab value="clinical" leftSection={<IconStethoscope size={16} />}>
              {t('procedures.viewModal.tabs.clinical', 'Clinical Details')}
            </Tabs.Tab>
            <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
              {t('procedures.viewModal.tabs.notes', 'Notes')}
            </Tabs.Tab>
            <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
              {t('procedures.viewModal.tabs.documents', 'Documents')}
            </Tabs.Tab>
          </Tabs.List>

          {/* Overview Tab */}
          <Tabs.Panel value="overview">
            <Box mt="md">
              <Stack gap="lg">
                {/* Basic Information */}
                <div>
                  <Title order={4} mb="sm">{t('procedures.viewModal.basicInfo', 'Basic Information')}</Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('procedures.viewModal.procedureName', 'Procedure Name')}</Text>
                      <Text size="sm">{procedure.procedure_name}</Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('procedures.viewModal.procedureType', 'Procedure Type')}</Text>
                      <Text size="sm" c={procedure.procedure_type ? 'inherit' : 'dimmed'}>
                        {procedure.procedure_type || t('procedures.viewModal.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('procedures.viewModal.procedureCode', 'Procedure Code')}</Text>
                      <Text size="sm" c={procedure.procedure_code ? 'inherit' : 'dimmed'}>
                        {procedure.procedure_code || t('procedures.viewModal.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('procedures.viewModal.date', 'Date')}</Text>
                      <Text size="sm" c={procedure.date ? 'inherit' : 'dimmed'}>
                        {procedure.date ? formatDate(procedure.date) : t('procedures.viewModal.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('procedures.viewModal.status', 'Status')}</Text>
                      <StatusBadge status={procedure.status} />
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('procedures.viewModal.setting', 'Setting')}</Text>
                      <Text size="sm" c={procedure.procedure_setting ? 'inherit' : 'dimmed'}>
                        {procedure.procedure_setting || t('procedures.viewModal.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('procedures.viewModal.duration', 'Duration')}</Text>
                      <Text size="sm" c={procedure.procedure_duration ? 'inherit' : 'dimmed'}>
                        {procedure.procedure_duration ? t('procedures.viewModal.durationMinutes', '{{minutes}} minutes', { minutes: procedure.procedure_duration }) : t('procedures.viewModal.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('procedures.viewModal.facility', 'Facility')}</Text>
                      <Text size="sm" c={procedure.facility ? 'inherit' : 'dimmed'}>
                        {procedure.facility || t('procedures.viewModal.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                  </SimpleGrid>
                </div>

                {/* Practitioner Information */}
                <div>
                  <Title order={4} mb="sm">{t('procedures.viewModal.practitioner', 'Practitioner')}</Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('procedures.viewModal.doctor', 'Doctor')}</Text>
                      {procedure.practitioner_id ? (
                        <Text
                          size="sm"
                          fw={600}
                          c="blue"
                          style={{ cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => navigateToEntity('practitioner', procedure.practitioner_id, navigate)}
                          title={t('procedures.viewModal.viewPractitioner', 'View practitioner details')}
                        >
                          {practitioner?.name || t('procedures.viewModal.practitionerId', 'Practitioner ID: {{id}}', { id: procedure.practitioner_id })}
                        </Text>
                      ) : (
                        <Text size="sm" c="dimmed">{t('procedures.viewModal.notSpecified', 'Not specified')}</Text>
                      )}
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('procedures.viewModal.specialty', 'Specialty')}</Text>
                      <Text size="sm" c={practitioner?.specialty ? 'inherit' : 'dimmed'}>
                        {practitioner?.specialty || t('procedures.viewModal.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                  </SimpleGrid>
                </div>

                {/* Description */}
                <div>
                  <Title order={4} mb="sm">{t('procedures.viewModal.description', 'Description')}</Title>
                  <Text size="sm" c={procedure.description ? 'inherit' : 'dimmed'}>
                    {procedure.description || t('procedures.viewModal.noDescription', 'No description available')}
                  </Text>
                </div>

                {/* Tags Section */}
                {procedure.tags && procedure.tags.length > 0 && (
                  <div>
                    <Title order={4} mb="sm">{t('procedures.viewModal.tags', 'Tags')}</Title>
                    <Group gap="xs">
                      {procedure.tags.map((tag, index) => (
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

          {/* Clinical Details Tab */}
          <Tabs.Panel value="clinical">
            <Box mt="md">
              <Stack gap="lg">
                {/* Anesthesia Information */}
                <div>
                  <Title order={4} mb="sm">{t('procedures.viewModal.anesthesiaInfo', 'Anesthesia Information')}</Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">{t('procedures.viewModal.anesthesiaType', 'Anesthesia Type')}</Text>
                      <Text size="sm" c={procedure.anesthesia_type ? 'inherit' : 'dimmed'}>
                        {procedure.anesthesia_type || t('procedures.viewModal.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                    <Stack gap="xs" style={{ gridColumn: '1 / -1' }}>
                      <Text fw={500} size="sm" c="dimmed">{t('procedures.viewModal.anesthesiaNotes', 'Anesthesia Notes')}</Text>
                      <Text size="sm" c={procedure.anesthesia_notes ? 'inherit' : 'dimmed'}>
                        {procedure.anesthesia_notes || t('procedures.viewModal.noAnesthesiaNotes', 'No anesthesia notes available')}
                      </Text>
                    </Stack>
                  </SimpleGrid>
                </div>

                {/* Complications */}
                <div>
                  <Title order={4} mb="sm">{t('procedures.viewModal.complications', 'Complications')}</Title>
                  <Text size="sm" c={procedure.procedure_complications ? '#d63384' : 'dimmed'}>
                    {procedure.procedure_complications || t('procedures.viewModal.noComplications', 'No complications reported')}
                  </Text>
                </div>
              </Stack>
            </Box>
          </Tabs.Panel>

          {/* Notes Tab */}
          <Tabs.Panel value="notes">
            <Box mt="md">
              <Stack gap="lg">
                <div>
                  <Title order={4} mb="sm">{t('procedures.viewModal.clinicalNotes', 'Clinical Notes')}</Title>
                  <Text size="sm" c={procedure.notes ? 'inherit' : 'dimmed'}>
                    {procedure.notes || t('procedures.viewModal.noClinicalNotes', 'No clinical notes available')}
                  </Text>
                </div>
              </Stack>
            </Box>
          </Tabs.Panel>

          {/* Documents Tab */}
          <Tabs.Panel value="documents">
            <Box mt="md">
              <DocumentManagerWithProgress
                entityType="procedure"
                entityId={procedure.id}
                mode="view"
                showProgressModal={true}
                onUploadComplete={handleDocumentUploadComplete}
                onError={handleDocumentError}
              />
            </Box>
          </Tabs.Panel>
          </Tabs>

          {/* Action Buttons */}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={onClose}>
              {t('procedures.viewModal.close', 'Close')}
            </Button>
            <Button variant="filled" onClick={handleEditClick} leftSection={<IconEdit size={16} />}>
              {t('procedures.viewModal.edit', 'Edit')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    );
  } catch (error) {
    handleError(error, 'render');
    return null;
  }
};

export default ProcedureViewModal;
