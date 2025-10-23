import React, { useState } from 'react';
import {
  Modal,
  Stack,
  Title,
  Text,
  Paper,
  Group,
  Button,
  Card,
  Divider,
  Grid,
  Badge,
  Tabs,
  Box,
  SimpleGrid,
} from '@mantine/core';
import {
  IconInfoCircle,
  IconStethoscope,
  IconNotes,
  IconFileText,
} from '@tabler/icons-react';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import { formatDate } from '../../../utils/helpers';
import { navigateToEntity } from '../../../utils/linkNavigation';
import logger from '../../../services/logger';

const VisitViewModal = ({
  isOpen,
  onClose,
  visit,
  onEdit,
  practitioners,
  conditions,
  navigate,
  onFileUploadComplete,
  isBlocking,
  onError
}) => {
  // Tab state management
  const [activeTab, setActiveTab] = useState('overview');

  // Reset tab when modal opens with new visit
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
    }
  }, [isOpen, visit?.id]);

  const handleError = (error, context) => {
    logger.error('visit_view_modal_error', {
      message: `Error in VisitViewModal: ${context}`,
      visitId: visit?.id,
      error: error.message,
      component: 'VisitViewModal',
    });

    if (onError) {
      onError(error);
    }
  };

  const handleDocumentError = (error) => {
    handleError(error, 'document_manager');
  };

  const handleDocumentUploadComplete = (success, completedCount, failedCount) => {
    logger.info('visits_view_upload_completed', {
      message: 'File upload completed in visits view',
      visitId: visit?.id,
      success,
      completedCount,
      failedCount,
      component: 'VisitViewModal',
    });

    if (onFileUploadComplete) {
      onFileUploadComplete(success, completedCount, failedCount);
    }
  };

  const getPractitionerDisplay = (practitionerId) => {
    if (!practitionerId) return 'No practitioner assigned';

    const practitioner = practitioners.find(
      p => p.id === parseInt(practitionerId)
    );
    if (practitioner) {
      return `${practitioner.name}${practitioner.specialty ? ` - ${practitioner.specialty}` : ''}`;
    }
    return `Practitioner ID: ${practitionerId}`;
  };

  const getConditionDetails = (conditionId) => {
    if (!conditionId || !conditions) return null;
    return conditions.find(c => c.id === conditionId);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'red';
      case 'high':
        return 'orange';
      case 'medium':
        return 'yellow';
      case 'low':
        return 'blue';
      default:
        return 'gray';
    }
  };

  const getVisitTypeColor = (visitType) => {
    switch (visitType?.toLowerCase()) {
      case 'emergency':
        return 'red';
      case 'urgent care':
        return 'orange';
      case 'follow-up':
        return 'blue';
      case 'routine':
        return 'green';
      case 'consultation':
        return 'purple';
      default:
        return 'gray';
    }
  };

  if (!visit) return null;

  try {
    const practitioner = practitioners.find(p => p.id === parseInt(visit.practitioner_id));
    const condition = getConditionDetails(visit.condition_id);

    return (
      <Modal
        opened={isOpen}
        onClose={() => !isBlocking && onClose()}
        title={`Visit - ${formatDate(visit.date)}`}
        size="xl"
        centered
        zIndex={2000}
        styles={{
          body: {
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto'
          }
        }}
      >
        <Stack gap="lg">
          {/* Header Card */}
          <Paper withBorder p="md" style={{ backgroundColor: '#f8f9fa' }}>
            <Group justify="space-between" align="center">
              <div>
                <Title order={3} mb="xs">
                  {visit.reason || 'General Visit'}
                </Title>
                <Group gap="xs">
                  {visit.visit_type && (
                    <Badge
                      color={getVisitTypeColor(visit.visit_type)}
                      variant="light"
                      size="sm"
                    >
                      {visit.visit_type}
                    </Badge>
                  )}
                  {visit.priority && (
                    <Badge
                      color={getPriorityColor(visit.priority)}
                      variant="filled"
                      size="sm"
                    >
                      {visit.priority}
                    </Badge>
                  )}
                </Group>
              </div>
            </Group>
          </Paper>

          {/* Tabbed Content */}
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="overview" leftSection={<IconInfoCircle size={16} />}>
                Visit Info
              </Tabs.Tab>
              <Tabs.Tab value="clinical" leftSection={<IconStethoscope size={16} />}>
                Clinical
              </Tabs.Tab>
              <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                Notes
              </Tabs.Tab>
              <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
                Documents
              </Tabs.Tab>
            </Tabs.List>

            {/* Visit Info Tab */}
            <Tabs.Panel value="overview">
              <Box mt="md">
                <Stack gap="lg">
                  <div>
                    <Title order={4} mb="sm">Visit Information</Title>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">Date</Text>
                        <Text>{formatDate(visit.date)}</Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">Reason</Text>
                        <Text c={visit.reason ? 'inherit' : 'dimmed'}>
                          {visit.reason || 'Not specified'}
                        </Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">Visit Type</Text>
                        <Text c={visit.visit_type ? 'inherit' : 'dimmed'}>
                          {visit.visit_type || 'Not specified'}
                        </Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">Priority</Text>
                        <Text c={visit.priority ? 'inherit' : 'dimmed'}>
                          {visit.priority || 'Not specified'}
                        </Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">Location</Text>
                        <Text c={visit.location ? 'inherit' : 'dimmed'}>
                          {visit.location || 'Not specified'}
                        </Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">Duration</Text>
                        <Text c={visit.duration_minutes ? 'inherit' : 'dimmed'}>
                          {visit.duration_minutes
                            ? `${visit.duration_minutes} minutes`
                            : 'Not specified'}
                        </Text>
                      </Stack>
                    </SimpleGrid>
                  </div>

                  {/* Tags Section */}
                  {visit.tags && visit.tags.length > 0 && (
                    <div>
                      <Title order={4} mb="sm">Tags</Title>
                      <Group gap="xs">
                        {visit.tags.map((tag, index) => (
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
                  <div>
                    <Title order={4} mb="sm">Practitioner</Title>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">Doctor</Text>
                        <Text c={visit.practitioner_id ? 'inherit' : 'dimmed'}>
                          {visit.practitioner_id
                            ? getPractitionerDisplay(visit.practitioner_id)
                            : 'Not specified'}
                        </Text>
                      </Stack>
                      {practitioner?.specialty && (
                        <Stack gap="xs">
                          <Text fw={500} size="sm" c="dimmed">Specialty</Text>
                          <Text>{practitioner.specialty}</Text>
                        </Stack>
                      )}
                    </SimpleGrid>
                  </div>

                  {condition && (
                    <div>
                      <Title order={4} mb="sm">Related Condition</Title>
                      <Text
                        c="blue"
                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => navigateToEntity('condition', condition.id, navigate)}
                        title="View condition details"
                      >
                        {condition.diagnosis}
                      </Text>
                    </div>
                  )}

                  <div>
                    <Title order={4} mb="sm">Clinical Information</Title>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">Chief Complaint</Text>
                        <Text c={visit.chief_complaint ? 'inherit' : 'dimmed'}>
                          {visit.chief_complaint || 'Not specified'}
                        </Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">Diagnosis</Text>
                        <Text c={visit.diagnosis ? 'inherit' : 'dimmed'}>
                          {visit.diagnosis || 'Not specified'}
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
                  {/* Treatment Plan */}
                  {visit.treatment_plan && (
                    <div>
                      <Title order={4} mb="sm">Treatment Plan</Title>
                      <Paper withBorder p="sm" bg="gray.1">
                        <Text style={{ whiteSpace: 'pre-wrap' }}>
                          {visit.treatment_plan}
                        </Text>
                      </Paper>
                    </div>
                  )}

                  {/* Follow-up Instructions */}
                  {visit.follow_up_instructions && (
                    <div>
                      <Title order={4} mb="sm">Follow-up Instructions</Title>
                      <Paper withBorder p="sm" bg="gray.1">
                        <Text style={{ whiteSpace: 'pre-wrap' }}>
                          {visit.follow_up_instructions}
                        </Text>
                      </Paper>
                    </div>
                  )}

                  {/* Additional Notes */}
                  <div>
                    <Title order={4} mb="sm">Additional Notes</Title>
                    <Paper withBorder p="sm" bg="gray.1">
                      <Text
                        style={{ whiteSpace: 'pre-wrap' }}
                        c={visit.notes ? 'inherit' : 'dimmed'}
                      >
                        {visit.notes || 'No notes available'}
                      </Text>
                    </Paper>
                  </div>
                </Stack>
              </Box>
            </Tabs.Panel>

            {/* Documents Tab */}
            <Tabs.Panel value="documents">
              <Box mt="md">
                <Stack gap="md">
                  <Title order={4}>Attached Documents</Title>
                  <DocumentManagerWithProgress
                    entityType="visit"
                    entityId={visit.id}
                    mode="view"
                    config={{
                      acceptedTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'],
                      maxSize: 10 * 1024 * 1024, // 10MB
                      maxFiles: 10
                    }}
                    onUploadComplete={handleDocumentUploadComplete}
                    onError={handleDocumentError}
                    showProgressModal={true}
                  />
                </Stack>
              </Box>
            </Tabs.Panel>
          </Tabs>

          {/* Action Buttons */}
          <Group justify="flex-end" mt="md">
            <Button
              variant="light"
              onClick={() => {
                onClose();
                // Small delay to ensure view modal is closed before opening edit modal
                setTimeout(() => {
                  onEdit(visit);
                }, 100);
              }}
            >
              Edit Visit
            </Button>
            <Button variant="filled" onClick={onClose}>
              Close
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

export default VisitViewModal;
