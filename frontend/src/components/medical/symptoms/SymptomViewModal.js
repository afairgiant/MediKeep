import React, { useState, useEffect } from 'react';
import {
  Modal,
  Badge,
  Button,
  Group,
  Stack,
  Text,
  Title,
  Tabs,
  Box,
  SimpleGrid,
  Paper,
  Loader,
  Center,
  Table,
} from '@mantine/core';
import {
  IconInfoCircle,
  IconStethoscope,
  IconNotes,
  IconFileText,
  IconClockHour4,
  IconNote,
} from '@tabler/icons-react';
import { formatDate } from '../../../utils/helpers';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import logger from '../../../services/logger';
import { symptomApi } from '../../../services/api/symptomApi';
import {
  SYMPTOM_STATUS_COLORS,
  SYMPTOM_SEVERITY_COLORS,
} from '../../../constants/symptomEnums';

const SymptomViewModal = ({
  isOpen,
  onClose,
  symptom,
  onEdit,
  onDelete,
  onLogEpisode,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [occurrences, setOccurrences] = useState([]);
  const [loadingOccurrences, setLoadingOccurrences] = useState(false);

  // Reset tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
    }
  }, [isOpen, symptom?.id]);

  // Fetch occurrences when symptom changes or modal opens
  useEffect(() => {
    if (isOpen && symptom?.id) {
      fetchOccurrences();
    }
  }, [isOpen, symptom?.id]);

  const fetchOccurrences = async () => {
    if (!symptom?.id) return;

    try {
      setLoadingOccurrences(true);
      logger.debug('symptom_view_fetch_occurrences', {
        symptomId: symptom.id,
        component: 'SymptomViewModal',
      });

      const data = await symptomApi.getOccurrences(symptom.id);
      // Sort by occurrence_date descending (most recent first)
      const sortedData = (data || []).sort((a, b) => {
        const dateA = new Date(a.occurrence_date);
        const dateB = new Date(b.occurrence_date);
        return dateB - dateA;
      });
      setOccurrences(sortedData);

      logger.info('symptom_view_fetch_occurrences_success', {
        symptomId: symptom.id,
        count: sortedData.length,
        component: 'SymptomViewModal',
      });
    } catch (err) {
      logger.error('symptom_view_fetch_occurrences_error', {
        symptomId: symptom.id,
        error: err.message,
        component: 'SymptomViewModal',
      });
    } finally {
      setLoadingOccurrences(false);
    }
  };

  const handleDeleteOccurrence = async occurrenceId => {
    if (!window.confirm('Are you sure you want to delete this episode?')) {
      return;
    }

    try {
      await symptomApi.deleteOccurrence(symptom.id, occurrenceId);
      fetchOccurrences();
      if (onRefresh) onRefresh();
    } catch (err) {
      logger.error('delete_occurrence_error', {
        symptomId: symptom.id,
        occurrenceId,
        error: err.message,
        component: 'SymptomViewModal',
      });
    }
  };

  if (!symptom) return null;

  // Calculate occurrence statistics from actual occurrence dates
  const totalOccurrences = occurrences.length;
  const occurrenceDates = occurrences.map(o => new Date(o.occurrence_date));
  const firstOccurrenceDate = occurrenceDates.length > 0
    ? new Date(Math.min(...occurrenceDates))
    : null;
  const lastOccurrenceDate = occurrenceDates.length > 0
    ? new Date(Math.max(...occurrenceDates))
    : null;

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={`${symptom.symptom_name} - Details`}
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
        <Paper withBorder p="md" style={{ backgroundColor: '#f8f9fa' }}>
          <Group justify="space-between" align="center">
            <div>
              <Title order={3} mb="xs">
                {symptom.symptom_name}
              </Title>
              <Group gap="xs">
                <Badge
                  color={SYMPTOM_STATUS_COLORS[symptom.status]}
                  size="md"
                  variant="light"
                  tt="capitalize"
                >
                  {symptom.status}
                </Badge>
                {symptom.is_chronic && (
                  <Badge color="violet" size="md" variant="light">
                    Chronic
                  </Badge>
                )}
                {symptom.category && (
                  <Badge color="gray" size="md" variant="outline">
                    {symptom.category}
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
              Overview
            </Tabs.Tab>
            <Tabs.Tab value="occurrences" leftSection={<IconClockHour4 size={16} />}>
              Episodes ({occurrences.length})
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
                <div>
                  <Title order={4} mb="sm">
                    Basic Information
                  </Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">
                        Symptom Name
                      </Text>
                      <Text size="sm">{symptom.symptom_name}</Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">
                        Category
                      </Text>
                      <Text size="sm">{symptom.category || 'Not specified'}</Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">
                        Status
                      </Text>
                      <div>
                        <Badge
                          color={SYMPTOM_STATUS_COLORS[symptom.status]}
                          size="md"
                          tt="capitalize"
                        >
                          {symptom.status}
                        </Badge>
                      </div>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">
                        Type
                      </Text>
                      <div>
                        <Badge
                          color={symptom.is_chronic ? 'violet' : 'blue'}
                          size="md"
                          variant="light"
                        >
                          {symptom.is_chronic ? 'Chronic' : 'Acute'}
                        </Badge>
                      </div>
                    </Stack>
                  </SimpleGrid>
                </div>

                {/* Timeline Section */}
                <div>
                  <Title order={4} mb="sm">
                    Timeline
                  </Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">
                        First Occurrence
                      </Text>
                      <Text size="sm">
                        {firstOccurrenceDate
                          ? formatDate(firstOccurrenceDate)
                          : 'No episodes logged'}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">
                        Last Occurrence
                      </Text>
                      <Text size="sm" c={lastOccurrenceDate ? 'inherit' : 'dimmed'}>
                        {lastOccurrenceDate
                          ? formatDate(lastOccurrenceDate)
                          : 'No episodes logged'}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">
                        Total Episodes
                      </Text>
                      <Text size="sm" fw={500} c="blue">
                        {totalOccurrences} episode{totalOccurrences !== 1 ? 's' : ''}
                      </Text>
                    </Stack>
                  </SimpleGrid>
                </div>

                {/* Common Triggers */}
                {symptom.typical_triggers && symptom.typical_triggers.length > 0 && (
                  <div>
                    <Title order={4} mb="sm">
                      Common Triggers
                    </Title>
                    <Group gap="xs">
                      {symptom.typical_triggers.map((trigger, index) => (
                        <Badge key={index} variant="light" color="orange" size="md">
                          {trigger}
                        </Badge>
                      ))}
                    </Group>
                  </div>
                )}

                {/* Tags Section */}
                {symptom.tags && symptom.tags.length > 0 && (
                  <div>
                    <Title order={4} mb="sm">
                      Tags
                    </Title>
                    <Group gap="xs">
                      {symptom.tags.map((tag, index) => (
                        <Badge key={index} variant="light" color="blue" size="md">
                          {tag}
                        </Badge>
                      ))}
                    </Group>
                  </div>
                )}
              </Stack>
            </Box>
          </Tabs.Panel>

          {/* Occurrences Tab */}
          <Tabs.Panel value="occurrences">
            <Box mt="md">
              <Stack gap="md">
                <Group justify="space-between">
                  <Title order={4}>Episode History</Title>
                  {onLogEpisode && (
                    <Button
                      size="xs"
                      leftSection={<IconNote size={14} />}
                      onClick={() => {
                        onClose();
                        setTimeout(() => onLogEpisode(symptom), 100);
                      }}
                    >
                      Log New Episode
                    </Button>
                  )}
                </Group>

                {loadingOccurrences ? (
                  <Center p="xl">
                    <Loader size="md" />
                  </Center>
                ) : occurrences.length === 0 ? (
                  <Paper p="xl" withBorder>
                    <Stack align="center" gap="md">
                      <IconStethoscope size={48} stroke={1.5} color="gray" />
                      <Text size="sm" c="dimmed">
                        No episodes logged yet
                      </Text>
                      {onLogEpisode && (
                        <Button
                          size="sm"
                          variant="light"
                          onClick={() => {
                            onClose();
                            setTimeout(() => onLogEpisode(symptom), 100);
                          }}
                        >
                          Log First Episode
                        </Button>
                      )}
                    </Stack>
                  </Paper>
                ) : (
                  <Stack gap="sm">
                    {occurrences.map(occurrence => (
                      <Paper key={occurrence.id} p="md" withBorder>
                        <Group justify="space-between" align="flex-start">
                          <Stack gap="xs" style={{ flex: 1 }}>
                            <Group gap="sm">
                              <Text fw={600} size="sm">
                                {formatDate(occurrence.occurrence_date)}
                              </Text>
                              <Badge
                                color={SYMPTOM_SEVERITY_COLORS[occurrence.severity]}
                                size="sm"
                              >
                                {occurrence.severity}
                              </Badge>
                              {occurrence.pain_scale !== null && (
                                <Badge color="red" variant="outline" size="sm">
                                  Pain: {occurrence.pain_scale}/10
                                </Badge>
                              )}
                            </Group>

                            {occurrence.time_of_day && (
                              <Text size="xs" c="dimmed">
                                Time: {occurrence.time_of_day}
                              </Text>
                            )}

                            {occurrence.duration && (
                              <Text size="xs" c="dimmed">
                                Duration: {occurrence.duration}
                              </Text>
                            )}

                            {occurrence.location && (
                              <Text size="xs" c="dimmed">
                                Location: {occurrence.location}
                              </Text>
                            )}

                            {occurrence.impact_level && (
                              <Text size="xs" c="dimmed">
                                Impact: {occurrence.impact_level.replace('_', ' ')}
                              </Text>
                            )}

                            {occurrence.triggers && occurrence.triggers.length > 0 && (
                              <Group gap="xs">
                                <Text size="xs" c="dimmed">
                                  Triggers:
                                </Text>
                                {occurrence.triggers.map((trigger, idx) => (
                                  <Badge key={idx} size="xs" variant="dot">
                                    {trigger}
                                  </Badge>
                                ))}
                              </Group>
                            )}

                            {occurrence.relief_methods && occurrence.relief_methods.length > 0 && (
                              <Group gap="xs">
                                <Text size="xs" c="dimmed">
                                  Relief:
                                </Text>
                                {occurrence.relief_methods.map((method, idx) => (
                                  <Badge key={idx} size="xs" color="green" variant="dot">
                                    {method}
                                  </Badge>
                                ))}
                              </Group>
                            )}

                            {occurrence.notes && (
                              <Text size="xs" lineClamp={2}>
                                {occurrence.notes}
                              </Text>
                            )}
                          </Stack>

                          <Button
                            size="xs"
                            variant="light"
                            color="red"
                            onClick={() => handleDeleteOccurrence(occurrence.id)}
                          >
                            Delete
                          </Button>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Box>
          </Tabs.Panel>

          {/* Notes Tab */}
          <Tabs.Panel value="notes">
            <Box mt="md">
              <Stack gap="lg">
                <div>
                  <Title order={4} mb="sm">
                    General Notes
                  </Title>
                  <Paper withBorder p="md" bg="gray.1">
                    <Text
                      size="sm"
                      style={{ whiteSpace: 'pre-wrap' }}
                      c={symptom.general_notes ? 'inherit' : 'dimmed'}
                    >
                      {symptom.general_notes || 'No notes provided'}
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
                  entityType="symptom"
                  entityId={symptom.id}
                  mode="view"
                  config={{
                    acceptedTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'],
                    maxSize: 10 * 1024 * 1024,
                    maxFiles: 10,
                  }}
                  onError={error => {
                    logger.error('Document manager error in symptom view:', error);
                  }}
                  showProgressModal={true}
                />
              </Stack>
            </Box>
          </Tabs.Panel>
        </Tabs>

        {/* Action Buttons */}
        <Group justify="flex-end" mt="md">
          {onDelete && (
            <Button
              variant="light"
              color="red"
              onClick={() => {
                onClose();
                setTimeout(() => {
                  onDelete(symptom.id);
                }, 100);
              }}
            >
              Delete Symptom
            </Button>
          )}
          {onEdit && (
            <Button
              variant="light"
              onClick={() => {
                onClose();
                setTimeout(() => {
                  onEdit(symptom);
                }, 100);
              }}
            >
              Edit Symptom
            </Button>
          )}
          {onLogEpisode && (
            <Button
              variant="filled"
              color="green"
              leftSection={<IconNote size={16} />}
              onClick={() => {
                onClose();
                setTimeout(() => onLogEpisode(symptom), 100);
              }}
            >
              Log Episode
            </Button>
          )}
          <Button variant="filled" onClick={onClose}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default SymptomViewModal;
