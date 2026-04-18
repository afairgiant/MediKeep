import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Stack,
  Group,
  Text,
  Title,
  Checkbox,
  SimpleGrid,
  MultiSelect,
  Badge,
  ActionIcon,
  Paper,
  Alert,
  Loader,
  Center,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconChartLine, IconX, IconInfoCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { apiService } from '../../services/api/index.js';
import logger from '../../services/logger';
import {
  decodeLabChartValue,
  encodeLabChartValue,
  labChartKey,
} from '../../utils/labChartKey';

interface ChartCounts {
  vital_counts: Record<string, number>;
  lab_test_counts: Record<string, number>;
}

interface TrendChartSelectorProps {
  trendCharts: {
    vital_charts: Array<{
      vital_type: string;
      date_from: string | null;
      date_to: string | null;
    }>;
    lab_test_charts: Array<{
      test_name: string;
      unit: string | null;
      date_from: string | null;
      date_to: string | null;
    }>;
  };
  addVitalChart: (_vitalType: string) => void;
  removeVitalChart: (_vitalType: string) => void;
  updateVitalChartDates: (
    _vitalType: string,
    _dateFrom: string | null,
    _dateTo: string | null
  ) => void;
  addLabTestChart: (_testName: string, _unit: string | null) => void;
  removeLabTestChart: (_testName: string, _unit: string | null) => void;
  updateLabTestChartDates: (
    _testName: string,
    _unit: string | null,
    _dateFrom: string | null,
    _dateTo: string | null
  ) => void;
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
  updateVitalChartDates,
  addLabTestChart,
  removeLabTestChart,
  updateLabTestChartDates,
  trendChartCount,
}) => {
  const { t } = useTranslation(['reports', 'common']);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);

  const [availableVitals, setAvailableVitals] = useState<AvailableVitalType[]>(
    []
  );
  const [availableLabTests, setAvailableLabTests] = useState<
    AvailableLabTest[]
  >([]);
  const [chartCounts, setChartCounts] = useState<ChartCounts>({
    vital_counts: {},
    lab_test_counts: {},
  });
  const countsAbortRef = useRef<AbortController | null>(null);

  const maxReached = trendChartCount >= 10;

  // Fetch available data on mount
  useEffect(() => {
    const controller = new AbortController();
    apiService
      .getAvailableTrendData(controller.signal)
      .then(result => {
        if (!controller.signal.aborted && result) {
          setAvailableVitals(result.vital_types || []);
          setAvailableLabTests(result.lab_test_names || []);
          logger.debug(
            'trend_chart_available_data_loaded',
            'Available trend data loaded',
            {
              vitalTypeCount: result.vital_types?.length || 0,
              labTestCount: result.lab_test_names?.length || 0,
              component: 'TrendChartSelector',
            }
          );
        }
      })
      .catch((err: Error) => {
        if (err.name !== 'AbortError') {
          logger.debug(
            'trend_chart_available_data_error',
            'Failed to fetch available trend data',
            {
              error: err.message,
              component: 'TrendChartSelector',
            }
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  // Fetch record counts when chart selections or date ranges change
  useEffect(() => {
    if (trendChartCount === 0) {
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

      apiService
        .getTrendChartCounts(trendCharts, controller.signal)
        .then((result: ChartCounts) => {
          if (!controller.signal.aborted) {
            setChartCounts(result);
          }
        })
        .catch((err: Error) => {
          if (err.name !== 'AbortError') {
            logger.debug(
              'trend_chart_counts_error',
              'Failed to fetch chart counts',
              {
                error: err.message,
                component: 'TrendChartSelector',
              }
            );
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

  const emptyCounts: ChartCounts = { vital_counts: {}, lab_test_counts: {} };
  const effectiveCounts = trendChartCount === 0 ? emptyCounts : chartCounts;

  const selectedVitalTypes = useMemo(
    () => new Set(trendCharts.vital_charts.map(c => c.vital_type)),
    [trendCharts.vital_charts]
  );

  const selectedLabTestKeys = useMemo(
    () =>
      trendCharts.lab_test_charts.map(c => labChartKey(c.test_name, c.unit)),
    [trendCharts.lab_test_charts]
  );

  const selectedLabSelectValues = useMemo(
    () =>
      trendCharts.lab_test_charts.map(c =>
        encodeLabChartValue(c.test_name, c.unit)
      ),
    [trendCharts.lab_test_charts]
  );

  const labTestSelectData = useMemo(
    () =>
      availableLabTests.map(lt => ({
        value: encodeLabChartValue(lt.test_name, lt.unit),
        label: `${lt.test_name}${lt.unit ? ` (${lt.unit})` : ''} - ${lt.count} results`,
      })),
    [availableLabTests]
  );

  const handleVitalToggle = (vitalType: string, checked: boolean) => {
    if (checked) {
      addVitalChart(vitalType);
    } else {
      removeVitalChart(vitalType);
    }
  };

  const handleLabTestChange = (selectedValues: string[]) => {
    const decoded = selectedValues.map(v => {
      const { testName, unit } = decodeLabChartValue(v);
      return { testName, unit, key: labChartKey(testName, unit) };
    });
    const currentKeys = new Set(selectedLabTestKeys);
    const nextKeys = new Set(decoded.map(d => d.key));

    for (const { testName, unit, key } of decoded) {
      if (!currentKeys.has(key)) {
        addLabTestChart(testName, unit);
      }
    }
    for (const chart of trendCharts.lab_test_charts) {
      if (!nextKeys.has(labChartKey(chart.test_name, chart.unit))) {
        removeLabTestChart(chart.test_name, chart.unit);
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

  const noDataAvailable =
    availableVitals.length === 0 && availableLabTests.length === 0;

  if (noDataAvailable) {
    return (
      <Paper p="xl">
        <Center py="xl">
          <Stack align="center" gap="md">
            <IconChartLine
              size={48}
              stroke={1}
              color="var(--mantine-color-gray-5)"
            />
            <Text c="dimmed" ta="center">
              {t('builder.trendCharts.emptyState')}
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
          {t('builder.trendCharts.maxReached')}
        </Alert>
      )}

      {/* Vital Sign Charts */}
      {availableVitals.length > 0 && (
        <Stack gap="sm">
          <Title order={5}>{t('builder.trendCharts.vitalCharts.title')}</Title>
          <Text size="sm" c="dimmed">
            {t('builder.trendCharts.vitalCharts.description')}
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="xs">
            {availableVitals.map(vital => (
              <Checkbox
                key={vital.vital_type}
                label={`${vital.display_name} (${vital.count})`}
                checked={selectedVitalTypes.has(vital.vital_type)}
                onChange={e =>
                  handleVitalToggle(vital.vital_type, e.currentTarget.checked)
                }
                disabled={
                  maxReached && !selectedVitalTypes.has(vital.vital_type)
                }
              />
            ))}
          </SimpleGrid>
        </Stack>
      )}

      {/* Lab Test Charts */}
      {availableLabTests.length > 0 && (
        <Stack gap="sm">
          <Title order={5}>
            {t('builder.trendCharts.labTestCharts.title')}
          </Title>
          <Text size="sm" c="dimmed">
            {t('builder.trendCharts.labTestCharts.description')}
          </Text>
          <MultiSelect
            data={labTestSelectData}
            value={selectedLabSelectValues}
            onChange={handleLabTestChange}
            searchable
            placeholder={t(
              'builder.trendCharts.labTestCharts.searchPlaceholder'
            )}
            maxDropdownHeight={200}
            disabled={maxReached && selectedLabSelectValues.length === 0}
            clearable
          />
        </Stack>
      )}

      {/* Selected Charts with Date Range Controls */}
      {trendChartCount > 0 && (
        <Stack gap="sm">
          <Title order={5}>
            {t('builder.trendCharts.selectedCharts', {
              count: trendChartCount,
            })}
          </Title>

          {/* Vital chart rows */}
          {trendCharts.vital_charts.map(chart => {
            const vitalInfo = availableVitals.find(
              v => v.vital_type === chart.vital_type
            );
            const count = effectiveCounts.vital_counts[chart.vital_type];
            return (
              <Group key={chart.vital_type} gap="sm" wrap="nowrap">
                <Badge
                  variant="light"
                  color="blue"
                  size="lg"
                  style={{ flex: '0 0 auto' }}
                >
                  {vitalInfo?.display_name || chart.vital_type}
                </Badge>
                <DatePickerInput
                  value={chart.date_from}
                  onChange={val =>
                    updateVitalChartDates(chart.vital_type, val, chart.date_to)
                  }
                  size="xs"
                  style={{ width: 130 }}
                  placeholder={t('builder.trendCharts.dateFrom')}
                  aria-label={t('builder.trendCharts.dateFrom')}
                  clearable
                  maxDate={chart.date_to || undefined}
                  popoverProps={{ withinPortal: true }}
                />
                <DatePickerInput
                  value={chart.date_to}
                  onChange={val =>
                    updateVitalChartDates(
                      chart.vital_type,
                      chart.date_from,
                      val
                    )
                  }
                  size="xs"
                  style={{ width: 130 }}
                  placeholder={t('builder.trendCharts.dateTo')}
                  aria-label={t('builder.trendCharts.dateTo')}
                  clearable
                  minDate={chart.date_from || undefined}
                  maxDate={today}
                  popoverProps={{ withinPortal: true }}
                />
                {count !== undefined && (
                  <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                    {t('builder.trendCharts.recordCount', { count })}
                  </Text>
                )}
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="sm"
                  onClick={() => removeVitalChart(chart.vital_type)}
                  aria-label={t('builder.trendCharts.removeChart', {
                    name: vitalInfo?.display_name || chart.vital_type,
                  })}
                >
                  <IconX size={14} />
                </ActionIcon>
              </Group>
            );
          })}

          {/* Lab test chart rows */}
          {trendCharts.lab_test_charts.map(chart => {
            const countKey = encodeLabChartValue(chart.test_name, chart.unit);
            const count = effectiveCounts.lab_test_counts[countKey];
            const rowKey = labChartKey(chart.test_name, chart.unit);
            const isLegacy = chart.unit == null;
            return (
              <React.Fragment key={rowKey}>
                <Group gap="sm" wrap="nowrap">
                  <Badge
                    variant="light"
                    color="teal"
                    size="lg"
                    style={{ flex: '0 0 auto' }}
                  >
                    {chart.test_name}
                    {chart.unit ? ` (${chart.unit})` : ''}
                  </Badge>
                  <DatePickerInput
                    value={chart.date_from}
                    onChange={val =>
                      updateLabTestChartDates(
                        chart.test_name,
                        chart.unit,
                        val,
                        chart.date_to
                      )
                    }
                    size="xs"
                    style={{ width: 130 }}
                    placeholder={t('builder.trendCharts.dateFrom')}
                    aria-label={t('builder.trendCharts.dateFrom')}
                    clearable
                    maxDate={chart.date_to || undefined}
                    popoverProps={{ withinPortal: true }}
                  />
                  <DatePickerInput
                    value={chart.date_to}
                    onChange={val =>
                      updateLabTestChartDates(
                        chart.test_name,
                        chart.unit,
                        chart.date_from,
                        val
                      )
                    }
                    size="xs"
                    style={{ width: 130 }}
                    placeholder={t('builder.trendCharts.dateTo')}
                    aria-label={t('builder.trendCharts.dateTo')}
                    clearable
                    minDate={chart.date_from || undefined}
                    maxDate={today}
                    popoverProps={{ withinPortal: true }}
                  />
                  {count !== undefined && (
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                      {t('builder.trendCharts.recordCount', { count })}
                    </Text>
                  )}
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() =>
                      removeLabTestChart(chart.test_name, chart.unit)
                    }
                    aria-label={t('builder.trendCharts.removeChart', {
                      name: chart.test_name,
                    })}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                </Group>
                {isLegacy && (
                  <Alert
                    color="yellow"
                    variant="light"
                    icon={<IconInfoCircle size={14} />}
                    p="xs"
                  >
                    <Text size="xs">
                      {t('builder.trendCharts.legacyUnitWarning')}
                    </Text>
                  </Alert>
                )}
              </React.Fragment>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
};

export default TrendChartSelector;
