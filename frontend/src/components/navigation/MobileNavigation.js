import React, { useRef, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getNavigationSections } from '../../config/navigation.config';
import ThemeToggle from '../ui/ThemeToggle';
import './MobileNavigation.css';

const MobileNavigation = ({
  isOpen,
  onClose,
  user,
  isAdmin,
  onLogout,
  showBackButton,
  backButtonText,
  onBackClick,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef(null);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  
  // Get navigation sections for mobile
  const navigationSections = getNavigationSections('mobile', isAdmin);
  
  // Handle touch gestures for swipe to close
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
    
    // Swipe left to close (nav opens from right)
    if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 50 && isOpen) {
      onClose();
    }
    
    touchStartX.current = 0;
    touchStartY.current = 0;
  };
  
  // Close on escape key
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      // Prevent body scroll when nav is open
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);
  
  const handleNavigation = (path) => {
    navigate(path);
    onClose();
  };
  
  const isCurrentPath = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/';
    }
    return location.pathname === path;
  };
  
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="mobile-nav-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      
      {/* Navigation Panel */}
      <nav
        ref={navRef}
        className={`mobile-navigation ${isOpen ? 'open' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        aria-label="Mobile navigation menu"
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="mobile-nav-header">
          <h3>Medical Records</h3>
          <button
            className="mobile-nav-close"
            onClick={onClose}
            aria-label="Close navigation menu"
            type="button"
          >
            ✕
          </button>
        </div>
        
        {/* Content */}
        <div className="mobile-nav-content">
          {/* Back button if needed */}
          {showBackButton && (
            <div className="mobile-nav-section mobile-back-section">
              <button
                className="mobile-nav-link nav-back-link"
                onClick={() => {
                  onBackClick();
                  onClose();
                }}
                type="button"
              >
                <span className="nav-icon">←</span>
                <span className="nav-text">{backButtonText?.replace('← ', '')}</span>
              </button>
            </div>
          )}
          
          {/* Navigation Sections */}
          {Object.entries(navigationSections).map(([key, section]) => (
            <div key={key} className="mobile-nav-section">
              <h4 className="mobile-nav-section-title">{section.title}</h4>
              <ul className="mobile-nav-list">
                {section.items.map((item) => (
                  <li key={item.id} className="mobile-nav-item">
                    <button
                      className={`mobile-nav-link ${
                        isCurrentPath(item.path) ? 'active' : ''
                      }`}
                      onClick={() => handleNavigation(item.path)}
                      type="button"
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
        
        {/* Footer with actions and user info */}
        <div className="mobile-nav-footer">
          {/* Action buttons */}
          <div className="mobile-nav-actions">
            <button
              className="mobile-nav-action-btn"
              onClick={() => handleNavigation('/settings')}
              type="button"
            >
              <span className="nav-icon">⚙️</span>
              <span className="nav-text">Settings</span>
            </button>
            
            <div className="mobile-nav-action-btn theme-toggle-wrapper">
              <span className="nav-icon">🎨</span>
              <span className="nav-text">Theme</span>
              <ThemeToggle />
            </div>
            
            <button
              className="mobile-nav-action-btn logout-action"
              onClick={() => {
                onLogout();
                onClose();
              }}
              type="button"
            >
              <span className="nav-icon">🚪</span>
              <span className="nav-text">Logout</span>
            </button>
          </div>
          
          {/* User Info */}
          {user && (
            <div className="mobile-nav-user-info">
              <div className="mobile-nav-user-avatar">
                {user.first_name?.[0]}
                {user.last_name?.[0]}
              </div>
              <div className="mobile-nav-user-details">
                <span className="mobile-nav-user-name">
                  {user.first_name} {user.last_name}
                </span>
                <span className="mobile-nav-user-role">
                  {isAdmin ? 'Administrator' : 'Patient'}
                </span>
              </div>
            </div>
          )}
        </div>
      </nav>
    </>
  );
};

export default MobileNavigation;