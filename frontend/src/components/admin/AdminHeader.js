import React from 'react';
import './AdminHeader.css';

const AdminHeader = ({ user, onLogout, onToggleSidebar }) => {
  return (
    <header className="admin-header">
      <div className="header-left">
        <button className="sidebar-toggle-btn" onClick={onToggleSidebar}>
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
      </div>

      <div className="header-right">
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
          
          <button className="logout-btn" onClick={onLogout} title="Logout">
            🚪 Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
