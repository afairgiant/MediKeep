import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, Button } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
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
  const [isNavOpen, setIsNavOpen] = useState(false);

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

            {/* Global navigation actions */}
            {showGlobalActions && (
              <div className="global-actions">
                {/* Navigation Menu Toggle */}
                {showNavigation && (
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

      {/* Navigation Overlay for Mobile */}
      {isNavOpen && (
        <div className="nav-overlay" onClick={() => setIsNavOpen(false)} />
      )}

      {/* Navigation Menu */}
      {showNavigation && (
        <nav className={`navigation ${isNavOpen ? 'open' : ''}`}>
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

          {/* User Info */}
          {user && (
            <div className="nav-footer">
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
            </div>
          )}
        </nav>
      )}

      {/* Desktop Navigation Bar */}
      {showNavigation && (
        <div className="desktop-nav-bar">
          <div className="desktop-nav-content">
            {navigationSections
              .filter(section => section.title !== 'Administration') // Exclude admin section
              .map((section, sectionIndex) => (
                <Menu key={sectionIndex} position="bottom-start" offset={5}>
                  <Menu.Target>
                    <Button
                      variant="subtle"
                      className="nav-dropdown-trigger"
                      rightSection={<IconChevronDown size={14} />}
                    >
                      {section.title}
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
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
              ))}
          </div>
        </div>
      )}
    </>
  );
};

export default PageHeader;
