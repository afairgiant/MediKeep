import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Drawer,
  Stack,
  Group,
  Text,
  ScrollArea,
  Paper,
  Divider,
  Title,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { IconStack2, IconEye, IconPencil, IconTrash, IconFlask } from '@tabler/icons-react';
import { useDateFormat } from '../../../hooks/useDateFormat';
import StatusBadge from '../StatusBadge';
import TestComponentTrendChart from './TestComponentTrendChart';
import {
  TrendResponse,
  TrendDataPoint,
  TrendStatistics,
} from '../../../services/api/labTestComponentApi';
import { LabResultGroup, LabResultSummary } from './LabResultStackCard';

interface DateFormatHook {
  formatDate: (_dateValue: string | null | undefined) => string;
  formatLongDate: (_dateValue: string | null | undefined) => string;
}

interface LabResultStackPanelProps {
  opened: boolean;
  onClose: () => void;
  group: LabResultGroup | null;
  patientId: number;
  onViewResult: (_result: LabResultSummary) => void;
  onEditResult?: (_result: LabResultSummary) => void;
  onDeleteResult?: (_result: LabResultSummary) => void;
  onViewComponent?: (_result: LabResultSummary) => void;
  disableActions?: boolean;
}

function buildTrendResponse(group: LabResultGroup): TrendResponse | null {
  const dataPoints: TrendDataPoint[] = group.results
    .filter(r => r.value != null)
    .map(r => ({
      id: r.id,
      value: r.value ?? null,
      unit: r.unit ?? null,
      status: r.labs_result ?? null,
      ref_range_min: r.ref_range_min ?? null,
      ref_range_max: r.ref_range_max ?? null,
      ref_range_text: r.ref_range_text ?? null,
      recorded_date: r.completed_date ?? r.ordered_date ?? null,
      created_at: r.completed_date
        ? r.completed_date + 'T00:00:00'
        : r.ordered_date
          ? r.ordered_date + 'T00:00:00'
          : new Date().toISOString(),
      lab_result: {
        id: r.id,
        test_name: r.test_name,
        completed_date: r.completed_date ?? null,
      },
      result_type: 'quantitative' as const,
      qualitative_value: null,
    }));

  if (dataPoints.length === 0) return null;

  const values = dataPoints
    .map(d => d.value)
    .filter((v): v is number => v != null);

  const computeTrendDirection = (vals: number[]): TrendStatistics['trend_direction'] => {
    if (vals.length < 2) return 'stable';
    const half = Math.ceil(vals.length / 2);
    const recentAvg = vals.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const olderAvg = vals.slice(half).reduce((a, b) => a + b, 0) / (vals.length - half);
    if (recentAvg > olderAvg * 1.05) return 'increasing';
    if (recentAvg < olderAvg * 0.95) return 'decreasing';
    return 'stable';
  };

  const statistics: TrendStatistics = {
    count: values.length,
    latest: values[0] ?? null,
    average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    std_dev: null,
    trend_direction: computeTrendDirection(values),
    normal_count: dataPoints.filter(d => d.status === 'normal').length,
    abnormal_count: dataPoints.filter(
      d => ['abnormal', 'high', 'low', 'critical'].includes(d.status ?? '')
    ).length,
  };

  return {
    test_name: group.test_name,
    unit: group.results.find(r => r.unit)?.unit ?? null,
    data_points: dataPoints,
    statistics,
    is_aggregated: false,
    result_type: 'quantitative',
  };
}

const LabResultStackPanel: React.FC<LabResultStackPanelProps> = ({
  opened,
  onClose,
  group,
  patientId,
  onViewResult,
  onEditResult,
  onDeleteResult,
  onViewComponent,
  disableActions = false,
}) => {
  const { t } = useTranslation(['labresults', 'shared', 'common']);
  const { formatLongDate } = useDateFormat() as DateFormatHook;

  const trendData = useMemo(
    () => (group ? buildTrendResponse(group) : null),
    [group]
  );

  if (!group) return null;

  const handleViewClick = (result: LabResultSummary) => {
    onClose();
    if (result.source === 'component') {
      onViewComponent?.(result);
    } else {
      onViewResult(result);
    }
  };

  const handleEditClick = (result: LabResultSummary) => {
    onClose();
    onEditResult?.(result);
  };

  const handleDeleteClick = (result: LabResultSummary) => {
    onDeleteResult?.(result);
  };

  const formatRangeValue = (result: LabResultSummary): string | null => {
    if (result.ref_range_text) return result.ref_range_text;
    if (result.ref_range_min != null && result.ref_range_max != null)
      return `${result.ref_range_min}–${result.ref_range_max}`;
    if (result.ref_range_min != null) return `≥${result.ref_range_min}`;
    if (result.ref_range_max != null) return `≤${result.ref_range_max}`;
    return null;
  };

  return (
    <>
      <Drawer
        opened={opened}
        onClose={onClose}
        position="right"
        size="lg"
        title={
          <Group gap="sm">
            <IconStack2 size={24} />
            <div>
              <Text fw={600} size="lg">
                {group.test_name}
              </Text>
              <Text size="sm" c="dimmed">
                {t('labresults:stackedView.results', '{{count}} results', {
                  count: group.count,
                })}
              </Text>
            </div>
          </Group>
        }
        overlayProps={{ opacity: 0.5, blur: 4 }}
        zIndex={2000}
      >
        <ScrollArea>
          <Stack gap="md">
            {trendData && (
              <Stack gap="xs">
                <Title order={6} c="dimmed">
                  {t('labresults:stackedView.trendChart', 'Value over time')}
                </Title>
                <TestComponentTrendChart trendData={trendData} />
              </Stack>
            )}

            <Stack gap="sm">
              {group.results.length === 0 ? (
                <Text c="dimmed" size="sm" ta="center" py="xl">
                  {t('labresults:stackedView.noResults', 'No results in this group')}
                </Text>
              ) : (
                group.results.map((result, index) => (
                  <React.Fragment key={`${result.source ?? 'i'}-${result.id}`}>
                    <Paper withBorder p="sm" radius="md">
                      <Group justify="space-between" wrap="nowrap">
                        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                          {result.source === 'component' && (
                            <Group gap={4}>
                              <IconFlask size={12} color="var(--mantine-color-violet-6)" />
                              <Text size="xs" c="violet" fw={500}>
                                {t('labresults:stackedView.fromPanel', 'From panel')}
                              </Text>
                            </Group>
                          )}
                          <Text size="sm" fw={500}>
                            {result.completed_date
                              ? formatLongDate(result.completed_date)
                              : result.ordered_date
                                ? `${t('shared:labels.orderedDate', 'Ordered')}: ${formatLongDate(result.ordered_date)}`
                                : t('common:labels.noDate', 'No date')}
                          </Text>
                          {result.labs_result && (
                            <StatusBadge
                              status={result.labs_result}
                              size="sm"
                            />
                          )}
                          {result.result_type === 'qualitative' && result.qualitative_value && (
                            <Text size="sm" fw={500} data-testid={`qualitative-value-${result.source === 'component' ? `comp-${result.id}` : result.id}`}>
                              {result.qualitative_value}
                            </Text>
                          )}
                          {result.value != null && (
                            <Text size="sm" fw={600} data-testid={`numeric-value-${result.source === 'component' ? `comp-${result.id}` : result.id}`}>
                              {result.value}
                              {result.unit && (
                                <Text span size="xs" c="dimmed" ml={4}>
                                  {result.unit}
                                </Text>
                              )}
                              {(() => {
                                const range = formatRangeValue(result);
                                return range ? (
                                  <Text span size="xs" c="dimmed" ml={4} data-testid={`value-range-${result.source === 'component' ? `comp-${result.id}` : result.id}`}>
                                    ({range})
                                  </Text>
                                ) : null;
                              })()}
                            </Text>
                          )}
                          {result.facility && (
                            <Text size="xs" c="dimmed" lineClamp={1}>
                              {result.facility}
                            </Text>
                          )}
                          {result.notes && (
                            <Text size="xs" c="dimmed" lineClamp={2}>
                              {result.notes}
                            </Text>
                          )}
                        </Stack>
                        {!disableActions && (
                          <Group gap={4} wrap="nowrap">
                            <Tooltip label={t('common:actions.view', 'View')} withArrow>
                              <ActionIcon
                                variant="subtle"
                                size="sm"
                                onClick={() => handleViewClick(result)}
                                data-testid={`view-result-${result.source === 'component' ? `comp-${result.id}` : result.id}`}
                                aria-label={t('common:actions.view', 'View')}
                              >
                                <IconEye size={14} />
                              </ActionIcon>
                            </Tooltip>
                            {result.source !== 'component' && (
                              <>
                                <Tooltip label={t('shared:labels.edit', 'Edit')} withArrow>
                                  <ActionIcon
                                    variant="subtle"
                                    size="sm"
                                    onClick={() => handleEditClick(result)}
                                    data-testid={`edit-result-${result.id}`}
                                    aria-label={t('shared:labels.edit', 'Edit')}
                                  >
                                    <IconPencil size={14} />
                                  </ActionIcon>
                                </Tooltip>
                                <Tooltip label={t('common:actions.delete', 'Delete')} withArrow>
                                  <ActionIcon
                                    variant="subtle"
                                    color="red"
                                    size="sm"
                                    onClick={() => handleDeleteClick(result)}
                                    data-testid={`delete-result-${result.id}`}
                                    aria-label={t('common:actions.delete', 'Delete')}
                                  >
                                    <IconTrash size={14} />
                                  </ActionIcon>
                                </Tooltip>
                              </>
                            )}
                          </Group>
                        )}
                      </Group>
                    </Paper>
                    {index < group.results.length - 1 && <Divider />}
                  </React.Fragment>
                ))
              )}
            </Stack>

          </Stack>
        </ScrollArea>
      </Drawer>
    </>
  );
};

export default LabResultStackPanel;
