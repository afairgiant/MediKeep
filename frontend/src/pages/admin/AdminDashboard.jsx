import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
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
  ActionIcon,
  Tabs,
  Stack,
  SimpleGrid,
  Paper,
  Center,
  Loader,
  Alert,
  ThemeIcon,
  Progress,
  Divider,
  LoadingOverlay,
} from '@mantine/core';
import {
  IconRefresh,
  IconChartBar,
  IconEye,
  IconUsers,
  IconStethoscope,
  IconFlask,
  IconPill,
  IconHeart,
  IconDatabase,
  IconActivity,
  IconSettings,
  IconReportAnalytics,
  IconUserCog,
  IconTrendingUp,
  IconClock,
  IconShieldCheck,
  IconAlertCircle,
  IconArrowRight,
  IconTrash,
} from '@tabler/icons-react';
import AdminLayout from '../../components/admin/AdminLayout';
import ChartErrorBoundary from '../../components/shared/ChartErrorBoundary';
import { useAdminData } from '../../hooks/useAdminData';
import { adminApiService } from '../../services/api/adminApi';
import { useDateFormat } from '../../hooks/useDateFormat';
import useThemeColors from '../../hooks/useThemeColors';
import logger from '../../services/logger';
import './AdminDashboard.css';

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

// Dashboard Configuration Constants
const DASHBOARD_CONFIG = {
  RECENT_ACTIVITY_LIMIT: 15,
  ANALYTICS_DAYS: 7,
  REFRESH_INTERVAL: 30000,
  ACTIVITY_MAX_HEIGHT: 300,
  DEFAULT_WEEK_LABELS: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  DEFAULT_WEEK_DATA: [0, 0, 0, 0, 0, 0, 0],
};

const AdminDashboard = () => {
  const { formatDate, formatDateTime } = useDateFormat();
  const [activeTab, setActiveTab] = useState('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const themeColors = useThemeColors();

  // Dashboard Stats (no auto-refresh - manual refresh only)
  const {
    data: stats,
    loading: statsLoading,
    error: statsError,
    refreshData: refreshStats,
  } = useAdminData({
    entityName: 'Dashboard Statistics',
    apiMethodsConfig: {
      load: signal => adminApiService.getDashboardStats(signal),
    },
    autoRefresh: false,
  });

  // Recent Activity (staggered refresh)
  const {
    data: recentActivity,
    loading: activityLoading,
    error: activityError,
    refreshData: refreshActivity,
  } = useAdminData({
    entityName: 'Recent Activity',
    apiMethodsConfig: {
      load: signal => adminApiService.getRecentActivity(DASHBOARD_CONFIG.RECENT_ACTIVITY_LIMIT, signal),
    },
    autoRefresh: false,
  });

  // System Health (staggered refresh)
  const {
    data: systemHealth,
    loading: healthLoading,
    error: healthError,
    refreshData: refreshHealth,
  } = useAdminData({
    entityName: 'System Health',
    apiMethodsConfig: {
      load: signal => adminApiService.getSystemHealth(signal),
    },
    autoRefresh: false,
  });

  // Analytics Data
  const {
    data: analyticsData,
    loading: analyticsLoading,
    error: analyticsError,
    refreshData: refreshAnalytics,
  } = useAdminData({
    entityName: 'Analytics Data',
    apiMethodsConfig: {
      load: signal => adminApiService.getAnalyticsData(DASHBOARD_CONFIG.ANALYTICS_DAYS, signal),
    },
  });

  const loading =
    statsLoading || activityLoading || healthLoading || analyticsLoading;

  // Note: Auto-refresh disabled to reduce log noise and unnecessary API calls
  // Users can manually refresh using the "Refresh All" button

  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshStats(true),
        refreshActivity(true),
        refreshHealth(true),
        refreshAnalytics(true),
      ]);
    } catch (error) {
      logger.error('refresh_all_failed', 'Failed to refresh dashboard data', {
        component: 'AdminDashboard',
        error: error.message,
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshStats, refreshActivity, refreshHealth, refreshAnalytics]);

  const getHealthStatusColor = status => {
    switch (status?.toLowerCase()) {
      case 'healthy':
        return themeColors.success;
      case 'warning':
        return themeColors.warning;
      case 'error':
      case 'critical':
        return themeColors.danger;
      default:
        return themeColors.textSecondary;
    }
  };

  const chartData = useMemo(() => {
    return {
      activity: {
        labels: analyticsData?.weekly_activity?.labels || DASHBOARD_CONFIG.DEFAULT_WEEK_LABELS,
        datasets: [
          {
            label: 'User Activity',
            data: analyticsData?.weekly_activity?.data || DASHBOARD_CONFIG.DEFAULT_WEEK_DATA,
            borderColor: themeColors.primary,
            backgroundColor: `${themeColors.primary}1a`,
            tension: 0.4,
          },
        ],
      },
      distribution: {
        labels: [
          'Patients',
          'Lab Results',
          'Medications',
          'Procedures',
          'Allergies',
          'Vitals',
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
    };
  }, [analyticsData, stats, themeColors]);

  // Memoized chart configuration options
  const lineChartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
          labels: {
            color: themeColors.textPrimary,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Activities', color: themeColors.textPrimary },
          ticks: { color: themeColors.textPrimary },
          grid: { color: themeColors.borderLight },
        },
        x: {
          title: { display: true, text: 'Day of Week', color: themeColors.textPrimary },
          ticks: { color: themeColors.textPrimary },
          grid: { color: themeColors.borderLight },
        },
      },
    };
  }, [themeColors]);

  const doughnutChartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: themeColors.textPrimary,
          },
        },
      },
    };
  }, [themeColors]);

  if (loading && !stats) {
    return (
      <AdminLayout>
        <Center h={400}>
          <Stack align="center">
            <Loader size="lg" />
            <Text c="dimmed">Loading comprehensive dashboard...</Text>
          </Stack>
        </Center>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="admin-dashboard-modern">
        {/* Dashboard Header */}
        <Card shadow="sm" p="xl" mb="xl" withBorder>
          <Group justify="space-between" align="flex-start">
            <div>
              <Group align="center" mb="xs">
                <ThemeIcon size="xl" variant="light" color="blue">
                  <IconStethoscope size={24} />
                </ThemeIcon>
                <Text size="xl" fw={700}>
                  Admin Dashboard
                </Text>
              </Group>
              <Text c="dimmed" size="md">
                Comprehensive system overview and management
              </Text>
            </div>
            <Group>
              <Button
                leftSection={<IconRefresh size={16} />}
                onClick={handleRefreshAll}
                loading={loading}
                variant="light"
              >
                Refresh All
              </Button>
            </Group>
          </Group>
        </Card>

        {/* Quick Stats Grid */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 5 }} mb="xl">
          <StatCard
            icon={IconUsers}
            value={stats?.total_users || 0}
            label="Total Users"
            change={`+${stats?.recent_registrations || 0} this week`}
            color="blue"
            href="/admin/models/user"
          />
          <StatCard
            icon={IconStethoscope}
            value={stats?.total_patients || 0}
            label="Active Patients"
            color="green"
            href="/admin/models/patient"
          />
          <StatCard
            icon={IconFlask}
            value={stats?.total_lab_results || 0}
            label="Lab Results"
            color="orange"
            href="/admin/models/lab_result"
          />
          <StatCard
            icon={IconPill}
            value={stats?.total_medications || 0}
            label="Medications"
            change={`${stats?.active_medications || 0} active prescriptions`}
            color="cyan"
            href="/admin/models/medication"
          />
          <StatCard
            icon={IconHeart}
            value={stats?.total_vitals || 0}
            label="Vital Signs"
            color="red"
            href="/admin/models/vitals"
          />
        </SimpleGrid>

        {/* Main Dashboard Content with Tabs */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List mb="xl">
            <Tabs.Tab value="overview" leftSection={<IconEye size={16} />}>
              Overview
            </Tabs.Tab>
            <Tabs.Tab
              value="analytics"
              leftSection={<IconChartBar size={16} />}
            >
              Analytics
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="analytics">
            <Grid>
              <Grid.Col span={{ base: 12, md: 8 }}>
                <Card shadow="sm" p="lg" withBorder>
                  <Group justify="space-between" mb="md">
                    <div>
                      <Text size="lg" fw={600}>
                        Weekly Activity Trend
                      </Text>
                      <Text size="sm" c="dimmed">
                        User interactions over the past week
                      </Text>
                    </div>
                    <Badge variant="light" color="blue">
                      Analytics
                    </Badge>
                  </Group>

                  {analyticsData?.weekly_activity && (
                    <Group mb="md">
                      <Text size="sm" c="dimmed">
                        Total: {analyticsData.weekly_activity.total} activities
                      </Text>
                      {analyticsData.date_range && (
                        <Text size="sm" c="dimmed">
                          ({analyticsData.date_range.start} to{' '}
                          {analyticsData.date_range.end})
                        </Text>
                      )}
                    </Group>
                  )}

                  <div className="chart-container">
                    <ChartErrorBoundary onReset={refreshAnalytics}>
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
                        Records Distribution
                      </Text>
                      <Text size="sm" c="dimmed">
                        Breakdown by type
                      </Text>
                    </div>
                  </Group>

                  <div className="chart-container doughnut">
                    <ChartErrorBoundary onReset={refreshStats}>
                      <Doughnut
                        data={chartData.distribution}
                        options={doughnutChartOptions}
                      />
                    </ChartErrorBoundary>
                  </div>
                </Card>
              </Grid.Col>
            </Grid>
          </Tabs.Panel>

          <Tabs.Panel value="overview">
            <Grid>
              <Grid.Col span={{ base: 12, lg: 6 }}>
                <SystemHealthCard
                  systemHealth={systemHealth}
                  loading={healthLoading}
                  error={healthError}
                  getHealthStatusColor={getHealthStatusColor}
                  isRefreshing={isRefreshing}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, lg: 6 }}>
                <ActivityCard
                  activities={recentActivity || []}
                  loading={activityLoading}
                  error={activityError}
                  isRefreshing={isRefreshing}
                />
              </Grid.Col>

              <Grid.Col span={12}>
                <QuickActionsCard />
              </Grid.Col>
            </Grid>
          </Tabs.Panel>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

// Reusable StatCard Component
const StatCard = ({ icon: IconComponent, value, label, change, color, href }) => {
  const navigate = useNavigate();

  return (
    <Card
      shadow="sm"
      p="lg"
      withBorder
      onClick={href ? () => navigate(href) : undefined}
      className={href ? 'action-button-hover' : undefined}
    >
      <Group justify="space-between" mb="xs">
        <ThemeIcon size="lg" variant="light" color={color}>
          <IconComponent size={20} />
        </ThemeIcon>
        <Badge variant="light" color={color} size="sm">
          <IconTrendingUp size={12} />
        </Badge>
      </Group>

      <Text size="xl" fw={700} mb="xs">
        {value}
      </Text>

      <Text size="sm" fw={500} mb="xs">
        {label}
      </Text>

      <Text size="xs" c="dimmed">
        {change}
      </Text>
    </Card>
  );
};

StatCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  label: PropTypes.string.isRequired,
  change: PropTypes.string,
  color: PropTypes.string.isRequired,
  href: PropTypes.string,
};

// Reusable SystemHealthCard Component
const SystemHealthCard = ({
  systemHealth,
  loading,
  error,
  getHealthStatusColor,
  isRefreshing = false,
}) => {
  const { formatDate } = useDateFormat();

  return (
  <Card shadow="sm" p="lg" withBorder h="100%" style={{ position: 'relative' }}>
    <LoadingOverlay visible={isRefreshing} />
    <Group justify="space-between" mb="md">
      <Group>
        <ThemeIcon size="lg" variant="light" color="blue">
          <IconShieldCheck size={20} />
        </ThemeIcon>
        <div>
          <Text size="lg" fw={600}>
            System Health
          </Text>
          <Text size="sm" c="dimmed">
            Current system status
          </Text>
        </div>
      </Group>
      <Badge
        color={systemHealth?.database_status === 'healthy' ? 'green' : 'orange'}
        variant="light"
      >
        {systemHealth?.database_status || 'Unknown'}
      </Badge>
    </Group>

    {loading && (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    )}

    {error && (
      <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
        Error loading system health
      </Alert>
    )}

    {!loading && !error && (
      <Stack gap="md">
        <HealthMetric
          icon={IconDatabase}
          label="Database Status"
          value={systemHealth?.database_status || 'Unknown'}
          color="blue"
        />
        <HealthMetric
          icon={IconReportAnalytics}
          label="Total Records"
          value={systemHealth?.total_records || 0}
          color="green"
        />
        <HealthMetric
          icon={IconClock}
          label="Uptime"
          value={systemHealth?.system_uptime || 'Unknown'}
          color="orange"
        />
        <HealthMetric
          icon={IconDatabase}
          label="Last Backup"
          value={
            systemHealth?.last_backup
              ? formatDate(systemHealth.last_backup)
              : 'No backup'
          }
          color="purple"
        />
      </Stack>
    )}
  </Card>
  );
};

SystemHealthCard.propTypes = {
  systemHealth: PropTypes.shape({
    database_status: PropTypes.string,
    total_records: PropTypes.number,
    system_uptime: PropTypes.string,
    last_backup: PropTypes.string,
  }),
  loading: PropTypes.bool.isRequired,
  error: PropTypes.object,
  getHealthStatusColor: PropTypes.func.isRequired,
  isRefreshing: PropTypes.bool,
};

// Reusable ActivityCard Component
const ActivityCard = ({ activities, loading, error, isRefreshing = false }) => {
  const getActivityIcon = (modelName, action) => {
    const iconMap = {
      User: IconUsers,
      Patient: IconStethoscope,
      LabResult: IconFlask,
      Medication: IconPill,
      Procedure: IconHeart,
      Allergy: IconAlertCircle,
      Immunization: IconShieldCheck,
      Condition: IconReportAnalytics,
    };

    const IconComponent = iconMap[modelName] || IconReportAnalytics;

    const colorMap = {
      created: 'green',
      updated: 'blue',
      deleted: 'red',
      viewed: 'cyan',
      downloaded: 'violet',
    };

    const color = colorMap[action?.toLowerCase()] || 'gray';

    return { IconComponent, color };
  };

  return (
    <Card shadow="sm" p="lg" withBorder h="100%" style={{ position: 'relative' }}>
      <LoadingOverlay visible={isRefreshing} />
      <Group justify="space-between" mb="md">
        <Group>
          <ThemeIcon size="lg" variant="light" color="green">
            <IconActivity size={20} />
          </ThemeIcon>
          <div>
            <Text size="lg" fw={600}>
              Recent Activity
            </Text>
            <Text size="sm" c="dimmed">
              Latest system events
            </Text>
          </div>
        </Group>
        <Badge variant="light" color="green">
          {activities.length} activities
        </Badge>
      </Group>

      {loading && (
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      )}

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
          Error loading activity
        </Alert>
      )}

      {!loading && !error && (
        <>
          <Stack gap="sm" mah={DASHBOARD_CONFIG.ACTIVITY_MAX_HEIGHT} style={{ overflowY: 'auto' }}>
            {activities.length > 0 ? (
              activities.map((activity, index) => (
                <ActivityItem
                  key={index}
                  activity={activity}
                  iconData={getActivityIcon(activity.model_name, activity.action)}
                />
              ))
            ) : (
              <Center py="xl">
                <Stack align="center">
                  <ThemeIcon size="xl" variant="light" color="gray">
                    <IconActivity size={24} />
                  </ThemeIcon>
                  <Text c="dimmed" size="sm">
                    No recent activity to display
                  </Text>
                </Stack>
              </Center>
            )}
          </Stack>
          {activities.length > 0 && (
            <Button
              variant="subtle"
              fullWidth
              mt="md"
              rightSection={<IconArrowRight size={16} />}
              disabled
              title="Available when Audit Log page is added"
            >
              View All Activity
            </Button>
          )}
        </>
      )}
    </Card>
  );
};

ActivityCard.propTypes = {
  activities: PropTypes.arrayOf(
    PropTypes.shape({
      model_name: PropTypes.string,
      action: PropTypes.string,
      description: PropTypes.string,
      timestamp: PropTypes.string,
    })
  ).isRequired,
  loading: PropTypes.bool.isRequired,
  error: PropTypes.object,
  isRefreshing: PropTypes.bool,
};

// Reusable QuickActionsCard Component
const QuickActionsCard = () => (
  <Card shadow="sm" p="lg" withBorder>
    <Group mb="md">
      <ThemeIcon size="lg" variant="light" color="violet">
        <IconSettings size={20} />
      </ThemeIcon>
      <div>
        <Text size="lg" fw={600}>
          Quick Actions
        </Text>
        <Text size="sm" c="dimmed">
          Common administrative tasks
        </Text>
      </div>
    </Group>

    <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md">
      <ActionButton
        href="/admin/data-models"
        icon={IconDatabase}
        title="Data Models"
        desc="View and manage database tables"
        color="blue"
      />
      <ActionButton
        href="/admin/create-user"
        icon={IconUserCog}
        title="Create New User"
        desc="Create user account with patient profile"
        color="green"
      />
      <ActionButton
        href="/admin/system-health"
        icon={IconShieldCheck}
        title="System Health"
        desc="Monitor system status"
        color="orange"
      />
      <ActionButton
        href="/admin/backup"
        icon={IconDatabase}
        title="Backups"
        desc="Backup management"
        color="purple"
      />
      <ActionButton
        href="/admin/settings"
        icon={IconSettings}
        title="Settings"
        desc="System configuration"
        color="gray"
      />
      <ActionButton
        href="/admin/models/user"
        icon={IconUsers}
        title="Manage Users"
        desc="View and manage user accounts"
        color="teal"
      />
      <ActionButton
        href="/admin/audit-log"
        icon={IconActivity}
        title="Audit Log"
        desc="View system activity log"
        color="red"
      />
      <ActionButton
        href="/admin/trash"
        icon={IconTrash}
        title="Trash"
        desc="Recover deleted records"
        color="yellow"
      />
    </SimpleGrid>
  </Card>
);

// Helper Components
const HealthMetric = ({ icon: IconComponent, label, value, color }) => (
  <Group>
    <ThemeIcon size="md" variant="light" color={color}>
      <IconComponent size={16} />
    </ThemeIcon>
    <div>
      <Text size="xs" c="dimmed" fw={500}>
        {label}
      </Text>
      <Text size="sm" fw={600}>
        {value}
      </Text>
    </div>
  </Group>
);

HealthMetric.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  color: PropTypes.string.isRequired,
};

const ActivityItem = ({ activity, iconData }) => {
  const { IconComponent, color } = iconData;
  const { formatDateTime } = useDateFormat();

  return (
    <Paper p="sm" withBorder>
      <Group justify="space-between">
        <Group>
          <ThemeIcon size="md" variant="light" color={color}>
            <IconComponent size={16} />
          </ThemeIcon>
          <div>
            <Text size="sm" fw={500} lineClamp={1}>
              {activity.description}
            </Text>
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                {formatDateTime(activity.timestamp)}
              </Text>
              <Badge size="xs" variant="light" color="gray">
                {activity.model_name}
              </Badge>
              <Badge size="xs" variant="light" color={color}>
                {activity.action || 'created'}
              </Badge>
            </Group>
          </div>
        </Group>
      </Group>
    </Paper>
  );
};

ActivityItem.propTypes = {
  activity: PropTypes.shape({
    model_name: PropTypes.string,
    action: PropTypes.string,
    description: PropTypes.string.isRequired,
    timestamp: PropTypes.string.isRequired,
  }).isRequired,
  iconData: PropTypes.shape({
    IconComponent: PropTypes.elementType.isRequired,
    color: PropTypes.string.isRequired,
  }).isRequired,
};

const ActionButton = ({ href, icon: IconComponent, title, desc, color }) => {
  const navigate = useNavigate();

  return (
    <Paper
      p="md"
      withBorder
      onClick={() => navigate(href)}
      className="action-button-hover"
    >
      <Stack align="center" gap="xs">
        <ThemeIcon size="lg" variant="light" color={color}>
          <IconComponent size={20} />
        </ThemeIcon>
        <div style={{ textAlign: 'center' }}>
          <Text size="sm" fw={600} mb="xs">
            {title}
          </Text>
          <Text size="xs" c="dimmed" lineClamp={2}>
            {desc}
          </Text>
        </div>
      </Stack>
    </Paper>
  );
};

ActionButton.propTypes = {
  href: PropTypes.string.isRequired,
  icon: PropTypes.elementType.isRequired,
  title: PropTypes.string.isRequired,
  desc: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
};

export default AdminDashboard;
