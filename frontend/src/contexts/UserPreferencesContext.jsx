import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getUserPreferences,
  updateUserPreferences,
} from '../services/api/userPreferencesApi';
import { useAuth } from './AuthContext';
import frontendLogger from '../services/frontendLogger';
import { PAPERLESS_SETTING_DEFAULTS } from '../constants/paperlessSettings';
import { timezoneService } from '../services/timezoneService';
import { DATE_FORMAT_OPTIONS, DEFAULT_DATE_FORMAT } from '../utils/constants';
import i18n from '../i18n';

// Supported languages - must match backend validation
const SUPPORTED_LANGUAGES = ['en', 'fr', 'de', 'es', 'it', 'pt'];

/**
 * User Preferences Context
 * Provides user preferences (including unit system) throughout the app
 */

const UserPreferencesContext = createContext();

export const useUserPreferences = () => {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error(
      'useUserPreferences must be used within a UserPreferencesProvider'
    );
  }
  return context;
};

export const UserPreferencesProvider = ({ children }) => {
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load user preferences when authenticated user changes
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setLoading(true);
        setError(null);
        const userPrefs = await getUserPreferences();
        setPreferences(userPrefs);

        frontendLogger.logInfo('User preferences loaded', {
          unitSystem: userPrefs.unit_system,
          paperlessEnabled: userPrefs.paperless_enabled,
          userId: user?.id,
          component: 'UserPreferencesContext',
        });
      } catch (err) {
        const errorMessage = err.message || 'Failed to load user preferences';
        setError(errorMessage);

        // Set default preferences on error
        const defaultPrefs = {
          unit_system: 'imperial',
          session_timeout_minutes: 30,
          date_format: 'mdy',
          ...PAPERLESS_SETTING_DEFAULTS,
          // Override the sync tags default for this context
          paperless_sync_tags: true,
        };
        setPreferences(defaultPrefs);

        frontendLogger.logError(
          'Failed to load user preferences, using defaults',
          {
            error: errorMessage,
            defaultPreferences: defaultPrefs,
            userId: user?.id,
            component: 'UserPreferencesContext',
          }
        );
      } finally {
        setLoading(false);
      }
    };

    // Only load preferences if user is authenticated
    if (isAuthenticated && user) {
      loadPreferences();
    } else if (!authLoading) {
      // Only clear preferences when not authenticated AND auth is not loading
      setPreferences(null);
      setLoading(false);
      setError(null);

      frontendLogger.logInfo('User logged out, clearing preferences', {
        component: 'UserPreferencesContext',
      });
    }
  }, [isAuthenticated, user?.id, authLoading]); // Depend on authentication state, user ID, and auth loading state

  // Function to update preferences and save to server
  const updatePreferences = useCallback(async newPreferences => {
    try {
      // Save to server first
      const updatedPreferences = await updateUserPreferences(newPreferences);

      // Then update local state with server response
      setPreferences(prev => ({
        ...prev,
        ...updatedPreferences,
      }));

      frontendLogger.logInfo('User preferences updated and saved', {
        updatedFields: Object.keys(newPreferences),
        component: 'UserPreferencesContext',
      });

      return updatedPreferences;
    } catch (err) {
      const errorMessage = err.message || 'Failed to save user preferences';
      setError(errorMessage);

      frontendLogger.logError('Failed to save user preferences', {
        error: errorMessage,
        updatedFields: Object.keys(newPreferences),
        component: 'UserPreferencesContext',
      });

      throw err;
    }
  }, []);

  // Sync auto-detected language to backend on first login
  useEffect(() => {
    const syncAutoDetectedLanguage = async () => {
      if (isAuthenticated && user && preferences && !loading) {
        const currentLanguage = i18n.language;
        const savedLanguage = preferences.language;

        // Only save if user has no language preference yet (still on default 'en')
        // and their browser/system language is different AND supported
        if (
          savedLanguage === 'en' &&
          currentLanguage !== 'en' &&
          SUPPORTED_LANGUAGES.includes(currentLanguage)
        ) {
          try {
            await updatePreferences({ language: currentLanguage });
            frontendLogger.logInfo('Auto-detected language saved to backend', {
              language: currentLanguage,
              userId: user.id,
              component: 'UserPreferencesContext',
            });
          } catch (error) {
            frontendLogger.logError('Failed to save auto-detected language', {
              error: error.message,
              language: currentLanguage,
              userId: user.id,
              component: 'UserPreferencesContext',
            });
          }
        } else if (savedLanguage === 'en' && currentLanguage !== 'en') {
          // Log when browser language is not supported
          frontendLogger.logInfo('Browser language not supported, keeping default', {
            browserLanguage: currentLanguage,
            supportedLanguages: SUPPORTED_LANGUAGES,
            userId: user.id,
            component: 'UserPreferencesContext',
          });
        }
      }
    };

    syncAutoDetectedLanguage();
  }, [isAuthenticated, user, preferences, loading, updatePreferences]);

  // Sync date format locale to timezoneService when preferences change
  useEffect(() => {
    const formatCode = preferences?.date_format || DEFAULT_DATE_FORMAT;
    const config = DATE_FORMAT_OPTIONS[formatCode] || DATE_FORMAT_OPTIONS[DEFAULT_DATE_FORMAT];
    timezoneService.setDateLocale(config.locale, formatCode);
  }, [preferences?.date_format]);

  // Function to update local preferences only (for internal use)
  const updateLocalPreferences = newPreferences => {
    setPreferences(prev => ({
      ...prev,
      ...newPreferences,
    }));
  };

  // Function to refresh preferences from server
  const refreshPreferences = async () => {
    try {
      setLoading(true);
      setError(null);
      const userPrefs = await getUserPreferences();
      setPreferences(userPrefs);
      return userPrefs;
    } catch (err) {
      const errorMessage = err.message || 'Failed to refresh user preferences';
      setError(errorMessage);
      frontendLogger.logError('Failed to refresh user preferences', {
        error: errorMessage,
        component: 'UserPreferencesContext',
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    preferences,
    loading,
    error,
    updatePreferences, // Now saves to server automatically
    updateLocalPreferences, // Local state update only (for backwards compatibility)
    refreshPreferences,
    // Convenience getters for unit system
    unitSystem: preferences?.unit_system || 'imperial',
    isMetric: preferences?.unit_system === 'metric',
    isImperial: preferences?.unit_system === 'imperial',
    // Convenience getters for date format
    dateFormat: preferences?.date_format || 'mdy',
    isUSDateFormat: preferences?.date_format === 'mdy' || !preferences?.date_format,
    isEuropeanDateFormat: preferences?.date_format === 'dmy',
    isISODateFormat: preferences?.date_format === 'ymd',
  };

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
};

export default UserPreferencesContext;
