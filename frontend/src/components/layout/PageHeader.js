import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { NavigationWrapper } from '../navigation';
import { useViewport } from '../../hooks/useViewport';
import ThemeToggle from '../ui/ThemeToggle';
import './PageHeader.css';

/**
 * Simplified PageHeader component using the new modular navigation system
 */
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
  showGlobalActions = true,
  showNavigation = true,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isMobile } = useViewport();
  
  // Check if user is admin
  const isAdmin = () => {
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const userRole = payload.role || '';
        return (
          userRole.toLowerCase() === 'admin' ||
          userRole.toLowerCase() === 'administrator'
        );
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
    return false;
  };
  
  const handleBackClick = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      navigate(backButtonPath);
    }
  };
  
  const baseClasses =
    variant === 'dashboard'
      ? 'page-header dashboard-header'
      : 'page-header medical-page-header';
  
  return (
    <>
      <header className={`${baseClasses} ${className}`}>
        <div className="header-left">
          {showBackButton && !isMobile && (
            <button 
              className="back-button" 
              onClick={handleBackClick}
              type="button"
            >
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
            
            {/* Global actions only for mobile (desktop has them in Account dropdown) */}
            {showGlobalActions && isMobile && (
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
              </div>
            )}
          </div>
        </div>
      </header>
      
      {/* Navigation Bar - rendered below header */}
      {showNavigation && (
        <NavigationWrapper
          user={user}
          isAdmin={isAdmin()}
          showBackButton={showBackButton && isMobile}
          backButtonText={backButtonText}
          backButtonPath={backButtonPath}
          onBackClick={onBackClick}
        />
      )}
    </>
  );
};

export default PageHeader;