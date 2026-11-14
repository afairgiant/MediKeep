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
  'paperless_enabled', // Boolean: Enable/disable Paperless integration
  'paperless_url', // String: URL to Paperless-ngx instance
  'paperless_api_token', // String: API token for authentication (encrypted)
  'paperless_username', // String: Username for authentication (encrypted)
  'paperless_password', // String: Password for authentication (encrypted)
  'paperless_auth_method', // String: Chosen authentication method (see PAPERLESS_AUTH_METHODS)
  'default_storage_backend', // String: Default storage backend for documents
  'paperless_auto_sync', // Boolean: Enable automatic synchronization
  'paperless_sync_tags', // String/Array: Tags to use for syncing
];

/**
 * Object mapping setting keys to their types for validation
 * @type {Object<string, string>}
 */
export const PAPERLESS_SETTING_TYPES = {
  paperless_enabled: 'boolean',
  paperless_url: 'string',
  paperless_api_token: 'string',
  paperless_username: 'string',
  paperless_password: 'string',
  paperless_auth_method: 'string',
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
  paperless_api_token: '',
  paperless_username: '',
  paperless_password: '',
  paperless_auth_method: 'token',
  default_storage_backend: 'local',
  paperless_auto_sync: false,
  paperless_sync_tags: '',
};

/**
 * Settings that contain sensitive data and should be encrypted
 * @type {string[]}
 */
export const PAPERLESS_SENSITIVE_SETTINGS = [
  'paperless_api_token',
  'paperless_username',
  'paperless_password',
];

/**
 * Helper function to check if a setting key is a Paperless setting
 * @param {string} key - The setting key to check
 * @returns {boolean} True if the key is a Paperless setting
 */
export const isPaperlessSetting = key => {
  return PAPERLESS_SETTING_KEYS.includes(key);
};

/**
 * Helper function to check if a setting contains sensitive data
 * @param {string} key - The setting key to check
 * @returns {boolean} True if the setting is sensitive
 */
export const isPaperlessSensitiveSetting = key => {
  return PAPERLESS_SENSITIVE_SETTINGS.includes(key);
};

/**
 * Helper function to get the type of a Paperless setting
 * @param {string} key - The setting key
 * @returns {string} The type of the setting
 */
export const getPaperlessSettingType = key => {
  return PAPERLESS_SETTING_TYPES[key] || 'string';
};

/**
 * Helper function to get the default value for a Paperless setting
 * @param {string} key - The setting key
 * @returns {any} The default value for the setting
 */
export const getPaperlessSettingDefault = key => {
  return PAPERLESS_SETTING_DEFAULTS[key] || '';
};

/**
 * Ways to authenticate to Paperless-ngx. The ids match the backend registry
 * (app/services/paperless_auth_methods.py); the radio group renders from this
 * list, so a new method is added here and in the per-method fields. Labels are
 * `settings` namespace translation keys, with the English text as fallback.
 * @type {{value: string, labelKey: string, defaultLabel: string}[]}
 */
export const PAPERLESS_AUTH_METHODS = [
  {
    value: 'token',
    labelKey: 'paperlessConnection.apiTokenRecommended',
    defaultLabel: 'API Token (Recommended)',
  },
  {
    value: 'basic_auth',
    labelKey: 'paperlessConnection.usernamePassword',
    defaultLabel: 'Username & Password',
  },
];

export const DEFAULT_PAPERLESS_AUTH_METHOD = 'token';

/**
 * The method to display for a stored value. Anything that is not a known
 * method (missing, or an id added by a newer server) shows the default.
 * @param {string} [value] - Stored paperless_auth_method
 * @returns {string} A value from PAPERLESS_AUTH_METHODS
 */
export const resolvePaperlessAuthMethod = value =>
  PAPERLESS_AUTH_METHODS.some(method => method.value === value)
    ? value
    : DEFAULT_PAPERLESS_AUTH_METHOD;

const hasText = value => typeof value === 'string' && value.trim() !== '';

const AUTH_METHOD_CREDENTIAL_CHECKS = {
  token: prefs =>
    hasText(prefs.paperless_api_token) || Boolean(prefs.paperless_has_token),
  basic_auth: prefs =>
    Boolean(prefs.paperless_has_credentials) ||
    (hasText(prefs.paperless_username) && hasText(prefs.paperless_password)),
};

/**
 * Whether a method has credentials saved on the server or typed into the form.
 * A method this client does not know about is assumed usable; the server decides.
 * @param {Object} prefs - Local preferences
 * @param {string} method - Authentication method id
 * @returns {boolean}
 */
export const hasPaperlessCredentials = (prefs, method) => {
  const check = AUTH_METHOD_CREDENTIAL_CHECKS[method];
  return check ? check(prefs) : true;
};
