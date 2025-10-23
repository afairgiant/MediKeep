import React, { useState } from 'react';
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
        title={labResult.test_name || 'Lab Result Details'}
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
                Overview
              </Tabs.Tab>
              <Tabs.Tab value="test-components" leftSection={<IconFlask size={16} />}>
                Test Components
              </Tabs.Tab>
              {fetchLabResultConditions && (
                <Tabs.Tab value="conditions" leftSection={<IconUsers size={16} />}>
                  Related Conditions
                </Tabs.Tab>
              )}
              {labResult.tags && labResult.tags.length > 0 && (
                <Tabs.Tab value="tags" leftSection={<IconTags size={16} />}>
                  Tags
                  <Badge size="sm" color="blue" style={{ marginLeft: 8 }}>
                    {labResult.tags.length}
                  </Badge>
                </Tabs.Tab>
              )}
              <Tabs.Tab value="files" leftSection={<IconFileText size={16} />}>
                Files
              </Tabs.Tab>
            </Tabs.List>

            {/* Overview Tab */}
            <Tabs.Panel value="overview">
              <Box mt="md">
                <Stack gap="lg">
                  {/* Test Information Section */}
                  <div>
                    <Title order={4} mb="sm">Test Information</Title>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">Test Code</Text>
                        <Text>{labResult.test_code || 'N/A'}</Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">Category</Text>
                        <Text>{labResult.test_category || 'N/A'}</Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">Test Type</Text>
                        <Text c={labResult.test_type ? 'inherit' : 'dimmed'}>
                          {labResult.test_type || 'Not specified'}
                        </Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">Facility</Text>
                        <Text c={labResult.facility ? 'inherit' : 'dimmed'}>
                          {labResult.facility || 'Not specified'}
                        </Text>
                      </Stack>
                    </SimpleGrid>
                  </div>

                  {/* Test Results Section */}
                  <div>
                    <Title order={4} mb="sm">Test Results</Title>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">Status</Text>
                        <StatusBadge status={labResult.status} />
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">Lab Result</Text>
                        {labResult.labs_result ? (
                          <StatusBadge status={labResult.labs_result} />
                        ) : (
                          <Text c="dimmed">Not specified</Text>
                        )}
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">Ordered Date</Text>
                        <Text>{formatDate(labResult.ordered_date)}</Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">Completed Date</Text>
                        <Text c={labResult.completed_date ? 'inherit' : 'dimmed'}>
                          {labResult.completed_date
                            ? formatDate(labResult.completed_date)
                            : 'Not completed'}
                        </Text>
                      </Stack>
                    </SimpleGrid>
                  </div>

                  {/* Practitioner Information Section */}
                  <div>
                    <Title order={4} mb="sm">Ordering Practitioner</Title>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      <Stack gap="xs">
                        <Text fw={500} size="sm" c="dimmed">Doctor</Text>
                        <Text c={labResult.practitioner_id ? 'inherit' : 'dimmed'}>
                          {labResult.practitioner_id
                            ? practitioner?.name || `Practitioner ID: ${labResult.practitioner_id}`
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

                  {/* Notes Section */}
                  <div>
                    <Title order={4} mb="sm">Notes</Title>
                    <Paper withBorder p="sm" bg="gray.1">
                      <Text
                        style={{ whiteSpace: 'pre-wrap' }}
                        c={labResult.notes ? 'inherit' : 'dimmed'}
                      >
                        {labResult.notes || 'No notes available'}
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
                    <Title order={4}>Tags</Title>
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
                  <Title order={4}>Associated Files</Title>
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
              Close
            </Button>
            <Button
              onClick={() => {
                onClose();
                onEdit(labResult);
              }}
            >
              Edit Lab Result
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