import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Drawer,
  Stack,
  Group,
  Text,
  ScrollArea,
  Paper,
  Title,
  ActionIcon,
  Tooltip,
  Badge,
  Table,
  Tabs,
} from '@mantine/core';
import {
  IconStack2,
  IconEye,
  IconPencil,
  IconTrash,
  IconFlask,
  IconArrowUp,
  IconArrowDown,
  IconArrowsSort,
  IconChartLine,
  IconTable,
} from '@tabler/icons-react';
import { useDateFormat } from '../../../hooks/useDateFormat';
import TestComponentTrendChart from './TestComponentTrendChart';
import {
  TrendResponse,
  TrendDataPoint,
  TrendStatistics,
} from '../../../services/api/labTestComponentApi';
import { LabResultGroup, LabResultSummary } from './LabResultStackCard';
import {
  getQualitativeDisplayName,
  getQualitativeColor,
} from '../../../constants/labCategories';

interface DateFormatHook {
  formatDate: (_dateValue: string | null | undefined) => string;
  formatLongDate: (_dateValue: string | null | undefined) => string;
}

interface LabResultStackPanelProps {
  opened: boolean;
  onClose: () => void;
  group: LabResultGroup | null;
  onViewResult: (_result: LabResultSummary) => void;
  onEditResult?: (_result: LabResultSummary) => void;
  onDeleteResult?: (_result: LabResultSummary) => void;
  onViewComponent?: (_result: LabResultSummary) => void;
  disableActions?: boolean;
}

type SortField = 'date' | 'value' | 'status';
type SortOrder = 'asc' | 'desc';

const getStatusColor = (status: string | null | undefined): string => {
  if (!status) return 'gray';
  switch (status.toLowerCase()) {
    case 'normal': return 'green';
    case 'high':
    case 'low': return 'orange';
    case 'critical': return 'red';
    case 'abnormal':
    case 'borderline': return 'yellow';
    default: return 'gray';
  }
};

const SortIcon: React.FC<{
  field: SortField;
  sortField: SortField;
  sortOrder: SortOrder;
}> = ({ field, sortField, sortOrder }) => {
  if (sortField !== field) {
    return <IconArrowsSort size={14} style={{ opacity: 0.5 }} />;
  }
  return sortOrder === 'asc' ? (
    <IconArrowUp size={14} />
  ) : (
    <IconArrowDown size={14} />
  );
};

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
          : null,
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
  onViewResult,
  onEditResult,
  onDeleteResult,
  onViewComponent,
  disableActions = false,
}) => {
  const { t } = useTranslation(['labresults', 'shared', 'common']);
  const { formatDate } = useDateFormat() as DateFormatHook;
  const [activeTab, setActiveTab] = useState<string>('chart');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const trendData = useMemo(
    () => (group ? buildTrendResponse(group) : null),
    [group]
  );

  const sortedResults = useMemo(() => {
    if (!group) return [];
    const data = [...group.results];
    data.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date': {
          const dateA = a.completed_date ?? a.ordered_date ?? '';
          const dateB = b.completed_date ?? b.ordered_date ?? '';
          comparison = dateA.localeCompare(dateB);
          break;
        }
        case 'value':
          if (a.result_type === 'qualitative' || b.result_type === 'qualitative') {
            comparison = (a.qualitative_value ?? '').localeCompare(b.qualitative_value ?? '');
          } else {
            comparison = (a.value ?? 0) - (b.value ?? 0);
          }
          break;
        case 'status':
          comparison = (a.labs_result ?? '').localeCompare(b.labs_result ?? '');
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return data;
  }, [group, sortField, sortOrder]);

  if (!group) return null;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const ariaSortAttr = (field: SortField): 'ascending' | 'descending' | 'none' =>
    sortField === field ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none';

  const sortButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: 0,
    font: 'inherit',
    color: 'inherit',
  };

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

  const resultsTable = group.results.length === 0 ? (
    <Text c="dimmed" size="sm" ta="center" py="xl">
      {t('labresults:stackedView.noResults', 'No results in this group')}
    </Text>
  ) : (
    <Stack gap="xs">
      {group.results.length > 1 && (
        <Text size="xs" c="dimmed" ta="right">
          {t('labresults:trendTable.clickToSort', 'Click column headers to sort')}
        </Text>
      )}
      <Paper withBorder radius="md">
        <ScrollArea>
          <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th aria-sort={ariaSortAttr('date')}>
                            <button type="button" onClick={() => handleSort('date')} style={sortButtonStyle}>
                              <Text span size="xs" fw={600}>
                                {t('shared:labels.date', 'Date')}
                              </Text>
                              <SortIcon field="date" sortField={sortField} sortOrder={sortOrder} />
                            </button>
                          </Table.Th>
                          <Table.Th aria-sort={ariaSortAttr('value')}>
                            <button type="button" onClick={() => handleSort('value')} style={sortButtonStyle}>
                              <Text span size="xs" fw={600}>
                                {t('shared:labels.value', 'Value')}
                              </Text>
                              <SortIcon field="value" sortField={sortField} sortOrder={sortOrder} />
                            </button>
                          </Table.Th>
                          <Table.Th>
                            <Text size="xs" fw={600}>
                              {t('labresults:testComponents.editModal.fields.unit', 'Unit')}
                            </Text>
                          </Table.Th>
                          <Table.Th aria-sort={ariaSortAttr('status')}>
                            <button type="button" onClick={() => handleSort('status')} style={sortButtonStyle}>
                              <Text span size="xs" fw={600}>
                                {t('shared:fields.status', 'Status')}
                              </Text>
                              <SortIcon field="status" sortField={sortField} sortOrder={sortOrder} />
                            </button>
                          </Table.Th>
                          <Table.Th>
                            <Text size="xs" fw={600}>
                              {t('labresults:testComponents.editModal.fields.referenceRange', 'Reference Range')}
                            </Text>
                          </Table.Th>
                          <Table.Th>
                            <Text size="xs" fw={600}>
                              {t('shared:labels.actions', 'Actions')}
                            </Text>
                          </Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {sortedResults.map(result => {
                          const resultKey = `${result.source ?? 'i'}-${result.id}`;
                          const dateStr = result.completed_date ?? result.ordered_date ?? null;
                          const isOrdered = !result.completed_date && !!result.ordered_date;
                          const range = formatRangeValue(result);
                          return (
                            <Table.Tr key={resultKey}>
                              <Table.Td>
                                <Stack gap={2}>
                                  {result.source === 'component' && (
                                    <Group gap={4}>
                                      <IconFlask size={10} color="var(--mantine-color-violet-6)" />
                                      <Text size="xs" c="violet" fw={500}>
                                        {t('labresults:stackedView.fromPanel', 'From panel')}
                                      </Text>
                                    </Group>
                                  )}
                                  <Text size="sm">
                                    {dateStr ? formatDate(dateStr) : t('common:labels.noDate', 'No date')}
                                  </Text>
                                  {isOrdered && (
                                    <Text size="xs" c="dimmed">
                                      {t('shared:labels.orderedDate', 'Ordered')}
                                    </Text>
                                  )}
                                </Stack>
                              </Table.Td>
                              <Table.Td>
                                {result.result_type === 'qualitative' && result.qualitative_value ? (
                                  <Badge
                                    size="sm"
                                    variant="filled"
                                    color={getQualitativeColor(result.qualitative_value)}
                                    data-testid={`qualitative-value-${result.source === 'component' ? `comp-${result.id}` : result.id}`}
                                  >
                                    {getQualitativeDisplayName(result.qualitative_value)}
                                  </Badge>
                                ) : result.value != null ? (
                                  <Text size="sm" fw={600} data-testid={`numeric-value-${result.source === 'component' ? `comp-${result.id}` : result.id}`}>
                                    {result.value}
                                  </Text>
                                ) : (
                                  <Text size="xs" c="dimmed">—</Text>
                                )}
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm" c="dimmed">
                                  {result.result_type === 'qualitative' ? '—' : (result.unit ?? '—')}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                {result.labs_result ? (
                                  <Badge size="sm" variant="light" color={getStatusColor(result.labs_result)}>
                                    {result.labs_result}
                                  </Badge>
                                ) : (
                                  <Text size="xs" c="dimmed">—</Text>
                                )}
                              </Table.Td>
                              <Table.Td>
                                <Text size="xs" c="dimmed" data-testid={`value-range-${result.source === 'component' ? `comp-${result.id}` : result.id}`}>
                                  {result.result_type === 'qualitative' ? '—' : (range ?? t('labresults:trendTable.notSpecified', 'Not specified'))}
                                </Text>
                              </Table.Td>
                              <Table.Td>
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
                                  {!disableActions && result.source !== 'component' && (
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
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                      </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </Stack>
  );

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
          {trendData ? (
            <Tabs value={activeTab} onChange={v => setActiveTab(v || 'chart')}>
              <Tabs.List>
                <Tabs.Tab value="chart" leftSection={<IconChartLine size={16} />}>
                  {t('labresults:trends.chart', 'Chart')}
                </Tabs.Tab>
                <Tabs.Tab value="table" leftSection={<IconTable size={16} />}>
                  {t('labresults:trends.dataTable', 'Data Table')}
                </Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="chart" pt="md">
                <TestComponentTrendChart trendData={trendData} />
              </Tabs.Panel>
              <Tabs.Panel value="table" pt="md">
                <Stack gap="xs">
                  <Title order={6} c="dimmed">
                    {t('labresults:trendTable.historicalData', 'Historical Data ({{count}} points)', {
                      count: group.results.length,
                    })}
                  </Title>
                  {resultsTable}
                </Stack>
              </Tabs.Panel>
            </Tabs>
          ) : (
            <Stack gap="xs">
              <Title order={6} c="dimmed">
                {t('labresults:trendTable.historicalData', 'Historical Data ({{count}} points)', {
                  count: group.results.length,
                })}
              </Title>
              {resultsTable}
            </Stack>
          )}
        </ScrollArea>
      </Drawer>
    </>
  );
};

export default LabResultStackPanel;
