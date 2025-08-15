import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
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
  
  // Handle logout - use the proper auth system
  const { logout } = useAuth();
  const handleLogout = useCallback(async () => {
    console.log('🚪 NAVIGATION_LOGOUT: NavigationWrapper logout clicked', {
      timestamp: new Date().toISOString()
    });
    try {
      await logout();
      console.log('🚪 NAVIGATION_LOGOUT: AuthContext logout completed, redirecting...', {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('🚪 NAVIGATION_LOGOUT: Error during logout:', error);
      // Fallback: direct redirect if auth logout fails
      window.location.href = '/login';
    }
  }, [logout]);
  
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