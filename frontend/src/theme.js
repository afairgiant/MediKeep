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

  /** Comprehensive CSS Variables for Mantine v8 */
  vars: (theme, colorScheme) => {
    const isDark = colorScheme === 'dark';
    return {
      // Base text colors
      '--mantine-color-text': isDark ? '#f7fafc' : '#000000',
      '--mantine-color-dimmed': isDark ? '#a0aec0' : '#3f4a59',
      '--mantine-color-placeholder': 'var(--mantine-color-dimmed)',

      // Input specific - referencing base variables
      '--input-color': 'var(--mantine-color-text)',
      '--input-placeholder-color': 'var(--mantine-color-placeholder)',
      '--input-section-color': 'var(--mantine-color-text)',

      // Border colors
      '--input-bd': isDark ? '#4a5568' : '#6b7280',
      '--input-bd-focus': theme.colors.primary[5],

      // Background colors
      '--mantine-color-body': isDark ? '#1a202c' : '#ffffff',
      '--mantine-color-default': isDark ? '#2d3748' : '#ffffff',

      // Component specific
      '--card-shadow': '0 2px 4px rgba(0, 0, 0, 0.1)',
      '--button-font-weight': '500',
    };
  },

  /** Component-specific theme overrides using CSS variables */
  components: {
    Button: {
      styles: {
        root: {
          fontWeight: 'var(--button-font-weight)',
        },
      },
    },
    Card: {
      styles: {
        root: {
          boxShadow: 'var(--card-shadow)',
        },
      },
    },
    TextInput: {
      styles: {
        label: { color: 'var(--color-text-primary)', fontWeight: 600 },
        input: {
          borderColor: 'var(--input-bd)',
          color: 'var(--input-color)',
          '&:focus': { borderColor: 'var(--input-bd-focus)' },
          '&::placeholder': { color: 'var(--input-placeholder-color)' },
        },
        section: { color: 'var(--input-section-color)' },
      },
    },
    Select: {
      styles: {
        label: { color: 'var(--color-text-primary)', fontWeight: 600 },
        input: {
          borderColor: 'var(--input-bd)',
          color: 'var(--input-color)',
          '&:focus': { borderColor: 'var(--input-bd-focus)' },
          '&::placeholder': { color: 'var(--input-placeholder-color)' },
        },
        option: { color: 'var(--mantine-color-text)' },
        rightSection: { color: 'var(--input-section-color)' },
        section: { color: 'var(--input-section-color)' },
      },
    },
    Textarea: {
      styles: {
        label: { color: 'var(--color-text-primary)', fontWeight: 600 },
        input: {
          borderColor: 'var(--input-bd)',
          color: 'var(--input-color)',
          '&:focus': { borderColor: 'var(--input-bd-focus)' },
          '&::placeholder': { color: 'var(--input-placeholder-color)' },
        },
      },
    },
    NumberInput: {
      styles: {
        label: { color: 'var(--color-text-primary)', fontWeight: 600 },
        input: {
          borderColor: 'var(--input-bd)',
          color: 'var(--input-color)',
          '&:focus': { borderColor: 'var(--input-bd-focus)' },
          '&::placeholder': { color: 'var(--input-placeholder-color)' },
        },
        section: { color: 'var(--input-section-color)' },
      },
    },
    DateInput: {
      styles: {
        label: { color: 'var(--color-text-primary)', fontWeight: 600 },
        input: {
          borderColor: 'var(--input-bd)',
          color: 'var(--input-color)',
          '&:focus': { borderColor: 'var(--input-bd-focus)' },
          '&::placeholder': { color: 'var(--input-placeholder-color)' },
        },
        section: { color: 'var(--input-section-color)' },
      },
    },
    Autocomplete: {
      styles: {
        label: { color: 'var(--color-text-primary)', fontWeight: 600 },
      },
    },
    MultiSelect: {
      styles: {
        label: { color: 'var(--color-text-primary)', fontWeight: 600 },
        input: {
          borderColor: 'var(--input-bd)',
          color: 'var(--input-color)',
          '&:focus': { borderColor: 'var(--input-bd-focus)' },
          '&::placeholder': { color: 'var(--input-placeholder-color)' },
        },
        option: { color: 'var(--mantine-color-text)' },
        section: { color: 'var(--input-section-color)' },
      },
    },
    Combobox: {
      styles: {
        input: {
          color: 'var(--input-color)',
          '&::placeholder': { color: 'var(--input-placeholder-color)' },
        },
        option: { color: 'var(--mantine-color-text)' },
        section: { color: 'var(--input-section-color)' },
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
