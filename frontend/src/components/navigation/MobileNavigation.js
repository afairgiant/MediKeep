import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getNavigationSections } from '../../config/navigation.config';
import { useViewport } from '../../hooks/useViewport';
import ThemeToggle from '../ui/ThemeToggle';

const MobileNavigation = ({ 
  isOpen, 
  onClose, 
  user, 
  isAdmin, 
  onLogout, 
  showBackButton, 
  backButtonText, 
  onBackClick 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { viewport } = useViewport();
  
  const navigationSections = getNavigationSections(viewport, isAdmin);
  
  const isCurrentPath = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/';
    }
    return location.pathname === path;
  };
  
  const handleNavigation = (path) => {
    navigate(path);
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="mobile-navigation-overlay" onClick={onClose}>
      <nav className="mobile-navigation" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-nav-header">
          <h3>Navigation</h3>
          <button className="mobile-nav-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="mobile-nav-content">
          {showBackButton && (
            <button className="mobile-nav-item back-button" onClick={onBackClick}>
              {backButtonText}
            </button>
          )}
          
          {Object.entries(navigationSections).map(([key, section]) => (
            <div key={key} className="mobile-nav-section">
              <h4 className="mobile-section-title">{section.title}</h4>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  className={`mobile-nav-item ${isCurrentPath(item.path) ? 'active' : ''}`}
                  onClick={() => handleNavigation(item.path)}
                >
                  {item.icon} {item.name}
                </button>
              ))}
            </div>
          ))}
          
          <div className="mobile-nav-section">
            <h4 className="mobile-section-title">Account</h4>
            <button className="mobile-nav-item" onClick={() => handleNavigation('/settings')}>
              ⚙️ Settings
            </button>
            <div className="mobile-theme-toggle">
              <span>Theme</span>
              <ThemeToggle />
            </div>
            <button className="mobile-nav-item logout" onClick={onLogout}>
              🚪 Logout
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default MobileNavigation;