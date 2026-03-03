import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Stack,
  Group,
  Text,
  Title,
  Checkbox,
  SimpleGrid,
  Select,
  MultiSelect,
  Badge,
  ActionIcon,
  Paper,
  Alert,
  Loader,
  Center,
} from '@mantine/core';
import { IconChartLine, IconX, IconInfoCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../hooks/useApi.js';
import { apiService } from '../../services/api/index.js';
import logger from '../../services/logger';

interface ChartCounts {
  vital_counts: Record<string, number>;
  lab_test_counts: Record<string, number>;
}

const TIME_RANGE_OPTIONS = [
  { value: 'all', labelKey: 'reportBuilder.trendCharts.timeRange.all' },
  { value: '3months', labelKey: 'reportBuilder.trendCharts.timeRange.3months' },
  { value: '6months', labelKey: 'reportBuilder.trendCharts.timeRange.6months' },
  { value: '1year', labelKey: 'reportBuilder.trendCharts.timeRange.1year' },
  { value: '2years', labelKey: 'reportBuilder.trendCharts.timeRange.2years' },
  { value: '5years', labelKey: 'reportBuilder.trendCharts.timeRange.5years' },
];

interface TrendChartSelectorProps {
  trendCharts: {
    vital_charts: Array<{ vital_type: string; time_range: string }>;
    lab_test_charts: Array<{ test_name: string; time_range: string }>;
  };
  addVitalChart: (vitalType: string, timeRange?: string) => void;
  removeVitalChart: (vitalType: string) => void;
  updateVitalChartTimeRange: (vitalType: string, timeRange: string) => void;
  addLabTestChart: (testName: string, timeRange?: string) => void;
  removeLabTestChart: (testName: string) => void;
  updateLabTestChartTimeRange: (testName: string, timeRange: string) => void;
  trendChartCount: number;
}

interface AvailableVitalType {
  vital_type: string;
  display_name: string;
  unit: string;
  count: number;
}

interface AvailableLabTest {
  test_name: string;
  unit: string;
  count: number;
}

const TrendChartSelector: React.FC<TrendChartSelectorProps> = ({
  trendCharts,
  addVitalChart,
  removeVitalChart,
  updateVitalChartTimeRange,
  addLabTestChart,
  removeLabTestChart,
  updateLabTestChartTimeRange,
  trendChartCount,
}) => {
  const { t } = useTranslation('common');
  const { loading, execute } = useApi();

  const [availableVitals, setAvailableVitals] = useState<AvailableVitalType[]>([]);
  const [availableLabTests, setAvailableLabTests] = useState<AvailableLabTest[]>([]);
  const [chartCounts, setChartCounts] = useState<ChartCounts>({ vital_counts: {}, lab_test_counts: {} });
  const countsAbortRef = useRef<AbortController | null>(null);

  const maxReached = trendChartCount >= 10;

  // Fetch available data on mount
  const fetchAvailableData = useCallback(async () => {
    const result = await execute(
      (signal: AbortSignal) => apiService.getAvailableTrendData(signal),
      { errorMessage: 'Failed to fetch available trend data' }
    );

    if (result) {
      setAvailableVitals(result.vital_types || []);
      setAvailableLabTests(result.lab_test_names || []);
      logger.debug('trend_chart_available_data_loaded', 'Available trend data loaded', {
        vitalTypeCount: result.vital_types?.length || 0,
        labTestCount: result.lab_test_names?.length || 0,
        component: 'TrendChartSelector',
      });
    }
  }, [execute]);

  useEffect(() => {
    fetchAvailableData();
  }, [fetchAvailableData]);

  // Fetch record counts when chart selections or time ranges change
  useEffect(() => {
    if (trendChartCount === 0) {
      setChartCounts({ vital_counts: {}, lab_test_counts: {} });
      return;
    }

    // Debounce to avoid rapid API calls during selection changes
    const timer = setTimeout(() => {
      // Cancel previous in-flight request
      if (countsAbortRef.current) {
        countsAbortRef.current.abort();
      }
      const controller = new AbortController();
      countsAbortRef.current = controller;

      apiService.getTrendChartCounts(trendCharts, controller.signal)
        .then((result: ChartCounts) => {
          if (!controller.signal.aborted) {
            setChartCounts(result);
          }
        })
        .catch((err: Error) => {
          if (err.name !== 'AbortError') {
            logger.debug('trend_chart_counts_error', 'Failed to fetch chart counts', {
              error: err.message,
              component: 'TrendChartSelector',
            });
          }
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      if (countsAbortRef.current) {
        countsAbortRef.current.abort();
      }
    };
  }, [trendCharts, trendChartCount]);

  const selectedVitalTypes = new Set(trendCharts.vital_charts.map(c => c.vital_type));
  const selectedLabTestNames = trendCharts.lab_test_charts.map(c => c.test_name);

  const timeRangeOptions = TIME_RANGE_OPTIONS.map(opt => ({
    value: opt.value,
    label: t(opt.labelKey),
  }));

  // Deduplicate lab tests by test_name (API may return same name with different units)
  const seenLabTestNames = new Set<string>();
  const labTestSelectData = availableLabTests
    .filter(lt => {
      const key = lt.test_name.toLowerCase();
      if (seenLabTestNames.has(key)) return false;
      seenLabTestNames.add(key);
      return true;
    })
    .map(lt => ({
      value: lt.test_name,
      label: `${lt.test_name}${lt.unit ? ` (${lt.unit})` : ''} - ${lt.count} results`,
    }));

  const handleVitalToggle = (vitalType: string, checked: boolean) => {
    if (checked) {
      addVitalChart(vitalType);
    } else {
      removeVitalChart(vitalType);
    }
  };

  const handleLabTestChange = (selectedValues: string[]) => {
    // Find added items
    const currentNames = new Set(selectedLabTestNames.map(n => n.toLowerCase()));
    for (const name of selectedValues) {
      if (!currentNames.has(name.toLowerCase())) {
        addLabTestChart(name);
      }
    }
    // Find removed items
    const newNames = new Set(selectedValues.map(n => n.toLowerCase()));
    for (const name of selectedLabTestNames) {
      if (!newNames.has(name.toLowerCase())) {
        removeLabTestChart(name);
      }
    }
  };

  if (loading) {
    return (
      <Center py="xl">
        <Loader size="md" />
      </Center>
    );
  }

  const noDataAvailable = availableVitals.length === 0 && availableLabTests.length === 0;

  if (noDataAvailable) {
    return (
      <Paper p="xl">
        <Center py="xl">
          <Stack align="center" gap="md">
            <IconChartLine size={48} stroke={1} color="var(--mantine-color-gray-5)" />
            <Text c="dimmed" ta="center">
              {t('reportBuilder.trendCharts.emptyState')}
            </Text>
          </Stack>
        </Center>
      </Paper>
    );
  }

  return (
    <Stack gap="lg" p="md">
      {maxReached && (
        <Alert color="yellow" icon={<IconInfoCircle size={16} />}>
          {t('reportBuilder.trendCharts.maxReached')}
        </Alert>
      )}

      {/* Vital Sign Charts */}
      {availableVitals.length > 0 && (
        <Stack gap="sm">
          <Title order={5}>{t('reportBuilder.trendCharts.vitalCharts.title')}</Title>
          <Text size="sm" c="dimmed">
            {t('reportBuilder.trendCharts.vitalCharts.description')}
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="xs">
            {availableVitals.map(vital => (
              <Checkbox
                key={vital.vital_type}
                label={`${vital.display_name} (${vital.count})`}
                checked={selectedVitalTypes.has(vital.vital_type)}
                onChange={(e) => handleVitalToggle(vital.vital_type, e.currentTarget.checked)}
                disabled={maxReached && !selectedVitalTypes.has(vital.vital_type)}
              />
            ))}
          </SimpleGrid>
        </Stack>
      )}

      {/* Lab Test Charts */}
      {availableLabTests.length > 0 && (
        <Stack gap="sm">
          <Title order={5}>{t('reportBuilder.trendCharts.labTestCharts.title')}</Title>
          <Text size="sm" c="dimmed">
            {t('reportBuilder.trendCharts.labTestCharts.description')}
          </Text>
          <MultiSelect
            data={labTestSelectData}
            value={selectedLabTestNames}
            onChange={handleLabTestChange}
            searchable
            placeholder={t('reportBuilder.trendCharts.labTestCharts.searchPlaceholder')}
            maxDropdownHeight={200}
            disabled={maxReached && selectedLabTestNames.length === 0}
            clearable
          />
        </Stack>
      )}

      {/* Selected Charts with Time Range Controls */}
      {trendChartCount > 0 && (
        <Stack gap="sm">
          <Title order={5}>
            {t('reportBuilder.trendCharts.selectedCharts', { count: trendChartCount })}
          </Title>

          {/* Vital chart rows */}
          {trendCharts.vital_charts.map(chart => {
            const vitalInfo = availableVitals.find(v => v.vital_type === chart.vital_type);
            const count = chartCounts.vital_counts[chart.vital_type];
            return (
              <Group key={chart.vital_type} gap="sm" wrap="nowrap">
                <Badge variant="light" color="blue" size="lg" style={{ flex: '0 0 auto' }}>
                  {vitalInfo?.display_name || chart.vital_type}
                </Badge>
                <Select
                  data={timeRangeOptions}
                  value={chart.time_range}
                  onChange={(val) => val && updateVitalChartTimeRange(chart.vital_type, val)}
                  size="xs"
                  style={{ width: 120 }}
                  aria-label={t('reportBuilder.trendCharts.timeRange.label')}
                />
                {count !== undefined && (
                  <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                    {t('reportBuilder.trendCharts.recordCount', { count })}
                  </Text>
                )}
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="sm"
                  onClick={() => removeVitalChart(chart.vital_type)}
                  aria-label={t('reportBuilder.trendCharts.removeChart', { name: vitalInfo?.display_name || chart.vital_type })}
                >
                  <IconX size={14} />
                </ActionIcon>
              </Group>
            );
          })}

          {/* Lab test chart rows */}
          {trendCharts.lab_test_charts.map(chart => {
            const count = chartCounts.lab_test_counts[chart.test_name];
            return (
              <Group key={chart.test_name} gap="sm" wrap="nowrap">
                <Badge variant="light" color="teal" size="lg" style={{ flex: '0 0 auto' }}>
                  {chart.test_name}
                </Badge>
                <Select
                  data={timeRangeOptions}
                  value={chart.time_range}
                  onChange={(val) => val && updateLabTestChartTimeRange(chart.test_name, val)}
                  size="xs"
                  style={{ width: 120 }}
                  aria-label={t('reportBuilder.trendCharts.timeRange.label')}
                />
                {count !== undefined && (
                  <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                    {t('reportBuilder.trendCharts.recordCount', { count })}
                  </Text>
                )}
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="sm"
                  onClick={() => removeLabTestChart(chart.test_name)}
                  aria-label={t('reportBuilder.trendCharts.removeChart', { name: chart.test_name })}
                >
                  <IconX size={14} />
                </ActionIcon>
              </Group>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
};

export default TrendChartSelector;
