import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Paper,
  Timeline,
  Text,
  Badge,
  Group,
  Stack,
  Select,
  Title,
  Loader,
  Center,
  Modal,
  Button,
  Divider,
} from '@mantine/core';
import { IconStethoscope, IconEye } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { symptomApi } from '../../services/api/symptomApi';
import { SymptomViewModal } from './symptoms';
import logger from '../../services/logger';
import {
  SYMPTOM_SEVERITY_COLORS,
  SYMPTOM_STATUS_COLORS,
  SYMPTOM_SEVERITY_ORDER,
} from '../../constants/symptomEnums';

/**
 * SymptomTimeline Component
 * Displays a timeline of symptom occurrences (episodes) with date range filtering
 * Uses the new two-level hierarchy API
 */
const SymptomTimeline = ({ patientId, hidden }) => {
  const { t } = useTranslation('common');
  const [timelineData, setTimelineData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('all');
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedOccurrences, setSelectedOccurrences] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewingSymptom, setViewingSymptom] = useState(null);

  const fetchTimelineData = useCallback(async () => {
    try {
      setLoading(true);

      // Calculate date range
      let startDateParam = null;
      let endDateParam = null;

      if (dateRange !== 'all') {
        const endDate = new Date();
        const startDate = new Date();

        switch (dateRange) {
          case 'week':
            startDate.setDate(startDate.getDate() - 7);
            break;
          case 'month':
            startDate.setMonth(startDate.getMonth() - 1);
            break;
          case '3months':
            startDate.setMonth(startDate.getMonth() - 3);
            break;
          case 'year':
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
          default:
            startDate.setMonth(startDate.getMonth() - 1);
        }

        startDateParam = startDate.toISOString().split('T')[0];
        endDateParam = endDate.toISOString().split('T')[0];
      }

      logger.debug('symptom_timeline_fetch', {
        patientId,
        startDate: startDateParam || 'all',
        endDate: endDateParam || 'all',
        component: 'SymptomTimeline',
      });

      const data = await symptomApi.getTimeline(
        patientId,
        startDateParam,
        endDateParam
      );

      setTimelineData(data || []);

      logger.info('symptom_timeline_fetch_success', {
        count: data?.length || 0,
        component: 'SymptomTimeline',
      });
    } catch (error) {
      logger.error('symptom_timeline_fetch_error', {
        error: error.message,
        component: 'SymptomTimeline',
      });
      setTimelineData([]);
    } finally {
      setLoading(false);
    }
  }, [patientId, dateRange]);

  useEffect(() => {
    // Only fetch data when component becomes visible
    if (patientId && !hidden) {
      fetchTimelineData();
    }
  }, [patientId, hidden, fetchTimelineData]);

  const handleTimelineClick = date => {
    setSelectedDate(date);

    // Filter occurrences for selected date
    const occurrencesOnDate = timelineData.filter(item => item.date === date);
    setSelectedOccurrences(occurrencesOnDate);
    setModalOpen(true);
  };

  const handleViewSymptom = async symptomId => {
    try {
      const symptom = await symptomApi.getById(symptomId);
      setViewingSymptom(symptom);
      setViewModalOpen(true);
      setModalOpen(false); // Close occurrences modal
    } catch (error) {
      logger.error('symptom_view_error', {
        error: error.message,
        symptomId,
        component: 'SymptomTimeline',
      });
    }
  };

  const handleCloseViewModal = () => {
    setViewModalOpen(false);
    setViewingSymptom(null);
    setModalOpen(true); // Reopen occurrences modal
  };

  // Memoize timeline grouping and sorting - expensive operation
  const timelineEntries = useMemo(() => {
    // Group timeline data by date
    const groupedData = timelineData.reduce((acc, item) => {
      const date = item.date;
      if (!acc[date]) {
        acc[date] = {
          date,
          occurrences: [],
          maxSeverity: item.severity,
        };
      }
      acc[date].occurrences.push(item);

      // Track highest severity for the day
      if (SYMPTOM_SEVERITY_ORDER[item.severity] > SYMPTOM_SEVERITY_ORDER[acc[date].maxSeverity]) {
        acc[date].maxSeverity = item.severity;
      }

      return acc;
    }, {});

    return Object.values(groupedData).sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
  }, [timelineData]);

  // Don't render anything when hidden (keep state but save render cost)
  if (hidden) {
    return null;
  }

  if (loading) {
    return (
      <Paper p="md" withBorder>
        <Center>
          <Loader />
        </Center>
      </Paper>
    );
  }

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={3}>{t('symptoms.timeline.title', 'Symptom Timeline')}</Title>
        <Select
          value={dateRange}
          onChange={setDateRange}
          data={[
            { value: 'all', label: t('symptoms.timeline.filters.allDates', 'All Dates') },
            { value: 'week', label: t('symptoms.timeline.filters.lastWeek', 'Last Week') },
            { value: 'month', label: t('symptoms.timeline.filters.lastMonth', 'Last Month') },
            { value: '3months', label: t('symptoms.timeline.filters.last3Months', 'Last 3 Months') },
            { value: 'year', label: t('symptoms.timeline.filters.lastYear', 'Last Year') },
          ]}
          style={{ width: 150 }}
        />
      </Group>

      {timelineEntries.length === 0 ? (
        <Center p="xl">
          <Stack align="center">
            <IconStethoscope size={48} stroke={1.5} color="gray" />
            <Text c="dimmed">{t('symptoms.timeline.noEpisodes', 'No symptom episodes recorded in this period')}</Text>
          </Stack>
        </Center>
      ) : (
        <Timeline active={-1} bulletSize={24} lineWidth={2}>
          {timelineEntries.map((entry, index) => (
            <Timeline.Item
              key={index}
              bullet={<IconStethoscope size={12} />}
              title={
                <Group gap="xs">
                  <Text fw={500}>
                    {new Date(entry.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                  <Badge color={SYMPTOM_SEVERITY_COLORS[entry.maxSeverity]} size="sm">
                    {entry.maxSeverity}
                  </Badge>
                </Group>
              }
              style={{ cursor: 'pointer' }}
              onClick={() => handleTimelineClick(entry.date)}
            >
              <Text c="dimmed" size="sm">
                {entry.occurrences.length} episode
                {entry.occurrences.length !== 1 ? 's' : ''} recorded
              </Text>
              {entry.occurrences.length <= 3 && (
                <Group gap="xs" mt="xs">
                  {entry.occurrences.map((occ, idx) => (
                    <Badge key={idx} size="xs" variant="dot">
                      {occ.symptom_name}
                    </Badge>
                  ))}
                </Group>
              )}
            </Timeline.Item>
          ))}
        </Timeline>
      )}

      {/* Occurrence Details Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Symptom Episodes on ${
          selectedDate
            ? new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
            : ''
        }`}
        size="lg"
      >
        {selectedOccurrences.length === 0 ? (
          <Text c="dimmed">No occurrences found for this date</Text>
        ) : (
          <Stack gap="md">
            {selectedOccurrences.map((occurrence, idx) => (
              <Paper key={idx} p="md" withBorder>
                <Stack gap="xs">
                  <Group gap="sm" justify="space-between">
                    <Group gap="sm">
                      <Text fw={600} size="lg">
                        {occurrence.symptom_name}
                      </Text>
                      <Badge
                        color={SYMPTOM_SEVERITY_COLORS[occurrence.severity]}
                        size="sm"
                        tt="uppercase"
                      >
                        {occurrence.severity}
                      </Badge>
                      {occurrence.pain_scale !== null &&
                        occurrence.pain_scale !== undefined && (
                          <Badge color="red" variant="outline" size="sm">
                            Pain: {occurrence.pain_scale}/10
                          </Badge>
                        )}
                    </Group>
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconEye size={14} />}
                      onClick={() => handleViewSymptom(occurrence.symptom_id)}
                    >
                      View Symptom
                    </Button>
                  </Group>

                  {occurrence.duration && (
                    <Text size="sm">
                      <strong>Duration:</strong> {occurrence.duration}
                    </Text>
                  )}
                  {occurrence.location && (
                    <Text size="sm">
                      <strong>Location:</strong> {occurrence.location}
                    </Text>
                  )}
                  {occurrence.time_of_day && (
                    <Text size="sm">
                      <strong>Time of Day:</strong> {occurrence.time_of_day}
                    </Text>
                  )}
                  {occurrence.resolved_date && (
                    <Text size="sm" c="green">
                      <strong>Resolved:</strong> {new Date(occurrence.resolved_date).toLocaleDateString()}
                    </Text>
                  )}
                  {!occurrence.resolved_date && (
                    <Badge size="sm" color="blue" variant="light">
                      Ongoing
                    </Badge>
                  )}
                  {occurrence.notes && (
                    <Text size="sm" c="dimmed">
                      {occurrence.notes}
                    </Text>
                  )}

                  <Divider />
                  <Text size="xs" c="dimmed">
                    Occurrence ID: {occurrence.occurrence_id}
                  </Text>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Modal>

      {/* Symptom View Modal */}
      {viewingSymptom && (
        <SymptomViewModal
          isOpen={viewModalOpen}
          onClose={handleCloseViewModal}
          symptom={viewingSymptom}
          onRefresh={fetchTimelineData}
        />
      )}
    </Paper>
  );
};

export default SymptomTimeline;
