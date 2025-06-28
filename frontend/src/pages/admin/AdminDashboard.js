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
import AdminLayout from '../../components/admin/AdminLayout';
import AdminCard from '../../components/admin/AdminCard';
import { useAdminData } from '../../hooks/useAdminData';
import { adminApiService } from '../../services/api/adminApi';
import { Loading } from '../../components';
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
        <div className="admin-page-loading">
          <Loading message="Loading comprehensive dashboard..." />
        </div>
      </AdminLayout>
    );
  }

  const chartData = createChartData();

  return (
    <AdminLayout>
      <div className="admin-dashboard-modern">
        {/* Dashboard Header */}
        <AdminCard className="dashboard-header-card">
          <div className="header-content">
            <div className="header-title">
              <h1>🏥 Admin Dashboard</h1>
              <p>Comprehensive system overview and management</p>
            </div>
            <div className="header-actions">
              <button
                onClick={handleRefreshAll}
                className="refresh-btn"
                disabled={loading}
              >
                <span className={`refresh-icon ${loading ? 'spinning' : ''}`}>
                  🔄
                </span>
                Refresh All
              </button>
              <div className="view-tabs">
                <button
                  className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveTab('overview')}
                >
                  📊 Overview
                </button>
                <button
                  className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                  onClick={() => setActiveTab('analytics')}
                >
                  📈 Analytics
                </button>
              </div>
            </div>
          </div>
        </AdminCard>

        {/* Quick Stats Grid */}
        <div className="quick-stats-grid">
          <StatCard
            icon="👥"
            value={stats?.total_users || 0}
            label="Total Users"
            change={`+${stats?.recent_registrations || 0} this week`}
            variant="primary"
            trend="📈"
          />
          <StatCard
            icon="🏥"
            value={stats?.total_patients || 0}
            label="Active Patients"
            change={`${stats?.active_patients || 0} active`}
            variant="success"
            trend="📊"
          />
          <StatCard
            icon="🧪"
            value={stats?.total_lab_results || 0}
            label="Lab Results"
            change={`${stats?.pending_lab_results || 0} pending review`}
            variant="warning"
            trend="⏳"
          />
          <StatCard
            icon="💊"
            value={stats?.total_medications || 0}
            label="Medications"
            change={`${stats?.active_medications || 0} active prescriptions`}
            variant="info"
            trend="💊"
          />
          <StatCard
            icon="📊"
            value={stats?.total_vitals || 0}
            label="Vital Signs"
            change="Recent measurements"
            variant="secondary"
            trend="❤️"
          />
        </div>

        {/* Main Dashboard Content */}
        {activeTab === 'analytics' && (
          <div className="charts-section">
            <AdminCard
              title="📈 Weekly Activity Trend"
              subtitle="User interactions over the past week"
              className="chart-card"
            >
              {analyticsData?.weekly_activity && (
                <div className="activity-summary">
                  <span>
                    Total: {analyticsData.weekly_activity.total} activities
                  </span>
                  {analyticsData.date_range && (
                    <span>
                      ({analyticsData.date_range.start} to{' '}
                      {analyticsData.date_range.end})
                    </span>
                  )}
                </div>
              )}
              <div className="chart-container">
                <Line
                  data={chartData.activity}
                  options={createLineChartOptions()}
                />
              </div>
            </AdminCard>

            <AdminCard
              title="📊 Records Distribution"
              subtitle="Breakdown of medical records by type"
              className="chart-card"
            >
              <div className="chart-container doughnut">
                <Doughnut
                  data={chartData.distribution}
                  options={createDoughnutChartOptions()}
                />
              </div>
            </AdminCard>
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="overview-section">
            {/* System Health Card */}
            <SystemHealthCard
              systemHealth={systemHealth}
              loading={healthLoading}
              error={healthError}
              getHealthStatusColor={getHealthStatusColor}
            />

            {/* Recent Activity Card */}
            <ActivityCard
              activities={recentActivity || []}
              loading={activityLoading}
              error={activityError}
              getActivityIcon={getActivityIcon}
            />

            {/* Quick Actions Panel */}
            <QuickActionsCard />
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

// Reusable StatCard Component
const StatCard = ({ icon, value, label, change, variant, trend }) => (
  <div className={`stat-card-modern ${variant}`}>
    <div className="stat-icon">{icon}</div>
    <div className="stat-content">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-change">{change}</div>
    </div>
    <div className="stat-trend">{trend}</div>
  </div>
);

// Reusable SystemHealthCard Component
const SystemHealthCard = ({
  systemHealth,
  loading,
  error,
  getHealthStatusColor,
}) => (
  <AdminCard
    title="🔍 System Health"
    loading={loading}
    error={error}
    className="health-card"
    actions={
      <div className="health-status-indicator">
        <span
          className="status-dot"
          style={{
            backgroundColor: getHealthStatusColor(
              systemHealth?.database_status
            ),
          }}
        />
        {systemHealth?.database_status || 'Unknown'}
      </div>
    }
  >
    <div className="health-metrics">
      <HealthMetric
        icon="💾"
        label="Database Status"
        value={systemHealth?.database_status || 'Unknown'}
      />
      <HealthMetric
        icon="📊"
        label="Total Records"
        value={systemHealth?.total_records || 0}
      />
      <HealthMetric
        icon="⏱️"
        label="Uptime"
        value={systemHealth?.system_uptime || 'Unknown'}
      />
      <HealthMetric
        icon="💽"
        label="Last Backup"
        value={
          systemHealth?.last_backup
            ? formatDate(systemHealth.last_backup)
            : 'No backup'
        }
      />
    </div>
  </AdminCard>
);

// Reusable ActivityCard Component
const ActivityCard = ({ activities, loading, error, getActivityIcon }) => (
  <AdminCard
    title="📋 Recent Activity"
    loading={loading}
    error={error}
    className="activity-card"
    actions={
      <div className="activity-filter">
        <small>{activities.length} activities</small>
      </div>
    }
  >
    <div className="activity-feed">
      {activities.length > 0 ? (
        activities.map((activity, index) => (
          <ActivityItem
            key={index}
            activity={activity}
            icon={getActivityIcon(activity.model_name, activity.action)}
          />
        ))
      ) : (
        <div className="no-activity-modern">
          <div className="no-activity-icon">📭</div>
          <p>No recent activity to display</p>
        </div>
      )}
    </div>
  </AdminCard>
);

// Reusable QuickActionsCard Component
const QuickActionsCard = () => (
  <AdminCard title="⚡ Quick Actions" className="quick-actions-card">
    <div className="actions-grid">
      <ActionButton
        href="/admin/models/user"
        icon="👥"
        title="Manage Users"
        desc="View, edit, and manage user accounts"
        variant="primary"
      />
      <ActionButton
        href="/admin/models/patient"
        icon="🏥"
        title="Patient Records"
        desc="Access and manage patient information"
        variant="success"
      />
      <ActionButton
        href="/admin/system-health"
        icon="🔍"
        title="System Health"
        desc="Monitor system performance and status"
        variant="warning"
      />
      <ActionButton
        href="/admin/bulk-operations"
        icon="⚡"
        title="Bulk Operations"
        desc="Perform batch operations on records"
        variant="info"
      />
      <ActionButton
        href="/admin/models/lab-result"
        icon="🧪"
        title="Lab Results"
        desc="Review and manage laboratory results"
        variant="secondary"
      />
      <ActionButton
        href="/admin/reports"
        icon="📊"
        title="Generate Reports"
        desc="Create system and usage reports"
        variant="tertiary"
      />
    </div>
  </AdminCard>
);

// Helper Components
const HealthMetric = ({ icon, label, value }) => (
  <div className="health-metric">
    <div className="metric-icon">{icon}</div>
    <div className="metric-content">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  </div>
);

const ActivityItem = ({ activity, icon }) => (
  <div
    className={`activity-item-modern ${activity.action?.toLowerCase() === 'deleted' ? 'deleted' : ''}`}
  >
    <div className="activity-icon-modern">{icon}</div>
    <div className="activity-content-modern">
      <div className="activity-description">{activity.description}</div>
      <div className="activity-meta">
        <span className="activity-time">
          {formatDateTime(activity.timestamp)}
        </span>
        <span className="activity-type">{activity.model_name}</span>
        <span className={`activity-action ${activity.action?.toLowerCase()}`}>
          {activity.action || 'created'}
        </span>
      </div>
    </div>
    <div className="activity-status">
      <span className="status-badge">
        {activity.action === 'deleted'
          ? '🗑️'
          : activity.action === 'updated'
            ? '📝'
            : activity.action === 'viewed'
              ? '👁️'
              : '✓'}
      </span>
    </div>
  </div>
);

const ActionButton = ({ href, icon, title, desc, variant }) => (
  <button
    className={`action-btn-modern ${variant}`}
    onClick={() => (window.location.href = href)}
  >
    <div className="action-icon">{icon}</div>
    <div className="action-content">
      <div className="action-title">{title}</div>
      <div className="action-desc">{desc}</div>
    </div>
  </button>
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
