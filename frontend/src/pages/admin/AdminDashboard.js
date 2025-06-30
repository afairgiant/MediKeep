import React, { useState } from 'react';
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
} from '@tabler/icons-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAdminData } from '../../hooks/useAdminData';
import { adminApiService } from '../../services/api/adminApi';
import { formatDate, formatDateTime } from '../../utils/helpers';
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

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');

  // Dashboard Stats with auto-refresh
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
    autoRefresh: true,
    refreshInterval: 30000,
  });

  // Recent Activity
  const {
    data: recentActivity,
    loading: activityLoading,
    error: activityError,
    refreshData: refreshActivity,
  } = useAdminData({
    entityName: 'Recent Activity',
    apiMethodsConfig: {
      load: signal => adminApiService.getRecentActivity(15, signal),
    },
    autoRefresh: true,
    refreshInterval: 30000,
  });

  // System Health
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
    autoRefresh: true,
    refreshInterval: 30000,
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
      load: signal => adminApiService.getAnalyticsData(7, signal),
    },
  });

  const loading =
    statsLoading || activityLoading || healthLoading || analyticsLoading;

  const handleRefreshAll = async () => {
    await Promise.all([
      refreshStats(true),
      refreshActivity(true),
      refreshHealth(true),
      refreshAnalytics(true),
    ]);
  };

  const getHealthStatusColor = status => {
    switch (status?.toLowerCase()) {
      case 'healthy':
        return '#10b981';
      case 'warning':
        return '#f59e0b';
      case 'error':
      case 'critical':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getActivityIcon = (modelName, action) => {
    const baseIcons = {
      User: '👥',
      Patient: '🏥',
      LabResult: '🧪',
      Medication: '💊',
      Procedure: '🩺',
      Allergy: '⚠️',
      Immunization: '💉',
      Condition: '📋',
    };

    const actionModifiers = {
      created: '✨',
      updated: '📝',
      deleted: '🗑️',
      viewed: '👁️',
      downloaded: '📥',
    };

    const baseIcon = baseIcons[modelName] || '📄';
    const actionIcon = actionModifiers[action?.toLowerCase()] || '';
    return actionIcon ? `${actionIcon} ${baseIcon}` : baseIcon;
  };

  const createChartData = () => ({
    activity: {
      labels: analyticsData?.weekly_activity?.labels || [
        'Mon',
        'Tue',
        'Wed',
        'Thu',
        'Fri',
        'Sat',
        'Sun',
      ],
      datasets: [
        {
          label: 'User Activity',
          data: analyticsData?.weekly_activity?.data || [0, 0, 0, 0, 0, 0, 0],
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
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
            '#3b82f6',
            '#10b981',
            '#f59e0b',
            '#ef4444',
            '#8b5cf6',
            '#06b6d4',
          ],
          borderWidth: 0,
        },
      ],
    },
  });

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

  const chartData = createChartData();

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
          />
          <StatCard
            icon={IconStethoscope}
            value={stats?.total_patients || 0}
            label="Active Patients"
            color="green"
          />
          <StatCard
            icon={IconFlask}
            value={stats?.total_lab_results || 0}
            label="Lab Results"
            color="orange"
          />
          <StatCard
            icon={IconPill}
            value={stats?.total_medications || 0}
            label="Medications"
            change={`${stats?.active_medications || 0} active prescriptions`}
            color="cyan"
          />
          <StatCard
            icon={IconHeart}
            value={stats?.total_vitals || 0}
            label="Vital Signs"
            color="red"
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
                    <Line
                      data={chartData.activity}
                      options={createLineChartOptions()}
                    />
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
                    <Doughnut
                      data={chartData.distribution}
                      options={createDoughnutChartOptions()}
                    />
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
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, lg: 6 }}>
                <ActivityCard
                  activities={recentActivity || []}
                  loading={activityLoading}
                  error={activityError}
                  getActivityIcon={getActivityIcon}
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
const StatCard = ({ icon: IconComponent, value, label, change, color }) => (
  <Card shadow="sm" p="lg" withBorder>
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

// Reusable SystemHealthCard Component
const SystemHealthCard = ({
  systemHealth,
  loading,
  error,
  getHealthStatusColor,
}) => (
  <Card shadow="sm" p="lg" withBorder h="100%">
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

// Reusable ActivityCard Component
const ActivityCard = ({ activities, loading, error, getActivityIcon }) => (
  <Card shadow="sm" p="lg" withBorder h="100%">
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
      <Stack gap="sm" mah={300} style={{ overflowY: 'auto' }}>
        {activities.length > 0 ? (
          activities.map((activity, index) => (
            <ActivityItem
              key={index}
              activity={activity}
              icon={getActivityIcon(activity.model_name, activity.action)}
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
    )}
  </Card>
);

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

    <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="md">
      <ActionButton
        href="/admin/data-models"
        icon={IconDatabase}
        title="Data Models"
        desc="View and manage database tables"
        color="blue"
      />
      <ActionButton
        href="/admin/models/user"
        icon={IconUserCog}
        title="Manage Users"
        desc="User account management"
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
        href="/admin/bulk-operations"
        icon={IconSettings}
        title="Bulk Operations"
        desc="Batch operations"
        color="cyan"
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

const ActivityItem = ({ activity, icon }) => (
  <Paper p="sm" withBorder>
    <Group justify="space-between">
      <Group>
        <Text size="sm">{icon}</Text>
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
            <Badge
              size="xs"
              variant="light"
              color={
                activity.action === 'deleted'
                  ? 'red'
                  : activity.action === 'updated'
                    ? 'blue'
                    : activity.action === 'viewed'
                      ? 'cyan'
                      : 'green'
              }
            >
              {activity.action || 'created'}
            </Badge>
          </Group>
        </div>
      </Group>
    </Group>
  </Paper>
);

const ActionButton = ({ href, icon: IconComponent, title, desc, color }) => (
  <Paper
    p="md"
    withBorder
    style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
    onClick={() => (window.location.href = href)}
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

// Chart Configuration Functions
const createLineChartOptions = () => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    y: { beginAtZero: true, title: { display: true, text: 'Activities' } },
    x: { title: { display: true, text: 'Day of Week' } },
  },
});

const createDoughnutChartOptions = () => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom' } },
});

export default AdminDashboard;
