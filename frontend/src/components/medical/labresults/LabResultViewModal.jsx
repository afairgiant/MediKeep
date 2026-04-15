import { useState, useEffect } from 'react';
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
  Tooltip,
} from '@mantine/core';
import {
  IconInfoCircle,
  IconFlask,
  IconUsers,
  IconTags,
  IconFileText,
  IconNotes,
  IconStethoscope,
} from '@tabler/icons-react';
import StatusBadge from '../StatusBadge';
import { ClickableTagBadge } from '../../common/ClickableTagBadge';
import { useTagColors } from '../../../hooks/useTagColors';
import ConditionRelationships from '../ConditionRelationships';
import LabResultEncounterRelationships from './LabResultEncounterRelationships';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import TestComponentsTab from './TestComponentsTab';
import logger from '../../../services/logger';
import { useDateFormat } from '../../../hooks/useDateFormat';

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
  onLabResultUpdated,
  initialTab = 'overview',
  encounters,
  labResultEncounters,
  fetchLabResultEncounters,
  disableEdit = false,
  disableEditTooltip,
}) => {
  const { t } = useTranslation(['common', 'shared']);
  const { formatDate } = useDateFormat();
  const { getTagColor } = useTagColors();

  // Reset activeTab when modal opens with new labResult
  const [activeTab, setActiveTab] = useState(initialTab);

  // Reset tab when labResult changes or initialTab changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, labResult?.id, initialTab]);

  // Fall back to overview if the active tab is no longer available
  useEffect(() => {
    if (!isOpen) return;
    const conditionalTabs = {
      notes: !!labResult?.notes,
      tags: labResult?.tags?.length > 0,
      conditions: !!fetchLabResultConditions,
      encounters: !!fetchLabResultEncounters,
    };
    if (activeTab in conditionalTabs && !conditionalTabs[activeTab]) {
      setActiveTab('overview');
    }
  }, [
    isOpen,
    activeTab,
    labResult?.notes,
    labResult?.tags?.length,
    fetchLabResultConditions,
    fetchLabResultEncounters,
  ]);

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

  const handleDocumentError = error => {
    handleError(error, 'document_manager');
  };

  const handleTestComponentsError = error => {
    handleError(error, 'test_components');
  };

  if (!labResult) return null;

  try {
    // Find practitioner for this lab result
    const practitioner = practitioners.find(
      p => p.id === labResult.practitioner_id
    );

    return (
      <Modal
        opened={isOpen}
        onClose={() => !isBlocking && onClose()}
        title={
          labResult.test_name ||
          t('labresults:modal.title', 'Lab Result Details')
        }
        size="xl"
        centered
        zIndex={2000}
        styles={{
          body: {
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto',
          },
        }}
      >
        <Stack gap="lg">
          {/* Header Card */}
          <Paper
            withBorder
            p="md"
            style={{ backgroundColor: 'var(--color-bg-secondary)' }}
          >
            <Group justify="space-between" align="center">
              <div>
                <Title order={3} mb="xs">
                  {labResult.test_name}
                </Title>
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
              <Tabs.Tab
                value="overview"
                leftSection={<IconInfoCircle size={16} />}
              >
                {t('shared:tabs.overview', 'Overview')}
              </Tabs.Tab>
              <Tabs.Tab
                value="test-components"
                leftSection={<IconFlask size={16} />}
              >
                {t('labresults:modal.tabs.testComponents', 'Test Components')}
              </Tabs.Tab>
              {fetchLabResultConditions && (
                <Tabs.Tab
                  value="conditions"
                  leftSection={<IconUsers size={16} />}
                >
                  {t('shared:labels.relatedConditions', 'Related Conditions')}
                </Tabs.Tab>
              )}
              {fetchLabResultEncounters && (
                <Tabs.Tab
                  value="encounters"
                  leftSection={<IconStethoscope size={16} />}
                >
                  {t('shared:tabs.visits', 'Visits')}
                </Tabs.Tab>
              )}
              {labResult.notes && (
                <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
                  {t('shared:tabs.notes', 'Notes')}
                </Tabs.Tab>
              )}
              {labResult.tags && labResult.tags.length > 0 && (
                <Tabs.Tab value="tags" leftSection={<IconTags size={16} />}>
                  {t('shared:labels.tags', 'Tags')}
                  <Badge size="sm" color="blue" style={{ marginLeft: 8 }}>
                    {labResult.tags.length}
                  </Badge>
                </Tabs.Tab>
              )}
              <Tabs.Tab value="files" leftSection={<IconFileText size={16} />}>
                {t('shared:tabs.documents', 'Documents')}
              </Tabs.Tab>
            </Tabs.List>

            {/* Overview Tab */}
            <Tabs.Panel value="overview">
              <Box mt="md">
                <Stack gap="lg">
                  {/* Test Information Section */}
                  <div>
                    <Title order={4} mb="sm">
                      {t(
                        'labresults:modal.sections.testInfo',
                        'Test Information'
                      )}
                    </Title>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      <Stack gap="xs">
                        <Text fw={600} size="sm" c="dimmed">
                          {t('shared:fields.testCode', 'Test Code')}
                        </Text>
                        <Text>
                          {labResult.test_code ||
                            t('shared:labels.notSpecified', 'Not specified')}
                        </Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={600} size="sm" c="dimmed">
                          {t('shared:labels.category', 'Category')}
                        </Text>
                        <Text>
                          {labResult.test_category ||
                            t('shared:labels.notSpecified', 'Not specified')}
                        </Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={600} size="sm" c="dimmed">
                          {t('labresults:modal.labels.testType', 'Test Type')}
                        </Text>
                        <Text c={labResult.test_type ? 'inherit' : 'dimmed'}>
                          {labResult.test_type ||
                            t('shared:labels.notSpecified', 'Not specified')}
                        </Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={600} size="sm" c="dimmed">
                          {t('shared:labels.facility', 'Facility')}
                        </Text>
                        <Text c={labResult.facility ? 'inherit' : 'dimmed'}>
                          {labResult.facility ||
                            t('shared:labels.notSpecified', 'Not specified')}
                        </Text>
                      </Stack>
                    </SimpleGrid>
                  </div>

                  {/* Test Results Section */}
                  <div>
                    <Title order={4} mb="sm">
                      {t(
                        'labresults:modal.sections.testResults',
                        'Test Results'
                      )}
                    </Title>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      <Stack gap="xs">
                        <Text fw={600} size="sm" c="dimmed">
                          {t('shared:fields.status', 'Status')}
                        </Text>
                        <StatusBadge status={labResult.status} />
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={600} size="sm" c="dimmed">
                          {t('shared:labels.labResult', 'Lab Result')}
                        </Text>
                        {labResult.labs_result ? (
                          <StatusBadge status={labResult.labs_result} />
                        ) : (
                          <Text c="dimmed">
                            {t('shared:labels.notSpecified', 'Not specified')}
                          </Text>
                        )}
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={600} size="sm" c="dimmed">
                          {t('shared:labels.orderedDate', 'Ordered Date')}
                        </Text>
                        <Text>{formatDate(labResult.ordered_date)}</Text>
                      </Stack>
                      <Stack gap="xs">
                        <Text fw={600} size="sm" c="dimmed">
                          {t('shared:labels.completedDate', 'Completed Date')}
                        </Text>
                        <Text
                          c={labResult.completed_date ? 'inherit' : 'dimmed'}
                        >
                          {labResult.completed_date
                            ? formatDate(labResult.completed_date)
                            : t('labels.notCompleted', 'Not completed')}
                        </Text>
                      </Stack>
                    </SimpleGrid>
                  </div>

                  {/* Practitioner Information Section */}
                  <div>
                    <Title order={4} mb="sm">
                      {t(
                        'shared:labels.orderingPractitioner',
                        'Ordering Practitioner'
                      )}
                    </Title>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      <Stack gap="xs">
                        <Text fw={600} size="sm" c="dimmed">
                          {t('shared:labels.doctor', 'Doctor')}
                        </Text>
                        <Text
                          c={labResult.practitioner_id ? 'inherit' : 'dimmed'}
                        >
                          {labResult.practitioner_id
                            ? practitioner?.name ||
                              `Practitioner ID: ${labResult.practitioner_id}`
                            : t('shared:labels.notSpecified', 'Not specified')}
                        </Text>
                      </Stack>
                      {practitioner?.specialty && (
                        <Stack gap="xs">
                          <Text fw={600} size="sm" c="dimmed">
                            {t('shared:labels.specialty', 'Specialty')}
                          </Text>
                          <Text>{practitioner.specialty}</Text>
                        </Stack>
                      )}
                    </SimpleGrid>
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
                  isViewMode={disableEdit}
                  onError={handleTestComponentsError}
                  onLabResultUpdated={onLabResultUpdated}
                />
              </Box>
            </Tabs.Panel>

            {/* Related Conditions Tab */}
            {fetchLabResultConditions && (
              <Tabs.Panel value="conditions">
                <Box mt="md">
                  <ConditionRelationships
                    key={`conditions-${labResult.id}`}
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

            {/* Encounters/Visits Tab */}
            {fetchLabResultEncounters && (
              <Tabs.Panel value="encounters">
                <Box mt="md">
                  <LabResultEncounterRelationships
                    key={`encounters-${labResult.id}`}
                    labResultId={labResult.id}
                    labResultEncounters={labResultEncounters}
                    encounters={encounters}
                    fetchLabResultEncounters={fetchLabResultEncounters}
                    navigate={navigate}
                    isViewMode={disableEdit}
                  />
                </Box>
              </Tabs.Panel>
            )}

            {/* Notes Tab */}
            {labResult.notes && (
              <Tabs.Panel value="notes">
                <Box mt="md">
                  <Stack gap="md">
                    <Title order={4}>{t('shared:tabs.notes', 'Notes')}</Title>
                    <Paper withBorder p="sm" bg="var(--color-bg-secondary)">
                      <ScrollArea.Autosize mah={400}>
                        <Text style={{ whiteSpace: 'pre-wrap' }}>
                          {labResult.notes}
                        </Text>
                      </ScrollArea.Autosize>
                    </Paper>
                  </Stack>
                </Box>
              </Tabs.Panel>
            )}

            {/* Tags Tab */}
            {labResult.tags && labResult.tags.length > 0 && (
              <Tabs.Panel value="tags">
                <Box mt="md">
                  <Stack gap="md">
                    <Title order={4}>{t('shared:labels.tags', 'Tags')}</Title>
                    <Group gap="xs">
                      {labResult.tags.map((tag, index) => (
                        <ClickableTagBadge
                          key={index}
                          tag={tag}
                          color={getTagColor(tag)}
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
                  <Title order={4}>
                    {t(
                      'labresults:modal.sections.associatedFiles',
                      'Associated Documents'
                    )}
                  </Title>
                  <DocumentManagerWithProgress
                    entityType="lab-result"
                    entityId={labResult.id}
                    mode="view"
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
              {t('shared:labels.close', 'Close')}
            </Button>
            <Tooltip
              label={disableEditTooltip}
              disabled={!disableEdit || !disableEditTooltip}
            >
              <span>
                <Button
                  onClick={() => {
                    onClose();
                    onEdit(labResult);
                  }}
                  disabled={disableEdit}
                >
                  {t('labresults:modal.editLabResult', 'Edit Lab Result')}
                </Button>
              </span>
            </Tooltip>
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
