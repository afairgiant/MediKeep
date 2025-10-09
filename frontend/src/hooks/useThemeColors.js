import { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Custom hook to extract and memoize CSS custom properties (theme colors)
 * Prevents repeated getComputedStyle calls and improves performance
 *
 * @returns {Object} Theme colors extracted from CSS variables
 */
const useThemeColors = () => {
  const { theme } = useTheme();

  const colors = useMemo(() => {
    const rootStyles = getComputedStyle(document.documentElement);

    return {
      primary: rootStyles.getPropertyValue('--color-primary').trim() || '#3b82f6',
      primaryDark: rootStyles.getPropertyValue('--color-primary-dark').trim() || '#2563eb',
      success: rootStyles.getPropertyValue('--color-success').trim() || '#10b981',
      warning: rootStyles.getPropertyValue('--color-warning').trim() || '#f59e0b',
      danger: rootStyles.getPropertyValue('--color-danger').trim() || '#ef4444',
      info: rootStyles.getPropertyValue('--color-info').trim() || '#06b6d4',
      purple: rootStyles.getPropertyValue('--color-purple').trim() || '#8b5cf6',
      textPrimary: rootStyles.getPropertyValue('--color-text-primary').trim() || '#212529',
      textSecondary: rootStyles.getPropertyValue('--color-text-secondary').trim() || '#6b7280',
      borderLight: rootStyles.getPropertyValue('--color-border-light').trim() || '#e9ecef',
      bgPrimary: rootStyles.getPropertyValue('--color-bg-primary').trim() || '#ffffff',
      bgSecondary: rootStyles.getPropertyValue('--color-bg-secondary').trim() || '#f8f9fa',
    };
  }, [theme]);

  return colors;
};

export default useThemeColors;
