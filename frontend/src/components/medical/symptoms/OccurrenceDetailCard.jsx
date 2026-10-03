import PropTypes from 'prop-types';
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
import { SYMPTOM_SEVERITY_COLORS } from '../../../constants/symptomEnums';
import { OCCURRENCE_SEVERITY_LABEL_KEYS } from '../../../utils/medicalFormFields/symptomOccurrence';
import OccurrenceFields from './OccurrenceFields';

/**
 * Shared card component for displaying occurrence details in modals.
 * Used by both SymptomCalendar and SymptomTimeline to avoid duplication.
 */
function OccurrenceDetailCard({ occurrence, onViewSymptom }) {
  const { t } = useTranslation(['common', 'shared']);
  const isSymptomResolved = occurrence.symptom_status === 'resolved';

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
            >
              {t(
                OCCURRENCE_SEVERITY_LABEL_KEYS[occurrence.severity],
                occurrence.severity
              )}
            </Badge>
            {occurrence.pain_scale !== null &&
              occurrence.pain_scale !== undefined && (
                <Badge color="red" variant="outline" size="sm">
                  {t('symptoms.calendar.pain', 'Pain')}: {occurrence.pain_scale}
                  /10
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

        <OccurrenceFields occurrence={occurrence} />

        {!occurrence.resolved_date && (
          <Group>
            <Badge
              size="sm"
              variant="light"
              color={isSymptomResolved ? 'green' : 'blue'}
            >
              {isSymptomResolved
                ? t('shared:labels.resolved', 'Resolved')
                : t('shared:labels.ongoing', 'Ongoing')}
            </Badge>
          </Group>
        )}

        <Divider />
        <Text size="xs" c="dimmed">
          {t('symptoms.calendar.occurrenceId', 'Occurrence ID')}:{' '}
          {occurrence.occurrence_id}
        </Text>
      </Stack>
    </Paper>
  );
}

OccurrenceDetailCard.propTypes = {
  occurrence: PropTypes.shape({
    occurrence_id: PropTypes.number,
    symptom_id: PropTypes.number,
    symptom_name: PropTypes.string,
    symptom_status: PropTypes.string,
    severity: PropTypes.string,
    pain_scale: PropTypes.number,
    resolved_date: PropTypes.string,
  }).isRequired,
  onViewSymptom: PropTypes.func.isRequired,
};

export default OccurrenceDetailCard;
