import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './AdminSidebar.css';

const AdminSidebar = ({ isOpen, onToggle, currentPath }) => {
  const [isMobile, setIsMobile] = useState(false);
  

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    }
  };

  const handleLinkClick = path => {
    // Close sidebar on mobile when a link is clicked
    if (isMobile && isOpen && onToggle) {
      onToggle();
    }
  };

  const handleBackdropClick = () => {
    if (isMobile && isOpen && onToggle) {
      onToggle();
    }
  };

  // Close sidebar on escape key press (mobile)
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && isMobile && isOpen && onToggle) {
        onToggle();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onToggle, isMobile]);

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && (
        <div 
          className={`mobile-sidebar-backdrop ${isOpen ? 'visible' : ''}`}
          onClick={handleBackdropClick}
        />
      )}
      
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
    </>
  );
};

export default AdminSidebar;
