/**
 * ResponsiveNavigation - Main navigation wrapper component
 * Renders appropriate navigation based on current breakpoint
 * 
 * Following PR #3: Navigation & Layout System specifications
 */

import React, { useState, useCallback } from 'react';
import { useResponsive } from '../../hooks/useResponsive';
// import DesktopSidebar from './DesktopSidebar';
import DesktopSidebarSimple from './DesktopSidebarSimple'; // Temporarily using simple version for Firefox debugging
import TabletSidebar from './TabletSidebar';
import MobileDrawer from './MobileDrawer';

const ResponsiveNavigation = ({
  currentPath,
  menuItems = [],
  userInfo = null,
  user = null, // Support both userInfo and user props
  navigationItems = [], // Support navigationItems prop from test page
  onLogout,
  isOpen: controlledIsOpen = undefined, // Support controlled state
  onToggle: controlledOnToggle = undefined, // Support controlled toggle
  className = ''
}) => {
  const responsive = useResponsive();
  
  // Use internal state only if not controlled
  const [internalOpen, setInternalOpen] = useState(() => {
    // Default state based on breakpoint
    return responsive.isAbove('md') || responsive.matches('lg'); // Open by default on desktop
  });
  
  // Use controlled state if provided, otherwise use internal state
  const navigationOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;

  // Handle navigation toggle
  const handleToggle = useCallback(() => {
    if (controlledOnToggle) {
      controlledOnToggle();
    } else {
      setInternalOpen(prev => !prev);
    }
  }, [controlledOnToggle]);

  // Handle navigation close (for mobile/tablet)
  const handleClose = useCallback(() => {
    if (controlledOnToggle) {
      controlledOnToggle();
    } else {
      setInternalOpen(false);
    }
  }, [controlledOnToggle]);

  // Handle navigation link click
  const handleLinkClick = useCallback((path) => {
    // Close navigation on mobile/tablet after link click
    if (responsive.isBelow('lg')) {
      if (controlledOnToggle) {
        // If controlled, let parent handle the state
        controlledOnToggle();
      } else {
        setInternalOpen(false);
      }
    }
  }, [responsive.isBelow, controlledOnToggle]);

  // Default admin menu items if none provided
  const defaultMenuItems = [
    {
      section: 'Dashboard',
      items: [
        {
          path: '/admin',
          label: 'Overview',
          icon: '📊',
          exact: true
        }
      ]
    },
    {
      section: 'Data Management',
      items: [
        {
          path: '/admin/data-models',
          label: 'Data Models',
          icon: '🗄️'
        },
        {
          path: '/admin/models/user',
          label: 'Manage Users',
          icon: '👥'
        }
      ]
    },
    {
      section: 'Tools',
      items: [
        {
          path: '/admin/backup',
          label: 'Backup Management',
          icon: '💾'
        },
        {
          path: '/admin/system-health',
          label: 'System Health',
          icon: '🔍'
        },
        {
          path: '/admin/settings',
          label: 'Settings',
          icon: '⚙️'
        }
      ]
    }
  ];

  // Menu items to use - check multiple prop names for compatibility
  const activeMenuItems = menuItems.length > 0 ? menuItems : 
                          navigationItems.length > 0 ? navigationItems : 
                          defaultMenuItems;
  
  // User info to use - support both prop names
  const activeUserInfo = userInfo || user;

  // Common navigation props
  const navigationProps = {
    isOpen: navigationOpen,
    onToggle: handleToggle,
    onClose: handleClose,
    onLinkClick: handleLinkClick,
    currentPath,
    menuItems: activeMenuItems,
    userInfo: activeUserInfo,
    user: activeUserInfo, // Provide both for compatibility
    navigationItems: activeMenuItems, // Provide both for compatibility
    onLogout,
    className
  };

  // Render appropriate navigation based on breakpoint
  if (responsive.matches('xs') || responsive.matches('sm')) {
    // Mobile: Drawer navigation
    return <MobileDrawer {...navigationProps} />;
  } else if (responsive.matches('md')) {
    // Tablet: Collapsible sidebar
    return <TabletSidebar {...navigationProps} />;
  } else {
    // Desktop: Full sidebar (lg, xl, xxl)
    return <DesktopSidebarSimple {...navigationProps} />;
  }
};

export default ResponsiveNavigation;