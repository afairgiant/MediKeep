import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  Alert,
  ThemeIcon,
  LoadingOverlay,
} from '@mantine/core';
import {
  IconRefresh,
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
import { useAdminData } from '../../hooks/useAdminData';
import { adminApiService } from '../../services/api/adminApi';
import { useDateFormat } from '../../hooks/useDateFormat';
import logger from '../../services/logger';
import './AdminDashboard.css';

const DASHBOARD_CONFIG = {
  RECENT_ACTIVITY_LIMIT: 15,
  ACTIVITY_MAX_HEIGHT: 300,
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('admin');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dashboard Stats (no auto-refresh - manual refresh only)
  const {
    data: stats,
    loading: statsLoading,
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

  const loading = statsLoading || activityLoading || healthLoading;

  // Note: Auto-refresh disabled to reduce log noise and unnecessary API calls
  // Users can manually refresh using the "Refresh All" button

  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshStats(true),
        refreshActivity(true),
        refreshHealth(true),
      ]);
    } catch (error) {
      logger.error('Failed to refresh dashboard data', {
        component: 'AdminDashboard',
        event: 'refresh_all_failed',
        error: error.message,
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshStats, refreshActivity, refreshHealth]);

  if (loading && !stats) {
    return (
      <AdminLayout>
        <Center h={400}>
          <Stack align="center">
            <Loader size="lg" />
            <Text c="dimmed">{t('dashboard.loading', 'Loading comprehensive dashboard...')}</Text>
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
                <ThemeIcon size="xl" variant="light" color="blue" aria-hidden="true">
                  <IconStethoscope size={24} />
                </ThemeIcon>
                <Text size="xl" fw={700}>
                  {t('dashboard.title', 'Admin Dashboard')}
                </Text>
              </Group>
              <Text c="dimmed" size="md">
                {t('dashboard.subtitle', 'Comprehensive system overview and management')}
              </Text>
            </div>
            <Group>
              <Button
                leftSection={<IconRefresh size={16} />}
                onClick={handleRefreshAll}
                loading={loading}
                variant="light"
              >
                {t('dashboard.refreshAll', 'Refresh All')}
              </Button>
            </Group>
          </Group>
        </Card>

        {/* Quick Stats Grid */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 5 }} mb="xl">
          <StatCard
            icon={IconUsers}
            value={stats?.total_users || 0}
            label={t('dashboard.stats.totalUsers', 'Total Users')}
            change={t('dashboard.stats.recentRegistrations', '+{{count}} this week', { count: stats?.recent_registrations || 0 })}
            color="blue"
            href="/admin/models/user"
          />
          <StatCard
            icon={IconStethoscope}
            value={stats?.total_patients || 0}
            label={t('dashboard.stats.activePatients', 'Active Patients')}
            color="green"
            href="/admin/models/patient"
          />
          <StatCard
            icon={IconFlask}
            value={stats?.total_lab_results || 0}
            label={t('dashboard.stats.labResults', 'Lab Results')}
            color="orange"
            href="/admin/models/lab_result"
          />
          <StatCard
            icon={IconPill}
            value={stats?.total_medications || 0}
            label={t('dashboard.stats.medications', 'Medications')}
            change={t('dashboard.stats.activePrescriptions', '{{count}} active prescriptions', { count: stats?.active_medications || 0 })}
            color="cyan"
            href="/admin/models/medication"
          />
          <StatCard
            icon={IconHeart}
            value={stats?.total_vitals || 0}
            label={t('dashboard.stats.vitalSigns', 'Vital Signs')}
            color="red"
            href="/admin/models/vitals"
          />
        </SimpleGrid>

        {/* Main Dashboard Content */}
        <Grid>
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <SystemHealthCard
              systemHealth={systemHealth}
              loading={healthLoading}
              error={healthError}
              isRefreshing={isRefreshing}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 6 }}>
            <ActivityCard
              activities={recentActivity || []}
              loading={activityLoading}
              error={activityError}
              isRefreshing={isRefreshing}
              onViewAll={() => navigate('/admin/audit-log')}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <QuickActionsCard />
          </Grid.Col>
        </Grid>
      </div>
    </AdminLayout>
  );
};

// Reusable StatCard Component
const StatCard = ({ icon: IconComponent, value, label, change, color, href }) => {
  const navigate = useNavigate();

  const handleNavigation = href ? () => navigate(href) : undefined;

  const handleKeyDown = href
    ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleNavigation();
        }
      }
    : undefined;

  return (
    <Card
      shadow="sm"
      p="lg"
      withBorder
      onClick={handleNavigation}
      onKeyDown={handleKeyDown}
      role={href ? 'button' : undefined}
      tabIndex={href ? 0 : undefined}
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
  isRefreshing = false,
}) => {
  const { formatDate } = useDateFormat();
  const { t } = useTranslation('admin');

  return (
  <Card shadow="sm" p="lg" withBorder h="100%" style={{ position: 'relative' }}>
    <LoadingOverlay visible={isRefreshing} />
    <Group justify="space-between" mb="md">
      <Group>
        <ThemeIcon size="lg" variant="light" color="blue" aria-hidden="true">
          <IconShieldCheck size={20} />
        </ThemeIcon>
        <div>
          <Text size="lg" fw={600}>
            {t('dashboard.systemHealth.title', 'System Health')}
          </Text>
          <Text size="sm" c="dimmed">
            {t('dashboard.systemHealth.subtitle', 'Current system status')}
          </Text>
        </div>
      </Group>
      <Badge
        color={systemHealth?.database_status === 'healthy' ? 'green' : 'orange'}
        variant="light"
      >
        {systemHealth?.database_status || t('shared.unknown', 'Unknown')}
      </Badge>
    </Group>

    {loading && (
      <Center py="xl">
        <Loader size="sm" />
      </Center>
    )}

    {error && (
      <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
        {t('dashboard.systemHealth.errorLoading', 'Error loading system health')}
      </Alert>
    )}

    {!loading && !error && (
      <Stack gap="md">
        <HealthMetric
          icon={IconDatabase}
          label={t('dashboard.systemHealth.databaseStatus', 'Database Status')}
          value={systemHealth?.database_status || t('shared.unknown', 'Unknown')}
          color="blue"
        />
        <HealthMetric
          icon={IconReportAnalytics}
          label={t('dashboard.systemHealth.totalRecords', 'Total Records')}
          value={systemHealth?.total_records || 0}
          color="green"
        />
        <HealthMetric
          icon={IconClock}
          label={t('dashboard.systemHealth.uptime', 'Uptime')}
          value={systemHealth?.system_uptime || t('shared.unknown', 'Unknown')}
          color="orange"
        />
        <HealthMetric
          icon={IconDatabase}
          label={t('dashboard.systemHealth.lastBackup', 'Last Backup')}
          value={
            systemHealth?.last_backup
              ? formatDate(systemHealth.last_backup)
              : t('dashboard.systemHealth.noBackup', 'No backup')
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
  isRefreshing: PropTypes.bool,
};

// Reusable ActivityCard Component
const ActivityCard = ({ activities, loading, error, isRefreshing = false, onViewAll }) => {
  const { t } = useTranslation('admin');

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
          <ThemeIcon size="lg" variant="light" color="green" aria-hidden="true">
            <IconActivity size={20} />
          </ThemeIcon>
          <div>
            <Text size="lg" fw={600}>
              {t('dashboard.recentActivity.title', 'Recent Activity')}
            </Text>
            <Text size="sm" c="dimmed">
              {t('dashboard.recentActivity.subtitle', 'Latest system events')}
            </Text>
          </div>
        </Group>
        <Badge variant="light" color="green">
          {t('dashboard.recentActivity.count', '{{count}} activities', { count: activities.length })}
        </Badge>
      </Group>

      {loading && (
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      )}

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
          {t('dashboard.recentActivity.errorLoading', 'Error loading activity')}
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
                    {t('dashboard.recentActivity.noActivity', 'No recent activity to display')}
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
              onClick={onViewAll}
            >
              {t('dashboard.recentActivity.viewAll', 'View All Activity')}
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
  onViewAll: PropTypes.func,
};

// Reusable QuickActionsCard Component
const QuickActionsCard = () => {
  const { t } = useTranslation('admin');

  return (
    <Card shadow="sm" p="lg" withBorder>
      <Group mb="md">
        <ThemeIcon size="lg" variant="light" color="violet" aria-hidden="true">
          <IconSettings size={20} />
        </ThemeIcon>
        <div>
          <Text size="lg" fw={600}>
            {t('dashboard.quickActions.title', 'Quick Actions')}
          </Text>
          <Text size="sm" c="dimmed">
            {t('dashboard.quickActions.subtitle', 'Common administrative tasks')}
          </Text>
        </div>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md">
        <ActionButton
          href="/admin/data-models"
          icon={IconDatabase}
          title={t('dashboard.quickActions.dataModels', 'Data Models')}
          desc={t('dashboard.quickActions.dataModelsDesc', 'View and manage database tables')}
          color="blue"
        />
        <ActionButton
          href="/admin/create-user"
          icon={IconUserCog}
          title={t('dashboard.quickActions.createUser', 'Create New User')}
          desc={t('dashboard.quickActions.createUserDesc', 'Create user account with patient profile')}
          color="green"
        />
        <ActionButton
          href="/admin/system-health"
          icon={IconShieldCheck}
          title={t('dashboard.quickActions.systemHealth', 'System Health')}
          desc={t('dashboard.quickActions.systemHealthDesc', 'Monitor system status')}
          color="orange"
        />
        <ActionButton
          href="/admin/backup"
          icon={IconDatabase}
          title={t('dashboard.quickActions.backups', 'Backups')}
          desc={t('dashboard.quickActions.backupsDesc', 'Backup management')}
          color="purple"
        />
        <ActionButton
          href="/admin/settings"
          icon={IconSettings}
          title={t('dashboard.quickActions.settings', 'Settings')}
          desc={t('dashboard.quickActions.settingsDesc', 'System configuration')}
          color="gray"
        />
        <ActionButton
          href="/admin/models/user"
          icon={IconUsers}
          title={t('dashboard.quickActions.manageUsers', 'Manage Users')}
          desc={t('dashboard.quickActions.manageUsersDesc', 'View and manage user accounts')}
          color="teal"
        />
        <ActionButton
          href="/admin/audit-log"
          icon={IconActivity}
          title={t('dashboard.quickActions.auditLog', 'Audit Log')}
          desc={t('dashboard.quickActions.auditLogDesc', 'View system activity log')}
          color="red"
        />
        <ActionButton
          href="/admin/trash"
          icon={IconTrash}
          title={t('dashboard.quickActions.trash', 'Trash')}
          desc={t('dashboard.quickActions.trashDesc', 'Recover deleted files')}
          color="yellow"
        />
      </SimpleGrid>
    </Card>
  );
};

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

const ActionButton = ({ href, icon: IconComponent, title, desc, color, disabled }) => {
  const navigate = useNavigate();

  const handleClick = disabled ? undefined : () => navigate(href);

  const handleKeyDown = disabled
    ? undefined
    : (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigate(href);
        }
      };

  return (
    <Paper
      p="md"
      withBorder
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={disabled ? -1 : 0}
      className={disabled ? undefined : 'action-button-hover'}
      style={disabled ? { opacity: 0.5 } : undefined}
      aria-disabled={disabled || undefined}
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
  disabled: PropTypes.bool,
};

export default AdminDashboard;
