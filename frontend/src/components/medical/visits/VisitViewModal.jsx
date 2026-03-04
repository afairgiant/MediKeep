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
import { useTranslation } from 'react-i18next';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { useTagColors } from '../../../hooks/useTagColors';
import { ClickableTagBadge } from '../../common/ClickableTagBadge';
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
  const { t } = useTranslation('common');
  const { formatDate } = useDateFormat();
  const { getTagColor } = useTagColors();

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
    if (!practitionerId) return t('visits.viewModal.noPractitionerAssigned', 'No practitioner assigned');

    const practitioner = practitioners.find(
      p => p.id === parseInt(practitionerId)
    );
    if (practitioner) {
      return `${practitioner.name}${practitioner.specialty ? ` - ${practitioner.specialty}` : ''}`;
    }
    return t('visits.viewModal.practitionerId', 'Practitioner ID: {{id}}', { id: practitionerId });
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
        title={t('visits.viewModal.title', 'Visit - {{date}}', { date: formatDate(visit.date) })}
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
                  {visit.reason || t('visits.viewModal.generalVisit', 'General Visit')}
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
                {t('visits.viewModal.tabs.visitInfo', 'Visit Info')}
              </Tabs.Tab>
              <Tabs.Tab value="clinical" leftSection={<IconStethoscope size={16} />}>
                {t('visits.viewModal.tabs.clinical', 'Clinical')}
              </Tabs.Tab>
              <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                {t('visits.viewModal.tabs.notes', 'Notes')}
              </Tabs.Tab>
              <Tabs.Tab value="documents" leftSection={<IconFileText size={16} />}>
                {t('visits.viewModal.tabs.documents', 'Documents')}
              </Tabs.Tab>
            </Tabs.List>

            {/* Visit Info Tab */}
            <Tabs.Panel value="overview">
              <Box mt="md">
                <Stack gap="lg">
                  <div>
                    <Title order={4} mb="sm">{t('visits.viewModal.visitInformation', 'Visit Information')}</Title>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">{t('labels.date', 'Date')}</Text>
                        <Text>{formatDate(visit.date)}</Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">{t('visits.viewModal.reason', 'Reason')}</Text>
                        <Text c={visit.reason ? 'inherit' : 'dimmed'}>
                          {visit.reason || t('labels.notSpecified', 'Not specified')}
                        </Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">{t('visits.viewModal.visitType', 'Visit Type')}</Text>
                        <Text c={visit.visit_type ? 'inherit' : 'dimmed'}>
                          {visit.visit_type || t('labels.notSpecified', 'Not specified')}
                        </Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">{t('visits.viewModal.priority', 'Priority')}</Text>
                        <Text c={visit.priority ? 'inherit' : 'dimmed'}>
                          {visit.priority || t('labels.notSpecified', 'Not specified')}
                        </Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">{t('visits.viewModal.location', 'Location')}</Text>
                        <Text c={visit.location ? 'inherit' : 'dimmed'}>
                          {visit.location || t('labels.notSpecified', 'Not specified')}
                        </Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">{t('visits.viewModal.duration', 'Duration')}</Text>
                        <Text c={visit.duration_minutes ? 'inherit' : 'dimmed'}>
                          {visit.duration_minutes
                            ? t('visits.viewModal.durationMinutes', '{{minutes}} minutes', { minutes: visit.duration_minutes })
                            : t('labels.notSpecified', 'Not specified')}
                        </Text>
                      </Stack>
                    </SimpleGrid>
                  </div>

                  {/* Tags Section */}
                  {visit.tags && visit.tags.length > 0 && (
                    <div>
                      <Title order={4} mb="sm">{t('labels.tags', 'Tags')}</Title>
                      <Group gap="xs">
                        {visit.tags.map((tag, index) => (
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

            {/* Clinical Details Tab */}
            <Tabs.Panel value="clinical">
              <Box mt="md">
                <Stack gap="lg">
                  <div>
                    <Title order={4} mb="sm">{t('labels.practitioner', 'Practitioner')}</Title>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">{t('visits.viewModal.doctor', 'Doctor')}</Text>
                        <Text c={visit.practitioner_id ? 'inherit' : 'dimmed'}>
                          {visit.practitioner_id
                            ? getPractitionerDisplay(visit.practitioner_id)
                            : t('labels.notSpecified', 'Not specified')}
                        </Text>
                      </Stack>
                      {practitioner?.specialty && (
                        <Stack gap="xs">
                          <Text fw={500} size="sm" c="dimmed">{t('visits.viewModal.specialty', 'Specialty')}</Text>
                          <Text>{practitioner.specialty}</Text>
                        </Stack>
                      )}
                    </SimpleGrid>
                  </div>

                  {condition && (
                    <div>
                      <Title order={4} mb="sm">{t('visits.viewModal.relatedCondition', 'Related Condition')}</Title>
                      <Text
                        c="blue"
                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => navigateToEntity('condition', condition.id, navigate)}
                        title={t('visits.viewModal.viewCondition', 'View condition details')}
                      >
                        {condition.diagnosis}
                      </Text>
                    </div>
                  )}

                  <div>
                    <Title order={4} mb="sm">{t('visits.viewModal.clinicalInformation', 'Clinical Information')}</Title>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">{t('visits.viewModal.chiefComplaint', 'Chief Complaint')}</Text>
                        <Text c={visit.chief_complaint ? 'inherit' : 'dimmed'}>
                          {visit.chief_complaint || t('labels.notSpecified', 'Not specified')}
                        </Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">{t('visits.viewModal.diagnosis', 'Diagnosis')}</Text>
                        <Text c={visit.diagnosis ? 'inherit' : 'dimmed'}>
                          {visit.diagnosis || t('labels.notSpecified', 'Not specified')}
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
                      <Title order={4} mb="sm">{t('visits.viewModal.treatmentPlan', 'Treatment Plan')}</Title>
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
                      <Title order={4} mb="sm">{t('visits.viewModal.followUpInstructions', 'Follow-up Instructions')}</Title>
                      <Paper withBorder p="sm" bg="gray.1">
                        <Text style={{ whiteSpace: 'pre-wrap' }}>
                          {visit.follow_up_instructions}
                        </Text>
                      </Paper>
                    </div>
                  )}

                  {/* Additional Notes */}
                  <div>
                    <Title order={4} mb="sm">{t('visits.viewModal.additionalNotes', 'Additional Notes')}</Title>
                    <Paper withBorder p="sm" bg="gray.1">
                      <Text
                        style={{ whiteSpace: 'pre-wrap' }}
                        c={visit.notes ? 'inherit' : 'dimmed'}
                      >
                        {visit.notes || t('visits.viewModal.noNotesAvailable', 'No notes available')}
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
                  <Title order={4}>{t('visits.viewModal.attachedDocuments', 'Attached Documents')}</Title>
                  <DocumentManagerWithProgress
                    entityType="visit"
                    entityId={visit.id}
                    mode="view"
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
              {t('visits.viewModal.editVisit', 'Edit Visit')}
            </Button>
            <Button variant="filled" onClick={onClose}>
              {t('buttons.close', 'Close')}
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
