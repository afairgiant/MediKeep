import React, { useState, useEffect } from 'react';
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
import { symptomApi } from '../../services/api/symptomApi';
import { SymptomViewModal } from './symptoms';
import logger from '../../services/logger';
import {
  SYMPTOM_SEVERITY_COLORS,
  SYMPTOM_STATUS_COLORS,
} from '../../constants/symptomEnums';

/**
 * SymptomTimeline Component
 * Displays a timeline of symptom occurrences (episodes) with date range filtering
 * Uses the new two-level hierarchy API
 */
const SymptomTimeline = ({ patientId }) => {
  const [timelineData, setTimelineData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('all');
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedOccurrences, setSelectedOccurrences] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewingSymptom, setViewingSymptom] = useState(null);

  useEffect(() => {
    if (patientId) {
      fetchTimelineData();
    }
  }, [patientId, dateRange]);

  const fetchTimelineData = async () => {
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
  };

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
    const severityOrder = { mild: 1, moderate: 2, severe: 3, critical: 4 };
    if (severityOrder[item.severity] > severityOrder[acc[date].maxSeverity]) {
      acc[date].maxSeverity = item.severity;
    }

    return acc;
  }, {});

  const timelineEntries = Object.values(groupedData).sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

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
        <Title order={3}>Symptom Timeline</Title>
        <Select
          value={dateRange}
          onChange={setDateRange}
          data={[
            { value: 'all', label: 'All Dates' },
            { value: 'week', label: 'Last Week' },
            { value: 'month', label: 'Last Month' },
            { value: '3months', label: 'Last 3 Months' },
            { value: 'year', label: 'Last Year' },
          ]}
          style={{ width: 150 }}
        />
      </Group>

      {timelineEntries.length === 0 ? (
        <Center p="xl">
          <Stack align="center">
            <IconStethoscope size={48} stroke={1.5} color="gray" />
            <Text c="dimmed">No symptom episodes recorded in this period</Text>
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
