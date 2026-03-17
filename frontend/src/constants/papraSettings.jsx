/**
 * Constants for Papra settings keys
 * These are used to identify and handle Papra-related user preferences
 * throughout the application.
 */

/**
 * Mapping of semantic key names to the backend setting key strings
 * @type {Object<string, string>}
 */
export const PAPRA_SETTING_KEYS = {
  enabled: 'papra_enabled',
  url: 'papra_url',
  apiToken: 'papra_api_token',
  organizationId: 'papra_organization_id',
};

/**
 * Array of all Papra setting key strings for lookup operations
 * @type {string[]}
 */
const PAPRA_ALL_KEYS = Object.values(PAPRA_SETTING_KEYS);

/**
 * Default values for Papra settings
 * @type {Object<string, any>}
 */
export const PAPRA_DEFAULTS = {
  papra_enabled: false,
  papra_url: '',
  papra_api_token: '',
  papra_organization_id: '',
};

/**
 * Helper function to check if a setting key is a Papra setting
 * @param {string} key - The setting key to check
 * @returns {boolean} True if the key is a Papra setting
 */
export const isPapraSetting = (key) => {
  return PAPRA_ALL_KEYS.includes(key);
};
