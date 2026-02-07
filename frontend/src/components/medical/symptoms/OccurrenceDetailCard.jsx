import React from 'react';
import {
  Paper,
  Text,
  Group,
  Stack,
  Badge,
  Button,
  Divider,
} from '@mantine/core';
import { IconEye } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { formatTimeToAmPm } from '../../../utils/dateUtils';
import { SYMPTOM_SEVERITY_COLORS } from '../../../constants/symptomEnums';
import { useDateFormat } from '../../../hooks/useDateFormat';

/**
 * Renders the resolved/ongoing status indicator for an occurrence.
 * Shows one of three states:
 * - Resolved date (green text with date) when resolved_date exists
 * - Resolved badge when parent symptom is resolved but no specific date
 * - Ongoing badge when parent symptom is not resolved
 */
function OccurrenceStatusIndicator({ occurrence, t, formatDate }) {
  if (occurrence.resolved_date) {
    return (
      <Text size="sm" c="green">
        <strong>{t('symptoms.calendar.resolved', 'Resolved')}:</strong> {formatDate(occurrence.resolved_date)}
      </Text>
    );
  }

  if (occurrence.symptom_status === 'resolved') {
    return (
      <Badge size="sm" color="green" variant="light">
        {t('symptoms.calendar.resolved', 'Resolved')}
      </Badge>
    );
  }

  return (
    <Badge size="sm" color="blue" variant="light">
      {t('symptoms.calendar.ongoing', 'Ongoing')}
    </Badge>
  );
}

/**
 * Shared card component for displaying occurrence details in modals.
 * Used by both SymptomCalendar and SymptomTimeline to avoid duplication.
 */
function OccurrenceDetailCard({ occurrence, onViewSymptom }) {
  const { t } = useTranslation('common');
  const { formatDate } = useDateFormat();

  return (
    <Paper p="md" withBorder>
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
                  {t('symptoms.calendar.pain', 'Pain')}: {occurrence.pain_scale}/10
                </Badge>
              )}
          </Group>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconEye size={14} />}
            onClick={() => onViewSymptom(occurrence.symptom_id)}
          >
            {t('symptoms.calendar.viewSymptom', 'View Symptom')}
          </Button>
        </Group>

        {occurrence.duration && (
          <Text size="sm">
            <strong>{t('symptoms.calendar.duration', 'Duration')}:</strong> {occurrence.duration}
          </Text>
        )}
        {occurrence.location && (
          <Text size="sm">
            <strong>{t('symptoms.calendar.location', 'Location')}:</strong> {occurrence.location}
          </Text>
        )}
        {occurrence.occurrence_time && (
          <Text size="sm">
            <strong>{t('symptoms.calendar.time', 'Time')}:</strong> {formatTimeToAmPm(occurrence.occurrence_time)}
          </Text>
        )}

        <OccurrenceStatusIndicator occurrence={occurrence} t={t} formatDate={formatDate} />

        {occurrence.notes && (
          <Text size="sm" c="dimmed">
            {occurrence.notes}
          </Text>
        )}

        <Divider />
        <Text size="xs" c="dimmed">
          {t('symptoms.calendar.occurrenceId', 'Occurrence ID')}: {occurrence.occurrence_id}
        </Text>
      </Stack>
    </Paper>
  );
}

export default OccurrenceDetailCard;
