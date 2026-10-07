import { Grid, Paper, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { DateInput } from '../adapters/DateInput';
import { TagInput } from '../common/TagInput';
import { formatDateInputChange } from '../../utils/dateUtils';

export interface ReportDateRange {
  start_date: string | null;
  end_date: string | null;
}

interface ReportFiltersProps {
  dateRange: ReportDateRange | null;
  tags: string[];
  onDateRangeChange: (_range: ReportDateRange | null) => void;
  onTagsChange: (_tags: string[]) => void;
}

/**
 * Date range and tag filters for the report. They decide which records can be
 * picked (the record lists and counts are reloaded with them), drop selected
 * records that no longer match, and are applied again when the report is
 * generated. They are saved with templates.
 */
export function ReportFilters({
  dateRange,
  tags,
  onDateRangeChange,
  onTagsChange,
}: ReportFiltersProps) {
  const { t } = useTranslation('reports');

  const updateDate = (key: keyof ReportDateRange, value: unknown) => {
    const next = {
      start_date: dateRange?.start_date ?? null,
      end_date: dateRange?.end_date ?? null,
      [key]: formatDateInputChange(value as string | Date | null) || null,
    };
    onDateRangeChange(next.start_date || next.end_date ? next : null);
  };

  const start = dateRange?.start_date ?? null;
  const end = dateRange?.end_date ?? null;
  const rangeInvalid = !!start && !!end && end < start;

  return (
    <Paper
      shadow="sm"
      p="md"
      radius="md"
      withBorder
      data-testid="report-filters"
    >
      <Stack gap="sm">
        <Stack gap={2}>
          <Title order={5}>{t('builder.filters.title')}</Title>
          <Text c="dimmed" size="sm">
            {t('builder.filters.description')}
          </Text>
        </Stack>
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <DateInput
              label={t('builder.filters.startDate')}
              value={start}
              onChange={(value: unknown) => updateDate('start_date', value)}
              clearable
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <DateInput
              label={t('builder.filters.endDate')}
              value={end}
              onChange={(value: unknown) => updateDate('end_date', value)}
              error={
                rangeInvalid ? t('builder.filters.invalidRange') : undefined
              }
              clearable
            />
          </Grid.Col>
        </Grid>
        <Stack gap={4}>
          <Text fw={500} size="sm">
            {t('builder.filters.tags')}
          </Text>
          <TagInput
            value={tags}
            onChange={onTagsChange}
            placeholder={t('builder.filters.tagsPlaceholder')}
          />
          <Text c="dimmed" size="xs">
            {t('builder.filters.note')}
          </Text>
        </Stack>
      </Stack>
    </Paper>
  );
}

export default ReportFilters;
