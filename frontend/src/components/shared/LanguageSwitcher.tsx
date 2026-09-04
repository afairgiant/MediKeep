import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import logger from '../../services/logger';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { LANGUAGES, normalizeLanguage } from '../../constants/languages';

interface LanguageSwitcherProps {
  compact?: boolean;
  variant?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  comboboxWithinPortal?: boolean;
}

/**
 * LanguageSwitcher - Component for switching application language
 *
 * Displays available languages (EN/FR/DE/ES)
 * Uses local state for immediate UI feedback and syncs with i18next
 */
const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  compact = false,
  variant = 'default',
  size = 'sm',
  comboboxWithinPortal = true,
}) => {
  const { i18n, t } = useTranslation('settings');
  const { updatePreferences } = useUserPreferences();

  // Track if a change is in progress to prevent race conditions
  const isChangingRef = useRef(false);

  // Local state for immediate UI feedback
  // This ensures the Select always shows the correct value even during async operations
  const [selectedLanguage, setSelectedLanguage] = useState(() =>
    normalizeLanguage(i18n.language)
  );

  // Sync local state with i18n.language when it changes externally
  useEffect(() => {
    if (!isChangingRef.current) {
      const normalizedLang = normalizeLanguage(i18n.language);
      setSelectedLanguage(normalizedLang);
    }
  }, [i18n.language]);

  const handleLanguageChange = useCallback(
    async (value: string | null) => {
      if (!value || value === selectedLanguage || isChangingRef.current) {
        return;
      }

      const normalizedValue = normalizeLanguage(value);
      if (normalizedValue === selectedLanguage) {
        return;
      }

      isChangingRef.current = true;
      const previousLanguage = selectedLanguage;

      // Update local state immediately for responsive UI
      setSelectedLanguage(normalizedValue);

      try {
        await i18n.changeLanguage(normalizedValue);

        logger.info('language_changed', 'User changed language', {
          component: 'LanguageSwitcher',
          newLanguage: normalizedValue,
          previousLanguage: previousLanguage,
        });

        // Save to backend via UserPreferencesContext
        try {
          await updatePreferences({ language: normalizedValue });
          logger.info(
            'language_saved_to_backend',
            'Language preference saved to backend',
            {
              component: 'LanguageSwitcher',
              language: normalizedValue,
            }
          );
        } catch (backendError) {
          logger.error(
            'language_backend_save_failed',
            'Failed to save language to backend',
            {
              component: 'LanguageSwitcher',
              language: normalizedValue,
              error:
                backendError instanceof Error
                  ? backendError.message
                  : 'Unknown error',
            }
          );
          notifications.show({
            message: t(
              'preferences.language.saveError',
              'Language applied but could not be saved. It may revert on next login.'
            ),
            color: 'orange',
            autoClose: 6000,
          });
        }
      } catch (error) {
        // Revert local state on failure
        setSelectedLanguage(previousLanguage);

        logger.error('language_change_failed', 'Failed to change language', {
          component: 'LanguageSwitcher',
          targetLanguage: normalizedValue,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        isChangingRef.current = false;
      }
    },
    [selectedLanguage, i18n, t, updatePreferences]
  );

  const selectData = LANGUAGES.map(lang => ({
    value: lang.value,
    label: compact ? lang.shortLabel : lang.label,
  }));

  return (
    <Select
      value={selectedLanguage}
      onChange={handleLanguageChange}
      data={selectData}
      variant={variant}
      size={size}
      styles={{
        input: {
          minWidth: compact ? '60px' : '140px',
          cursor: 'pointer',
        },
      }}
      comboboxProps={{ withinPortal: comboboxWithinPortal, zIndex: 1100 }}
      allowDeselect={false}
      aria-label="Select language"
    />
  );
};

export default LanguageSwitcher;
