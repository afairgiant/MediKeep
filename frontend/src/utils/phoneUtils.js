/**
 * Phone number utilities with centralized field detection.
 *
 * Phone numbers are stored and displayed as-entered (free-form text).
 * Only a light character-set validation is applied.
 */

/**
 * Centralized configuration for phone field identification
 */
export const PHONE_FIELD_PATTERNS = [
  'phone',
  'telephone',
  'mobile',
  'cell'
];

/**
 * Centralized phone field detection utility.
 *
 * @param {string} fieldName - The field name to check
 * @param {string} fieldType - Optional field type (e.g., 'tel')
 * @returns {boolean} True if field is a phone field
 */
export const isPhoneField = (fieldName, fieldType = '') => {
  if (!fieldName) return false;

  if (fieldType === 'tel') return true;

  const lowercaseFieldName = fieldName.toLowerCase();
  return PHONE_FIELD_PATTERNS.some(pattern =>
    lowercaseFieldName.includes(pattern)
  );
};

/**
 * Validate phone number character set.
 * Allows digits, spaces, dashes, parentheses, periods, and +.
 *
 * @param {string} phoneNumber - The phone number to validate
 * @returns {boolean} - True if valid, false otherwise
 */
export const isValidPhoneNumber = phoneNumber => {
  if (!phoneNumber) return true;

  const value = String(phoneNumber).trim();
  if (value === '') return true;

  if (value.length > 20) return false;

  return /^[0-9\s\-+().]*$/.test(value);
};
