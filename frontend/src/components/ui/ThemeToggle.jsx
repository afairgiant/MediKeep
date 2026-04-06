import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import './ThemeToggle.css';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      className="theme-toggle-btn"
      onClick={toggleTheme}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <span className="theme-icon">🌙</span>
      ) : (
        // eslint-disable-next-line i18next/no-literal-string -- decorative emoji
        <span className="theme-icon">{'\u2600\uFE0F'}</span>
      )}
    </button>
  );
};

export default ThemeToggle;
