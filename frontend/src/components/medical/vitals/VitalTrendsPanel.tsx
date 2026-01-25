/**
 * VitalTrendsPanel component
 * Slide-out drawer that displays historical trend data for a specific vital type
 * Shows chart, statistics, and historical data table
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Drawer,
  Stack,
  Group,
  Text,
  Title,
  Tabs,
  Alert,
  Paper,
  Badge,
  LoadingOverlay,
  Divider,
  Box,
  Skeleton,
  ActionIcon,
  Tooltip,
  Select
} from '@mantine/core';
import {
  IconChartLine,
  IconTable,
  IconAlertCircle,
  IconDownload,
  IconCalendar,
  IconRefresh,
  IconFilter
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import logger from '../../../services/logger';
import VitalTrendChart from './VitalTrendChart';
import VitalTrendTable from './VitalTrendTable';
import { VitalType, VitalTrendResponse, VITAL_TYPE_CONFIGS } from './types';
import { vitalsService } from '../../../services/medical/vitalsService';
import { useUserPreferences } from '../../../contexts/UserPreferencesContext';
import { convertForDisplay, unitLabels } from '../../../utils/unitConversion';

// Maps vital types to their corresponding measurement types for unit conversion
const CONVERTIBLE_VITAL_TYPES: Partial<Record<VitalType, 'weight' | 'temperature'>> = {
  weight: 'weight',
  temperature: 'temperature'
};

interface VitalTrendsPanelProps {
  opened: boolean;
  onClose: () => void;
  vitalType: VitalType | null;
  patientId: number;
  patientHeight?: number | null;
}

// Raw data structure before unit conversion (stored in imperial units)
interface RawTrendData {
  vital_type: VitalType;
  vital_type_label: string;
  base_unit: string;
  data_points: { id: number; value: number; secondary_value: number | null; recorded_date: string }[];
  reference_range: VitalTrendResponse['reference_range'];
}

const VitalTrendsPanel: React.FC<VitalTrendsPanelProps> = ({
  opened,
  onClose,
  vitalType,
  patientId,
  patientHeight
}) => {
  const { t } = useTranslation('common');
  const { unitSystem } = useUserPreferences();
  // Store raw data in imperial units - conversion happens in useMemo
  const [rawTrendData, setRawTrendData] = useState<RawTrendData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('chart');
  const [timeRange, setTimeRange] = useState<string>('all');

  const getDateRangeFromSelection = (range: string): { startDate?: string; endDate?: string } => {
    const today = new Date();
    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    if (range === 'all') {
      return {};
    }

    const endDate = formatDate(today);
    let startDate: Date;

    switch (range) {
      case '3months':
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 3);
        return { startDate: formatDate(startDate), endDate };
      case '6months':
        startDate = new Date(today);
        startDate.setMonth(today.getMonth() - 6);
        return { startDate: formatDate(startDate), endDate };
      case 'year':
        startDate = new Date(today);
        startDate.setFullYear(today.getFullYear() - 1);
        return { startDate: formatDate(startDate), endDate };
      case '2years':
        startDate = new Date(today);
        startDate.setFullYear(today.getFullYear() - 2);
        return { startDate: formatDate(startDate), endDate };
      case '5years':
        startDate = new Date(today);
        startDate.setFullYear(today.getFullYear() - 5);
        return { startDate: formatDate(startDate), endDate };
      default:
        return {};
    }
  };

  const loadTrendData = useCallback(async () => {
    if (!vitalType || !patientId) return;

    // For BMI, we need patient height
    if (vitalType === 'bmi' && !patientHeight) {
      setError(t('vitals.trends.noHeightForBMI', 'Patient height is required to calculate BMI trends. Please update the patient profile with their height.'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const dateRange = getDateRangeFromSelection(timeRange);
      const config = VITAL_TYPE_CONFIGS[vitalType];

      // Fetch vitals data (backend enforces max 100 per request)
      let vitalsData;
      if (dateRange.startDate && dateRange.endDate) {
        vitalsData = await vitalsService.getPatientVitalsDateRange(
          patientId,
          dateRange.startDate,
          dateRange.endDate,
          { limit: 100 }
        );
      } else {
        vitalsData = await vitalsService.getPatientVitals(patientId, { limit: 100 });
      }

      // Process the data for the specific vital type
      const dataArray = Array.isArray(vitalsData) ? vitalsData : vitalsData?.data || [];

      // Helper function to calculate BMI from weight (lbs) and height (inches)
      const calculateBMI = (weightLbs: number, heightInches: number): number => {
        const bmi = (weightLbs / (heightInches * heightInches)) * 703;
        return Math.round(bmi * 10) / 10; // Round to 1 decimal place
      };

      // For BMI, we need to calculate from weight records using patient height
      const isBMI = vitalType === 'bmi';

      // Filter and transform data points - store raw values in imperial units
      const dataPoints = dataArray
        .filter((vital: any) => {
          if (isBMI) {
            // For BMI, we need weight and patient height
            return vital.weight !== null && vital.weight !== undefined && patientHeight;
          }
          return config.getValue(vital) !== null && config.getValue(vital) !== undefined;
        })
        .map((vital: any) => {
          let value: number;
          if (isBMI && patientHeight) {
            // Calculate BMI from weight and patient height
            value = calculateBMI(vital.weight, patientHeight);
          } else {
            value = config.getValue(vital);
          }
          const secondaryValue = config.getSecondaryValue ? config.getSecondaryValue(vital) : null;

          // Store raw values - conversion happens in useMemo based on unitSystem
          return {
            id: vital.id,
            value: value,
            secondary_value: secondaryValue,
            recorded_date: vital.recorded_date
          };
        })
        .sort((a: any, b: any) => new Date(b.recorded_date).getTime() - new Date(a.recorded_date).getTime());

      // Store raw data - unit conversion and statistics calculated in useMemo
      const rawData: RawTrendData = {
        vital_type: vitalType,
        vital_type_label: config.label,
        base_unit: config.unit,
        data_points: dataPoints,
        reference_range: config.referenceRange
      };

      setRawTrendData(rawData);

      logger.info('vital_trends_loaded', {
        message: 'Vital trends loaded successfully',
        vitalType,
        patientId,
        timeRange,
        dataPointCount: dataPoints.length,
        component: 'VitalTrendsPanel'
      });
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to load trend data';
      setError(errorMessage);

      logger.error('vital_trends_error', {
        message: 'Error loading vital trends',
        vitalType,
        patientId,
        error: errorMessage,
        component: 'VitalTrendsPanel'
      });

      notifications.show({
        title: t('labels.error', 'Error'),
        message: errorMessage,
        color: 'red',
        autoClose: 5000
      });
    } finally {
      setLoading(false);
    }
  }, [vitalType, patientId, timeRange, patientHeight, t]);

  useEffect(() => {
    if (opened && vitalType) {
      const timeoutId = setTimeout(() => {
        loadTrendData();
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [opened, vitalType, loadTrendData]);

  // Reset state when panel closes
  useEffect(() => {
    if (!opened) {
      setRawTrendData(null);
      setError(null);
      setActiveTab('chart');
    }
  }, [opened]);

  // Derive converted trend data from raw data based on unit system
  // This allows unit changes to update display without refetching from API
  const trendData = useMemo((): VitalTrendResponse | null => {
    if (!rawTrendData) return null;

    const measurementType = CONVERTIBLE_VITAL_TYPES[rawTrendData.vital_type];

    // Convert data points if this vital type needs unit conversion
    const convertedDataPoints = rawTrendData.data_points.map(point => ({
      ...point,
      value: measurementType
        ? convertForDisplay(point.value, measurementType, unitSystem) ?? point.value
        : point.value
    }));

    // Determine display unit based on user preference
    const displayUnit = measurementType
      ? unitLabels[unitSystem][measurementType]
      : rawTrendData.base_unit;

    // Calculate statistics from converted values
    const values = convertedDataPoints.map(p => p.value);
    const secondaryValues = convertedDataPoints
      .map(p => p.secondary_value)
      .filter((v): v is number => v !== null && v !== undefined);

    // Calculate standard deviation for primary values
    let stdDev: number | null = null;
    if (values.length > 1) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const squareDiffs = values.map(v => Math.pow(v - mean, 2));
      stdDev = Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
    }

    // Calculate secondary statistics (for blood pressure diastolic)
    let secondaryStdDev: number | null = null;
    if (secondaryValues.length > 1) {
      const mean = secondaryValues.reduce((a, b) => a + b, 0) / secondaryValues.length;
      const squareDiffs = secondaryValues.map(v => Math.pow(v - mean, 2));
      secondaryStdDev = Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / secondaryValues.length);
    }

    return {
      vital_type: rawTrendData.vital_type,
      vital_type_label: rawTrendData.vital_type_label,
      unit: displayUnit,
      data_points: convertedDataPoints,
      statistics: {
        count: convertedDataPoints.length,
        latest: values.length > 0 ? values[0] : null,
        average: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null,
        min: values.length > 0 ? Math.min(...values) : null,
        max: values.length > 0 ? Math.max(...values) : null,
        std_dev: stdDev,
        secondary_latest: secondaryValues.length > 0 ? secondaryValues[0] : null,
        secondary_average: secondaryValues.length > 0 ? secondaryValues.reduce((a, b) => a + b, 0) / secondaryValues.length : null,
        secondary_min: secondaryValues.length > 0 ? Math.min(...secondaryValues) : null,
        secondary_max: secondaryValues.length > 0 ? Math.max(...secondaryValues) : null,
        secondary_std_dev: secondaryStdDev
      },
      reference_range: rawTrendData.reference_range
    };
  }, [rawTrendData, unitSystem]);

  const getTimeRangeLabel = (range: string): string => {
    switch (range) {
      case 'all':
        return t('vitals.trends.allDates', 'All Dates');
      case '3months':
        return t('vitals.trends.past3Months', 'Past 3 Months');
      case '6months':
        return t('vitals.trends.past6Months', 'Past 6 Months');
      case 'year':
        return t('vitals.trends.pastYear', 'Past Year');
      case '2years':
        return t('vitals.trends.past2Years', 'Past 2 Years');
      case '5years':
        return t('vitals.trends.past5Years', 'Past 5 Years');
      default:
        return t('vitals.trends.allDates', 'All Dates');
    }
  };

  const handleExport = () => {
    if (!trendData) return;

    try {
      const headers = ['Date', 'Value', 'Unit'];
      const rows = trendData.data_points.map(point => {
        const date = point.recorded_date.split('T')[0];
        const valueStr = point.secondary_value !== null && point.secondary_value !== undefined
          ? `${point.value}/${point.secondary_value}`
          : point.value.toString();

        return [
          date,
          valueStr,
          trendData.unit
        ];
      });

      const csvContent = [
        [`Vital Signs Trend Data: ${trendData.vital_type_label}`],
        [`Export Date: ${new Date().toLocaleDateString()}`],
        [''],
        ['Summary Statistics'],
        ['Count', trendData.statistics.count.toString()],
        ['Latest', trendData.statistics.latest?.toFixed(2) || 'N/A'],
        ['Average', trendData.statistics.average?.toFixed(2) || 'N/A'],
        ['Min', trendData.statistics.min?.toFixed(2) || 'N/A'],
        ['Max', trendData.statistics.max?.toFixed(2) || 'N/A'],
        ['Std Dev', trendData.statistics.std_dev?.toFixed(2) || 'N/A'],
        [''],
        headers,
        ...rows
      ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `vitals_trend_${trendData.vital_type}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      logger.info('vital_trends_exported', {
        message: 'Vital trend data exported to CSV',
        vitalType,
        patientId,
        dataPointCount: trendData.data_points.length,
        component: 'VitalTrendsPanel'
      });

      notifications.show({
        title: t('labels.success', 'Success'),
        message: t('vitals.trends.exportSuccess', `Exported ${trendData.data_points.length} data points to CSV`),
        color: 'green',
        autoClose: 3000
      });
    } catch (err: any) {
      logger.error('vital_trends_export_error', {
        message: 'Error exporting vital trend data',
        vitalType,
        patientId,
        error: err.message,
        component: 'VitalTrendsPanel'
      });

      notifications.show({
        title: t('labels.error', 'Error'),
        message: t('vitals.trends.exportError', 'Failed to export data. Please try again.'),
        color: 'red',
        autoClose: 5000
      });
    }
  };

  const vitalConfig = vitalType ? VITAL_TYPE_CONFIGS[vitalType] : null;

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="xl"
      title={
        <Group gap="sm">
          <IconChartLine size={24} />
          <div>
            <Text fw={600} size="lg">{t('vitals.trends.title', 'Trend Analysis')}</Text>
            {vitalConfig && <Text size="sm" c="dimmed">{vitalConfig.label}</Text>}
          </div>
        </Group>
      }
      overlayProps={{ opacity: 0.5, blur: 4 }}
      zIndex={2500}
    >
      <Stack gap="md" style={{ position: 'relative', minHeight: '100%' }}>
        <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

        {/* Error State */}
        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title={t('labels.error', 'Error')}
            color="red"
            withCloseButton
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        {/* Time Range Filter */}
        {!loading && (
          <Paper withBorder p="md" radius="md" bg="gray.0">
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Group gap="xs">
                  <IconFilter size={16} />
                  <Text fw={600} size="sm">{t('vitals.trends.timeRange', 'Time Range')}</Text>
                </Group>
              </Group>

              <Select
                label={t('vitals.trends.selectTimeRange', 'Select Time Range')}
                placeholder={t('vitals.trends.chooseTimeRange', 'Choose time range')}
                value={timeRange}
                onChange={(value) => setTimeRange(value || 'all')}
                data={[
                  { value: 'all', label: t('vitals.trends.allDates', 'All Dates') },
                  { value: '3months', label: t('vitals.trends.past3Months', 'Past 3 Months') },
                  { value: '6months', label: t('vitals.trends.past6Months', 'Past 6 Months') },
                  { value: 'year', label: t('vitals.trends.pastYear', 'Past Year') },
                  { value: '2years', label: t('vitals.trends.past2Years', 'Past 2 Years') },
                  { value: '5years', label: t('vitals.trends.past5Years', 'Past 5 Years') }
                ]}
                leftSection={<IconCalendar size={16} />}
                size="md"
                allowDeselect={false}
                comboboxProps={{ withinPortal: true, zIndex: 3000 }}
              />

              {timeRange !== 'all' && (
                <Paper withBorder p="sm" radius="sm" bg="blue.0">
                  <Group gap="xs" justify="center">
                    <Text size="sm" fw={600}>{t('vitals.trends.showing', 'Showing')}:</Text>
                    <Badge size="lg" variant="filled">
                      {getTimeRangeLabel(timeRange)}
                    </Badge>
                  </Group>
                </Paper>
              )}
            </Stack>
          </Paper>
        )}

        {/* Statistics Summary */}
        {trendData && !loading && (
          <Paper withBorder p="md" radius="md">
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Text fw={600} size="sm">{t('vitals.trends.summaryStatistics', 'Summary Statistics')}</Text>
                <Group gap="xs">
                  <Tooltip label={t('buttons.refresh', 'Refresh')}>
                    <ActionIcon variant="subtle" onClick={loadTrendData} size="sm">
                      <IconRefresh size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label={t('vitals.trends.exportCsv', 'Export to CSV')}>
                    <ActionIcon variant="subtle" onClick={handleExport} size="sm">
                      <IconDownload size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>

              <Divider />

              <Group gap="xl">
                <Box>
                  <Text size="xs" c="dimmed">{t('vitals.trends.latest', 'Latest')}</Text>
                  <Group gap="xs" align="baseline">
                    <Text fw={700} size="xl">
                      {trendData.statistics.latest?.toFixed(0) ?? 'N/A'}
                      {trendData.statistics.secondary_latest != null && (
                        <Text span c="dimmed">/{trendData.statistics.secondary_latest.toFixed(0)}</Text>
                      )}
                    </Text>
                    <Text size="sm" c="dimmed">{trendData.unit}</Text>
                  </Group>
                </Box>

                <Box>
                  <Text size="xs" c="dimmed">{t('vitals.trends.average', 'Average')}</Text>
                  <Group gap="xs" align="baseline">
                    <Text fw={600} size="lg">
                      {trendData.statistics.average?.toFixed(0) ?? 'N/A'}
                      {trendData.statistics.secondary_average != null && (
                        <Text span c="dimmed">/{trendData.statistics.secondary_average.toFixed(0)}</Text>
                      )}
                    </Text>
                    <Text size="sm" c="dimmed">{trendData.unit}</Text>
                  </Group>
                </Box>

                <Box>
                  <Text size="xs" c="dimmed">{t('vitals.trends.range', 'Range')}</Text>
                  <Group gap="xs" align="baseline">
                    {trendData.statistics.min != null && trendData.statistics.max != null ? (
                      <>
                        <Text fw={600} size="sm">
                          {trendData.statistics.min.toFixed(0)}
                          {trendData.statistics.secondary_min != null && (
                            <Text span c="dimmed">/{trendData.statistics.secondary_min.toFixed(0)}</Text>
                          )}
                          {' - '}
                          {trendData.statistics.max.toFixed(0)}
                          {trendData.statistics.secondary_max != null && (
                            <Text span c="dimmed">/{trendData.statistics.secondary_max.toFixed(0)}</Text>
                          )}
                        </Text>
                        <Text size="xs" c="dimmed">{trendData.unit}</Text>
                      </>
                    ) : (
                      <Text fw={600} size="sm">{t('labels.notAvailable', 'N/A')}</Text>
                    )}
                  </Group>
                </Box>
              </Group>

              <Group gap="md">
                <Badge variant="light" color="blue" size="lg">
                  {trendData.statistics.count} {t('vitals.trends.dataPoints', 'data points')}
                </Badge>

                {trendData.statistics.std_dev !== null && (
                  <Badge variant="light" color="gray" size="lg">
                    {t('vitals.trends.stdDev', 'Std Dev')}: {trendData.statistics.std_dev.toFixed(1)}
                    {trendData.statistics.secondary_std_dev != null && (
                      <Text span>/{trendData.statistics.secondary_std_dev.toFixed(1)}</Text>
                    )}
                  </Badge>
                )}
              </Group>
            </Stack>
          </Paper>
        )}

        {/* Tabs for Chart and Table Views */}
        {trendData && !loading && (
          <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'chart')}>
            <Tabs.List>
              <Tabs.Tab value="chart" leftSection={<IconChartLine size={16} />}>
                {t('vitals.trends.chart', 'Chart')}
              </Tabs.Tab>
              <Tabs.Tab value="table" leftSection={<IconTable size={16} />}>
                {t('vitals.trends.dataTable', 'Data Table')}
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="chart" pt="md">
              <VitalTrendChart trendData={trendData} />
            </Tabs.Panel>

            <Tabs.Panel value="table" pt="md">
              <VitalTrendTable trendData={trendData} />
            </Tabs.Panel>
          </Tabs>
        )}

        {/* Empty State */}
        {trendData && trendData.data_points.length === 0 && !loading && (
          <Paper withBorder p="xl" radius="md" bg="gray.0">
            <Stack align="center" gap="md">
              <IconChartLine size={48} color="var(--mantine-color-gray-5)" />
              <Title order={3} c="dimmed">{t('vitals.trends.noData', 'No trend data available')}</Title>
              <Text size="sm" c="dimmed" ta="center">
                {t('vitals.trends.noDataDesc', 'There are no historical data points for this vital sign.')}
              </Text>
            </Stack>
          </Paper>
        )}

        {/* Loading Skeleton */}
        {loading && !trendData && (
          <Stack gap="md">
            <Skeleton height={150} radius="md" />
            <Skeleton height={300} radius="md" />
          </Stack>
        )}
      </Stack>
    </Drawer>
  );
};

export default VitalTrendsPanel;
