import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ThemeToggle from '../ui/ThemeToggle';
import LanguageSwitcher from '../shared/LanguageSwitcher';
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
  showThemeToggle = true,
  showLanguageSwitcher = true,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation('navigation');

  const handleBack = () => {
    navigate(backPath);
  };

  return (
    <header className="page-header">
      <div className="header-left">
        {showBackButton && (
          <button className="back-button" onClick={handleBack} type="button">
            ← {t('menu.backToDashboard')}
          </button>
        )}
        <div className="header-title-section">
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </div>

      <div className="header-actions">
        {actions}
        {showLanguageSwitcher && <LanguageSwitcher compact />}
        <button
          className="settings-button"
          onClick={() => navigate('/settings')}
          type="button"
          title={t('menu.settings')}
        >
          ⚙️
        </button>
        {showThemeToggle && <ThemeToggle />}
      </div>
    </header>
  );
};

export default Header;
