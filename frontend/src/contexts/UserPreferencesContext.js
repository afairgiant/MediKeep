import React, { createContext, useContext, useState, useEffect } from 'react';
import { getUserPreferences } from '../services/api/userPreferencesApi';
import frontendLogger from '../services/frontendLogger';

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
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load user preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setLoading(true);
        setError(null);
        const userPrefs = await getUserPreferences();
        setPreferences(userPrefs);

        frontendLogger.logInfo('User preferences loaded', {
          unitSystem: userPrefs.unit_system,
          component: 'UserPreferencesContext',
        });
      } catch (err) {
        const errorMessage = err.message || 'Failed to load user preferences';
        setError(errorMessage);

        // Set default preferences on error
        const defaultPrefs = { 
          unit_system: 'imperial',
          paperless_enabled: false,
          paperless_url: '',
          paperless_api_token: '',
          default_storage_backend: 'local',
          paperless_auto_sync: false,
          paperless_sync_tags: true
        };
        setPreferences(defaultPrefs);

        frontendLogger.logError(
          'Failed to load user preferences, using defaults',
          {
            error: errorMessage,
            defaultPreferences: defaultPrefs,
            component: 'UserPreferencesContext',
          }
        );
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, []);

  // Function to update preferences (called from Settings page)
  const updatePreferences = newPreferences => {
    setPreferences(prev => ({
      ...prev,
      ...newPreferences,
    }));

    frontendLogger.logInfo('User preferences updated in context', {
      updatedFields: Object.keys(newPreferences),
      component: 'UserPreferencesContext',
    });
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
    updatePreferences,
    refreshPreferences,
    // Convenience getters
    unitSystem: preferences?.unit_system || 'imperial',
    isMetric: preferences?.unit_system === 'metric',
    isImperial: preferences?.unit_system === 'imperial',
  };

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
};

export default UserPreferencesContext;
