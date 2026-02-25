import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import './AdminHeader.css';

const AdminHeader = ({ user, onLogout, onToggleSidebar }) => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    navigate(`/admin/data-models?q=${encodeURIComponent(trimmed)}`);
    setSearchQuery('');
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleLogout = () => onLogout?.();
  const handleToggleSidebar = () => onToggleSidebar?.();
  return (
    <header className="admin-header">
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            aria-label="Search data models"
          />
          <button className="search-btn" onClick={handleSearch} aria-label="Search">🔍</button>
        </div>
      </div>
      
      <div className="header-right">
        <button
          className="back-to-dashboard-btn"
          onClick={() => navigate('/admin')}
          title="Return to Admin Dashboard"
        >
          ← Dashboard
        </button>

        <button
          className="back-to-home-btn"
          onClick={() => navigate('/dashboard')}
          title="Return to Normal Dashboard"
        >
          🏠
        </button>

        <div className="admin-user-info">
          <span className="user-role">Admin</span>
          <span className="user-name">{user?.username || 'Administrator'}</span>
          <div className="user-avatar">👤</div>
        </div>

        <div className="header-actions">
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          <button className="logout-btn" onClick={handleLogout} title="Logout">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
