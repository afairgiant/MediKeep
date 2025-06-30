import React from 'react';
import { Link } from 'react-router-dom';
import './AdminSidebar.css';

const AdminSidebar = ({ isOpen, onToggle, currentPath }) => {
  console.log('🗂️ AdminSidebar render:', {
    timestamp: new Date().toISOString(),
    isOpen,
    currentPath,
    hasOnToggle: typeof onToggle === 'function',
  });
  // Models moved to separate Data Models page

  const handleToggle = () => {
    console.log('🗂️ AdminSidebar toggle clicked');
    if (onToggle) {
      onToggle();
    } else {
      console.error('❌ onToggle function not provided to AdminSidebar');
    }
  };

  const handleLinkClick = path => {
    console.log('🔗 AdminSidebar link clicked:', {
      timestamp: new Date().toISOString(),
      path,
      currentPath,
    });
  };

  return (
    <div className={`admin-sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <h2>🔧 Admin</h2>
        <button className="sidebar-toggle" onClick={handleToggle}>
          {isOpen ? '‹' : '›'}
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <h3>Dashboard</h3>
          <Link
            to="/admin"
            className={`nav-item ${currentPath === '/admin' ? 'active' : ''}`}
            onClick={() => handleLinkClick('/admin')}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-text">Overview</span>
          </Link>
        </div>

        <div className="nav-section">
          <h3>Data Management</h3>
          <Link
            to="/admin/data-models"
            className={`nav-item ${currentPath.includes('/admin/data-models') ? 'active' : ''}`}
            onClick={() => handleLinkClick('/admin/data-models')}
          >
            <span className="nav-icon">🗄️</span>
            <span className="nav-text">Data Models</span>
          </Link>
        </div>

        <div className="nav-section">
          <h3>Tools</h3>
          <Link
            to="/admin/backup"
            className={`nav-item ${currentPath.includes('/admin/backup') ? 'active' : ''}`}
            onClick={() => handleLinkClick('/admin/backup')}
          >
            <span className="nav-icon">💾</span>
            <span className="nav-text">Backup Management</span>
          </Link>
          <Link
            to="/admin/bulk-operations"
            className={`nav-item ${currentPath.includes('/admin/bulk-operations') ? 'active' : ''}`}
            onClick={() => handleLinkClick('/admin/bulk-operations')}
          >
            <span className="nav-icon">⚡</span>
            <span className="nav-text">Bulk Operations</span>
          </Link>
          <Link
            to="/admin/system-health"
            className={`nav-item ${currentPath.includes('/admin/system-health') ? 'active' : ''}`}
            onClick={() => handleLinkClick('/admin/system-health')}
          >
            <span className="nav-icon">🔍</span>
            <span className="nav-text">System Health</span>
          </Link>
          <Link
            to="/admin/settings"
            className={`nav-item ${currentPath.includes('/admin/settings') ? 'active' : ''}`}
            onClick={() => handleLinkClick('/admin/settings')}
          >
            <span className="nav-icon">⚙️</span>
            <span className="nav-text">Settings</span>
          </Link>
        </div>
      </nav>
    </div>
  );
};

export default AdminSidebar;
