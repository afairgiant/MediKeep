/**
 * Constants for Paperless-ngx settings keys
 * These are used to identify and handle Paperless-related user preferences
 * throughout the application.
 */

/**
 * Array of all Paperless setting keys that require special handling
 * (e.g., encryption for credentials, specific API endpoints)
 * 
 * @type {string[]}
 */
export const PAPERLESS_SETTING_KEYS = [
  'paperless_enabled',      // Boolean: Enable/disable Paperless integration
  'paperless_url',          // String: URL to Paperless-ngx instance
  'paperless_username',     // String: Username for authentication (encrypted)
  'paperless_password',     // String: Password for authentication (encrypted)
  'default_storage_backend', // String: Default storage backend for documents
  'paperless_auto_sync',    // Boolean: Enable automatic synchronization
  'paperless_sync_tags',    // String/Array: Tags to use for syncing
];

/**
 * Object mapping setting keys to their types for validation
 * @type {Object<string, string>}
 */
export const PAPERLESS_SETTING_TYPES = {
  paperless_enabled: 'boolean',
  paperless_url: 'string',
  paperless_username: 'string',
  paperless_password: 'string',
  default_storage_backend: 'string',
  paperless_auto_sync: 'boolean',
  paperless_sync_tags: 'string',
};

/**
 * Default values for Paperless settings
 * @type {Object<string, any>}
 */
export const PAPERLESS_SETTING_DEFAULTS = {
  paperless_enabled: false,
  paperless_url: '',
  paperless_username: '',
  paperless_password: '',
  default_storage_backend: 'local',
  paperless_auto_sync: false,
  paperless_sync_tags: '',
};

/**
 * Settings that contain sensitive data and should be encrypted
 * @type {string[]}
 */
export const PAPERLESS_SENSITIVE_SETTINGS = [
  'paperless_username',
  'paperless_password',
];

/**
 * Helper function to check if a setting key is a Paperless setting
 * @param {string} key - The setting key to check
 * @returns {boolean} True if the key is a Paperless setting
 */
export const isPaperlessSetting = (key) => {
  return PAPERLESS_SETTING_KEYS.includes(key);
};

/**
 * Helper function to check if a setting contains sensitive data
 * @param {string} key - The setting key to check
 * @returns {boolean} True if the setting is sensitive
 */
export const isPaperlessSensitiveSetting = (key) => {
  return PAPERLESS_SENSITIVE_SETTINGS.includes(key);
};

/**
 * Helper function to get the type of a Paperless setting
 * @param {string} key - The setting key
 * @returns {string} The type of the setting
 */
export const getPaperlessSettingType = (key) => {
  return PAPERLESS_SETTING_TYPES[key] || 'string';
};

/**
 * Helper function to get the default value for a Paperless setting
 * @param {string} key - The setting key
 * @returns {any} The default value for the setting
 */
export const getPaperlessSettingDefault = (key) => {
  return PAPERLESS_SETTING_DEFAULTS[key] || '';
};