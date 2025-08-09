import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useViewport } from '../../hooks/useViewport';
import MobileNavigation from './MobileNavigation';
import TabletNavigation from './TabletNavigation';
import DesktopNavigation from './DesktopNavigation';
import './NavigationWrapper.css';

/**
 * Main navigation wrapper that renders the appropriate navigation component
 * based on the current viewport size
 */
const NavigationWrapper = ({
  user,
  isAdmin,
  showBackButton = false,
  backButtonText = 'Back to Dashboard',
  backButtonPath = '/dashboard',
  onBackClick,
  className = '',
}) => {
  const navigate = useNavigate();
  const { viewport, isMobile, isTablet } = useViewport();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  
  // Handle logout
  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    // Clear any user-specific localStorage items
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('welcomeBox_dismissed_') || key.startsWith('user_')) {
        localStorage.removeItem(key);
      }
    });
    window.location.href = '/login';
  }, []);
  
  // Handle back navigation
  const handleBackClick = useCallback(() => {
    if (onBackClick) {
      onBackClick();
    } else {
      navigate(backButtonPath);
    }
  }, [onBackClick, navigate, backButtonPath]);
  
  // Toggle mobile navigation
  const toggleMobileNav = useCallback(() => {
    setIsMobileNavOpen(prev => !prev);
  }, []);
  
  // Close mobile navigation
  const closeMobileNav = useCallback(() => {
    setIsMobileNavOpen(false);
  }, []);
  
  return (
    <div className={`navigation-wrapper ${className}`}>
      {/* Mobile Navigation Toggle Button */}
      {isMobile && (
        <button
          className={`mobile-nav-toggle ${isMobileNavOpen ? 'active' : ''}`}
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
      
      {/* Render appropriate navigation based on viewport */}
      {isMobile ? (
        <MobileNavigation
          isOpen={isMobileNavOpen}
          onClose={closeMobileNav}
          user={user}
          isAdmin={isAdmin}
          onLogout={handleLogout}
          showBackButton={showBackButton}
          backButtonText={backButtonText}
          onBackClick={handleBackClick}
        />
      ) : isTablet ? (
        <TabletNavigation
          user={user}
          isAdmin={isAdmin}
          onLogout={handleLogout}
        />
      ) : (
        <DesktopNavigation
          user={user}
          isAdmin={isAdmin}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
};

export default NavigationWrapper;