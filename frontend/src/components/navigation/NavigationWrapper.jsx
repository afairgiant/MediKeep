import logger from '../../services/logger';

import { useCallback } from 'react';
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
  mobileNavOpen,
  onMobileNavClose,
}) => {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useViewport();

  const isMobileNavOpen = mobileNavOpen || false;
  const closeMobileNav = useCallback(() => {
    if (onMobileNavClose) {
      onMobileNavClose();
    }
  }, [onMobileNavClose]);

  // Handle logout - use the proper auth system
  const { logout } = useAuth();
  const handleLogout = useCallback(async () => {
    logger.info('🚪 NAVIGATION_LOGOUT: NavigationWrapper logout clicked', {
      timestamp: new Date().toISOString(),
    });
    try {
      await logout();
      logger.info(
        '🚪 NAVIGATION_LOGOUT: AuthContext logout completed, redirecting...',
        {
          timestamp: new Date().toISOString(),
        }
      );
    } catch (error) {
      logger.error('🚪 NAVIGATION_LOGOUT: Error during logout:', error);
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

  return (
    <div className={`navigation-wrapper ${className}`}>
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
