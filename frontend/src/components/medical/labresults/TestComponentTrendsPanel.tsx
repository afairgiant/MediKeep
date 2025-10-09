/**
 * TestComponentTrendsPanel component
 * Slide-out panel that displays historical trend data for a specific lab test component
 * Shows chart, statistics, and historical data table
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Stack,
  Group,
  Text,
  Title,
  Button,
  Tabs,
  Alert,
  Paper,
  Badge,
  LoadingOverlay,
  CloseButton,
  Divider,
  Box,
  Skeleton,
  ActionIcon,
  Tooltip,
  TextInput,
  Select
} from '@mantine/core';
import {
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconChartLine,
  IconTable,
  IconChartBar,
  IconAlertCircle,
  IconDownload,
  IconCalendar,
  IconRefresh,
  IconX,
  IconFilter
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  labTestComponentApi,
  TrendResponse
} from '../../../services/api/labTestComponentApi';
import logger from '../../../services/logger';
import TestComponentTrendChart from './TestComponentTrendChart';
import TestComponentTrendTable from './TestComponentTrendTable';

interface TestComponentTrendsPanelProps {
  opened: boolean;
  onClose: () => void;
  testName: string | null;
  patientId: number;
}

const TestComponentTrendsPanel: React.FC<TestComponentTrendsPanelProps> = ({
  opened,
  onClose,
  testName,
  patientId
}) => {
  const [trendData, setTrendData] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('chart');
  const [timeRange, setTimeRange] = useState<string>('all');

  const getDateRangeFromSelection = (range: string): { dateFrom?: string; dateTo?: string } => {
    const today = new Date();
    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    if (range === 'all') {
      return {};
    }

    const dateTo = formatDate(today);
    let dateFrom: Date;

    switch (range) {
      case '3months':
        dateFrom = new Date(today);
        dateFrom.setMonth(today.getMonth() - 3);
        return { dateFrom: formatDate(dateFrom), dateTo };
      case '6months':
        dateFrom = new Date(today);
        dateFrom.setMonth(today.getMonth() - 6);
        return { dateFrom: formatDate(dateFrom), dateTo };
      case 'year':
        dateFrom = new Date(today);
        dateFrom.setFullYear(today.getFullYear() - 1);
        return { dateFrom: formatDate(dateFrom), dateTo };
      case '2years':
        dateFrom = new Date(today);
        dateFrom.setFullYear(today.getFullYear() - 2);
        return { dateFrom: formatDate(dateFrom), dateTo };
      case '5years':
        dateFrom = new Date(today);
        dateFrom.setFullYear(today.getFullYear() - 5);
        return { dateFrom: formatDate(dateFrom), dateTo };
      default:
        return {};
    }
  };

  const loadTrendData = useCallback(async () => {
    if (!testName || !patientId) return;

    setLoading(true);
    setError(null);

    try {
      const dateRange = getDateRangeFromSelection(timeRange);

      const response = await labTestComponentApi.getTrendsByPatientAndTest(
        patientId,
        testName,
        {
          dateFrom: dateRange.dateFrom,
          dateTo: dateRange.dateTo,
          limit: 100
        }
      );

      setTrendData(response);

      logger.info('test_component_trends_loaded', {
        message: 'Test component trends loaded successfully',
        testName,
        patientId,
        timeRange,
        dataPointCount: response.data_points.length,
        component: 'TestComponentTrendsPanel'
      });
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to load trend data';
      setError(errorMessage);

      logger.error('test_component_trends_error', {
        message: 'Error loading test component trends',
        testName,
        patientId,
        error: errorMessage,
        component: 'TestComponentTrendsPanel'
      });

      notifications.show({
        title: 'Error Loading Trends',
        message: errorMessage,
        color: 'red',
        autoClose: 5000
      });
    } finally {
      setLoading(false);
    }
  }, [testName, patientId, timeRange]);

  useEffect(() => {
    if (opened && testName) {
      // Defer data loading slightly to allow drawer to render first
      // This prevents the main thread from being blocked during the drawer animation
      const timeoutId = setTimeout(() => {
        loadTrendData();
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [opened, testName, loadTrendData]);

  const getTrendIcon = () => {
    if (!trendData) return <IconMinus size={18} />;

    switch (trendData.statistics.trend_direction) {
      case 'increasing':
        return <IconTrendingUp size={18} />;
      case 'decreasing':
        return <IconTrendingDown size={18} />;
      default:
        return <IconMinus size={18} />;
    }
  };

  const getTrendColor = () => {
    if (!trendData) return 'gray';

    switch (trendData.statistics.trend_direction) {
      case 'increasing':
        return 'blue';
      case 'decreasing':
        return 'orange';
      default:
        return 'gray';
    }
  };

  const getTrendLabel = () => {
    if (!trendData) return 'Stable';

    switch (trendData.statistics.trend_direction) {
      case 'increasing':
        return 'Increasing';
      case 'decreasing':
        return 'Decreasing';
      default:
        return 'Stable';
    }
  };

  const getTimeRangeLabel = (range: string): string => {
    switch (range) {
      case 'all':
        return 'All Dates';
      case '3months':
        return 'Past 3 Months';
      case '6months':
        return 'Past 6 Months';
      case 'year':
        return 'Past Year';
      case '2years':
        return 'Past 2 Years';
      case '5years':
        return 'Past 5 Years';
      default:
        return 'All Dates';
    }
  };

  const handleExport = () => {
    if (!trendData) return;

    try {
      // Create CSV content
      const headers = ['Date', 'Value', 'Unit', 'Status', 'Reference Range', 'Lab Result'];
      const rows = trendData.data_points.map(point => {
        const date = point.recorded_date || point.created_at.split('T')[0];
        const refRange = point.ref_range_text ||
          (point.ref_range_min !== null && point.ref_range_max !== null
            ? `${point.ref_range_min} - ${point.ref_range_max}`
            : 'Not specified');

        return [
          date,
          point.value.toString(),
          point.unit,
          point.status || '',
          refRange,
          point.lab_result.test_name
        ];
      });

      // Build CSV string
      const csvContent = [
        // Title row
        [`Test Component Trend Data: ${trendData.test_name}`],
        [`Export Date: ${new Date().toLocaleDateString()}`],
        [''],
        // Statistics
        ['Summary Statistics'],
        ['Count', trendData.statistics.count.toString()],
        ['Latest', trendData.statistics.latest?.toFixed(2) || 'N/A'],
        ['Average', trendData.statistics.average?.toFixed(2) || 'N/A'],
        ['Min', trendData.statistics.min?.toFixed(2) || 'N/A'],
        ['Max', trendData.statistics.max?.toFixed(2) || 'N/A'],
        ['Std Dev', trendData.statistics.std_dev?.toFixed(2) || 'N/A'],
        ['Trend Direction', trendData.statistics.trend_direction],
        ['Normal Count', trendData.statistics.normal_count.toString()],
        ['Abnormal Count', trendData.statistics.abnormal_count.toString()],
        [''],
        // Data table
        headers,
        ...rows
      ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `trend_${trendData.test_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      logger.info('test_component_trends_exported', {
        message: 'Trend data exported to CSV',
        testName,
        patientId,
        dataPointCount: trendData.data_points.length,
        component: 'TestComponentTrendsPanel'
      });

      notifications.show({
        title: 'Export Successful',
        message: `Exported ${trendData.data_points.length} data points to CSV`,
        color: 'green',
        autoClose: 3000
      });
    } catch (error: any) {
      logger.error('test_component_trends_export_error', {
        message: 'Error exporting trend data',
        testName,
        patientId,
        error: error.message,
        component: 'TestComponentTrendsPanel'
      });

      notifications.show({
        title: 'Export Failed',
        message: 'Failed to export data. Please try again.',
        color: 'red',
        autoClose: 5000
      });
    }
  };

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
            <Text fw={600} size="lg">Trend Analysis</Text>
            {testName && <Text size="sm" c="dimmed">{testName}</Text>}
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
            title="Error"
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
                  <Text fw={600} size="sm">Time Range</Text>
                </Group>
              </Group>

              <Select
                label="Select Time Range"
                placeholder="Choose time range"
                value={timeRange}
                onChange={(value) => setTimeRange(value || 'all')}
                data={[
                  { value: 'all', label: 'All Dates' },
                  { value: '3months', label: 'Past 3 Months' },
                  { value: '6months', label: 'Past 6 Months' },
                  { value: 'year', label: 'Past Year' },
                  { value: '2years', label: 'Past 2 Years' },
                  { value: '5years', label: 'Past 5 Years' }
                ]}
                leftSection={<IconCalendar size={16} />}
                size="md"
                allowDeselect={false}
                comboboxProps={{ withinPortal: true, zIndex: 3000 }}
              />

              {/* Show selected time range */}
              {timeRange !== 'all' && (
                <Paper withBorder p="sm" radius="sm" bg="blue.0">
                  <Group gap="xs" justify="center">
                    <Text size="sm" fw={600}>Showing:</Text>
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
                <Text fw={600} size="sm">Summary Statistics</Text>
                <Group gap="xs">
                  <Tooltip label="Refresh data">
                    <ActionIcon variant="subtle" onClick={loadTrendData} size="sm">
                      <IconRefresh size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Export to CSV">
                    <ActionIcon variant="subtle" onClick={handleExport} size="sm">
                      <IconDownload size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>

              <Divider />

              <Group gap="xl">
                <Box>
                  <Text size="xs" c="dimmed">Latest</Text>
                  <Group gap="xs" align="baseline">
                    <Text fw={700} size="xl">
                      {trendData.statistics.latest?.toFixed(2) ?? 'N/A'}
                    </Text>
                    <Text size="sm" c="dimmed">{trendData.unit}</Text>
                  </Group>
                </Box>

                <Box>
                  <Text size="xs" c="dimmed">Average</Text>
                  <Group gap="xs" align="baseline">
                    <Text fw={600} size="lg">
                      {trendData.statistics.average?.toFixed(2) ?? 'N/A'}
                    </Text>
                    <Text size="sm" c="dimmed">{trendData.unit}</Text>
                  </Group>
                </Box>

                <Box>
                  <Text size="xs" c="dimmed">Range</Text>
                  <Group gap="xs" align="baseline">
                    <Text fw={600} size="sm">
                      {trendData.statistics.min?.toFixed(2)} - {trendData.statistics.max?.toFixed(2)}
                    </Text>
                    <Text size="xs" c="dimmed">{trendData.unit}</Text>
                  </Group>
                </Box>
              </Group>

              <Group gap="md">
                <Badge
                  leftSection={getTrendIcon()}
                  color={getTrendColor()}
                  variant="light"
                  size="lg"
                >
                  {getTrendLabel()}
                </Badge>

                <Badge variant="light" color="blue" size="lg">
                  {trendData.statistics.count} data points
                </Badge>

                {trendData.statistics.time_in_range_percent !== null && trendData.statistics.time_in_range_percent !== undefined && (
                  <Badge variant="light" color="green" size="lg">
                    {trendData.statistics.time_in_range_percent.toFixed(1)}% in range
                  </Badge>
                )}
              </Group>

              <Group gap="sm">
                <Text size="xs" c="dimmed">
                  Normal: <Text span fw={600}>{trendData.statistics.normal_count}</Text>
                </Text>
                <Text size="xs" c="dimmed">•</Text>
                <Text size="xs" c="dimmed">
                  Abnormal: <Text span fw={600}>{trendData.statistics.abnormal_count}</Text>
                </Text>
                {trendData.statistics.std_dev !== null && trendData.statistics.std_dev !== undefined && (
                  <>
                    <Text size="xs" c="dimmed">•</Text>
                    <Text size="xs" c="dimmed">
                      Std Dev: <Text span fw={600}>{trendData.statistics.std_dev.toFixed(2)}</Text>
                    </Text>
                  </>
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
                Chart
              </Tabs.Tab>
              <Tabs.Tab value="table" leftSection={<IconTable size={16} />}>
                Data Table
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="chart" pt="md">
              <TestComponentTrendChart trendData={trendData} />
            </Tabs.Panel>

            <Tabs.Panel value="table" pt="md">
              <TestComponentTrendTable trendData={trendData} />
            </Tabs.Panel>
          </Tabs>
        )}

        {/* Empty State */}
        {trendData && trendData.data_points.length === 0 && !loading && (
          <Paper withBorder p="xl" radius="md" bg="gray.0">
            <Stack align="center" gap="md">
              <IconChartLine size={48} color="var(--mantine-color-gray-5)" />
              <Title order={3} c="dimmed">No trend data available</Title>
              <Text size="sm" c="dimmed" ta="center">
                There are no historical data points for this test component.
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

export default TestComponentTrendsPanel;
