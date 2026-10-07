import { ActionIcon, Badge, Group, Text } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useDateFormat } from '../../hooks/useDateFormat';
import type { ReportDateRange } from './ReportFilters';

interface ActiveFilterChipsProps {
  dateRange: ReportDateRange | null;
  tags: string[];
  onDateRangeChange: (_range: ReportDateRange | null) => void;
  onTagsChange: (_tags: string[]) => void;
}

/**
 * One-line summary of the active report filters, shown while the Filters
 * panel is closed. Each chip removes its own filter.
 */
export function ActiveFilterChips({
  dateRange,
  tags,
  onDateRangeChange,
  onTagsChange,
}: ActiveFilterChipsProps) {
  const { t } = useTranslation('reports');
  const { formatDate } = useDateFormat();

  const start = dateRange?.start_date ?? null;
  const end = dateRange?.end_date ?? null;

  let dateLabel: string | null = null;
  if (start && end) {
    dateLabel = t('builder.filters.chips.dateBetween', {
      start: formatDate(start),
      end: formatDate(end),
    });
  } else if (start) {
    dateLabel = t('builder.filters.chips.dateFrom', {
      date: formatDate(start),
    });
  } else if (end) {
    dateLabel = t('builder.filters.chips.dateUntil', {
      date: formatDate(end),
    });
  }

  if (!dateLabel && tags.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {t('builder.filters.chips.none')}
      </Text>
    );
  }

  return (
    <Group gap="xs" data-testid="active-filter-chips">
      {dateLabel && (
        <FilterChip
          label={dateLabel}
          removeLabel={t('builder.filters.chips.remove', { name: dateLabel })}
          onRemove={() => onDateRangeChange(null)}
        />
      )}
      {tags.map(tag => (
        <FilterChip
          key={tag}
          label={tag}
          removeLabel={t('builder.filters.chips.remove', { name: tag })}
          onRemove={() =>
            onTagsChange(tags.filter(existing => existing !== tag))
          }
        />
      ))}
    </Group>
  );
}

interface FilterChipProps {
  label: string;
  removeLabel: string;
  onRemove: () => void;
}

// Own chip rather than Mantine's Pill: Pill's remove button is aria-hidden and
// not keyboard focusable.
function FilterChip({ label, removeLabel, onRemove }: FilterChipProps) {
  return (
    <Badge
      variant="light"
      size="lg"
      tt="none"
      rightSection={
        <ActionIcon
          size="xs"
          variant="transparent"
          color="blue"
          aria-label={removeLabel}
          onClick={onRemove}
        >
          <IconX size={12} />
        </ActionIcon>
      }
    >
      {label}
    </Badge>
  );
}

export default ActiveFilterChips;
