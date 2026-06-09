import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Group, Stack, Text, Badge } from '@mantine/core';
import { IconChevronRight, IconStack2 } from '@tabler/icons-react';
import { useDateFormat } from '../../../hooks/useDateFormat';
import StatusBadge from '../StatusBadge';

// useDateFormat is a JS hook without TS declarations
interface DateFormatHook {
  formatDate: (_dateValue: string | null | undefined) => string;
}

export interface LabResultGroup {
  key: string;
  test_name: string;
  results: LabResultSummary[];
  count: number;
  latest_date: string | null;
  earliest_date: string | null;
  latest_status: string | null;
}

export interface LabResultSummary {
  id: number;
  test_name: string;
  labs_result: string | null;
  ordered_date: string | null;
  completed_date: string | null;
  created_at?: string | null;
  notes: string | null;
  status: string | null;
  facility: string | null;
  test_category: string | null;
  value?: number | null;
  unit?: string | null;
  ref_range_min?: number | null;
  ref_range_max?: number | null;
  ref_range_text?: string | null;
  source?: 'individual' | 'component';
  parent_lab_result_id?: number | null;
  result_type?: string | null;
  qualitative_value?: string | null;
}

interface LabResultStackCardProps {
  group: LabResultGroup;
  onDrillDown: (_group: LabResultGroup) => void;
}

const LabResultStackCard: React.FC<LabResultStackCardProps> = ({
  group,
  onDrillDown,
}) => {
  const { t } = useTranslation(['labresults', 'shared']);
  const { formatDate } = useDateFormat() as DateFormatHook;

  const showDateRange =
    group.latest_date &&
    group.earliest_date &&
    group.latest_date !== group.earliest_date;

  const dateDisplay = showDateRange
    ? t('labresults:stackedView.dateRange', '{{from}} – {{to}}', {
        from: formatDate(group.earliest_date),
        to: formatDate(group.latest_date),
      })
    : group.latest_date
      ? formatDate(group.latest_date)
      : null;

  const latestResult = group.results[0] ?? null;

  const latestRange: string | null = (() => {
    if (!latestResult) return null;
    if (latestResult.ref_range_text) return latestResult.ref_range_text;
    const min = latestResult.ref_range_min;
    const max = latestResult.ref_range_max;
    if (min != null && max != null) return `${min}–${max}`;
    if (min != null) return `≥${min}`;
    if (max != null) return `≤${max}`;
    return null;
  })();

  return (
    <Card
      withBorder
      shadow="sm"
      radius="md"
      padding="md"
      style={{ cursor: 'pointer' }}
      onClick={() => onDrillDown(group)}
      role="button"
      tabIndex={0}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter') { onDrillDown(group); }
        if (e.key === ' ') { e.preventDefault(); onDrillDown(group); }
      }}
      data-testid="stack-card"
    >
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
            <IconStack2 size={16} color="var(--mantine-color-blue-6)" />
            <Text fw={600} size="sm" lineClamp={1} style={{ flex: 1 }}>
              {group.test_name}
            </Text>
          </Group>
          <Group gap="xs" wrap="nowrap">
            {group.count > 1 && (
              <Badge variant="filled" color="blue" size="sm" data-testid="count-badge">
                {t('labresults:stackedView.results', '{{count}} results', {
                  count: group.count,
                })}
              </Badge>
            )}
            <IconChevronRight size={16} color="var(--mantine-color-gray-5)" />
          </Group>
        </Group>

        {group.latest_status && (
          <Group gap="xs">
            <Text size="xs" c="dimmed">
              {t('labresults:stackedView.latestResult', 'Latest')}:
            </Text>
            <StatusBadge
              status={group.latest_status}
              size="sm"
              data-testid="status-badge"
            />
          </Group>
        )}

        {dateDisplay && (
          <Text size="xs" c="dimmed">
            {dateDisplay}
          </Text>
        )}

        {latestResult?.value != null && (
          <Group gap="xs" wrap="nowrap">
            <Text size="xs" fw={500} data-testid="latest-value">
              {latestResult.value}
              {latestResult.unit && (
                <Text span size="xs" c="dimmed" ml={4}>
                  {latestResult.unit}
                </Text>
              )}
            </Text>
            {latestRange && (
              <Text size="xs" c="dimmed" data-testid="latest-range">
                ({latestRange})
              </Text>
            )}
          </Group>
        )}
      </Stack>
    </Card>
  );
};

export default React.memo(LabResultStackCard);
