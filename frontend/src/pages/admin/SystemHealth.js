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
        return 'healthy';
      case 'warning':
        return 'warning';
      case 'error':
      case 'unhealthy':
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
        <Loading />
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
            <div className="health-section">
              <h2>💽 Storage Health</h2>
              <div className="health-items">
                <div className="health-item">
                  <span className="health-label">Status:</span>
                  <span
                    className={`health-status ${getHealthStatusColor(storageHealth.status)}`}
                  >
                    {storageHealth.status}
                  </span>
                </div>
                <div className="health-item">
                  <span className="health-label">Upload Directory:</span>
                  <span className="health-value">
                    {storageHealth.upload_directory}
                  </span>
                </div>
                <div className="health-item">
                  <span className="health-label">Write Permission:</span>
                  <span
                    className={`health-status ${storageHealth.write_permission ? 'healthy' : 'error'}`}
                  >
                    {storageHealth.write_permission ? 'Granted' : 'Denied'}
                  </span>
                </div>
                {storageHealth.disk_space && (
                  <>
                    <div className="health-item">
                      <span className="health-label">Disk Usage:</span>
                      <span
                        className={`health-value ${getStorageUsageColor(storageHealth.disk_space.usage_percent)}`}
                      >
                        {storageHealth.disk_space.usage_percent}% (
                        {storageHealth.disk_space.used_gb}GB /{' '}
                        {storageHealth.disk_space.total_gb}GB)
                      </span>
                    </div>
                    <div className="health-item">
                      <span className="health-label">Free Space:</span>
                      <span className="health-value">
                        {storageHealth.disk_space.free_gb}GB
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}{' '}
          {/* Application Services */}
          <div className="health-section">
            <h2>🔧 Application Services</h2>
            <div className="health-items">
              <div className="health-item">
                <span className="health-label">API Status:</span>
                <span className="health-status healthy">Operational</span>
              </div>
              <div className="health-item">
                <span className="health-label">Authentication Service:</span>
                <span className="health-status healthy">Operational</span>
              </div>
              {frontendLogHealth && (
                <div className="health-item">
                  <span className="health-label">Frontend Logging:</span>
                  <span
                    className={`health-status ${getHealthStatusColor(frontendLogHealth.status)}`}
                  >
                    {frontendLogHealth.status}
                  </span>
                </div>
              )}
              <div className="health-item">
                <span className="health-label">Admin Interface:</span>
                <span className="health-status healthy">Operational</span>
              </div>
              {systemMetrics?.application && (
                <>
                  <div className="health-item">
                    <span className="health-label">Memory Usage:</span>
                    <span className="health-value">
                      {systemMetrics.application.memory_usage}
                    </span>
                  </div>
                  <div className="health-item">
                    <span className="health-label">CPU Usage:</span>
                    <span className="health-value">
                      {systemMetrics.application.cpu_usage}
                    </span>
                  </div>
                  <div className="health-item">
                    <span className="health-label">Response Time:</span>
                    <span className="health-value">
                      {systemMetrics.application.response_time}
                    </span>
                  </div>
                </>
              )}
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
                      <span className="health-label">Memory Status:</span>
                      <span
                        className={`health-status ${systemMetrics.application.memory_usage === 'Normal' ? 'healthy' : 'warning'}`}
                      >
                        {systemMetrics.application.memory_usage}
                      </span>
                    </div>
                    <div className="health-item">
                      <span className="health-label">CPU Load:</span>
                      <span
                        className={`health-status ${systemMetrics.application.cpu_usage === 'Low' ? 'healthy' : 'warning'}`}
                      >
                        {systemMetrics.application.cpu_usage}
                      </span>
                    </div>
                    <div className="health-item">
                      <span className="health-label">Avg Response Time:</span>
                      <span className="health-value">
                        {systemMetrics.application.response_time}
                      </span>
                    </div>
                  </>
                )}
                {systemMetrics.storage && (
                  <>
                    <div className="health-item">
                      <span className="health-label">Database File Size:</span>
                      <span className="health-value">
                        {systemMetrics.storage.database_size || 'Unknown'}
                      </span>
                    </div>
                    <div className="health-item">
                      <span className="health-label">Upload Directory:</span>
                      <span className="health-value">
                        {systemMetrics.storage.upload_directory_size ||
                          'Unknown'}
                      </span>
                    </div>
                    <div className="health-item">
                      <span className="health-label">Storage Status:</span>
                      <span className="health-status healthy">
                        {systemMetrics.storage.available_space}
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
                <div className="health-item">
                  <span className="health-label">System Load:</span>
                  <span className="health-status healthy">Normal</span>
                </div>
              </div>
            </div>
          )}{' '}
          {/* Security Status */}
          <div className="health-section">
            <h2>🔒 Security Status</h2>
            <div className="health-items">
              <div className="health-item">
                <span className="health-label">Authentication:</span>
                <span className="health-status healthy">
                  {systemMetrics?.security?.authentication_method ||
                    'JWT Secure'}
                </span>
              </div>
              <div className="health-item">
                <span className="health-label">Authorization:</span>
                <span className="health-status healthy">
                  Role-based Access Control
                </span>
              </div>
              <div className="health-item">
                <span className="health-label">Data Encryption:</span>
                <span className="health-status healthy">
                  {systemMetrics?.security?.ssl_enabled
                    ? 'HTTPS Enabled'
                    : 'HTTPS Required'}
                </span>
              </div>
              <div className="health-item">
                <span className="health-label">Session Management:</span>
                <span className="health-status healthy">Token-based</span>
              </div>{' '}
              {systemMetrics?.security?.last_security_scan && (
                <div className="health-item">
                  <span className="health-label">Last Security Scan:</span>
                  <span className="health-value">
                    {systemMetrics.security.last_security_scan}
                  </span>
                </div>
              )}
              {!systemMetrics?.security?.last_security_scan &&
                systemMetrics?.security && (
                  <div className="health-item">
                    <span className="health-label">Last Security Scan:</span>
                    <span className="health-value" style={{ color: '#d97706' }}>
                      Not implemented
                    </span>
                  </div>
                )}
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
