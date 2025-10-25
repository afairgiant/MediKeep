import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Stack,
  Title,
  SimpleGrid,
  Text,
  Paper,
  Group,
  Button,
  ScrollArea,
  Tabs,
  Badge,
  Box,
} from '@mantine/core';
import {
  IconInfoCircle,
  IconFlask,
  IconUsers,
  IconTags,
  IconFileText,
} from '@tabler/icons-react';
import StatusBadge from '../StatusBadge';
import ConditionRelationships from '../ConditionRelationships';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import TestComponentsTab from './TestComponentsTab';
import { formatDate } from '../../../utils/helpers';
import logger from '../../../services/logger';

const LabResultViewModal = ({
  isOpen,
  onClose,
  labResult,
  onEdit,
  practitioners,
  onFileUploadComplete,
  conditions,
  labResultConditions,
  fetchLabResultConditions,
  navigate,
  isBlocking,
  onError,
  onLabResultUpdated
}) => {
  const { t } = useTranslation('common');

  // Reset activeTab when modal opens with new labResult
  const [activeTab, setActiveTab] = useState('overview');

  // Reset tab when labResult changes
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
    }
  }, [isOpen, labResult?.id]);

  const handleError = (error, context) => {
    logger.error('lab_result_view_modal_error', {
      message: `Error in LabResultViewModal: ${context}`,
      labResultId: labResult?.id,
      error: error.message,
      component: 'LabResultViewModal',
    });
    
    if (onError) {
      onError(error);
    }
  };

  const handleDocumentError = (error) => {
    handleError(error, 'document_manager');
  };

  if (!labResult) return null;

  try {
    // Find practitioner for this lab result
    const practitioner = practitioners.find(p => p.id === labResult.practitioner_id);

    return (
      <Modal
        opened={isOpen}
        onClose={() => !isBlocking && onClose()}
        title={labResult.test_name || t('labResults.modal.title', 'Lab Result Details')}
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
                <Title order={3} mb="xs">{labResult.test_name}</Title>
                <Group gap="xs">
                  {labResult.test_category && (
                    <StatusBadge status={labResult.test_category} />
                  )}
                  <StatusBadge status={labResult.status} />
                </Group>
              </div>
              {labResult.labs_result && (
                <StatusBadge status={labResult.labs_result} size="lg" />
              )}
            </Group>
          </Paper>

          {/* Tabbed Content */}
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="overview" leftSection={<IconInfoCircle size={16} />}>
                {t('labResults.modal.tabs.overview', 'Overview')}
              </Tabs.Tab>
              <Tabs.Tab value="test-components" leftSection={<IconFlask size={16} />}>
                {t('labResults.modal.tabs.testComponents', 'Test Components')}
              </Tabs.Tab>
              {fetchLabResultConditions && (
                <Tabs.Tab value="conditions" leftSection={<IconUsers size={16} />}>
                  {t('labResults.modal.tabs.relatedConditions', 'Related Conditions')}
                </Tabs.Tab>
              )}
              {labResult.tags && labResult.tags.length > 0 && (
                <Tabs.Tab value="tags" leftSection={<IconTags size={16} />}>
                  {t('labResults.modal.tabs.tags', 'Tags')}
                  <Badge size="sm" color="blue" style={{ marginLeft: 8 }}>
                    {labResult.tags.length}
                  </Badge>
                </Tabs.Tab>
              )}
              <Tabs.Tab value="files" leftSection={<IconFileText size={16} />}>
                {t('labResults.modal.tabs.files', 'Files')}
              </Tabs.Tab>
            </Tabs.List>

            {/* Overview Tab */}
            <Tabs.Panel value="overview">
              <Box mt="md">
                <Stack gap="lg">
                  {/* Test Information Section */}
                  <div>
                    <Title order={4} mb="sm">{t('labResults.modal.sections.testInfo', 'Test Information')}</Title>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">{t('labResults.modal.labels.testCode', 'Test Code')}</Text>
                        <Text>{labResult.test_code || t('labResults.modal.notSpecified', 'Not specified')}</Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">{t('labResults.modal.labels.category', 'Category')}</Text>
                        <Text>{labResult.test_category || t('labResults.modal.notSpecified', 'Not specified')}</Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">{t('labResults.modal.labels.testType', 'Test Type')}</Text>
                        <Text c={labResult.test_type ? 'inherit' : 'dimmed'}>
                          {labResult.test_type || t('labResults.modal.notSpecified', 'Not specified')}
                        </Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">{t('labResults.modal.labels.facility', 'Facility')}</Text>
                        <Text c={labResult.facility ? 'inherit' : 'dimmed'}>
                          {labResult.facility || t('labResults.modal.notSpecified', 'Not specified')}
                        </Text>
                      </Stack>
                    </SimpleGrid>
                  </div>

                  {/* Test Results Section */}
                  <div>
                    <Title order={4} mb="sm">{t('labResults.modal.sections.testResults', 'Test Results')}</Title>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">{t('labels.status', 'Status')}</Text>
                        <StatusBadge status={labResult.status} />
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">{t('labResults.modal.labels.labResult', 'Lab Result')}</Text>
                        {labResult.labs_result ? (
                          <StatusBadge status={labResult.labs_result} />
                        ) : (
                          <Text c="dimmed">{t('labResults.modal.notSpecified', 'Not specified')}</Text>
                        )}
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">{t('labResults.modal.labels.orderedDate', 'Ordered Date')}</Text>
                        <Text>{formatDate(labResult.ordered_date)}</Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">{t('labResults.modal.labels.completedDate', 'Completed Date')}</Text>
                        <Text c={labResult.completed_date ? 'inherit' : 'dimmed'}>
                          {labResult.completed_date
                            ? formatDate(labResult.completed_date)
                            : t('labResults.modal.notCompleted', 'Not completed')}
                        </Text>
                      </Stack>
                    </SimpleGrid>
                  </div>

                  {/* Practitioner Information Section */}
                  <div>
                    <Title order={4} mb="sm">{t('labResults.modal.sections.orderingPractitioner', 'Ordering Practitioner')}</Title>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">{t('labResults.modal.labels.doctor', 'Doctor')}</Text>
                        <Text c={labResult.practitioner_id ? 'inherit' : 'dimmed'}>
                          {labResult.practitioner_id
                            ? practitioner?.name || `Practitioner ID: ${labResult.practitioner_id}`
                            : t('labResults.modal.notSpecified', 'Not specified')}
                        </Text>
                      </Stack>
                      {practitioner?.specialty && (
                        <Stack gap="xs">
                          <Text fw={500} size="sm" c="dimmed">{t('labResults.modal.labels.specialty', 'Specialty')}</Text>
                          <Text>{practitioner.specialty}</Text>
                        </Stack>
                      )}
                    </SimpleGrid>
                  </div>

                  {/* Notes Section */}
                  <div>
                    <Title order={4} mb="sm">{t('labResults.modal.sections.notes', 'Notes')}</Title>
                    <Paper withBorder p="sm" bg="gray.1">
                      <Text
                        style={{ whiteSpace: 'pre-wrap' }}
                        c={labResult.notes ? 'inherit' : 'dimmed'}
                      >
                        {labResult.notes || t('labResults.modal.noNotes', 'No notes available')}
                      </Text>
                    </Paper>
                  </div>
                </Stack>
              </Box>
            </Tabs.Panel>

            {/* Test Components Tab */}
            <Tabs.Panel value="test-components">
              <Box mt="md">
                <TestComponentsTab
                  key={`test-components-${labResult.id}`}
                  labResultId={labResult.id}
                  isViewMode={false}
                  onError={handleError}
                  onLabResultUpdated={onLabResultUpdated}
                />
              </Box>
            </Tabs.Panel>

            {/* Related Conditions Tab */}
            {fetchLabResultConditions && (
              <Tabs.Panel value="conditions">
                <Box mt="md">
                  <ConditionRelationships
                    labResultId={labResult.id}
                    labResultConditions={labResultConditions}
                    conditions={conditions}
                    fetchLabResultConditions={fetchLabResultConditions}
                    navigate={navigate}
                    isViewMode={true}
                  />
                </Box>
              </Tabs.Panel>
            )}

            {/* Tags Tab */}
            {labResult.tags && labResult.tags.length > 0 && (
              <Tabs.Panel value="tags">
                <Box mt="md">
                  <Stack gap="md">
                    <Title order={4}>{t('labResults.modal.sections.tags', 'Tags')}</Title>
                    <Group gap="xs">
                      {labResult.tags.map((tag, index) => (
                        <StatusBadge
                          key={index}
                          status={tag}
                          variant="light"
                          color="blue"
                          size="sm"
                        />
                      ))}
                    </Group>
                  </Stack>
                </Box>
              </Tabs.Panel>
            )}

            {/* Files Tab */}
            <Tabs.Panel value="files">
              <Box mt="md">
                <Stack gap="md">
                  <Title order={4}>{t('labResults.modal.sections.associatedFiles', 'Associated Files')}</Title>
                  <DocumentManagerWithProgress
                    entityType="lab-result"
                    entityId={labResult.id}
                    mode="view"
                    config={{
                      acceptedTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.gif', '.txt', '.csv', '.xml', '.json', '.doc', '.docx', '.xls', '.xlsx'],
                      maxSize: 10 * 1024 * 1024, // 10MB
                      maxFiles: 10
                    }}
                    onUploadComplete={onFileUploadComplete}
                    onError={handleDocumentError}
                    showProgressModal={true}
                  />
                </Stack>
              </Box>
            </Tabs.Panel>
          </Tabs>

          {/* Action Buttons */}
          <Group justify="space-between" mt="md">
            <Button variant="outline" onClick={onClose}>
              {t('buttons.close', 'Close')}
            </Button>
            <Button
              onClick={() => {
                onClose();
                onEdit(labResult);
              }}
            >
              {t('labResults.modal.editLabResult', 'Edit Lab Result')}
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

export default LabResultViewModal;