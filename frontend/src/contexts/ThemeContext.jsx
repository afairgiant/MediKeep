import React, { createContext, useContext, useState, useEffect } from 'react';
import { useMantineColorScheme } from '@mantine/core';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Inner component that has access to Mantine's color scheme
const ThemeProviderInner = ({ children }) => {
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  const [theme, setTheme] = useState(() => {
    // Check what's already on the document first
    const documentTheme = document.documentElement.getAttribute('data-theme');
    if (documentTheme) {
      return documentTheme;
    }

    // Check localStorage next
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme;
    }

    // Check system preference last
    if (
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }

    return 'light';
  });

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);

    // Also update Mantine's color scheme
    setColorScheme(newTheme);
  };

  useEffect(() => {
    // Apply theme to document for CSS custom properties
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    // Sync with Mantine's color scheme
    if (colorScheme !== theme) {
      setColorScheme(theme);
    }
  }, [theme, colorScheme, setColorScheme]);

  const value = {
    theme,
    toggleTheme,
    isDark: theme === 'dark',
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

// Wrapper component for when used outside MantineProvider
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Check what's already on the document first
    const documentTheme = document.documentElement.getAttribute('data-theme');
    if (documentTheme) {
      return documentTheme;
    }

    // Check localStorage next
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme;
    }

    // Check system preference last
    if (
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }

    return 'light';
  });

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  useEffect(() => {
    // Apply theme to document
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

// Export the inner provider for use inside MantineProvider
export const MantineIntegratedThemeProvider = ThemeProviderInner;
