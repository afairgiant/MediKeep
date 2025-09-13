/**
 * MainNavigation - Main navigation bar with dropdown menus
 * Responsive navigation for the medical records system
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useResponsive } from '../../hooks/useResponsive';
import ThemeToggle from '../ui/ThemeToggle';
import './MainNavigation.css';

const MainNavigation = ({ 
  user, 
  isAdmin, 
  onLogout, 
  showBackButton = false,
  backButtonText = 'Back to Dashboard',
  backButtonPath = '/dashboard',
  onBackClick,
  showNavigation = true 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const responsive = useResponsive();
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Navigation structure based on original config
  const navigationSections = [
    {
      title: 'Medical Records',
      items: [
        { name: 'Patient Info', path: '/patient-info', icon: '👤' },
        { name: 'Medications', path: '/medications', icon: '💊' },
        { name: 'Lab Results', path: '/lab-results', icon: '🧪' },
        { name: 'Conditions', path: '/conditions', icon: '🩺' },
        { name: 'Allergies', path: '/allergies', icon: '⚠️' },
        { name: 'Vital Signs', path: '/vitals', icon: '❤️' },
      ],
    },
    {
      title: 'Care & Treatment',
      items: [
        { name: 'Treatments', path: '/treatments', icon: '🏥' },
        { name: 'Procedures', path: '/procedures', icon: '⚕️' },
        { name: 'Immunizations', path: '/immunizations', icon: '💉' },
        { name: 'Visit History', path: '/visits', icon: '📅' },
        { name: 'Family History', path: '/family-history', icon: '👨‍👩‍👧‍👦' },
      ],
    },
    {
      title: 'Misc.',
      items: [
        { name: 'Practitioners', path: '/practitioners', icon: '👨‍⚕️' },
        { name: 'Pharmacies', path: '/pharmacies', icon: '🏪' },
        { name: 'Insurance', path: '/insurance', icon: '💳' },
        { name: 'Emergency Contacts', path: '/emergency-contacts', icon: '🚨' },
      ],
    },
    {
      title: 'Tools',
      items: [
        { name: 'Custom Reports', path: '/reports/builder', icon: '📊' },
        { name: 'Export Records', path: '/export', icon: '📤' },
        { name: 'Settings', path: '/settings', icon: '⚙️' },
      ],
    },
  ];


  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown when route changes
  useEffect(() => {
    setActiveDropdown(null);
    setMobileMenuOpen(false);
  }, [location]);

  const handleDropdownToggle = (index) => {
    setActiveDropdown(activeDropdown === index ? null : index);
  };

  const handleMouseEnter = (index) => {
    setActiveDropdown(index);
  };

  const handleMouseLeave = () => {
    setActiveDropdown(null);
  };

  // Handle logout
  const handleLogout = useCallback(async () => {
    if (onLogout) {
      await onLogout();
    }
  }, [onLogout]);

  // Handle back navigation
  const handleBackClick = useCallback(() => {
    if (onBackClick) {
      onBackClick();
    } else {
      navigate(backButtonPath);
    }
  }, [onBackClick, navigate, backButtonPath]);

  const handleNavigation = (path) => {
    navigate(path);
    setActiveDropdown(null);
    setMobileMenuOpen(false);
  };

  const isCurrentPath = (path) => {
    return location.pathname === path;
  };

  const isSectionActive = (section) => {
    return section.items.some(item => location.pathname === item.path);
  };

  // Add account dropdown to sections
  const allSections = [...navigationSections];
  
  // Create Account dropdown with settings, theme toggle, admin (if admin), and logout
  const accountItems = [
    { name: 'Settings', path: '/settings', icon: '⚙️', action: 'navigate' },
  ];
  
  // Add admin items if user is admin
  if (isAdmin) {
    accountItems.push(
      { name: 'Admin Dashboard', path: '/admin', icon: '🔧', action: 'navigate' },
      { name: 'Data Models', path: '/admin/data-models', icon: '🗃️', action: 'navigate' },
      { name: 'Backup Management', path: '/admin/backup', icon: '💾', action: 'navigate' },
      { name: 'System Health', path: '/admin/system-health', icon: '🔍', action: 'navigate' }
    );
  }
  
  // Add logout
  accountItems.push({ name: 'Logout', icon: '🚪', action: 'logout' });
  
  allSections.push({
    title: 'Account',
    items: accountItems,
    isAccount: true
  });

  if (!showNavigation) return null;

  // Mobile navigation (hamburger menu)
  if (responsive.isMobile) {
    return (
      <>
        <button 
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          <span className="hamburger-icon">
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>

        {mobileMenuOpen && (
          <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
            <nav className="mobile-navigation" onClick={(e) => e.stopPropagation()}>
              <div className="mobile-menu-header">
                <h3>Navigation</h3>
                <button 
                  className="mobile-menu-close"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close menu"
                >
                  ✕
                </button>
              </div>
              
              <div className="mobile-menu-content">

                {allSections.map((section, index) => (
                  <div key={index} className="mobile-nav-section">
                    <h4 className="mobile-section-title">
                      {section.title}
                    </h4>
                    {section.items.map((item, itemIndex) => (
                      <button
                        key={itemIndex}
                        className={`mobile-nav-item ${isCurrentPath(item.path) ? 'active' : ''}`}
                        onClick={() => {
                          if (item.action === 'logout') {
                            handleLogout();
                          } else {
                            handleNavigation(item.path);
                          }
                        }}
                      >
                        {item.icon} {item.name}
                      </button>
                    ))}
                    {section.isAccount && (
                      <div className="theme-toggle-mobile">
                        <ThemeToggle />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </nav>
          </div>
        )}
      </>
    );
  }

  // Desktop navigation with dropdowns
  return (
    <nav className="main-navigation-bar" ref={dropdownRef}>
      <div className="nav-container">
        <div className="nav-items">
          {/* Dropdown sections */}
          {allSections.map((section, index) => (
            <div 
              key={index} 
              className="nav-dropdown"
              onMouseEnter={() => handleMouseEnter(index)}
              onMouseLeave={handleMouseLeave}
            >
              <button
                className={`nav-item dropdown-trigger ${isSectionActive(section) ? 'active' : ''} ${activeDropdown === index ? 'open' : ''} ${section.isAccount ? 'account-button' : ''}`}
                onClick={() => handleDropdownToggle(index)}
              >
                {section.title}
                <span className="dropdown-arrow">▼</span>
              </button>
              
              {activeDropdown === index && (
                <div className="dropdown-menu">
                  {section.items.map((item, itemIndex) => (
                    <button
                      key={itemIndex}
                      className={`dropdown-item ${isCurrentPath(item.path) ? 'active' : ''}`}
                      onClick={() => {
                        if (item.action === 'logout') {
                          handleLogout();
                        } else {
                          handleNavigation(item.path);
                        }
                      }}
                    >
                      <span className="item-icon">{item.icon}</span>
                      <span className="item-text">{item.name}</span>
                    </button>
                  ))}
                  {section.isAccount && (
                    <div className="theme-toggle-dropdown">
                      <span className="theme-label">Theme</span>
                      <ThemeToggle />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default MainNavigation;