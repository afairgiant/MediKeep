import { apiService } from './index';

/**
 * User Preferences API service
 * Handles user preference management including unit system settings
 */

/**
 * Get current user's preferences
 * @returns {Promise} User preferences object
 */
export const getUserPreferences = async () => {
  return apiService.get('/users/me/preferences');
};

/**
 * Update current user's preferences
 * @param {Object} preferences - Preferences to update
 * @param {string} preferences.unit_system - Unit system ('imperial' or 'metric')
 * @returns {Promise} Updated user preferences object
 */
export const updateUserPreferences = async preferences => {
  return apiService.put('/users/me/preferences', preferences);
};

export default {
  getUserPreferences,
  updateUserPreferences,
};
