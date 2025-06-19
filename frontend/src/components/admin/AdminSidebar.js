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
  const models = [
    { name: 'user', display: 'Users', icon: '👥' },
    { name: 'patient', display: 'Patients', icon: '🏥' },
    { name: 'practitioner', display: 'Practitioners', icon: '👨‍⚕️' },
    { name: 'medication', display: 'Medications', icon: '💊' },
    { name: 'lab_result', display: 'Lab Results', icon: '🧪' },
    { name: 'lab_result_file', display: 'Lab Files', icon: '📄' },
    { name: 'vitals', display: 'Vital Signs', icon: '🩺' },
    { name: 'condition', display: 'Conditions', icon: '📋' },
    { name: 'allergy', display: 'Allergies', icon: '⚠️' },
    { name: 'immunization', display: 'Immunizations', icon: '💉' },
    { name: 'procedure', display: 'Procedures', icon: '🔬' },
    { name: 'treatment', display: 'Treatments', icon: '🩹' },
    { name: 'encounter', display: 'Encounters', icon: '�' },
  ];

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
          <h3>Data Models</h3>
          {models.map(model => (
            <Link
              key={model.name}
              to={`/admin/models/${model.name}`}
              className={`nav-item ${currentPath.includes(`/admin/models/${model.name}`) ? 'active' : ''}`}
              onClick={() => handleLinkClick(`/admin/models/${model.name}`)}
            >
              <span className="nav-icon">{model.icon}</span>
              <span className="nav-text">{model.display}</span>
            </Link>
          ))}
        </div>

        <div className="nav-section">
          <h3>Tools</h3>
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
        </div>
      </nav>
    </div>
  );
};

export default AdminSidebar;
