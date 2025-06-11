import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminApiService } from '../../services/api/adminApi';
import { Loading } from '../../components';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Loading dashboard data sequentially to prevent concurrent issues...');

      // Load data sequentially instead of all at once to prevent concurrent auth issues
      console.log('📊 Loading stats...');
      const statsData = await adminApiService.getDashboardStats();
      setStats(statsData);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('📋 Loading recent activity...');
      const activityData = await adminApiService.getRecentActivity();
      setRecentActivity(activityData);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('🔍 Loading system health...');
      const healthData = await adminApiService.getSystemHealth();
      setSystemHealth(healthData);
      
      console.log('✅ All dashboard data loaded successfully');

    } catch (err) {
      console.error('❌ Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <Loading />
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="admin-error">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={loadDashboardData} className="retry-btn">
            Retry
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="admin-dashboard">
        <div className="dashboard-header">
          <h1>Admin Dashboard</h1>
          <p>System overview and statistics</p>
        </div>

        {/* Statistics Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <h3>Total Users</h3>
              <p className="stat-number">{stats?.total_users || 0}</p>
              <small>+{stats?.recent_registrations || 0} recent</small>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🏥</div>
            <div className="stat-content">
              <h3>Total Patients</h3>
              <p className="stat-number">{stats?.total_patients || 0}</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">👨‍⚕️</div>
            <div className="stat-content">
              <h3>Practitioners</h3>
              <p className="stat-number">{stats?.total_practitioners || 0}</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">💊</div>
            <div className="stat-content">
              <h3>Active Medications</h3>
              <p className="stat-number">{stats?.active_medications || 0}</p>
              <small>of {stats?.total_medications || 0} total</small>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🧪</div>
            <div className="stat-content">
              <h3>Lab Results</h3>
              <p className="stat-number">{stats?.total_lab_results || 0}</p>
              <small>{stats?.pending_lab_results || 0} pending</small>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🩺</div>
            <div className="stat-content">
              <h3>Medical Records</h3>
              <p className="stat-number">
                {(stats?.total_conditions || 0) + 
                 (stats?.total_allergies || 0) + 
                 (stats?.total_procedures || 0)}
              </p>
              <small>conditions, allergies, procedures</small>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="dashboard-content">
          {/* System Health */}
          <div className="dashboard-card">
            <h2>System Health</h2>
            <div className="system-health">
              <div className="health-item">
                <span className="health-label">Database Status:</span>
                <span className={`health-status ${systemHealth?.database_status === 'healthy' ? 'healthy' : 'error'}`}>
                  {systemHealth?.database_status || 'Unknown'}
                </span>
              </div>
              <div className="health-item">
                <span className="health-label">Total Records:</span>
                <span className="health-value">{systemHealth?.total_records || 0}</span>
              </div>
              <div className="health-item">
                <span className="health-label">System Uptime:</span>
                <span className="health-value">{systemHealth?.system_uptime || 'Unknown'}</span>
              </div>
              <div className="health-item">
                <span className="health-label">Last Backup:</span>
                <span className="health-value">
                  {systemHealth?.last_backup ? 
                    new Date(systemHealth.last_backup).toLocaleDateString() : 
                    'No backup recorded'
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="dashboard-card">
            <h2>Recent Activity</h2>
            <div className="recent-activity">
              {recentActivity.length > 0 ? (
                <ul className="activity-list">
                  {recentActivity.map((activity, index) => (
                    <li key={index} className="activity-item">
                      <div className="activity-icon">
                        {activity.model_name === 'User' && '👥'}
                        {activity.model_name === 'Patient' && '🏥'}
                        {activity.model_name === 'LabResult' && '🧪'}
                        {!['User', 'Patient', 'LabResult'].includes(activity.model_name) && '📋'}
                      </div>
                      <div className="activity-content">
                        <p className="activity-description">{activity.description}</p>
                        <small className="activity-time">
                          {new Date(activity.timestamp).toLocaleString()}
                        </small>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="no-activity">No recent activity</p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="dashboard-card">
            <h2>Quick Actions</h2>
            <div className="quick-actions">
              <button className="action-btn" onClick={() => window.location.href = '/admin/models/user'}>
                <span className="action-icon">👥</span>
                Manage Users
              </button>
              <button className="action-btn" onClick={() => window.location.href = '/admin/models/patient'}>
                <span className="action-icon">🏥</span>
                Manage Patients
              </button>
              <button className="action-btn" onClick={() => window.location.href = '/admin/bulk-operations'}>
                <span className="action-icon">⚡</span>
                Bulk Operations
              </button>
              <button className="action-btn" onClick={() => window.location.href = '/admin/system-health'}>
                <span className="action-icon">🔍</span>
                System Health
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
