import React from 'react';
import './AdminHeader.css';

const AdminHeader = ({ user, onLogout, onToggleSidebar }) => {
  console.log('🎯 AdminHeader render:', {
    timestamp: new Date().toISOString(),
    user: user?.username,
    hasOnLogout: typeof onLogout === 'function',
    hasOnToggleSidebar: typeof onToggleSidebar === 'function',
  });

  const handleLogout = () => {
    console.log('🚪 AdminHeader logout button clicked:', {
      timestamp: new Date().toISOString(),
      user: user?.username,
    });
    if (onLogout) {
      onLogout();
    } else {
      console.error('❌ onLogout function not provided to AdminHeader');
    }
  };

  const handleToggleSidebar = () => {
    console.log('📱 AdminHeader sidebar toggle clicked');
    if (onToggleSidebar) {
      onToggleSidebar();
    } else {
      console.error('❌ onToggleSidebar function not provided to AdminHeader');
    }
  };
  return (
    <header className="admin-header">
      {' '}
      <div className="header-left">
        <button className="sidebar-toggle-btn" onClick={handleToggleSidebar}>
          ☰
        </button>
        <h1>Medical Records Admin</h1>
      </div>
      <div className="header-center">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search records, users, or data..."
            className="global-search"
          />
          <button className="search-btn">🔍</button>
        </div>
      </div>{' '}
      <div className="header-right">
        <button
          className="back-to-dashboard-btn"
          onClick={() => (window.location.href = '/admin')}
          title="Return to Admin Dashboard"
        >
          ← Admin Dashboard
        </button>

        <button
          className="back-to-home-btn"
          onClick={() => (window.location.href = '/dashboard')}
          title="Return to Normal Dashboard"
        >
          🏠 Home
        </button>

        <div className="admin-user-info">
          <span className="user-role">Admin</span>
          <span className="user-name">{user?.username || 'Administrator'}</span>
          <div className="user-avatar">👤</div>
        </div>

        <div className="header-actions">
          <button className="notification-btn" title="Notifications">
            🔔
            <span className="notification-badge">3</span>
          </button>

          <button className="logout-btn" onClick={handleLogout} title="Logout">
            🚪 Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
