import React, { useState, useEffect } from 'react';
import {
  Paper,
  Text,
  Group,
  Stack,
  Title,
  Loader,
  Center,
  Badge,
  SimpleGrid,
  Box,
  ActionIcon,
  Modal,
  Button,
  Divider,
} from '@mantine/core';
import {
  IconChevronLeft,
  IconChevronRight,
  IconStethoscope,
  IconEye,
} from '@tabler/icons-react';
import { symptomApi } from '../../services/api/symptomApi';
import { SymptomViewModal } from './symptoms';
import logger from '../../services/logger';
import {
  SYMPTOM_SEVERITY_COLORS,
  SYMPTOM_STATUS_COLORS,
} from '../../constants/symptomEnums';

/**
 * SymptomCalendar Component
 * Displays a monthly calendar view of symptom occurrences (episodes)
 * Uses the new two-level hierarchy API
 */
const SymptomCalendar = ({ patientId }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [occurrences, setOccurrences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [occurrencesByDate, setOccurrencesByDate] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedOccurrences, setSelectedOccurrences] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewingSymptom, setViewingSymptom] = useState(null);

  useEffect(() => {
    if (patientId) {
      fetchOccurrences();
    }
  }, [patientId, currentDate]);

  const fetchOccurrences = async () => {
    try {
      setLoading(true);

      // Get first and last day of current month
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      logger.debug('symptom_calendar_fetch', {
        patientId,
        startDate: firstDay.toISOString().split('T')[0],
        endDate: lastDay.toISOString().split('T')[0],
        component: 'SymptomCalendar',
      });

      const data = await symptomApi.getTimeline(
        patientId,
        firstDay.toISOString().split('T')[0],
        lastDay.toISOString().split('T')[0]
      );

      // Group by date - handle duration-based symptoms
      const grouped = {};
      (data || []).forEach(occurrence => {
        const startDate = occurrence.date;
        const endDate = occurrence.resolved_date;

        if (endDate) {
          // Duration-based symptom - mark all dates in range
          const start = new Date(startDate);
          const end = new Date(endDate);
          const current = new Date(start);

          while (current <= end) {
            const dateKey = current.toISOString().split('T')[0];
            if (!grouped[dateKey]) {
              grouped[dateKey] = [];
            }
            // Mark if this is the start, end, or middle of the duration
            grouped[dateKey].push({
              ...occurrence,
              isDuration: true,
              isStart: dateKey === startDate,
              isEnd: dateKey === endDate,
              isMid: dateKey !== startDate && dateKey !== endDate,
            });
            current.setDate(current.getDate() + 1);
          }
        } else {
          // Point-in-time or ongoing symptom
          if (!grouped[startDate]) {
            grouped[startDate] = [];
          }
          grouped[startDate].push({
            ...occurrence,
            isDuration: false,
            isOngoing: true, // Ongoing since no resolved_date
          });
        }
      });

      setOccurrences(data || []);
      setOccurrencesByDate(grouped);

      logger.info('symptom_calendar_fetch_success', {
        count: data?.length || 0,
        component: 'SymptomCalendar',
      });
    } catch (error) {
      logger.error('symptom_calendar_fetch_error', {
        error: error.message,
        component: 'SymptomCalendar',
      });
      setOccurrences([]);
      setOccurrencesByDate({});
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = date => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  };

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handleDateClick = day => {
    if (!day) return;

    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateKey = clickedDate.toISOString().split('T')[0];
    const occurrencesOnDate = occurrencesByDate[dateKey] || [];

    if (occurrencesOnDate.length > 0) {
      setSelectedDate(
        clickedDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      );
      setSelectedOccurrences(occurrencesOnDate);
      setModalOpen(true);
    }
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
        component: 'SymptomCalendar',
      });
    }
  };

  const handleCloseViewModal = () => {
    setViewModalOpen(false);
    setViewingSymptom(null);
    setModalOpen(true); // Reopen occurrences modal
  };

  const getDateKey = day => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return date.toISOString().split('T')[0];
  };

  const getSeverityColor = occurrences => {
    if (!occurrences || occurrences.length === 0) return null;

    const hasCritical = occurrences.some(o => o.severity === 'critical');
    const hasSevere = occurrences.some(o => o.severity === 'severe');
    const hasModerate = occurrences.some(o => o.severity === 'moderate');

    if (hasCritical) return 'red';
    if (hasSevere) return 'orange';
    if (hasModerate) return 'yellow';
    return 'green';
  };

  const monthName = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const days = getDaysInMonth(currentDate);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={3}>Symptom Calendar</Title>
          <Group gap="xs">
            <ActionIcon variant="subtle" onClick={handlePreviousMonth}>
              <IconChevronLeft size={18} />
            </ActionIcon>
            <Text fw={500} style={{ minWidth: 150, textAlign: 'center' }}>
              {monthName}
            </Text>
            <ActionIcon variant="subtle" onClick={handleNextMonth}>
              <IconChevronRight size={18} />
            </ActionIcon>
          </Group>
        </Group>

        <SimpleGrid cols={7} spacing="xs">
          {weekDays.map(day => (
            <Box key={day} style={{ textAlign: 'center' }}>
              <Text size="sm" fw={500} c="dimmed">
                {day}
              </Text>
            </Box>
          ))}

          {days.map((day, index) => {
            if (!day) {
              return <Box key={`empty-${index}`} />;
            }

            const dateKey = getDateKey(day);
            const occurrencesOnDate = occurrencesByDate[dateKey] || [];
            const hasOccurrences = occurrencesOnDate.length > 0;
            const severityColor = getSeverityColor(occurrencesOnDate);

            // Check if this day has duration-based symptoms
            const hasDuration = occurrencesOnDate.some(o => o.isDuration);
            const hasOngoing = occurrencesOnDate.some(o => o.isOngoing);
            const isStart = occurrencesOnDate.some(o => o.isStart);
            const isEnd = occurrencesOnDate.some(o => o.isEnd);
            const isMid = occurrencesOnDate.some(o => o.isMid);

            // Calculate unique symptom count (not duplicate occurrences across days)
            const uniqueSymptoms = new Set(
              occurrencesOnDate.map(o => o.symptom_id)
            ).size;

            return (
              <Box
                key={day}
                p="xs"
                style={{
                  border: '1px solid #e9ecef',
                  borderRadius: hasDuration
                    ? isMid
                      ? '0px'
                      : isStart
                      ? '4px 0px 0px 4px'
                      : isEnd
                      ? '0px 4px 4px 0px'
                      : '4px'
                    : '4px',
                  cursor: hasOccurrences ? 'pointer' : 'default',
                  backgroundColor: hasOccurrences
                    ? hasDuration
                      ? `var(--mantine-color-${severityColor}-1)`
                      : `var(--mantine-color-${severityColor}-0)`
                    : 'transparent',
                  position: 'relative',
                  minHeight: '60px',
                  borderLeft: hasDuration && !isStart ? 'none' : '1px solid #e9ecef',
                  borderRight: hasDuration && !isEnd ? 'none' : '1px solid #e9ecef',
                }}
                onClick={() => handleDateClick(day)}
              >
                <Stack gap={4} align="center">
                  <Text size="sm" fw={hasOccurrences ? 600 : 400}>
                    {day}
                  </Text>
                  {hasOccurrences && (
                    <Group gap={4} justify="center">
                      <Badge size="xs" color={severityColor}>
                        {uniqueSymptoms}
                      </Badge>
                      {hasOngoing && (
                        <Badge size="xs" color="blue" variant="dot">
                          Ongoing
                        </Badge>
                      )}
                    </Group>
                  )}
                </Stack>
              </Box>
            );
          })}
        </SimpleGrid>

        {Object.keys(occurrencesByDate).length === 0 && (
          <Center p="xl">
            <Stack align="center">
              <IconStethoscope size={48} stroke={1.5} color="gray" />
              <Text c="dimmed">No symptom episodes recorded this month</Text>
            </Stack>
          </Center>
        )}
      </Stack>

      {/* Occurrence Details Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`Symptom Episodes on ${selectedDate}`}
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
          onRefresh={fetchOccurrences}
        />
      )}
    </Paper>
  );
};

export default SymptomCalendar;
