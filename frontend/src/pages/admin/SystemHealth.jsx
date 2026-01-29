import React, { useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminCard from '../../components/admin/AdminCard';
import { useAdminData } from '../../hooks/useAdminData';
import { adminApiService } from '../../services/api/adminApi';
import { Loading } from '../../components';
import { useDateFormat } from '../../hooks/useDateFormat';
import './SystemHealth.css';

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
    error: statsError,
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
    error: logError,
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


  const loading =
    healthLoading ||
    metricsLoading ||
    statsLoading ||
    storageLoading ||
    logLoading ||
    ssoLoading;
  const hasError =
    healthError || metricsError || statsError || storageError || logError || ssoError;

  const handleRefreshAll = async () => {
    setLastRefresh(new Date());
    await Promise.all([
      refreshHealth(true),
      refreshMetrics(true),
      refreshStats(true),
      refreshStorage(true),
      refreshLogs(true),
      refreshSSO(true),
    ]);
  };

  const formatUptime = uptimeString => {
    if (!uptimeString) return 'Unknown';
    return uptimeString;
  };

  const formatBytes = bytes => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getHealthStatusColor = status => {
    switch (status?.toLowerCase()) {
      case 'healthy':
      case 'ok':
      case 'operational':
        return 'healthy';
      case 'warning':
      case 'slow':
        return 'warning';
      case 'error':
      case 'unhealthy':
      case 'failed':
        return 'error';
      default:
        return 'info';
    }
  };

  const getStorageUsageColor = percentage => {
    if (percentage < 70) return 'healthy';
    if (percentage < 85) return 'warning';
    return 'error';
  };

  if (loading && !healthData) {
    return (
      <AdminLayout>
        <div className="admin-page-loading">
          <Loading message="Loading system health..." />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="system-health">
        {/* Header */}
        <div className="health-header">
          <div className="health-title">
            <h1>🔍 System Health Monitor</h1>
            <p>Real-time system status and performance metrics</p>
          </div>

          <div className="health-actions">
            {lastRefresh && (
              <div className="last-refresh">
                <span>
                  Last updated: {formatDateTime(lastRefresh.toISOString())}
                </span>
              </div>
            )}
            <button
              onClick={handleRefreshAll}
              className="refresh-btn"
              disabled={loading}
            >
              {loading ? '🔄 Refreshing...' : '🔄 Refresh All'}
            </button>
          </div>
        </div>

        {/* Overall System Status Overview */}
        <AdminCard
          title="Overall System Status"
          icon="💚"
          status={getHealthStatusColor(healthData?.database_status)}
          className="health-overview-card"
        >
          <div className="health-overview-grid">
            <div className="status-item">
              <div className="status-icon">📊</div>
              <div className="status-content">
                <h3>Total Records</h3>
                <p className="status-value">
                  {healthData?.total_records?.toLocaleString() || 0}
                </p>
              </div>
            </div>

            <div className="status-item">
              <div className="status-icon">⏱️</div>
              <div className="status-content">
                <h3>Application Uptime</h3>
                <p className="status-value">
                  {formatUptime(healthData?.system_uptime)}
                </p>
              </div>
            </div>

            <div className="status-item">
              <div className="status-icon">💾</div>
              <div className="status-content">
                <h3>Last Backup</h3>
                <p className="status-value">
                  {healthData?.last_backup
                    ? formatDate(healthData.last_backup)
                    : 'No backups configured'}
                </p>
              </div>
            </div>
          </div>
        </AdminCard>

        {/* Database Health */}
        <AdminCard
          title="Database Health"
          icon="🗄️"
          status={getHealthStatusColor(healthData?.database_status)}
          loading={healthLoading}
          error={healthError}
        >
          <div className="health-items">
            <HealthItem
              label="Connection Status"
              value={healthData?.database_status || 'Unknown'}
              status={getHealthStatusColor(healthData?.database_status)}
            />
            <HealthItem
              label="Connection Test"
              value={healthData?.database_connection_test ? 'Passed' : 'Failed'}
              status={
                healthData?.database_connection_test ? 'healthy' : 'error'
              }
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
          </div>
        </AdminCard>

        {/* Storage Health */}
        {storageHealth && (
          <AdminCard
            title="Storage Health"
            icon="💽"
            status={getHealthStatusColor(storageHealth.status)}
            loading={storageLoading}
            error={storageError}
          >
            <div className="storage-overview">
              <HealthItem
                label="Status"
                value={storageHealth.status}
                status={getHealthStatusColor(storageHealth.status)}
              />

              {storageHealth.disk_space && (
                <div className="disk-usage-container">
                  <span className="health-label">Disk Usage:</span>
                  <div className="disk-usage-info">
                    <div className="disk-usage-bar">
                      <div
                        className={`disk-usage-fill ${getStorageUsageColor(
                          storageHealth.disk_space.usage_percent
                        )}`}
                        style={{
                          width: `${storageHealth.disk_space.usage_percent}%`,
                        }}
                      />
                    </div>
                    <span className="disk-usage-text">
                      {storageHealth.disk_space.usage_percent}% (
                      {storageHealth.disk_space.free_gb}GB free)
                    </span>
                  </div>
                </div>
              )}

              {storageHealth.directories && (
                <div className="storage-directories">
                  {Object.entries(storageHealth.directories).map(
                    ([dirName, dirInfo]) => (
                      <DirectoryCard
                        key={dirName}
                        name={dirName}
                        info={dirInfo}
                      />
                    )
                  )}
                </div>
              )}
            </div>
          </AdminCard>
        )}

        {/* Application Services */}
        <AdminCard
          title="Application Services"
          icon="🔧"
          loading={metricsLoading}
          error={metricsError}
        >
          <div className="health-items">
            <HealthItem
              label="API Status"
              value={`${systemMetrics?.services?.api?.status || 'Unknown'}${
                systemMetrics?.services?.api?.response_time_ms
                  ? ` (${systemMetrics.services.api.response_time_ms}ms)`
                  : ''
              }`}
              status={getHealthStatusColor(
                systemMetrics?.services?.api?.status
              )}
            />
            <HealthItem
              label="Authentication Service"
              value={
                systemMetrics?.services?.authentication?.status || 'Unknown'
              }
              status={getHealthStatusColor(
                systemMetrics?.services?.authentication?.status
              )}
            />
            <HealthItem
              label="Frontend Logging"
              value={
                systemMetrics?.services?.frontend_logging?.status ||
                frontendLogHealth?.status ||
                'Unknown'
              }
              status={getHealthStatusColor(
                systemMetrics?.services?.frontend_logging?.status ||
                  frontendLogHealth?.status
              )}
            />
            <HealthItem
              label="Admin Interface"
              value={
                systemMetrics?.services?.admin_interface?.status || 'Unknown'
              }
              status={getHealthStatusColor(
                systemMetrics?.services?.admin_interface?.status
              )}
            />
          </div>
        </AdminCard>

        {/* SSO Configuration */}
        <AdminCard
          title="Single Sign-On (SSO)"
          icon="🔐"
          status={ssoConfig?.enabled ? 'healthy' : 'info'}
          loading={ssoLoading}
          error={ssoError}
        >
          <div className="health-items">
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
                {ssoConfig.provider_type === 'google' && (
                  <HealthItem
                    label="Provider"
                    value="Google OAuth 2.0"
                    status="healthy"
                  />
                )}
                {ssoConfig.provider_type === 'github' && (
                  <HealthItem
                    label="Provider"
                    value="GitHub OAuth"
                    status="healthy"
                  />
                )}
                {ssoConfig.provider_type === 'oidc' && (
                  <HealthItem
                    label="Provider"
                    value="OpenID Connect"
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
          </div>
        </AdminCard>

        {/* Application Performance */}
        {systemMetrics?.application && (
          <AdminCard
            title="Application Performance"
            icon="⚡"
            loading={metricsLoading}
            error={metricsError}
          >
            <div className="health-items">
              <HealthItem
                label="Memory Usage"
                value={systemMetrics.application.memory_usage}
                status={
                  systemMetrics.application.memory_usage === 'low'
                    ? 'healthy'
                    : systemMetrics.application.memory_usage === 'normal'
                      ? 'warning'
                      : 'error'
                }
              />
              <HealthItem
                label="CPU Usage"
                value={systemMetrics.application.cpu_usage}
                status={
                  systemMetrics.application.cpu_usage === 'low'
                    ? 'healthy'
                    : systemMetrics.application.cpu_usage === 'normal'
                      ? 'warning'
                      : 'error'
                }
              />
            </div>
          </AdminCard>
        )}
      </div>
    </AdminLayout>
  );
};

// Reusable HealthItem Component
const HealthItem = ({ label, value, status }) => (
  <div className="health-item">
    <span className="health-label">{label}:</span>
    <span className={`health-value ${status ? `status-${status}` : ''}`}>
      {value}
    </span>
  </div>
);

// Reusable DirectoryCard Component
const DirectoryCard = ({ name, info }) => {
  const dirIcons = {
    uploads: '📁',
    backups: '💾',
    logs: '📝',
  };

  return (
    <div className="directory-card">
      <div className="directory-header">
        <span className="directory-icon">{dirIcons[name] || '📂'}</span>
        <span className="directory-name">
          {name.charAt(0).toUpperCase() + name.slice(1)}
        </span>
        <span
          className={`directory-status ${
            info.write_permission && info.exists ? 'healthy' : 'error'
          }`}
        >
          {info.write_permission && info.exists ? '✓' : '✗'}
        </span>
      </div>
      <div className="directory-stats">
        <div className="stat">
          <span className="stat-value">{info.size_mb}</span>
          <span className="stat-label">MB</span>
        </div>
        <div className="stat">
          <span className="stat-value">{info.file_count}</span>
          <span className="stat-label">files</span>
        </div>
      </div>
      {info.error && <div className="directory-error">{info.error}</div>}
    </div>
  );
};

export default SystemHealth;
