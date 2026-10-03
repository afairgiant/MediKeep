import type { ReactNode } from 'react';
import { Badge, Group, Stack, Text } from '@mantine/core';
import type { MantineSize } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { formatTimeToAmPm } from '../../../utils/dateUtils';
import { OCCURRENCE_IMPACT_LABEL_KEYS } from '../../../utils/medicalFormFields/symptomOccurrence';
import type { TimelineDataPoint } from '../../../services/api/symptomApi';

export type OccurrenceDetails = Partial<
  Pick<
    TimelineDataPoint,
    | 'occurrence_time'
    | 'duration'
    | 'location'
    | 'impact_level'
    | 'triggers'
    | 'relief_methods'
    | 'associated_symptoms'
    | 'resolved_date'
    | 'resolved_time'
    | 'resolution_notes'
    | 'notes'
  >
>;

interface DateFormatHook {
  formatDate: (_date: string) => string;
}

interface OccurrenceFieldsProps {
  occurrence: OccurrenceDetails;
  size?: MantineSize;
}

/**
 * Detail rows for one symptom episode; a row renders only when its field has a value.
 */
function OccurrenceFields({ occurrence, size = 'sm' }: OccurrenceFieldsProps) {
  const { t } = useTranslation(['common', 'shared', 'medical']);
  const { formatDate } = useDateFormat() as DateFormatHook;

  const textRow = (label: string, value: ReactNode, preserveLines = false) => (
    <Text
      size={size}
      style={preserveLines ? { whiteSpace: 'pre-wrap' } : undefined}
    >
      <Text span fw={600} c="dimmed">
        {label}:
      </Text>{' '}
      {value}
    </Text>
  );

  const badgeRow = (label: string, items?: string[] | null, color?: string) =>
    items && items.length > 0 ? (
      <Group gap="xs">
        <Text size={size} fw={600} c="dimmed">
          {label}:
        </Text>
        {items.map(item => (
          <Badge key={item} size="xs" color={color} variant="dot">
            {item}
          </Badge>
        ))}
      </Group>
    ) : null;

  const impact = occurrence.impact_level;
  const impactKey =
    impact && (OCCURRENCE_IMPACT_LABEL_KEYS as Record<string, string>)[impact];
  const impactFallback = impact?.replace(/_/g, ' ') ?? '';

  const resolved = [
    occurrence.resolved_date ? formatDate(occurrence.resolved_date) : null,
    occurrence.resolved_time
      ? formatTimeToAmPm(occurrence.resolved_time)
      : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Stack gap={4}>
      {occurrence.occurrence_time &&
        textRow(
          t('shared:labels.time', 'Time'),
          formatTimeToAmPm(occurrence.occurrence_time)
        )}
      {occurrence.duration &&
        textRow(t('shared:labels.duration', 'Duration'), occurrence.duration)}
      {occurrence.location &&
        textRow(t('shared:labels.location', 'Location'), occurrence.location)}
      {impact &&
        textRow(
          t('symptoms.viewModal.impact', 'Impact'),
          impactKey ? t(impactKey as never, impactFallback) : impactFallback
        )}
      {badgeRow(
        t('symptoms.viewModal.triggers', 'Triggers'),
        occurrence.triggers
      )}
      {badgeRow(
        t('symptoms.viewModal.relief', 'Relief'),
        occurrence.relief_methods,
        'green'
      )}
      {badgeRow(
        t(
          'medical:symptoms.occurrence.associatedSymptoms.label',
          'Associated Symptoms'
        ),
        occurrence.associated_symptoms,
        'grape'
      )}
      {resolved && textRow(t('shared:labels.resolved', 'Resolved'), resolved)}
      {occurrence.resolution_notes &&
        textRow(
          t(
            'medical:symptoms.occurrence.resolutionNotes.label',
            'Resolution Notes'
          ),
          occurrence.resolution_notes,
          true
        )}
      {occurrence.notes &&
        textRow(
          t('shared:fields.additionalNotes', 'Additional Notes'),
          occurrence.notes,
          true
        )}
    </Stack>
  );
}

export default OccurrenceFields;
