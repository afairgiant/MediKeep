import React, { useState, useEffect } from 'react';
import { DashboardCard } from '../components';
import { apiService } from '../services/api';
import '../styles/pages/Dashboard.css';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Fetch user data from your FastAPI backend
    fetchUserData();
    fetchRecentActivity();
    checkAdminStatus();
  }, []);
  const checkAdminStatus = () => {
    try {
      const token = localStorage.getItem('token');
      console.log('🔍 Checking admin status...');
      console.log('Token exists:', !!token);

      if (token) {
        // Decode JWT token to check role
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('JWT payload:', payload);

        // Check if user has admin role (this should also be verified on backend)
        const userRole = payload.role || '';
        const adminCheck =
          userRole.toLowerCase() === 'admin' ||
          userRole.toLowerCase() === 'administrator';

        console.log('User role:', userRole);
        console.log('Is admin:', adminCheck);

        setIsAdmin(adminCheck);
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  };

  const fetchUserData = async () => {
    try {
      const userData = await apiService.getCurrentPatient();
      setUser(userData);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const activity = await apiService.getRecentActivity();
      setRecentActivity(activity);
    } catch (error) {
      console.error('Error fetching activity:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const dashboardItems = [
    {
      title: '📋 Patient Information',
      description: 'View and update your personal details',
      link: '/patients/me',
    },
    {
      title: '🧪 Lab Results',
      description: 'Access your laboratory test results',
      link: '/lab-results',
    },
    {
      title: '💊 Medications',
      description: 'Track your current medications',
      link: '/medications',
    },
    {
      title: '🩺 Vital Signs',
      description: 'Record and view your vital signs',
      link: '/vitals',
    },
    {
      title: '💉 Immunizations',
      description: 'Check your immunization records',
      link: '/immunizations',
    },
    {
      title: 'Procedures',
      description: 'Review your Procedures',
      link: '/procedures',
    },
    {
      title: 'Allergies',
      description: 'Review your allergies',
      link: '/allergies',
    },
    {
      title: 'Conditions',
      description: 'Review your medical conditions',
      link: '/conditions',
    },
    {
      title: 'Treatments',
      description: 'Review your treatments',
      link: '/treatments',
    },
    {
      title: 'Visit History',
      description: 'Review your visits',
      link: '/visits',
    },
  ]; // Smaller secondary items for additional features
  const secondaryItems = [
    {
      title: '👨‍⚕️ Doctors',
      description: 'View practitioner information',
      link: '/practitioners',
    },
  ];
  // Add admin dashboard link if user is admin
  if (isAdmin) {
    secondaryItems.unshift({
      title: '⚙️ Admin Dashboard',
      description: 'System administration and management',
      link: '/admin',
    });
  }

  console.log('🔍 Dashboard render state:');
  console.log('isAdmin:', isAdmin);
  console.log('secondaryItems:', secondaryItems);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header>
        <h1>🏥 Medical Records Dashboard</h1>
        <nav>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </nav>
      </header>

      <main>
        <div className="welcome-section">
          <h2>Welcome to your Medical Records System</h2>
          <p>
            Manage your personal health information securely and efficiently.
          </p>
          {user && <p>Hello, {user.name}!</p>}
        </div>{' '}
        <div className="dashboard-grid">
          {dashboardItems.map((item, index) => (
            <DashboardCard
              key={index}
              title={item.title}
              description={item.description}
              link={item.link}
            />
          ))}
          {/* Secondary/smaller items section */}
          <div className="secondary-items">
            <h3>Additional Resources</h3>
            <div className="secondary-grid">
              {secondaryItems.map((item, index) => (
                <DashboardCard
                  key={`secondary-${index}`}
                  title={item.title}
                  description={item.description}
                  link={item.link}
                  size="small"
                />
              ))}
            </div>
          </div>{' '}
          <div className="recent-activity">
            <h3>Recent Medical Activity</h3>
            {recentActivity.length > 0 ? (
              <ul>
                {recentActivity.map((activity, index) => (
                  <li key={index} className="activity-item">
                    <div className="activity-content">
                      <span className="activity-description">
                        {activity.description}
                      </span>
                      <span className="activity-time">
                        {new Date(activity.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="no-activity">
                <p>No recent medical activity to display.</p>
                <p>
                  Start by adding medications, lab results, or other medical
                  information.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer>
        <p>&copy; 2025 Medical Records System. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Dashboard;
