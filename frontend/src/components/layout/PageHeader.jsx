import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { isUserAdmin } from '../../utils/authUtils';
import { NavigationWrapper } from '../navigation';
import { useViewport } from '../../hooks/useViewport';
import LanguageSwitcher from '../shared/LanguageSwitcher';
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
  variant = 'dashboard', // 'medical' or 'dashboard'
  showNavigation = true,
  showTitle = true,
}) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isMobile } = useViewport();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const toggleMobileNav = useCallback(() => {
    setIsMobileNavOpen(prev => !prev);
  }, []);

  // Admin status is derived from AuthContext user (populated from /users/me),
  // not decoded client-side from the JWT — the cookie-auth flow stores the
  // token in an HttpOnly cookie that JS cannot read.
  const isAdmin = isUserAdmin(user);

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
          {showBackButton && (
            <button 
              className="back-button" 
              onClick={handleBackClick}
              type="button"
            >
              {backButtonText}
            </button>
          )}
        </div>
        
        {showTitle && (
          <div className="header-center">
            <h1 className="page-title">
              {icon && <span className="title-icon">{icon}</span>}
              {title}
            </h1>
          </div>
        )}
        
        <div className="header-right">
          <div className="header-actions">
            {/* Page-specific actions */}
            {actions}
            
            {/* Mobile hamburger toggle (replaces theme toggle - theme is in sidebar) */}
            {isMobile && (
              <button
                className={`header-mobile-nav-toggle ${isMobileNavOpen ? 'active' : ''}`}
                onClick={toggleMobileNav}
                aria-label="Toggle navigation menu"
                aria-expanded={isMobileNavOpen}
                type="button"
              >
                <span className="hamburger-line"></span>
                <span className="hamburger-line"></span>
                <span className="hamburger-line"></span>
              </button>
            )}
          </div>
        </div>
      </header>
      
      {/* Navigation Bar - rendered below header */}
      {showNavigation && (
        <NavigationWrapper
          user={user}
          isAdmin={isAdmin}
          showBackButton={showBackButton && isMobile}
          backButtonText={backButtonText}
          backButtonPath={backButtonPath}
          onBackClick={onBackClick}
          mobileNavOpen={isMobileNavOpen}
          onMobileNavClose={() => setIsMobileNavOpen(false)}
        />
      )}
    </>
  );
};

export default PageHeader;