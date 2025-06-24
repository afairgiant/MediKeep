import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminApiService } from '../../services/api/adminApi';
import { Loading } from '../../components';
import './SystemHealth.css';

const SystemHealth = () => {
  const [healthData, setHealthData] = useState(null);
  const [systemMetrics, setSystemMetrics] = useState(null);
  const [detailedStats, setDetailedStats] = useState(null);
  const [storageHealth, setStorageHealth] = useState(null);
  const [frontendLogHealth, setFrontendLogHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  useEffect(() => {
    loadSystemHealth();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadSystemHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadSystemHealth = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      console.log('🔍 Loading comprehensive system health data...'); // Load core system health
      const health = await adminApiService.getSystemHealth();
      setHealthData(health); // Load system metrics
      try {
        const metricsData = await adminApiService.getSystemMetrics();
        console.log('🔧 System Metrics Data:', metricsData);
        setSystemMetrics(metricsData);
      } catch (metricsError) {
        console.warn('Failed to load system metrics:', metricsError);
      }

      // Load detailed statistics
      try {
        const stats = await adminApiService.getDashboardStats();
        setDetailedStats(stats);
      } catch (statsError) {
        console.warn('Failed to load detailed stats:', statsError);
      } // Check storage health (lab result files)
      try {
        const storageData = await adminApiService.getStorageHealth();
        setStorageHealth(storageData);
      } catch (storageError) {
        console.warn('Failed to load storage health:', storageError);
      }

      // Check frontend logging health
      try {
        const logData = await adminApiService.getFrontendLogHealth();
        setFrontendLogHealth(logData);
      } catch (logError) {
        console.warn('Failed to load frontend log health:', logError);
      }

      setLastRefresh(new Date());
      console.log('✅ System health data loaded successfully');
    } catch (err) {
      console.error('❌ Error loading system health:', err);
      setError('Failed to load system health data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    loadSystemHealth(true);
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
        return 'unknown';
    }
  };

  const getStorageUsageColor = percentage => {
    if (percentage < 70) return 'healthy';
    if (percentage < 85) return 'warning';
    return 'error';
  };
  if (loading) {
    return (
      <AdminLayout>
        <div className="admin-page-loading">
          <Loading message="Loading system health..." />
        </div>
      </AdminLayout>
    );
  }

  if (error && !healthData) {
    return (
      <AdminLayout>
        <div className="system-health-error">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => loadSystemHealth()} className="retry-btn">
            Retry
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="system-health">
        <div className="health-header">
          <div className="health-title">
            <h1>🔍 System Health Monitor</h1>
            <p>Real-time system status and performance metrics</p>
          </div>

          <div className="health-actions">
            <div className="last-refresh">
              {lastRefresh && (
                <span>Last updated: {lastRefresh.toLocaleTimeString()}</span>
              )}
            </div>
            <button
              onClick={handleRefresh}
              className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
              disabled={refreshing}
            >
              {refreshing ? '🔄 Refreshing...' : '🔄 Refresh'}
            </button>
          </div>
        </div>

        {/* Overall System Status */}
        <div className="health-overview">
          <div className="status-card">
            <div className="status-icon">💚</div>
            <div className="status-content">
              <h3>Overall Status</h3>
              <p
                className={`status-value ${getHealthStatusColor(healthData?.database_status)}`}
              >
                {healthData?.database_status === 'healthy'
                  ? 'All Systems Operational'
                  : 'Issues Detected'}
              </p>
            </div>
          </div>

          <div className="status-card">
            <div className="status-icon">📊</div>
            <div className="status-content">
              <h3>Total Records</h3>
              <p className="status-value">
                {healthData?.total_records?.toLocaleString() || 0}
              </p>
            </div>
          </div>

          <div className="status-card">
            <div className="status-icon">⏱️</div>
            <div className="status-content">
              <h3>Application Uptime</h3>
              <p className="status-value">
                {formatUptime(healthData?.system_uptime)}
              </p>
            </div>
          </div>
          <div className="status-card">
            <div className="status-icon">💾</div>
            <div className="status-content">
              <h3>Last Backup</h3>
              <p className="status-value">
                {healthData?.last_backup
                  ? new Date(healthData.last_backup).toLocaleDateString()
                  : 'No backups configured'}
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Health Checks */}
        <div className="health-details">
          {' '}
          {/* Database Health */}
          <div className="health-section">
            <h2>🗄️ Database Health</h2>
            <div className="health-items">
              <div className="health-item">
                <span className="health-label">Connection Status:</span>
                <span
                  className={`health-status ${getHealthStatusColor(healthData?.database_status)}`}
                >
                  {healthData?.database_status || 'Unknown'}
                </span>
              </div>
              <div className="health-item">
                <span className="health-label">Connection Test:</span>
                <span
                  className={`health-status ${healthData?.database_connection_test ? 'healthy' : 'error'}`}
                >
                  {healthData?.database_connection_test ? 'Passed' : 'Failed'}
                </span>
              </div>
              <div className="health-item">
                <span className="health-label">Total Records:</span>
                <span className="health-value">
                  {healthData?.total_records?.toLocaleString() || 0}
                </span>
              </div>
              {healthData?.disk_usage && (
                <div className="health-item">
                  <span className="health-label">Database Size:</span>
                  <span className="health-value">{healthData.disk_usage}</span>
                </div>
              )}
              {systemMetrics?.database && (
                <>
                  <div className="health-item">
                    <span className="health-label">Query Performance:</span>
                    <span className="health-value">
                      {systemMetrics.database.query_performance}
                    </span>
                  </div>
                  <div className="health-item">
                    <span className="health-label">Active Connections:</span>
                    <span className="health-value">
                      {systemMetrics.database.active_connections}
                    </span>
                  </div>
                </>
              )}
              {detailedStats && (
                <>
                  <div className="health-item">
                    <span className="health-label">Active Users:</span>
                    <span className="health-value">
                      {detailedStats.total_users}
                    </span>
                  </div>
                  <div className="health-item">
                    <span className="health-label">Patient Records:</span>
                    <span className="health-value">
                      {detailedStats.total_patients}
                    </span>
                  </div>
                  <div className="health-item">
                    <span className="health-label">Medical Records:</span>
                    <span className="health-value">
                      {(detailedStats.total_medications || 0) +
                        (detailedStats.total_lab_results || 0) +
                        (detailedStats.total_conditions || 0)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
          {/* Storage Health */}
          {storageHealth && (
            <div className="health-section storage-section">
              <h2>💽 Storage Health</h2>

              {/* Overall Status & Disk Usage */}
              <div className="storage-overview">
                <div className="storage-status-row">
                  <span className="health-label">Status:</span>
                  <span
                    className={`health-status ${getHealthStatusColor(storageHealth.status)}`}
                  >
                    {storageHealth.status}
                  </span>
                </div>
                {storageHealth.disk_space && (
                  <div className="disk-usage-row">
                    <span className="health-label">Disk Usage:</span>
                    <div className="disk-usage-info">
                      <div className="disk-usage-bar">
                        <div
                          className="disk-usage-fill"
                          style={{
                            width: `${storageHealth.disk_space.usage_percent}%`,
                            backgroundColor:
                              getStorageUsageColor(
                                storageHealth.disk_space.usage_percent
                              ) === 'healthy'
                                ? '#10b981'
                                : getStorageUsageColor(
                                      storageHealth.disk_space.usage_percent
                                    ) === 'warning'
                                  ? '#f59e0b'
                                  : '#ef4444',
                          }}
                        ></div>
                      </div>
                      <span className="disk-usage-text">
                        {storageHealth.disk_space.usage_percent}% (
                        {storageHealth.disk_space.free_gb}GB free)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Directory Cards */}
              {storageHealth.directories && (
                <div className="storage-directories">
                  {Object.entries(storageHealth.directories).map(
                    ([dirName, dirInfo]) => {
                      const dirIcons = {
                        uploads: '📁',
                        backups: '💾',
                        logs: '📝',
                      };

                      return (
                        <div key={dirName} className="directory-card">
                          <div className="directory-header">
                            <span className="directory-icon">
                              {dirIcons[dirName] || '📂'}
                            </span>
                            <span className="directory-name">
                              {dirName.charAt(0).toUpperCase() +
                                dirName.slice(1)}
                            </span>
                            <span
                              className={`directory-status ${dirInfo.write_permission && dirInfo.exists ? 'healthy' : 'error'}`}
                            >
                              {dirInfo.write_permission && dirInfo.exists
                                ? '✓'
                                : '✗'}
                            </span>
                          </div>
                          <div className="directory-stats">
                            <div className="stat">
                              <span className="stat-value">
                                {dirInfo.size_mb}
                              </span>
                              <span className="stat-label">MB</span>
                            </div>
                            <div className="stat">
                              <span className="stat-value">
                                {dirInfo.file_count}
                              </span>
                              <span className="stat-label">files</span>
                            </div>
                          </div>
                          {dirInfo.error && (
                            <div className="directory-error">
                              {dirInfo.error}
                            </div>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          )}{' '}
          {/* Application Services */}
          <div className="health-section">
            <h2>🔧 Application Services</h2>
            <div className="health-items">
              <div className="health-item">
                <span className="health-label">API Status:</span>
                <span
                  className={`health-status ${getHealthStatusColor(systemMetrics?.services?.api?.status)}`}
                >
                  {systemMetrics?.services?.api?.status
                    ?.charAt(0)
                    .toUpperCase() +
                    systemMetrics?.services?.api?.status?.slice(1) || 'Unknown'}
                  {systemMetrics?.services?.api?.response_time_ms && (
                    <span className="health-detail">
                      {' '}
                      ({systemMetrics.services.api.response_time_ms}ms)
                    </span>
                  )}
                </span>
              </div>
              <div className="health-item">
                <span className="health-label">Authentication Service:</span>
                <span
                  className={`health-status ${getHealthStatusColor(systemMetrics?.services?.authentication?.status)}`}
                >
                  {systemMetrics?.services?.authentication?.status
                    ?.charAt(0)
                    .toUpperCase() +
                    systemMetrics?.services?.authentication?.status?.slice(1) ||
                    'Unknown'}
                </span>
              </div>
              <div className="health-item">
                <span className="health-label">Frontend Logging:</span>
                <span
                  className={`health-status ${getHealthStatusColor(
                    systemMetrics?.services?.frontend_logging?.status ||
                      frontendLogHealth?.status
                  )}`}
                >
                  {systemMetrics?.services?.frontend_logging?.status
                    ?.charAt(0)
                    .toUpperCase() +
                    systemMetrics?.services?.frontend_logging?.status?.slice(
                      1
                    ) ||
                    frontendLogHealth?.status ||
                    'Unknown'}
                </span>
              </div>
              <div className="health-item">
                <span className="health-label">Admin Interface:</span>
                <span
                  className={`health-status ${getHealthStatusColor(systemMetrics?.services?.admin_interface?.status)}`}
                >
                  {systemMetrics?.services?.admin_interface?.status
                    ?.charAt(0)
                    .toUpperCase() +
                    systemMetrics?.services?.admin_interface?.status?.slice(
                      1
                    ) || 'Unknown'}
                </span>
              </div>
            </div>
          </div>
          {/* Application Performance */}
          {systemMetrics && (
            <div className="health-section">
              <h2>⚡ Application Performance</h2>
              <div className="health-items">
                {systemMetrics.application && (
                  <>
                    <div className="health-item">
                      <span className="health-label">Memory Usage:</span>
                      <span
                        className={`health-status ${
                          systemMetrics.application.memory_usage === 'low'
                            ? 'healthy'
                            : systemMetrics.application.memory_usage ===
                                'normal'
                              ? 'warning'
                              : 'error'
                        }`}
                      >
                        {systemMetrics.application.memory_usage
                          ?.charAt(0)
                          .toUpperCase() +
                          systemMetrics.application.memory_usage?.slice(1) ||
                          'Unknown'}
                      </span>
                    </div>
                    <div className="health-item">
                      <span className="health-label">CPU Usage:</span>
                      <span
                        className={`health-status ${
                          systemMetrics.application.cpu_usage === 'low'
                            ? 'healthy'
                            : systemMetrics.application.cpu_usage === 'normal'
                              ? 'warning'
                              : 'error'
                        }`}
                      >
                        {systemMetrics.application.cpu_usage
                          ?.charAt(0)
                          .toUpperCase() +
                          systemMetrics.application.cpu_usage?.slice(1) ||
                          'Unknown'}
                      </span>
                    </div>
                    <div className="health-item">
                      <span className="health-label">System Load:</span>
                      <span
                        className={`health-status ${
                          systemMetrics.application.system_load === 'low'
                            ? 'healthy'
                            : systemMetrics.application.system_load === 'normal'
                              ? 'warning'
                              : 'error'
                        }`}
                      >
                        {systemMetrics.application.system_load
                          ?.charAt(0)
                          .toUpperCase() +
                          systemMetrics.application.system_load?.slice(1) ||
                          'Unknown'}
                      </span>
                    </div>
                    <div className="health-item">
                      <span className="health-label">Response Time:</span>
                      <span
                        className={`health-status ${
                          systemMetrics?.services?.api?.response_time_ms
                            ? systemMetrics.services.api.response_time_ms < 100
                              ? 'healthy'
                              : systemMetrics.services.api.response_time_ms <
                                  500
                                ? 'warning'
                                : 'error'
                            : 'unknown'
                        }`}
                      >
                        {systemMetrics?.services?.api?.response_time_ms
                          ? `${systemMetrics.services.api.response_time_ms}ms`
                          : systemMetrics?.application?.response_time ||
                            'Unknown'}
                      </span>
                    </div>
                  </>
                )}
                <div className="health-item">
                  <span className="health-label">Last Check:</span>
                  <span className="health-value">
                    {systemMetrics.timestamp
                      ? new Date(systemMetrics.timestamp).toLocaleString()
                      : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>
          )}
          {/* Performance Metrics */}
          {detailedStats && (
            <div className="health-section">
              <h2>📈 Performance Metrics</h2>
              <div className="health-items">
                <div className="health-item">
                  <span className="health-label">
                    Recent Registrations (30 days):
                  </span>
                  <span className="health-value">
                    {detailedStats.recent_registrations || 0}
                  </span>
                </div>
                <div className="health-item">
                  <span className="health-label">Active Medications:</span>
                  <span className="health-value">
                    {detailedStats.active_medications || 0} /{' '}
                    {detailedStats.total_medications || 0}
                  </span>
                </div>
                <div className="health-item">
                  <span className="health-label">Pending Lab Results:</span>
                  <span className="health-value">
                    {detailedStats.pending_lab_results || 0}
                  </span>
                </div>
              </div>
            </div>
          )}{' '}
          {/* Security Status */}
          <div className="health-section">
            <h2>🔒 Security Status</h2>

            {/* Security Warnings */}
            {systemMetrics?.security?.security_warnings &&
              systemMetrics.security.security_warnings.length > 0 && (
                <div className="security-warnings">
                  {systemMetrics.security.security_warnings.map(
                    (warning, index) => (
                      <div key={index} className="security-warning">
                        {warning}
                      </div>
                    )
                  )}
                </div>
              )}

            <div className="health-items">
              <div className="health-item">
                <span className="health-label">Authentication:</span>
                <span
                  className={`health-status ${getHealthStatusColor(systemMetrics?.security?.authentication_status)}`}
                >
                  {systemMetrics?.security?.authentication_method || 'JWT'}
                </span>
              </div>
              <div className="health-item">
                <span className="health-label">Authorization:</span>
                <span
                  className={`health-status ${getHealthStatusColor(systemMetrics?.security?.authorization_status)}`}
                >
                  Role-based (RBAC)
                </span>
              </div>
              <div className="health-item">
                <span className="health-label">Data Encryption:</span>
                <span
                  className={`health-status ${
                    systemMetrics?.security?.ssl_enabled
                      ? 'healthy'
                      : systemMetrics?.security?.environment === 'development'
                        ? 'warning'
                        : 'error'
                  }`}
                >
                  {systemMetrics?.security?.ssl_enabled
                    ? 'HTTPS Enabled'
                    : systemMetrics?.security?.environment === 'development'
                      ? 'Development Mode'
                      : 'HTTPS Required'}
                </span>
              </div>
              {systemMetrics?.security?.environment && (
                <div className="health-item">
                  <span className="health-label">Environment:</span>
                  <span
                    className={`health-status ${
                      systemMetrics.security.environment === 'production'
                        ? 'healthy'
                        : 'warning'
                    }`}
                  >
                    {systemMetrics.security.environment === 'development'
                      ? '🔧 Development'
                      : '🏭 Production'}
                  </span>
                </div>
              )}
              <div className="health-item">
                <span className="health-label">Session Management:</span>
                <span
                  className={`health-status ${getHealthStatusColor(systemMetrics?.security?.session_status)}`}
                >
                  JWT Tokens
                </span>
              </div>{' '}
              <div className="health-item">
                <span className="health-label">Security Scanning:</span>
                {systemMetrics?.security?.last_security_scan ? (
                  <span className="health-value">
                    {systemMetrics.security.last_security_scan}
                  </span>
                ) : (
                  <span
                    className="health-status"
                    style={{
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                    }}
                  >
                    🚀 Coming Soon
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="health-actions-section">
          <h2>🚀 Quick Actions</h2>
          <div className="action-buttons">
            <button
              className="action-btn"
              onClick={() => (window.location.href = '/admin/models/user')}
            >
              <span className="action-icon">👥</span>
              Manage Users
            </button>
            <button
              className="action-btn"
              onClick={() => (window.location.href = '/admin/bulk-operations')}
            >
              <span className="action-icon">⚡</span>
              Bulk Operations
            </button>
            <button
              className="action-btn"
              onClick={() => (window.location.href = '/admin')}
            >
              <span className="action-icon">📊</span>
              Admin Dashboard
            </button>
            <button
              className="action-btn"
              onClick={() => (window.location.href = '/logging-test')}
            >
              <span className="action-icon">🔍</span>
              Test Logging
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default SystemHealth;
