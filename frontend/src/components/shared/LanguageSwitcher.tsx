import React from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@mantine/core';
import logger from '../../services/logger';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';

interface LanguageSwitcherProps {
  compact?: boolean;
  variant?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

interface Language {
  value: string;
  label: string;
  shortLabel: string;
}

/**
 * LanguageSwitcher - Component for switching application language
 *
 * Displays available languages (EN/FR/DE)
 * Currently saves to localStorage via i18next
 * Phase 5: Will integrate with backend user preferences API
 */
const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  compact = false,
  variant = 'default',
  size = 'sm'
}) => {
  const { i18n } = useTranslation();
  const { updatePreferences } = useUserPreferences();

  // Available languages
  const languages: Language[] = [
    { value: 'en', label: 'English', shortLabel: 'EN' },
    { value: 'fr', label: 'Français', shortLabel: 'FR' },
    { value: 'de', label: 'Deutsch', shortLabel: 'DE' },
  ];

  const handleLanguageChange = async (value: string | null) => {
    if (value && value !== i18n.language) {
      try {
        const previousLanguage = i18n.language;
        await i18n.changeLanguage(value);

        logger.info('language_changed', 'User changed language', {
          component: 'LanguageSwitcher',
          newLanguage: value,
          previousLanguage: previousLanguage,
        });

        // Save to backend via UserPreferencesContext
        try {
          await updatePreferences({ language: value });
          logger.info('language_saved_to_backend', 'Language preference saved to backend', {
            component: 'LanguageSwitcher',
            language: value,
          });
        } catch (backendError) {
          // Log but don't fail - language is already changed locally
          logger.error('language_backend_save_failed', 'Failed to save language to backend', {
            component: 'LanguageSwitcher',
            language: value,
            error: backendError instanceof Error ? backendError.message : 'Unknown error',
          });
        }
      } catch (error) {
        logger.error('language_change_failed', 'Failed to change language', {
          component: 'LanguageSwitcher',
          targetLanguage: value,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  };

  return (
    <Select
      value={i18n.language}
      onChange={handleLanguageChange}
      data={compact
        ? languages.map(lang => ({ value: lang.value, label: lang.shortLabel }))
        : languages.map(lang => ({ value: lang.value, label: lang.label }))
      }
      variant={variant}
      size={size}
      styles={{
        input: {
          minWidth: compact ? '60px' : '140px',
          cursor: 'pointer',
        },
      }}
      comboboxProps={{ withinPortal: true }}
      allowDeselect={false}
      aria-label="Select language"
    />
  );
};

export default LanguageSwitcher;
