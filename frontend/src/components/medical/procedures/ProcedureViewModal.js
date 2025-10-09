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
} from '@mantine/core';
import {
  IconInfoCircle,
  IconStethoscope,
  IconNotes,
  IconFileText,
  IconEdit,
} from '@tabler/icons-react';
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
        title={
          <Group>
            <Text fw={600} size="lg">
              {procedure.procedure_name || 'Procedure Details'}
            </Text>
            <StatusBadge status={procedure.status} />
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
            <Tabs.Tab value="clinical" leftSection={<IconStethoscope size={16} />}>
              Clinical Details
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
                {/* Basic Information */}
                <div>
                  <Title order={4} mb="sm">Basic Information</Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Procedure Name</Text>
                      <Text size="sm">{procedure.procedure_name}</Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Procedure Type</Text>
                      <Text size="sm" c={procedure.procedure_type ? 'inherit' : 'dimmed'}>
                        {procedure.procedure_type || 'Not specified'}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Procedure Code</Text>
                      <Text size="sm" c={procedure.procedure_code ? 'inherit' : 'dimmed'}>
                        {procedure.procedure_code || 'Not specified'}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Date</Text>
                      <Text size="sm" c={procedure.date ? 'inherit' : 'dimmed'}>
                        {procedure.date ? formatDate(procedure.date) : 'Not specified'}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Status</Text>
                      <StatusBadge status={procedure.status} />
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Setting</Text>
                      <Text size="sm" c={procedure.procedure_setting ? 'inherit' : 'dimmed'}>
                        {procedure.procedure_setting || 'Not specified'}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Duration</Text>
                      <Text size="sm" c={procedure.procedure_duration ? 'inherit' : 'dimmed'}>
                        {procedure.procedure_duration ? `${procedure.procedure_duration} minutes` : 'Not specified'}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Facility</Text>
                      <Text size="sm" c={procedure.facility ? 'inherit' : 'dimmed'}>
                        {procedure.facility || 'Not specified'}
                      </Text>
                    </Stack>
                  </SimpleGrid>
                </div>

                {/* Practitioner Information */}
                <div>
                  <Title order={4} mb="sm">Practitioner</Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Doctor</Text>
                      {procedure.practitioner_id ? (
                        <Text
                          size="sm"
                          fw={600}
                          c="blue"
                          style={{ cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => navigateToEntity('practitioner', procedure.practitioner_id, navigate)}
                          title="View practitioner details"
                        >
                          {practitioner?.name || `Practitioner ID: ${procedure.practitioner_id}`}
                        </Text>
                      ) : (
                        <Text size="sm" c="dimmed">Not specified</Text>
                      )}
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Specialty</Text>
                      <Text size="sm" c={practitioner?.specialty ? 'inherit' : 'dimmed'}>
                        {practitioner?.specialty || 'Not specified'}
                      </Text>
                    </Stack>
                  </SimpleGrid>
                </div>

                {/* Description */}
                <div>
                  <Title order={4} mb="sm">Description</Title>
                  <Text size="sm" c={procedure.description ? 'inherit' : 'dimmed'}>
                    {procedure.description || 'No description available'}
                  </Text>
                </div>

                {/* Tags Section */}
                {procedure.tags && procedure.tags.length > 0 && (
                  <div>
                    <Title order={4} mb="sm">Tags</Title>
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
                  <Title order={4} mb="sm">Anesthesia Information</Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">Anesthesia Type</Text>
                      <Text size="sm" c={procedure.anesthesia_type ? 'inherit' : 'dimmed'}>
                        {procedure.anesthesia_type || 'Not specified'}
                      </Text>
                    </Stack>
                    <Stack gap="xs" style={{ gridColumn: '1 / -1' }}>
                      <Text fw={500} size="sm" c="dimmed">Anesthesia Notes</Text>
                      <Text size="sm" c={procedure.anesthesia_notes ? 'inherit' : 'dimmed'}>
                        {procedure.anesthesia_notes || 'No anesthesia notes available'}
                      </Text>
                    </Stack>
                  </SimpleGrid>
                </div>

                {/* Complications */}
                <div>
                  <Title order={4} mb="sm">Complications</Title>
                  <Text size="sm" c={procedure.procedure_complications ? '#d63384' : 'dimmed'}>
                    {procedure.procedure_complications || 'No complications reported'}
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
                  <Title order={4} mb="sm">Clinical Notes</Title>
                  <Text size="sm" c={procedure.notes ? 'inherit' : 'dimmed'}>
                    {procedure.notes || 'No clinical notes available'}
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
                config={{
                  acceptedTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.gif', '.txt', '.csv', '.xml', '.json', '.doc', '.docx', '.xls', '.xlsx'],
                  maxSize: 10 * 1024 * 1024, // 10MB
                  maxFiles: 10
                }}
                showProgressModal={true}
                onUploadComplete={handleDocumentUploadComplete}
                onError={handleDocumentError}
              />
            </Box>
          </Tabs.Panel>
        </Tabs>

        {/* Action Buttons */}
        <Group justify="flex-end" gap="sm" mt="lg">
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
          <Button variant="filled" onClick={handleEditClick} leftSection={<IconEdit size={16} />}>
            Edit
          </Button>
        </Group>
      </Modal>
    );
  } catch (error) {
    handleError(error, 'render');
    return null;
  }
};

export default ProcedureViewModal;
