import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, Button } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import { useViewportSize } from '@mantine/hooks';
import { useAuth } from '../../contexts/AuthContext';
import ThemeToggle from '../ui/ThemeToggle';
import { ENTITY_TYPES } from '../../utils/entityRelationships';
import { buildEntityUrl } from '../../utils/entityNavigation';
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
  showNavigation = true, // Show navigation menu
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { width: viewportWidth } = useViewportSize();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const navRef = useRef(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  
  // Responsive breakpoints
  const isMobile = viewportWidth < 768;
  const isTablet = viewportWidth >= 768 && viewportWidth < 1024;
  const isLaptop = viewportWidth >= 1024 && viewportWidth < 1440;
  const isDesktop = viewportWidth >= 1440;

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

  // Navigation items organized by category using entity types
  const navigationSections = [
    {
      title: 'Core',
      items: [
        { name: 'Dashboard', path: '/dashboard', icon: '🏥' },
        {
          name: 'Patient Info',
          path: buildEntityUrl(ENTITY_TYPES.PATIENT, 'me'),
          icon: '👤',
        },
      ],
    },
    {
      title: 'Medical Records',
      items: [
        {
          name: 'Medications',
          path: buildEntityUrl(ENTITY_TYPES.MEDICATION),
          icon: '💊',
        },
        {
          name: 'Lab Results',
          path: buildEntityUrl(ENTITY_TYPES.LAB_RESULT),
          icon: '🧪',
        },
        {
          name: 'Conditions',
          path: buildEntityUrl(ENTITY_TYPES.CONDITION),
          icon: '🏥',
        },
        {
          name: 'Allergies',
          path: buildEntityUrl(ENTITY_TYPES.ALLERGY),
          icon: '⚠️',
        },
        {
          name: 'Vital Signs',
          path: buildEntityUrl(ENTITY_TYPES.VITALS),
          icon: '❤️',
        },
      ],
    },
    {
      title: 'Care & Treatment',
      items: [
        {
          name: 'Treatments',
          path: buildEntityUrl(ENTITY_TYPES.TREATMENT),
          icon: '🩺',
        },
        {
          name: 'Procedures',
          path: buildEntityUrl(ENTITY_TYPES.PROCEDURE),
          icon: '⚕️',
        },
        {
          name: 'Immunizations',
          path: buildEntityUrl(ENTITY_TYPES.IMMUNIZATION),
          icon: '💉',
        },
        {
          name: 'Visit History',
          path: buildEntityUrl(ENTITY_TYPES.ENCOUNTER),
          icon: '📅',
        },
        {
          name: 'Family History',
          path: buildEntityUrl(ENTITY_TYPES.FAMILY_MEMBER),
          icon: '👪',
        },
      ],
    },
    {
      title: 'Providers',
      items: [
        {
          name: 'Practitioners',
          path: buildEntityUrl(ENTITY_TYPES.PRACTITIONER),
          icon: '👨‍⚕️',
        },
        {
          name: 'Pharmacies',
          path: buildEntityUrl(ENTITY_TYPES.PHARMACY),
          icon: '🏪',
        },
      ],
    },
    {
      title: 'Tools',
      items: [
        { name: 'Export Records', path: '/export', icon: '📤' },
        { name: 'Settings', path: '/settings', icon: '⚙️' },
      ],
    },
  ];

  // Add admin section if user is admin
  if (isAdmin()) {
    navigationSections.push({
      title: 'Administration',
      items: [
        { name: 'Admin Dashboard', path: '/admin', icon: '🔧' },
        { name: 'Data Models', path: '/admin/data-models', icon: '🗄️' },
        { name: 'Backup Management', path: '/admin/backup', icon: '💾' },
        { name: 'System Health', path: '/admin/system-health', icon: '🔍' },
      ],
    });
  }

  const isCurrentPath = path => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/';
    }
    return location.pathname === path;
  };

  const handleBackClick = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      navigate(backButtonPath);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    // Clear welcome box dismissal so it reappears on next login
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('welcomeBox_dismissed_')) {
        localStorage.removeItem(key);
      }
    });
    window.location.href = '/login';
  };

  const handleNavigation = path => {
    navigate(path);
    setIsNavOpen(false); // Close mobile menu after navigation
  };

  // Intelligent dropdown positioning based on viewport
  const getDropdownPosition = useCallback((triggerElement) => {
    if (!triggerElement) return 'bottom-start';
    
    const rect = triggerElement.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceRight = window.innerWidth - rect.left;
    
    // If not enough space below, position above
    const verticalPosition = spaceBelow < 200 ? 'top' : 'bottom';
    
    // If not enough space on the right, align to end
    const horizontalPosition = spaceRight < 300 ? 'end' : 'start';
    
    return `${verticalPosition}-${horizontalPosition}`;
  }, []);
  
  // Touch gesture handlers for swipe to close
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    if (!touchStartX.current || !touchStartY.current) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchStartX.current - touchEndX;
    const deltaY = touchStartY.current - touchEndY;
    
    // Only trigger swipe if horizontal movement is greater than vertical
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Swipe left to close (since nav opens from right)
      if (deltaX > 50 && isNavOpen) {
        setIsNavOpen(false);
      }
    }
    
    touchStartX.current = 0;
    touchStartY.current = 0;
  };

  // Close navigation on escape key
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && isNavOpen) {
        setIsNavOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [isNavOpen]);

  const baseClasses =
    variant === 'dashboard'
      ? 'page-header dashboard-header'
      : 'page-header medical-page-header';

  return (
    <>
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

            {/* Global navigation actions - only show on larger screens */}
            {showGlobalActions && !isMobile && (
              <div className="global-actions">
                {/* Navigation Menu Toggle - only for mobile */}
                {showNavigation && isMobile && (
                  <button
                    className={`nav-toggle-btn ${isNavOpen ? 'active' : ''}`}
                    onClick={() => setIsNavOpen(!isNavOpen)}
                    type="button"
                    title="Navigation Menu"
                  >
                    <span></span>
                    <span></span>
                    <span></span>
                  </button>
                )}

                {!isTablet && (
                  <button
                    className="settings-button"
                    onClick={() => navigate('/settings')}
                    type="button"
                    title="Settings"
                  >
                    ⚙️
                  </button>
                )}
                {!isTablet && <ThemeToggle />}
                {!isTablet && (
                  <button
                    onClick={handleLogout}
                    className="logout-btn"
                    title="Logout"
                  >
                    Logout
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Navigation Overlay for Mobile */}
      {isNavOpen && isMobile && (
        <div className="nav-overlay" onClick={() => setIsNavOpen(false)} />
      )}

      {/* Mobile Navigation Menu - only show on mobile */}
      {showNavigation && isMobile && (
        <nav 
          ref={navRef}
          className={`navigation mobile-sidebar ${isNavOpen ? 'open' : ''}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="nav-header">
            <h3>Medical Records Navigation</h3>
            <button
              className="nav-close"
              onClick={() => setIsNavOpen(false)}
              aria-label="Close navigation menu"
            >
              ✕
            </button>
          </div>

          <div className="nav-content">
            {/* Back button for mobile when showBackButton is true */}
            {showBackButton && (
              <div className="nav-section mobile-back-section">
                <button
                  className="nav-link nav-back-link"
                  onClick={() => {
                    handleBackClick();
                    setIsNavOpen(false);
                  }}
                >
                  <span className="nav-icon">←</span>
                  <span className="nav-text">{backButtonText.replace('← ', '')}</span>
                </button>
              </div>
            )}

            {navigationSections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="nav-section">
                <h4 className="nav-section-title">{section.title}</h4>
                <ul className="nav-list">
                  {section.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="nav-item">
                      <button
                        className={`nav-link ${isCurrentPath(item.path) ? 'active' : ''}`}
                        onClick={() => handleNavigation(item.path)}
                      >
                        <span className="nav-icon">{item.icon}</span>
                        <span className="nav-text">{item.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* User Info and Actions */}
          <div className="nav-footer">
            {/* Mobile-only actions section */}
            <div className="nav-mobile-actions">
              <button
                className="nav-action-btn"
                onClick={() => {
                  navigate('/settings');
                  setIsNavOpen(false);
                }}
                type="button"
                title="Settings"
              >
                <span className="nav-icon">⚙️</span>
                <span className="nav-text">Settings</span>
              </button>
              <div className="nav-action-btn theme-toggle-wrapper">
                <span className="nav-icon">🎨</span>
                <span className="nav-text">Theme</span>
                <ThemeToggle />
              </div>
              <button
                onClick={() => {
                  handleLogout();
                  setIsNavOpen(false);
                }}
                className="nav-action-btn logout-action"
                title="Logout"
              >
                <span className="nav-icon">🚪</span>
                <span className="nav-text">Logout</span>
              </button>
            </div>

            {/* User Info */}
            {user && (
              <div className="nav-user-info">
                <div className="nav-user-avatar">
                  {user.first_name?.[0]}
                  {user.last_name?.[0]}
                </div>
                <div className="nav-user-details">
                  <span className="nav-user-name">
                    {user.first_name} {user.last_name}
                  </span>
                  <span className="nav-user-role">
                    {isAdmin() ? 'Administrator' : 'Patient'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </nav>
      )}

      {/* Desktop/Tablet Navigation Bar - show on non-mobile screens */}
      {showNavigation && !isMobile && (
        <div className="desktop-nav-bar">
          <div className="desktop-nav-content">
            {navigationSections
              .filter(section => {
                // Filter out admin section from dropdowns, show in Account if user is admin
                return section.title !== 'Administration';
              })
              .map((section, sectionIndex) => {
                // Show fewer dropdowns on smaller screens
                if (isTablet && section.title === 'Providers') return null;
                
                return (
                  <Menu 
                    key={sectionIndex} 
                    position="bottom-start" 
                    offset={8}
                    withinPortal={true}
                    transitionProps={{ transition: 'pop-top-left', duration: 150 }}
                    middlewares={{
                      shift: true,
                      flip: true,
                      inline: false,
                    }}
                    clickOutsideEvents={['mousedown', 'touchstart']}
                  >
                    <Menu.Target>
                      <Button
                        variant="subtle"
                        className="nav-dropdown-trigger"
                        rightSection={<IconChevronDown size={12} />}
                        size={isTablet ? 'xs' : 'sm'}
                      >
                        {section.title}
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown className="nav-dropdown">
                      <Menu.Label>{section.title}</Menu.Label>
                      {section.items.map((item, itemIndex) => (
                        <Menu.Item
                          key={itemIndex}
                          leftSection={
                            <span style={{ fontSize: '14px' }}>{item.icon}</span>
                          }
                          onClick={() => handleNavigation(item.path)}
                          className={
                            isCurrentPath(item.path) ? 'nav-item-active' : ''
                          }
                        >
                          {item.name}
                        </Menu.Item>
                      ))}
                    </Menu.Dropdown>
                  </Menu>
                );
              })
              .filter(Boolean)}
            
            {/* User Actions Dropdown */}
            <Menu 
              position={isLaptop || viewportWidth <= 1280 ? "bottom-end" : "bottom-end"} 
              offset={8}
              withinPortal={true}
              transitionProps={{ transition: 'pop-top-right', duration: 150 }}
              middlewares={{
                shift: true,
                flip: true,
                inline: false,
                size: {
                  apply({ availableWidth, availableHeight, elements }) {
                    Object.assign(elements.floating.style, {
                      maxWidth: `${Math.min(300, availableWidth - 20)}px`,
                      maxHeight: `${Math.min(600, availableHeight - 20)}px`,
                    });
                  },
                },
              }}
              clickOutsideEvents={['mousedown', 'touchstart']}
            >
              <Menu.Target>
                <Button
                  variant="subtle"
                  className="nav-dropdown-trigger account-dropdown"
                  rightSection={<IconChevronDown size={12} />}
                  size={isTablet ? 'xs' : 'sm'}
                >
                  Account
                </Button>
              </Menu.Target>
              <Menu.Dropdown className="nav-dropdown account-dropdown-menu">
                <Menu.Label>User Actions</Menu.Label>
                <Menu.Item
                  leftSection={<span style={{ fontSize: '14px' }}>⚙️</span>}
                  onClick={() => navigate('/settings')}
                >
                  Settings
                </Menu.Item>
                <Menu.Item
                  leftSection={<span style={{ fontSize: '14px' }}>🎨</span>}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span>Theme</span>
                    <ThemeToggle />
                  </div>
                </Menu.Item>
                
                {/* Show admin items in Account dropdown if user is admin */}
                {isAdmin() && (
                  <>
                    <Menu.Divider />
                    <Menu.Label>Administration</Menu.Label>
                    <Menu.Item
                      leftSection={<span style={{ fontSize: '14px' }}>🔧</span>}
                      onClick={() => navigate('/admin')}
                    >
                      Admin Dashboard
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<span style={{ fontSize: '14px' }}>🗄️</span>}
                      onClick={() => navigate('/admin/data-models')}
                    >
                      Data Models
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<span style={{ fontSize: '14px' }}>💾</span>}
                      onClick={() => navigate('/admin/backup')}
                    >
                      Backup Management
                    </Menu.Item>
                    <Menu.Item
                      leftSection={<span style={{ fontSize: '14px' }}>🔍</span>}
                      onClick={() => navigate('/admin/system-health')}
                    >
                      System Health
                    </Menu.Item>
                  </>
                )}
                
                <Menu.Divider />
                <Menu.Item
                  leftSection={<span style={{ fontSize: '14px' }}>🚪</span>}
                  onClick={handleLogout}
                  color="red"
                >
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </div>
        </div>
      )}
    </>
  );
};

export default PageHeader;
