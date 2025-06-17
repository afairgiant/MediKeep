import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminApiService } from '../../services/api/adminApi';
import { Loading } from '../../components';
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

const AdminDashboard = () => {  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  useEffect(() => {
    loadDashboardData();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadDashboardData(true); // Silent refresh
    }, 30000);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  const loadDashboardData = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }


      console.log('🔄 Loading comprehensive dashboard data...');

      // Load all data in parallel for better performance
      const [statsData, activityData, healthData] = await Promise.all([
        adminApiService.getDashboardStats(),
        adminApiService.getRecentActivity(15),
        adminApiService.getSystemHealth()
      ]);
      
      setStats(statsData);
      setRecentActivity(activityData);
      setSystemHealth(healthData);
      setLastRefresh(new Date());
   

      console.log('✅ All dashboard data loaded successfully');
    } catch (err) {
      console.error('❌ Error loading dashboard data:', err);
      if (!silent) setError('Failed to load dashboard data');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadDashboardData();
  };

  const getHealthStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'healthy': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'error': case 'critical': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getActivityIcon = (modelName, action) => {
    const icons = {
      'User': '👥',
      'Patient': '🏥',
      'LabResult': '🧪',
      'Medication': '💊',
      'Procedure': '🩺',
      'Allergy': '⚠️',
      'Immunization': '💉',
      'Condition': '📋'
    };
    return icons[modelName] || '📄';
  };

  // Chart data preparation
  const activityChartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'User Activity',
        data: stats?.weekly_activity || [12, 19, 8, 15, 22, 18, 25],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      }
    ]
  };

  const recordsDistributionData = {
    labels: ['Patients', 'Lab Results', 'Medications', 'Procedures', 'Allergies'],
    datasets: [
      {
        data: [
          stats?.total_patients || 0,
          stats?.total_lab_results || 0,
          stats?.total_medications || 0,
          stats?.total_procedures || 0,
          stats?.total_allergies || 0
        ],
        backgroundColor: [
          '#3b82f6',
          '#10b981',
          '#f59e0b',
          '#ef4444',
          '#8b5cf6'
        ],
        borderWidth: 0,
      }
    ]
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="admin-loading">
          <Loading />
          <p>Loading comprehensive dashboard...</p>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="admin-error">
          <div className="error-icon">⚠️</div>
          <h2>Dashboard Error</h2>
          <p>{error}</p>
          <div className="error-actions">
            <button onClick={handleRefresh} className="retry-btn primary">
              🔄 Retry
            </button>
            <button onClick={() => window.location.reload()} className="retry-btn secondary">
              🔄 Reload Page
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }
  return (
    <AdminLayout>
      <div className="admin-dashboard-modern">
        {/* Dashboard Header */}
        <div className="dashboard-header-modern">
          <div className="header-content">
            <div className="header-title">
              <h1>🏥 Admin Dashboard</h1>
              <p>Comprehensive system overview and management</p>
              {lastRefresh && (
                <small className="last-refresh">
                  Last updated: {lastRefresh.toLocaleTimeString()}
                </small>
              )}
            </div>
            <div className="header-actions">
              <button onClick={handleRefresh} className="refresh-btn" disabled={loading}>
                <span className={`refresh-icon ${loading ? 'spinning' : ''}`}>🔄</span>
                Refresh
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
        </div>

        {/* Quick Stats Grid */}
        <div className="quick-stats-grid">
          <div className="stat-card-modern primary">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <div className="stat-value">{stats?.total_users || 0}</div>
              <div className="stat-label">Total Users</div>
              <div className="stat-change positive">
                +{stats?.recent_registrations || 0} this week
              </div>
            </div>
            <div className="stat-trend">📈</div>
          </div>

          <div className="stat-card-modern success">
            <div className="stat-icon">🏥</div>
            <div className="stat-content">
              <div className="stat-value">{stats?.total_patients || 0}</div>
              <div className="stat-label">Active Patients</div>
              <div className="stat-change neutral">
                {stats?.active_patients || 0} active
              </div>
            </div>
            <div className="stat-trend">📊</div>
          </div>

          <div className="stat-card-modern warning">
            <div className="stat-icon">🧪</div>
            <div className="stat-content">
              <div className="stat-value">{stats?.total_lab_results || 0}</div>
              <div className="stat-label">Lab Results</div>
              <div className="stat-change attention">
                {stats?.pending_lab_results || 0} pending review
              </div>
            </div>
            <div className="stat-trend">⏳</div>
          </div>

          <div className="stat-card-modern info">
            <div className="stat-icon">💊</div>
            <div className="stat-content">

              <div className="stat-value">{stats?.total_medications || 0}</div>
              <div className="stat-label">Medications</div>
              <div className="stat-change positive">
                {stats?.active_medications || 0} active prescriptions
              </div>

            </div>
            <div className="stat-trend">💊</div>
          </div>
        </div>


        {/* Main Dashboard Content */}
        <div className="dashboard-content-modern">
          
          {/* Charts Section */}
          {activeTab === 'analytics' && (
            <div className="charts-section">
              <div className="chart-card">
                <div className="chart-header">
                  <h3>📈 Weekly Activity Trend</h3>
                  <p>User interactions over the past week</p>
                </div>
                <div className="chart-container">
                  <Line 
                    data={activityChartData} 
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { display: false }
                      },
                      scales: {
                        y: { beginAtZero: true }
                      }
                    }} 
                  />
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-header">
                  <h3>📊 Records Distribution</h3>
                  <p>Breakdown of medical records by type</p>
                </div>
                <div className="chart-container doughnut">
                  <Doughnut 
                    data={recordsDistributionData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'bottom' }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}


          {/* Overview Content */}
          {activeTab === 'overview' && (
            <div className="overview-section">
              
              {/* System Health Card */}
              <div className="dashboard-card-modern health-card">
                <div className="card-header">
                  <h3>🔍 System Health</h3>
                  <div className="health-status-indicator">
                    <span 
                      className="status-dot" 
                      style={{ backgroundColor: getHealthStatusColor(systemHealth?.database_status) }}
                    ></span>
                    {systemHealth?.database_status || 'Unknown'}
                  </div>
                </div>
                <div className="health-metrics">
                  <div className="health-metric">
                    <div className="metric-icon">💾</div>
                    <div className="metric-content">
                      <div className="metric-label">Database Status</div>
                      <div className="metric-value">{systemHealth?.database_status || 'Unknown'}</div>
                    </div>
                  </div>
                  <div className="health-metric">
                    <div className="metric-icon">📊</div>
                    <div className="metric-content">
                      <div className="metric-label">Total Records</div>
                      <div className="metric-value">{systemHealth?.total_records || 0}</div>
                    </div>
                  </div>
                  <div className="health-metric">
                    <div className="metric-icon">⏱️</div>
                    <div className="metric-content">
                      <div className="metric-label">Uptime</div>
                      <div className="metric-value">{systemHealth?.system_uptime || 'Unknown'}</div>
                    </div>
                  </div>
                  <div className="health-metric">
                    <div className="metric-icon">💽</div>
                    <div className="metric-content">
                      <div className="metric-label">Last Backup</div>
                      <div className="metric-value">
                        {systemHealth?.last_backup ? 
                          new Date(systemHealth.last_backup).toLocaleDateString() : 
                          'No backup'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity Card */}
              <div className="dashboard-card-modern activity-card">
                <div className="card-header">
                  <h3>📋 Recent Activity</h3>
                  <div className="activity-filter">
                    <select className="filter-select">
                      <option value="all">All Activities</option>
                      <option value="users">User Activities</option>
                      <option value="medical">Medical Records</option>
                    </select>
                  </div>
                </div>
                <div className="activity-feed">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((activity, index) => (
                      <div key={index} className="activity-item-modern">
                        <div className="activity-icon-modern">
                          {getActivityIcon(activity.model_name, activity.action)}
                        </div>
                        <div className="activity-content-modern">
                          <div className="activity-description">{activity.description}</div>
                          <div className="activity-meta">
                            <span className="activity-time">
                              {new Date(activity.timestamp).toLocaleString()}
                            </span>
                            <span className="activity-type">{activity.model_name}</span>
                          </div>
                        </div>
                        <div className="activity-status">
                          <span className="status-badge success">✓</span>
                        </div>

                      </div>
                    ))
                  ) : (
                    <div className="no-activity-modern">
                      <div className="no-activity-icon">📭</div>
                      <p>No recent activity to display</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}


          {/* Quick Actions Panel */}
          <div className="quick-actions-modern">
            <h3>⚡ Quick Actions</h3>
            <div className="actions-grid">
              <button 
                className="action-btn-modern primary"
                onClick={() => window.location.href = '/admin/models/user'}
              >
                <div className="action-icon">👥</div>
                <div className="action-content">
                  <div className="action-title">Manage Users</div>
                  <div className="action-desc">View, edit, and manage user accounts</div>
                </div>
              </button>

              <button 
                className="action-btn-modern success"
                onClick={() => window.location.href = '/admin/models/patient'}
              >
                <div className="action-icon">🏥</div>
                <div className="action-content">
                  <div className="action-title">Patient Records</div>
                  <div className="action-desc">Access and manage patient information</div>
                </div>
              </button>

              <button 
                className="action-btn-modern warning"
                onClick={() => window.location.href = '/admin/system-health'}
              >
                <div className="action-icon">🔍</div>
                <div className="action-content">
                  <div className="action-title">System Health</div>
                  <div className="action-desc">Monitor system performance and status</div>
                </div>
              </button>

              <button 
                className="action-btn-modern info"
                onClick={() => window.location.href = '/admin/bulk-operations'}
              >
                <div className="action-icon">⚡</div>
                <div className="action-content">
                  <div className="action-title">Bulk Operations</div>
                  <div className="action-desc">Perform batch operations on records</div>
                </div>
              </button>

              <button 
                className="action-btn-modern secondary"
                onClick={() => window.location.href = '/admin/models/lab-result'}
              >
                <div className="action-icon">🧪</div>
                <div className="action-content">
                  <div className="action-title">Lab Results</div>
                  <div className="action-desc">Review and manage laboratory results</div>
                </div>
              </button>

              <button 
                className="action-btn-modern tertiary"
                onClick={() => window.location.href = '/admin/reports'}
              >
                <div className="action-icon">📊</div>
                <div className="action-content">
                  <div className="action-title">Generate Reports</div>
                  <div className="action-desc">Create system and usage reports</div>
                </div>
              </button>
            </div>
          </div>

        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
