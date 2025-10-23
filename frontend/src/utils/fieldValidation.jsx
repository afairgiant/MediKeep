import { PASSWORD_VALIDATION, EMAIL_REGEX, EDIT_EXCLUDED_FIELDS } from '../constants/validationConstants';
import { MEDICAL_MODELS } from '../constants/modelConstants';

/**
 * Validates a single field value
 *
 * @param {Object} field - Field metadata
 * @param {*} value - Field value to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.includePasswordValidation - Include password complexity checks
 * @param {string} options.modelName - Model name for context-specific validation
 * @returns {Array<string>} Array of error messages
 */
export const validateField = (field, value, options = {}) => {
  const { includePasswordValidation = false, modelName = null } = options;
  const errors = [];

  // Required field validation
  if (
    !field.nullable &&
    (value === null || value === undefined || value === '')
  ) {
    errors.push(`${field.name} is required`);
  }

  // Password validation for user creation
  if (
    includePasswordValidation &&
    (field.name === 'password_hash' ||
      field.name === 'password' ||
      field.name.includes('password')) &&
    modelName === 'user'
  ) {
    if (!value || value.length < PASSWORD_VALIDATION.MIN_LENGTH) {
      errors.push(PASSWORD_VALIDATION.MESSAGES.MIN_LENGTH);
    }

    const hasLetter = PASSWORD_VALIDATION.LETTER_REGEX.test(value);
    const hasNumber = PASSWORD_VALIDATION.NUMBER_REGEX.test(value);
    if (value && (!hasLetter || !hasNumber)) {
      errors.push(PASSWORD_VALIDATION.MESSAGES.COMPLEXITY);
    }
  }

  // Max length validation
  if (
    field.max_length &&
    typeof value === 'string' &&
    value.length > field.max_length
  ) {
    errors.push(
      `${field.name} must be ${field.max_length} characters or less`
    );
  }

  // Type validation
  if (value !== null && value !== undefined && value !== '') {
    if (field.type === 'number' && isNaN(Number(value))) {
      errors.push(`${field.name} must be a valid number`);
    }

    if (field.type === 'email' && value && !EMAIL_REGEX.test(value)) {
      errors.push(`${field.name} must be a valid email address`);
    }
  }

  return errors;
};

/**
 * Validates entire form
 *
 * @param {Object} metadata - Model metadata with fields array
 * @param {Object} formData - Form data to validate
 * @param {Object} options - Validation options
 * @param {boolean} options.skipPasswordFields - Skip password field validation (for edit mode)
 * @param {boolean} options.includePasswordValidation - Include password complexity checks (for create mode)
 * @param {string} options.modelName - Model name for context-specific validation
 * @returns {Object} Object with hasErrors boolean and errors object
 */
export const validateForm = (metadata, formData, options = {}) => {
  const {
    skipPasswordFields = false,
    includePasswordValidation = false,
    modelName = null,
  } = options;

  const errors = {};
  let hasErrors = false;

  metadata.fields.forEach(field => {
    // Don't validate primary keys (they're auto-generated)
    if (field.primary_key) {
      return;
    }

    // Skip timestamp fields - they're system-generated
    if (field.name === 'created_at' || field.name === 'updated_at') {
      return;
    }

    // Skip password fields if requested (edit mode)
    if (skipPasswordFields && EDIT_EXCLUDED_FIELDS.some(excluded => field.name.includes(excluded))) {
      return;
    }

    // Skip patient_id validation for medical models as it will be auto-populated
    if (field.name === 'patient_id' && MEDICAL_MODELS.includes(modelName)) {
      return;
    }

    const fieldErrors = validateField(field, formData[field.name], {
      includePasswordValidation,
      modelName,
    });

    if (fieldErrors.length > 0) {
      errors[field.name] = fieldErrors;
      hasErrors = true;
    }
  });

  return { hasErrors, errors };
};
