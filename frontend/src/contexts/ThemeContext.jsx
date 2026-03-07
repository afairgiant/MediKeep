import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

function getInitialTheme() {
  const documentTheme = document.documentElement.getAttribute('data-theme');
  if (documentTheme) return documentTheme;

  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) return savedTheme;

  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
}

// Single provider that works both with and without MantineProvider.
// Theme state lives here, ABOVE MantineProvider, so forceColorScheme
// can be passed as a prop - no async setColorScheme calls needed.
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', newTheme);
      return newTheme;
    });
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [theme]);

  const value = {
    theme,
    toggleTheme,
    isDark: theme === 'dark',
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

// Kept for test compatibility - now a passthrough since Mantine sync
// is handled via forceColorScheme prop in App.jsx
export const MantineIntegratedThemeProvider = ({ children }) => children;
