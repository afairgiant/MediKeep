import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Group,
  Stack,
  Text,
  Badge,
  Button,
  SimpleGrid,
  Paper,
  Progress,
  Alert,
  ThemeIcon,
  Center,
  Loader,
} from '@mantine/core';
import {
  IconHeartRateMonitor,
  IconShieldCheck,
  IconChartBar,
  IconClock,
  IconDeviceFloppy,
  IconDatabase,
  IconServer,
  IconSettings,
  IconLock,
  IconBolt,
  IconRefresh,
  IconCalendarEvent,
} from '@tabler/icons-react';
import AdminLayout from '../../components/admin/AdminLayout';
import HealthItem, { getHealthColor } from '../../components/admin/HealthItem';
import DirectoryCard from '../../components/admin/DirectoryCard';
import { useAdminData } from '../../hooks/useAdminData';
import { adminApiService } from '../../services/api/adminApi';
import { useDateFormat } from '../../hooks/useDateFormat';
import './SystemHealth.css';

const SSO_PROVIDER_LABELS = {
  google: 'Google OAuth 2.0',
  github: 'GitHub OAuth',
  oidc: 'OpenID Connect',
};

const USAGE_STATUS = {
  low: 'healthy',
  normal: 'warning',
};

const SystemHealth = () => {
  const { formatDate, formatDateTime } = useDateFormat();
  const [lastRefresh, setLastRefresh] = useState(null);

  // System Health Data with auto-refresh
  const {
    data: healthData,
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

  // System Metrics Data
  const {
    data: systemMetrics,
    loading: metricsLoading,
    error: metricsError,
    refreshData: refreshMetrics,
  } = useAdminData({
    entityName: 'System Metrics',
    apiMethodsConfig: {
      load: signal => adminApiService.getSystemMetrics(signal),
    },
    autoRefresh: true,
    refreshInterval: 30000,
  });

  // Dashboard Stats
  const {
    data: detailedStats,
    loading: statsLoading,
    refreshData: refreshStats,
  } = useAdminData({
    entityName: 'Dashboard Statistics',
    apiMethodsConfig: {
      load: signal => adminApiService.getDashboardStats(signal),
    },
  });

  // Storage Health
  const {
    data: storageHealth,
    loading: storageLoading,
    error: storageError,
    refreshData: refreshStorage,
  } = useAdminData({
    entityName: 'Storage Health',
    apiMethodsConfig: {
      load: signal => adminApiService.getStorageHealth(signal),
    },
  });

  // Frontend Log Health
  const {
    data: frontendLogHealth,
    loading: logLoading,
    refreshData: refreshLogs,
  } = useAdminData({
    entityName: 'Frontend Logs',
    apiMethodsConfig: {
      load: signal => adminApiService.getFrontendLogHealth(signal),
    },
  });

  // SSO Configuration
  const {
    data: ssoConfig,
    loading: ssoLoading,
    error: ssoError,
    refreshData: refreshSSO,
  } = useAdminData({
    entityName: 'SSO Configuration',
    apiMethodsConfig: {
      load: () => adminApiService.getSSOConfig(),
    },
  });

  // Backup Schedule
  const [scheduleSettings, setScheduleSettings] = useState(null);
  const loadScheduleSettings = useCallback(async () => {
    try {
      const data = await adminApiService.getAutoBackupSchedule();
      setScheduleSettings(data);
    } catch {
      // Non-critical — leave as null
    }
  }, []);

  useEffect(() => {
    loadScheduleSettings();
  }, [loadScheduleSettings]);

  const loading =
    healthLoading ||
    metricsLoading ||
    statsLoading ||
    storageLoading ||
    logLoading ||
    ssoLoading;

  const handleRefreshAll = async () => {
    setLastRefresh(new Date());
    await Promise.all([
      refreshHealth(true),
      refreshMetrics(true),
      refreshStats(true),
      refreshStorage(true),
      refreshLogs(true),
      refreshSSO(true),
      loadScheduleSettings(),
    ]);
  };

  const getStorageUsageColor = percentage => {
    if (percentage < 70) return 'green';
    if (percentage < 85) return 'yellow';
    return 'red';
  };

  if (loading && !healthData) {
    return (
      <AdminLayout>
        <Center h={400}>
          <Stack align="center">
            <Loader size="lg" />
            <Text c="dimmed">Loading system health...</Text>
          </Stack>
        </Center>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="system-health">
        {/* Header */}
        <Card shadow="sm" p="xl" mb="xl" withBorder>
          <Group justify="space-between" align="flex-start">
            <div>
              <Group align="center" mb="xs">
                <ThemeIcon size="xl" variant="light" color="blue">
                  <IconHeartRateMonitor size={24} />
                </ThemeIcon>
                <Text size="xl" fw={700}>
                  System Health Monitor
                </Text>
              </Group>
              <Text c="dimmed" size="md">
                Real-time system status and performance metrics
              </Text>
            </div>
            <Group>
              {lastRefresh && (
                <Text size="sm" c="dimmed">
                  Last updated: {formatDateTime(lastRefresh.toISOString())}
                </Text>
              )}
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

        {/* Overall System Status */}
        <Card shadow="sm" p="lg" mb="lg" withBorder>
          <Group mb="md">
            <ThemeIcon size="lg" variant="light" color="green">
              <IconShieldCheck size={20} />
            </ThemeIcon>
            <Text fw={600} size="lg">
              Overall System Status
            </Text>
            <Badge
              variant="light"
              color={getHealthColor(healthData?.database_status)}
            >
              {healthData?.database_status || 'Unknown'}
            </Badge>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Paper p="md" withBorder>
              <Group gap="sm" mb="xs">
                <ThemeIcon size="md" variant="light" color="blue">
                  <IconChartBar size={16} />
                </ThemeIcon>
                <Text size="sm" c="dimmed" tt="uppercase" fw={600}>
                  Total Records
                </Text>
              </Group>
              <Text size="xl" fw={700}>
                {healthData?.total_records?.toLocaleString() || 0}
              </Text>
            </Paper>
            <Paper p="md" withBorder>
              <Group gap="sm" mb="xs">
                <ThemeIcon size="md" variant="light" color="orange">
                  <IconClock size={16} />
                </ThemeIcon>
                <Text size="sm" c="dimmed" tt="uppercase" fw={600}>
                  Application Uptime
                </Text>
              </Group>
              <Text size="xl" fw={700}>
                {healthData?.system_uptime || 'Unknown'}
              </Text>
            </Paper>
            <Paper p="md" withBorder>
              <Group gap="sm" mb="xs">
                <ThemeIcon size="md" variant="light" color="violet">
                  <IconDeviceFloppy size={16} />
                </ThemeIcon>
                <Text size="sm" c="dimmed" tt="uppercase" fw={600}>
                  Last Backup
                </Text>
              </Group>
              {healthData?.last_backup ? (
                <Text size="xl" fw={700}>
                  {formatDate(healthData.last_backup)}
                </Text>
              ) : scheduleSettings?.last_run_status === 'failed' ? (
                <Text size="xl" fw={700} c="red">
                  Last run failed
                </Text>
              ) : (
                <Text size="xl" fw={700}>
                  None yet
                </Text>
              )}
              {scheduleSettings?.last_run_status === 'failed' && scheduleSettings.last_run_at && (
                <Text size="xs" c="red" mt={2}>
                  {formatDateTime(scheduleSettings.last_run_at)}
                  {scheduleSettings.last_run_error ? ` — ${scheduleSettings.last_run_error}` : ''}
                </Text>
              )}
              {scheduleSettings?.enabled && (
                <Group gap={4} mt={4}>
                  <IconCalendarEvent size={14} color="var(--mantine-color-green-6)" />
                  <Text size="xs" c="green">
                    Scheduled: {
                      scheduleSettings.preset === 'every_6_hours' ? 'Every 6 hours' :
                      scheduleSettings.preset === 'every_12_hours' ? 'Every 12 hours' :
                      scheduleSettings.preset === 'daily' ? 'Daily' :
                      scheduleSettings.preset === 'weekly' ? 'Weekly' :
                      scheduleSettings.preset
                    }
                  </Text>
                </Group>
              )}
              {scheduleSettings && !scheduleSettings.enabled && !healthData?.last_backup && (
                <Text size="xs" c="dimmed" mt={4}>
                  No schedule configured
                </Text>
              )}
              {scheduleSettings?.next_run_at && scheduleSettings.enabled && (
                <Text size="xs" c="dimmed" mt={2}>
                  Next: {formatDateTime(scheduleSettings.next_run_at)}
                </Text>
              )}
            </Paper>
          </SimpleGrid>
        </Card>

        {/* Database Health */}
        <Card shadow="sm" p="lg" mb="lg" withBorder>
          <Group mb="md">
            <ThemeIcon size="lg" variant="light" color="blue">
              <IconDatabase size={20} />
            </ThemeIcon>
            <Text fw={600} size="lg">
              Database Health
            </Text>
            <Badge
              variant="light"
              color={getHealthColor(healthData?.database_status)}
            >
              {healthData?.database_status || 'Unknown'}
            </Badge>
          </Group>
          {healthError ? (
            <Alert color="red" variant="light">
              {healthError}
            </Alert>
          ) : (
            <Stack gap={0}>
              <HealthItem
                label="Connection Status"
                value={healthData?.database_status || 'Unknown'}
                status={healthData?.database_status}
              />
              <HealthItem
                label="Connection Test"
                value={healthData?.database_connection_test ? 'Passed' : 'Failed'}
                status={healthData?.database_connection_test ? 'healthy' : 'error'}
              />
              <HealthItem
                label="Total Records"
                value={healthData?.total_records?.toLocaleString() || 0}
              />
              {healthData?.disk_usage && (
                <HealthItem label="Database Size" value={healthData.disk_usage} />
              )}
              {detailedStats && (
                <>
                  <HealthItem
                    label="Active Users"
                    value={detailedStats.total_users}
                  />
                  <HealthItem
                    label="Patient Records"
                    value={detailedStats.total_patients}
                  />
                  <HealthItem
                    label="Medical Records"
                    value={
                      (detailedStats.total_medications || 0) +
                      (detailedStats.total_lab_results || 0) +
                      (detailedStats.total_conditions || 0)
                    }
                  />
                </>
              )}
            </Stack>
          )}
        </Card>

        {/* Storage Health */}
        {storageHealth && (
          <Card shadow="sm" p="lg" mb="lg" withBorder>
            <Group mb="md">
              <ThemeIcon size="lg" variant="light" color="cyan">
                <IconServer size={20} />
              </ThemeIcon>
              <Text fw={600} size="lg">
                Storage Health
              </Text>
              <Badge
                variant="light"
                color={getHealthColor(storageHealth.status)}
              >
                {storageHealth.status}
              </Badge>
            </Group>
            {storageError ? (
              <Alert color="red" variant="light">
                {storageError}
              </Alert>
            ) : (
              <Stack>
                {/* App Storage Summary */}
                {storageHealth.app_storage && (
                  <div>
                    <Group justify="space-between" mb="xs">
                      <Text fw={500}>App Storage</Text>
                      <Text size="sm" c="dimmed">
                        {storageHealth.app_storage.total_mb >= 1024
                          ? `${(storageHealth.app_storage.total_mb / 1024).toFixed(2)} GB`
                          : `${storageHealth.app_storage.total_mb.toFixed(2)} MB`}
                        {' '}across {storageHealth.app_storage.total_files} files
                      </Text>
                    </Group>
                  </div>
                )}

                {/* Disk Usage */}
                {storageHealth.disk_space && (
                  <div>
                    <Group justify="space-between" mb="xs">
                      <Text fw={500}>Disk Usage</Text>
                      <Text size="sm" c="dimmed">
                        {storageHealth.disk_space.usage_percent}% (
                        {storageHealth.disk_space.free_gb} GB free of {storageHealth.disk_space.total_gb} GB)
                      </Text>
                    </Group>
                    <Progress
                      value={storageHealth.disk_space.usage_percent}
                      color={getStorageUsageColor(
                        storageHealth.disk_space.usage_percent
                      )}
                      size="lg"
                      radius="md"
                    />
                  </div>
                )}

                {storageHealth.directories && (
                  <SimpleGrid cols={{ base: 2, sm: 3 }} mt="sm">
                    {Object.entries(storageHealth.directories).map(
                      ([dirName, dirInfo]) => (
                        <DirectoryCard
                          key={dirName}
                          name={dirName}
                          info={dirInfo}
                        />
                      )
                    )}
                  </SimpleGrid>
                )}
              </Stack>
            )}
          </Card>
        )}

        {/* Application Services */}
        <Card shadow="sm" p="lg" mb="lg" withBorder>
          <Group mb="md">
            <ThemeIcon size="lg" variant="light" color="violet">
              <IconSettings size={20} />
            </ThemeIcon>
            <Text fw={600} size="lg">
              Application Services
            </Text>
          </Group>
          {metricsError ? (
            <Alert color="red" variant="light">
              {metricsError}
            </Alert>
          ) : (
            <Stack gap={0}>
              <HealthItem
                label="API Status"
                value={`${systemMetrics?.services?.api?.status || 'Unknown'}${
                  systemMetrics?.services?.api?.response_time_ms
                    ? ` (${systemMetrics.services.api.response_time_ms}ms)`
                    : ''
                }`}
                status={systemMetrics?.services?.api?.status}
              />
              <HealthItem
                label="Authentication Service"
                value={
                  systemMetrics?.services?.authentication?.status || 'Unknown'
                }
                status={systemMetrics?.services?.authentication?.status}
              />
              <HealthItem
                label="Frontend Logging"
                value={
                  systemMetrics?.services?.frontend_logging?.status ||
                  frontendLogHealth?.status ||
                  'Unknown'
                }
                status={
                  systemMetrics?.services?.frontend_logging?.status ||
                  frontendLogHealth?.status
                }
              />
              <HealthItem
                label="Admin Interface"
                value={
                  systemMetrics?.services?.admin_interface?.status || 'Unknown'
                }
                status={systemMetrics?.services?.admin_interface?.status}
              />
            </Stack>
          )}
        </Card>

        {/* SSO Configuration */}
        <Card shadow="sm" p="lg" mb="lg" withBorder>
          <Group mb="md">
            <ThemeIcon size="lg" variant="light" color="orange">
              <IconLock size={20} />
            </ThemeIcon>
            <Text fw={600} size="lg">
              Single Sign-On (SSO)
            </Text>
            <Badge
              variant="light"
              color={ssoConfig?.enabled ? 'green' : 'blue'}
            >
              {ssoConfig?.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </Group>
          {ssoError ? (
            <Alert color="red" variant="light">
              {ssoError}
            </Alert>
          ) : (
            <Stack gap={0}>
              <HealthItem
                label="SSO Status"
                value={ssoConfig?.enabled ? 'Enabled' : 'Disabled'}
                status={ssoConfig?.enabled ? 'healthy' : 'info'}
              />
              {ssoConfig?.enabled && (
                <>
                  <HealthItem
                    label="Provider Type"
                    value={ssoConfig.provider_type?.toUpperCase() || 'Unknown'}
                    status="info"
                  />
                  {SSO_PROVIDER_LABELS[ssoConfig.provider_type] && (
                    <HealthItem
                      label="Provider"
                      value={SSO_PROVIDER_LABELS[ssoConfig.provider_type]}
                      status="healthy"
                    />
                  )}
                  <HealthItem
                    label="Registration via SSO"
                    value={ssoConfig.registration_enabled ? 'Allowed' : 'Blocked'}
                    status={ssoConfig.registration_enabled ? 'healthy' : 'warning'}
                  />
                </>
              )}
              {!ssoConfig?.enabled && (
                <HealthItem
                  label="Info"
                  value="Users can only log in with username/password"
                  status="info"
                />
              )}
            </Stack>
          )}
        </Card>

        {/* Application Performance */}
        {systemMetrics?.application && (
          <Card shadow="sm" p="lg" mb="lg" withBorder>
            <Group mb="md">
              <ThemeIcon size="lg" variant="light" color="yellow">
                <IconBolt size={20} />
              </ThemeIcon>
              <Text fw={600} size="lg">
                Application Performance
              </Text>
            </Group>
            <Stack gap="md">
              {/* App Memory Usage (process RSS) */}
              {systemMetrics.application.memory_used_mb != null ? (
                <div>
                  <Group justify="space-between" mb="xs">
                    <Text fw={500}>App Memory (RSS)</Text>
                    <Text size="sm" c="dimmed">
                      {systemMetrics.application.memory_used_mb} MB used (system: {systemMetrics.application.memory_percent}% of {systemMetrics.application.memory_total_mb} MB)
                    </Text>
                  </Group>
                  <Progress
                    value={systemMetrics.application.memory_percent}
                    color={
                      systemMetrics.application.memory_percent > 85
                        ? 'red'
                        : systemMetrics.application.memory_percent > 70
                          ? 'yellow'
                          : 'green'
                    }
                    size="lg"
                    radius="md"
                  />
                </div>
              ) : (
                <HealthItem
                  label="Memory Usage"
                  value={systemMetrics.application.memory_usage}
                  status={USAGE_STATUS[systemMetrics.application.memory_usage] || 'error'}
                />
              )}

              {/* CPU Usage */}
              {systemMetrics.application.cpu_percent != null ? (
                <div>
                  <Group justify="space-between" mb="xs">
                    <Text fw={500}>CPU Usage</Text>
                    <Text size="sm" c="dimmed">
                      App: {systemMetrics.application.app_cpu_percent ?? '—'}%
                      {systemMetrics.application.cpu_count ? ` of ${systemMetrics.application.cpu_count} cores` : ''}
                      {' '}(system: {systemMetrics.application.cpu_percent}%)
                    </Text>
                  </Group>
                  <Progress
                    value={systemMetrics.application.cpu_percent}
                    color={
                      systemMetrics.application.cpu_percent > 80
                        ? 'red'
                        : systemMetrics.application.cpu_percent > 50
                          ? 'yellow'
                          : 'green'
                    }
                    size="lg"
                    radius="md"
                  />
                </div>
              ) : (
                <HealthItem
                  label="CPU Usage"
                  value={systemMetrics.application.cpu_usage}
                  status={USAGE_STATUS[systemMetrics.application.cpu_usage] || 'error'}
                />
              )}

              {/* Response Time & System Load */}
              <HealthItem
                label="Response Time"
                value={systemMetrics.application.response_time}
                status="healthy"
              />
              <HealthItem
                label="System Load"
                value={systemMetrics.application.system_load}
                status={USAGE_STATUS[systemMetrics.application.system_load] || 'error'}
              />
            </Stack>
          </Card>
        )}

      </div>
    </AdminLayout>
  );
};

export default SystemHealth;
