import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
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
  Tooltip,
  Pagination,
} from '@mantine/core';
import {
  IconInfoCircle,
  IconStethoscope,
  IconNotes,
  IconFileText,
  IconClockHour4,
  IconNote,
  IconEdit,
  IconTrash,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useDateFormat } from '../../../hooks/useDateFormat';
import DocumentManagerWithProgress from '../../shared/DocumentManagerWithProgress';
import OccurrenceFields from './OccurrenceFields';
import logger from '../../../services/logger';
import { symptomApi } from '../../../services/api/symptomApi';
import {
  SYMPTOM_STATUS_COLORS,
  SYMPTOM_SEVERITY_COLORS,
} from '../../../constants/symptomEnums';
import RecordVisitsTab from '../../shared/RecordVisitsTab';
import { rememberEditTab } from '../../../utils/editTabHandoff';
import RecordVisitsTabButton from '../../shared/RecordVisitsTabButton';
import { OCCURRENCE_SEVERITY_LABEL_KEYS } from '../../../utils/medicalFormFields/symptomOccurrence';
import { usePagination } from '../../../hooks/usePagination';

const SymptomViewModal = ({
  navigate,
  isOpen,
  onClose,
  symptom,
  onEdit,
  onDelete,
  onLogEpisode,
  onEditOccurrence,
  onRefresh,
  disableEdit = false,
  disableEditTooltip,
}) => {
  const { t } = useTranslation(['common', 'shared', 'medical']);
  const { formatDate } = useDateFormat();
  const [activeTab, setActiveTab] = useState('overview');
  const { page, setPage, paginateData, totalPages, resetPage, clampPage } =
    usePagination();
  const [occurrences, setOccurrences] = useState([]);
  const [loadingOccurrences, setLoadingOccurrences] = useState(false);

  // Reset tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
      resetPage();
    }
  }, [isOpen, symptom?.id, resetPage]);

  useEffect(() => {
    clampPage(occurrences.length);
  }, [occurrences.length, clampPage]);

  // Fetch occurrences when symptom changes or modal opens
  useEffect(() => {
    if (isOpen && symptom?.id) {
      fetchOccurrences();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchOccurrences is stable in component scope; only re-fetch when modal opens or symptom changes
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
      // Data is already sorted by backend (occurrence_date DESC)
      setOccurrences(data || []);

      logger.info('symptom_view_fetch_occurrences_success', {
        symptomId: symptom.id,
        count: data?.length || 0,
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
    if (
      !window.confirm(
        t(
          'symptoms.viewModal.confirmDeleteEpisode',
          'Are you sure you want to delete this episode?'
        )
      )
    ) {
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
  const firstOccurrenceDate =
    occurrenceDates.length > 0 ? new Date(Math.min(...occurrenceDates)) : null;
  const lastOccurrenceDate =
    occurrenceDates.length > 0 ? new Date(Math.max(...occurrenceDates)) : null;

  const episodePageCount = totalPages(totalOccurrences);
  const visibleOccurrences = paginateData(occurrences);

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={t('symptoms.viewModal.title', '{{name}} - Details', {
        name: symptom.symptom_name,
      })}
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
                    {t('symptoms.chronic', 'Chronic')}
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
            <Tabs.Tab
              value="overview"
              leftSection={<IconInfoCircle size={16} />}
            >
              {t('shared:tabs.overview', 'Overview')}
            </Tabs.Tab>
            <Tabs.Tab
              value="occurrences"
              leftSection={<IconClockHour4 size={16} />}
            >
              {t('shared:tabs.episodesCount', 'Episodes ({{count}})', {
                count: occurrences.length,
              })}
            </Tabs.Tab>
            <RecordVisitsTabButton recordType="symptoms" recordId={symptom.id} />
            <Tabs.Tab
              value="documents"
              leftSection={<IconFileText size={16} />}
            >
              {t('shared:tabs.documents', 'Documents')}
            </Tabs.Tab>
            <Tabs.Tab value="notes" leftSection={<IconNotes size={16} />}>
              {t('shared:tabs.notes', 'Notes')}
            </Tabs.Tab>
          </Tabs.List>

          {/* Overview Tab */}
          <Tabs.Panel value="overview">
            <Box mt="md">
              <Stack gap="lg">
                <div>
                  <Title order={4} mb="sm">
                    {t('shared:labels.basicInformation', 'Basic Information')}
                  </Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">
                        {t('shared:labels.symptomName', 'Symptom Name')}
                      </Text>
                      <Text size="sm">{symptom.symptom_name}</Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">
                        {t('shared:labels.category', 'Category')}
                      </Text>
                      <Text size="sm">
                        {symptom.category ||
                          t('shared:labels.notSpecified', 'Not specified')}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">
                        {t('shared:fields.status', 'Status')}
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
                        {t('shared:labels.type', 'Type')}
                      </Text>
                      <div>
                        <Badge
                          color={symptom.is_chronic ? 'violet' : 'blue'}
                          size="md"
                          variant="light"
                        >
                          {symptom.is_chronic
                            ? t('symptoms.chronic', 'Chronic')
                            : t('symptoms.viewModal.acute', 'Acute')}
                        </Badge>
                      </div>
                    </Stack>
                  </SimpleGrid>
                </div>

                {/* Timeline Section */}
                <div>
                  <Title order={4} mb="sm">
                    {t('shared:labels.timeline', 'Timeline')}
                  </Title>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">
                        {t('symptoms.first', 'First Occurrence')}
                      </Text>
                      <Text size="sm">
                        {firstOccurrenceDate
                          ? formatDate(firstOccurrenceDate)
                          : t(
                              'symptoms.viewModal.noEpisodesLogged',
                              'No episodes logged'
                            )}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">
                        {t('symptoms.last', 'Last Occurrence')}
                      </Text>
                      <Text
                        size="sm"
                        c={lastOccurrenceDate ? 'inherit' : 'dimmed'}
                      >
                        {lastOccurrenceDate
                          ? formatDate(lastOccurrenceDate)
                          : t(
                              'symptoms.viewModal.noEpisodesLogged',
                              'No episodes logged'
                            )}
                      </Text>
                    </Stack>
                    <Stack gap="xs">
                      <Text fw={500} size="sm" c="dimmed">
                        {t(
                          'symptoms.viewModal.totalEpisodes',
                          'Total Episodes'
                        )}
                      </Text>
                      <Text size="sm" fw={500} c="blue">
                        {totalOccurrences}{' '}
                        {totalOccurrences === 1
                          ? t('symptoms.episode', 'episode')
                          : t('symptoms.episodes', 'episodes')}
                      </Text>
                    </Stack>
                  </SimpleGrid>
                </div>

                {/* Common Triggers */}
                {symptom.typical_triggers &&
                  symptom.typical_triggers.length > 0 && (
                    <div>
                      <Title order={4} mb="sm">
                        {t('symptoms.commonTriggers', 'Common Triggers')}
                      </Title>
                      <Group gap="xs">
                        {symptom.typical_triggers.map((trigger, index) => (
                          <Badge
                            key={index}
                            variant="light"
                            color="orange"
                            size="md"
                          >
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
                      {t('shared:labels.tags', 'Tags')}
                    </Title>
                    <Group gap="xs">
                      {symptom.tags.map((tag, index) => (
                        <Badge
                          key={index}
                          variant="light"
                          color="blue"
                          size="md"
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

          {/* Occurrences Tab */}
          <Tabs.Panel value="occurrences">
            <Box mt="md">
              <Stack gap="md">
                <Group justify="space-between">
                  <Title order={4}>
                    {t('symptoms.viewModal.episodeHistory', 'Episode History')}
                  </Title>
                  {onLogEpisode && !disableEdit && (
                    <Button
                      size="xs"
                      leftSection={<IconNote size={14} />}
                      onClick={() => {
                        onClose();
                        setTimeout(() => onLogEpisode(symptom), 100);
                      }}
                    >
                      {t('symptoms.viewModal.logNewEpisode', 'Log New Episode')}
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
                        {t(
                          'symptoms.viewModal.noEpisodesYet',
                          'No episodes logged yet'
                        )}
                      </Text>
                      {onLogEpisode && !disableEdit && (
                        <Button
                          size="sm"
                          variant="light"
                          onClick={() => {
                            onClose();
                            setTimeout(() => onLogEpisode(symptom), 100);
                          }}
                        >
                          {t(
                            'symptoms.viewModal.logFirstEpisode',
                            'Log First Episode'
                          )}
                        </Button>
                      )}
                    </Stack>
                  </Paper>
                ) : (
                  <Stack gap="sm">
                    {visibleOccurrences.map(occurrence => (
                      <Paper key={occurrence.id} p="md" withBorder>
                        <Group justify="space-between" align="flex-start">
                          <Stack gap="xs" style={{ flex: 1 }}>
                            <Group gap="sm">
                              <Text fw={600} size="sm">
                                {formatDate(occurrence.occurrence_date)}
                              </Text>
                              <Badge
                                color={
                                  SYMPTOM_SEVERITY_COLORS[occurrence.severity]
                                }
                                size="sm"
                              >
                                {t(
                                  OCCURRENCE_SEVERITY_LABEL_KEYS[
                                    occurrence.severity
                                  ],
                                  occurrence.severity
                                )}
                              </Badge>
                              {occurrence.pain_scale !== null && (
                                <Badge color="red" variant="outline" size="sm">
                                  {t('symptoms.calendar.pain', 'Pain')}:{' '}
                                  {occurrence.pain_scale}/10
                                </Badge>
                              )}
                            </Group>

                            <OccurrenceFields
                              occurrence={occurrence}
                              size="xs"
                            />
                          </Stack>

                          <Group gap="xs">
                            {onEditOccurrence && !disableEdit && (
                              <Button
                                size="xs"
                                variant="light"
                                leftSection={<IconEdit size={14} />}
                                onClick={() => {
                                  onClose();
                                  setTimeout(
                                    () => onEditOccurrence(symptom, occurrence),
                                    100
                                  );
                                }}
                              >
                                {t('shared:labels.edit', 'Edit')}
                              </Button>
                            )}
                            {!disableEdit && (
                              <Button
                                size="xs"
                                variant="light"
                                color="red"
                                leftSection={<IconTrash size={14} />}
                                onClick={() =>
                                  handleDeleteOccurrence(occurrence.id)
                                }
                              >
                                {t('buttons.delete', 'Delete')}
                              </Button>
                            )}
                          </Group>
                        </Group>
                      </Paper>
                    ))}
                    {episodePageCount > 1 && (
                      <Center>
                        <Pagination
                          total={episodePageCount}
                          value={page}
                          onChange={setPage}
                          size="sm"
                        />
                      </Center>
                    )}
                  </Stack>
                )}
              </Stack>
            </Box>
          </Tabs.Panel>

          {/* Visits Tab */}
          <Tabs.Panel value="visits">
            <Box mt="md">
              {activeTab === 'visits' && (
                <RecordVisitsTab
                  recordType="symptoms"
                  recordId={symptom.id}
                  isViewMode
                  navigate={navigate}
                />
              )}
            </Box>
          </Tabs.Panel>

          {/* Notes Tab */}
          <Tabs.Panel value="notes">
            <Box mt="md">
              <Stack gap="lg">
                <div>
                  <Title order={4} mb="sm">
                    {t('symptoms.viewModal.generalNotes', 'General Notes')}
                  </Title>
                  <Paper withBorder p="md" bg="var(--color-bg-secondary)">
                    <Text
                      size="sm"
                      style={{ whiteSpace: 'pre-wrap' }}
                      c={symptom.general_notes ? 'inherit' : 'dimmed'}
                    >
                      {symptom.general_notes ||
                        t(
                          'symptoms.viewModal.noNotesProvided',
                          'No notes provided'
                        )}
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
                <Title order={4}>
                  {t('shared:labels.attachedDocuments', 'Attached Documents')}
                </Title>
                <DocumentManagerWithProgress
                  entityType="symptom"
                  entityId={symptom.id}
                  mode="view"
                  onError={error => {
                    logger.error(
                      'Document manager error in symptom view:',
                      error
                    );
                  }}
                  showProgressModal={true}
                />
              </Stack>
            </Box>
          </Tabs.Panel>
        </Tabs>

        {/* Action Buttons */}
        <Group justify="flex-end" mt="md">
          {onDelete && !disableEdit && (
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
              {t('symptoms.viewModal.deleteSymptom', 'Delete Symptom')}
            </Button>
          )}
          {onEdit && (
            <Tooltip
              label={disableEditTooltip}
              disabled={!disableEdit || !disableEditTooltip}
            >
              <span>
                <Button
                  variant="light"
                  onClick={() => {
                    rememberEditTab('symptoms', activeTab);
                    onClose();
                    setTimeout(() => {
                      onEdit(symptom);
                    }, 100);
                  }}
                  disabled={disableEdit}
                >
                  {t('symptoms.viewModal.editSymptom', 'Edit Symptom')}
                </Button>
              </span>
            </Tooltip>
          )}
          {onLogEpisode && !disableEdit && (
            <Button
              variant="filled"
              color="green"
              leftSection={<IconNote size={16} />}
              onClick={() => {
                onClose();
                setTimeout(() => onLogEpisode(symptom), 100);
              }}
            >
              {t('symptoms.logEpisode', 'Log Episode')}
            </Button>
          )}
          <Button variant="filled" onClick={onClose}>
            {t('shared:labels.close', 'Close')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

SymptomViewModal.propTypes = {
  navigate: PropTypes.func,
};

export default SymptomViewModal;
