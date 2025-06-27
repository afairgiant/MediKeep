import React from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../ui/ThemeToggle';
import './PageHeader.css';

const PageHeader = ({
  title,
  icon,
  showBackButton = true,
  backButtonText = '← Back to Dashboard',
  backButtonPath = '/dashboard',
  onBackClick,
  actions,
  className = '',
  variant = 'medical', // 'medical' or 'dashboard'
  showGlobalActions = true, // Show settings, theme, logout by default
}) => {
  const navigate = useNavigate();

  const handleBackClick = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      navigate(backButtonPath);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const baseClasses =
    variant === 'dashboard'
      ? 'page-header dashboard-header'
      : 'page-header medical-page-header';

  return (
    <header className={`${baseClasses} ${className}`}>
      <div className="header-left">
        {showBackButton && (
          <button className="back-button" onClick={handleBackClick}>
            {backButtonText}
          </button>
        )}
      </div>

      <div className="header-center">
        <h1 className="page-title">
          {icon && <span className="title-icon">{icon}</span>}
          {title}
        </h1>
      </div>

      <div className="header-right">
        <div className="header-actions">
          {/* Page-specific actions */}
          {actions}

          {/* Global navigation actions */}
          {showGlobalActions && (
            <div className="global-actions">
              <button
                className="settings-button"
                onClick={() => navigate('/settings')}
                type="button"
                title="Settings"
              >
                ⚙️
              </button>
              <ThemeToggle />
              <button
                onClick={handleLogout}
                className="logout-btn"
                title="Logout"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default PageHeader;
