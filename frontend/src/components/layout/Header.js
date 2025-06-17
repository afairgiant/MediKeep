import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Header.css';

/**
 * Common page header component with navigation
 */
const Header = ({
  title,
  showBackButton = false,
  backPath = '/dashboard',
  actions = null,
  subtitle = null,
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(backPath);
  };

  return (
    <header className="page-header">
      <div className="header-left">
        {showBackButton && (
          <button className="back-button" onClick={handleBack} type="button">
            ← Back to Dashboard
          </button>
        )}
        <div className="header-title-section">
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </div>

      {actions && <div className="header-actions">{actions}</div>}
    </header>
  );
};

export default Header;
