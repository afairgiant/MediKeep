import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Card,
  Grid,
  Text,
  Group,
  Button,
  Badge,
  Stack,
  SimpleGrid,
  Paper,
  Center,
  Loader,
  ThemeIcon,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconChartBar,
  IconRefresh,
  IconTrendingUp,
  IconTrendingDown,
  IconCalendar,
} from '@tabler/icons-react';
import AdminLayout from '../../components/admin/AdminLayout';
import ChartErrorBoundary from '../../components/shared/ChartErrorBoundary';
import { useAdminData } from '../../hooks/useAdminData';
import { adminApiService } from '../../services/api/adminApi';
import useThemeColors from '../../hooks/useThemeColors';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const ANALYTICS_CONFIG = {
  DEFAULT_DAYS: 7,
  DEFAULT_LABELS: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  DEFAULT_DATA: [0, 0, 0, 0, 0, 0, 0],
};

const Analytics = () => {
  const { t } = useTranslation('admin');
  const themeColors = useThemeColors();

  // Date range state
  const [analyticsDays, setAnalyticsDays] = useState(ANALYTICS_CONFIG.DEFAULT_DAYS);
  const [analyticsDateRange, setAnalyticsDateRange] = useState([null, null]);

  // Analytics data state
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [comparisonData, setComparisonData] = useState(null);
  const analyticsAbortRef = useRef(null);

  // Stats for distribution chart
  const {
    data: stats,
    refreshData: refreshStats,
  } = useAdminData({
    entityName: 'Dashboard Statistics',
    apiMethodsConfig: {
      load: signal => adminApiService.getDashboardStats(signal),
    },
    autoRefresh: false,
  });

  const fetchAnalytics = useCallback(async () => {
    if (analyticsAbortRef.current) {
      analyticsAbortRef.current.abort();
    }
    const controller = new AbortController();
    analyticsAbortRef.current = controller;

    setAnalyticsLoading(true);
    try {
      const opts = { compare: true, signal: controller.signal };
      if (analyticsDateRange[0] && analyticsDateRange[1]) {
        opts.startDate = analyticsDateRange[0].toISOString().split('T')[0];
        opts.endDate = analyticsDateRange[1].toISOString().split('T')[0];
      } else {
        opts.days = analyticsDays;
      }
      const data = await adminApiService.getAnalyticsData(opts);
      setAnalyticsData(data);
      setComparisonData(data.comparison || null);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setAnalyticsData(null);
      }
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsDays, analyticsDateRange]);

  useEffect(() => {
    fetchAnalytics();
    return () => {
      if (analyticsAbortRef.current) {
        analyticsAbortRef.current.abort();
      }
    };
  }, [fetchAnalytics]);

  const handlePresetDays = (days) => {
    setAnalyticsDateRange([null, null]);
    setAnalyticsDays(days);
  };

  const handleDateRangeChange = (range) => {
    setAnalyticsDateRange(range);
  };

  // Chart data
  const chartData = useMemo(() => ({
    activity: {
      labels: analyticsData?.weekly_activity?.labels || ANALYTICS_CONFIG.DEFAULT_LABELS,
      datasets: [
        {
          label: t('analytics.chartLabels.userActivity', 'User Activity'),
          data: analyticsData?.weekly_activity?.data || ANALYTICS_CONFIG.DEFAULT_DATA,
          borderColor: themeColors.primary,
          backgroundColor: `${themeColors.primary}1a`,
          tension: 0.4,
        },
      ],
    },
    distribution: {
      labels: [
        t('analytics.chartLabels.patients', 'Patients'),
        t('analytics.chartLabels.labResults', 'Lab Results'),
        t('analytics.chartLabels.medications', 'Medications'),
        t('analytics.chartLabels.procedures', 'Procedures'),
        t('analytics.chartLabels.allergies', 'Allergies'),
        t('analytics.chartLabels.vitals', 'Vitals'),
      ],
      datasets: [
        {
          data: [
            stats?.total_patients || 0,
            stats?.total_lab_results || 0,
            stats?.total_medications || 0,
            stats?.total_procedures || 0,
            stats?.total_allergies || 0,
            stats?.total_vitals || 0,
          ],
          backgroundColor: [
            themeColors.primary,
            themeColors.success,
            themeColors.warning,
            themeColors.danger,
            themeColors.purple,
            themeColors.info,
          ],
          borderWidth: 0,
        },
      ],
    },
  }), [analyticsData, stats, themeColors, t]);

  const lineChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
        labels: { color: themeColors.textPrimary },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: t('analytics.axisLabels.activities', 'Activities'), color: themeColors.textPrimary },
        ticks: { color: themeColors.textPrimary },
        grid: { color: themeColors.borderLight },
      },
      x: {
        title: { display: true, text: t('analytics.axisLabels.date', 'Date'), color: themeColors.textPrimary },
        ticks: { color: themeColors.textPrimary },
        grid: { color: themeColors.borderLight },
      },
    },
  }), [themeColors, t]);

  const doughnutChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: themeColors.textPrimary },
      },
    },
  }), [themeColors]);

  return (
    <AdminLayout>
      <div className="admin-analytics">
        {/* Header */}
        <Card shadow="sm" p="xl" mb="xl" withBorder>
          <Group justify="space-between" align="flex-start">
            <div>
              <Group align="center" mb="xs">
                <ThemeIcon size="xl" variant="light" color="blue">
                  <IconChartBar size={24} />
                </ThemeIcon>
                <Text size="xl" fw={700}>
                  {t('analytics.title', 'Analytics')}
                </Text>
              </Group>
              <Text c="dimmed" size="md">
                {t('analytics.subtitle', 'Activity trends, comparisons, and record distribution')}
              </Text>
            </div>
            <Button
              leftSection={<IconRefresh size={16} />}
              onClick={() => { fetchAnalytics(); refreshStats(true); }}
              loading={analyticsLoading}
              variant="light"
            >
              Refresh
            </Button>
          </Group>
        </Card>

        {/* Date Controls */}
        <Card shadow="sm" p="lg" mb="lg" withBorder>
          <Group justify="space-between" wrap="wrap">
            <Group gap="xs">
              {[7, 30, 90].map(d => (
                <Button
                  key={d}
                  size="xs"
                  variant={analyticsDays === d && !analyticsDateRange[0] ? 'filled' : 'light'}
                  onClick={() => handlePresetDays(d)}
                  aria-label={t('analytics.filterByDays', 'Filter by last {{days}} days', { days: d })}
                >
                  {d}d
                </Button>
              ))}
            </Group>
            <DatePickerInput
              type="range"
              placeholder={t('analytics.customDateRange', 'Custom date range')}
              value={analyticsDateRange}
              onChange={handleDateRangeChange}
              clearable
              size="xs"
              leftSection={<IconCalendar size={14} />}
              aria-label={t('analytics.analyticsDateRange', 'Analytics date range')}
            />
          </Group>
        </Card>

        {analyticsLoading && !analyticsData ? (
          <Center h={300}>
            <Stack align="center">
              <Loader size="lg" />
              <Text c="dimmed">{t('analytics.loading', 'Loading analytics...')}</Text>
            </Stack>
          </Center>
        ) : (
          <Stack gap="lg">
            {/* KPI Cards */}
            {comparisonData && (
              <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <KpiCard
                  label={t('analytics.totalActivities', 'Total Activities')}
                  value={comparisonData.current_total}
                  changePercent={comparisonData.change_percent}
                />
                <KpiCard
                  label={t('analytics.dailyAverage', 'Daily Average')}
                  value={
                    analyticsData?.date_range?.days
                      ? Math.round(comparisonData.current_total / analyticsData.date_range.days)
                      : 0
                  }
                  changePercent={comparisonData.change_percent}
                />
                <Paper p="md" withBorder>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
                    {t('analytics.period', 'Period')}
                  </Text>
                  <Text size="lg" fw={700}>
                    {t('analytics.days', '{{count}} days', { count: analyticsData?.date_range?.days || 0 })}
                  </Text>
                  {comparisonData.previous_period && (
                    <Text size="xs" c="dimmed" mt={4}>
                      vs. {comparisonData.previous_period.start} to {comparisonData.previous_period.end}
                    </Text>
                  )}
                </Paper>
              </SimpleGrid>
            )}

            {/* Charts */}
            <Grid>
              <Grid.Col span={{ base: 12, md: 8 }}>
                <Card shadow="sm" p="lg" withBorder>
                  <Group justify="space-between" mb="md">
                    <div>
                      <Text size="lg" fw={600}>
                        {t('analytics.activityTrend', 'Activity Trend')}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {analyticsData?.date_range
                          ? `${analyticsData.date_range.start} to ${analyticsData.date_range.end}`
                          : t('analytics.userInteractions', 'User interactions')}
                      </Text>
                    </div>
                    <Badge variant="light" color="blue">
                      {t('analytics.total', '{{count}} total', { count: analyticsData?.weekly_activity?.total || 0 })}
                    </Badge>
                  </Group>

                  <div
                    className="chart-container"
                    role="img"
                    aria-label={`Activity trend chart: ${analyticsData?.weekly_activity?.total || 0} total activities`}
                  >
                    <ChartErrorBoundary onReset={fetchAnalytics}>
                      <Line
                        data={chartData.activity}
                        options={lineChartOptions}
                      />
                    </ChartErrorBoundary>
                  </div>
                </Card>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 4 }}>
                <Card shadow="sm" p="lg" withBorder>
                  <Group justify="space-between" mb="md">
                    <div>
                      <Text size="lg" fw={600}>
                        {t('analytics.recordsDistribution', 'Records Distribution')}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {t('analytics.breakdownByType', 'Breakdown by type')}
                      </Text>
                    </div>
                  </Group>

                  <div
                    className="chart-container doughnut"
                    role="img"
                    aria-label="Records distribution chart across 6 categories"
                  >
                    <ChartErrorBoundary onReset={() => refreshStats(true)}>
                      <Doughnut
                        data={chartData.distribution}
                        options={doughnutChartOptions}
                      />
                    </ChartErrorBoundary>
                  </div>
                </Card>
              </Grid.Col>
            </Grid>

            {/* Model Activity Breakdown */}
            {analyticsData?.model_activity && Object.keys(analyticsData.model_activity).length > 0 && (
              <Card shadow="sm" p="lg" withBorder>
                <Text size="lg" fw={600} mb="md">
                  {t('analytics.activityByRecordType', 'Activity by Record Type')}
                </Text>
                <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }}>
                  {Object.entries(analyticsData.model_activity)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <Paper key={type} p="sm" withBorder>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
                          {type}
                        </Text>
                        <Text size="lg" fw={700}>
                          {count}
                        </Text>
                      </Paper>
                    ))}
                </SimpleGrid>
              </Card>
            )}
          </Stack>
        )}
      </div>
    </AdminLayout>
  );
};

// KPI Card with comparison badge
const KpiCard = ({ label, value, changePercent }) => {
  const { t } = useTranslation('admin');
  const isPositive = changePercent >= 0;
  const color = isPositive ? 'green' : 'red';
  const ArrowIcon = isPositive ? IconTrendingUp : IconTrendingDown;

  return (
    <Paper p="md" withBorder>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb="xs">
        {label}
      </Text>
      <Group justify="space-between" align="flex-end">
        <Text size="xl" fw={700}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </Text>
        <Badge
          variant="light"
          color={color}
          leftSection={<ArrowIcon size={12} />}
          size="sm"
        >
          {isPositive ? '+' : ''}{changePercent}%
        </Badge>
      </Group>
      <Text size="xs" c="dimmed" mt={4}>
        {t('analytics.vsPreviousPeriod', 'vs. previous period')}
      </Text>
    </Paper>
  );
};

KpiCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  changePercent: PropTypes.number.isRequired,
};

export default Analytics;
