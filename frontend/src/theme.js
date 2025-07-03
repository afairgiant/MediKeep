import { createTheme } from '@mantine/core';

export const theme = createTheme({
  /** Color scheme detection and settings */
  forceColorScheme: undefined, // Let Mantine handle auto-detection

  /** Primary color scheme */
  colors: {
    // Primary blue theme (based on your current --primary-color: #667eea)
    primary: [
      '#f0f4ff',
      '#d1e7ff',
      '#a3d0ff',
      '#74b3ff',
      '#4285ff',
      '#667eea', // Your main primary color
      '#5a67d8',
      '#4c63d2',
      '#4055c7',
      '#3347bb',
    ],
    // Success green
    success: [
      '#f0fff4',
      '#c6f6d5',
      '#9ae6b4',
      '#68d391',
      '#48bb78',
      '#38a169',
      '#2f855a',
      '#276749',
      '#22543d',
      '#1a202c',
    ],
    // Warning orange/yellow
    warning: [
      '#fffbeb',
      '#fef3c7',
      '#fde68a',
      '#fcd34d',
      '#fbbf24',
      '#f59e0b',
      '#d97706',
      '#b45309',
      '#92400e',
      '#78350f',
    ],
    // Error red
    error: [
      '#fef2f2',
      '#fecaca',
      '#fca5a5',
      '#f87171',
      '#ef4444',
      '#dc2626',
      '#b91c1c',
      '#991b1b',
      '#7f1d1d',
      '#6b1f1f',
    ],
  },

  /** Set the primary color */
  primaryColor: 'primary',

  /** Default radius for components */
  defaultRadius: 'md',

  /** Font settings */
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
  fontFamilyMonospace: 'Monaco, Courier, monospace',
  headings: {
    fontFamily:
      'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
    fontWeight: '600',
  },

  /** Component-specific theme overrides */
  components: {
    Button: {
      styles: {
        root: {
          fontWeight: 500,
        },
      },
    },
    Card: {
      styles: {
        root: {
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        },
      },
    },
    TextInput: {
      styles: {
        input: {
          borderColor: '#e2e8f0',
          '&:focus': {
            borderColor: '#667eea',
          },
        },
      },
    },
    Select: {
      styles: {
        input: {
          borderColor: '#e2e8f0',
          '&:focus': {
            borderColor: '#667eea',
          },
        },
      },
    },
  },

  /** Spacing scale */
  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },
});
