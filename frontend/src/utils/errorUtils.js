/**
 * Error handling utilities for consistent error message processing
 */

/**
 * Map of common validation error types to user-friendly messages
 */
const ERROR_TYPE_MESSAGES = {
  // Field validation errors
  'value_error.missing': 'This field is required',
  'type_error.none.not_allowed': 'This field cannot be empty',
  'value_error.str.min_length': 'Value is too short',
  'value_error.str.max_length': 'Value is too long',
  'value_error.number.not_ge': 'Value must be greater than or equal to the minimum',
  'value_error.number.not_le': 'Value must be less than or equal to the maximum',
  'value_error.date.not_le': 'Date cannot be in the future',
  'value_error.date.not_ge': 'Date cannot be before the minimum date',
  'type_error.integer': 'Must be a valid number',
  'type_error.float': 'Must be a valid decimal number',
  'value_error.email': 'Must be a valid email address',
  'value_error.url': 'Must be a valid URL',
  'value_error.regex': 'Invalid format',
  'value_error.duplicate': 'This value already exists',
  'value_error.invalid_choice': 'Invalid selection',
};

/**
 * Map of common error message patterns to user-friendly messages
 * Used as fallback when error type is not available
 */
const ERROR_PATTERN_MESSAGES = [
  {
    pattern: /ensure this value is not greater than (\d{4}-\d{2}-\d{2})/,
    getMessage: (match) => `Date cannot be after ${match[1]}`
  },
  {
    pattern: /ensure this value is not less than (\d{4}-\d{2}-\d{2})/,
    getMessage: (match) => `Date cannot be before ${match[1]}`
  },
  {
    pattern: /ensure this value is greater than or equal to (\d+)/,
    getMessage: (match) => `Value must be at least ${match[1]}`
  },
  {
    pattern: /ensure this value is less than or equal to (\d+)/,
    getMessage: (match) => `Value must be at most ${match[1]}`
  },
  {
    pattern: /ensure this value has at least (\d+) characters/,
    getMessage: (match) => `Must be at least ${match[1]} characters`
  },
  {
    pattern: /ensure this value has at most (\d+) characters/,
    getMessage: (match) => `Must be at most ${match[1]} characters`
  },
  {
    pattern: /field required/i,
    getMessage: () => 'This field is required'
  },
  {
    pattern: /string too short/i,
    getMessage: () => 'Value is too short'
  },
  {
    pattern: /string too long/i,
    getMessage: () => 'Value is too long'
  },
  {
    pattern: /invalid date format/i,
    getMessage: () => 'Invalid date format'
  },
  {
    pattern: /duplicate key value/i,
    getMessage: () => 'This value already exists'
  },
];

/**
 * Format a field name to be more user-friendly
 * Converts snake_case to Title Case
 * 
 * @param {string} fieldName - The field name to format
 * @returns {string} - Formatted field name
 */
export const formatFieldName = (fieldName) => {
  if (!fieldName) return 'Field';
  
  return fieldName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/Id\b/g, 'ID') // Special case for ID
    .replace(/Icd/g, 'ICD') // Special case for ICD
    .replace(/Url\b/g, 'URL'); // Special case for URL
};

/**
 * Get a user-friendly error message based on error type or message
 * 
 * @param {Object} error - The validation error object
 * @param {string} error.type - The error type code
 * @param {string} error.msg - The error message
 * @param {Array} error.loc - The location array (field path)
 * @returns {string} - User-friendly error message
 */
export const getValidationErrorMessage = (error) => {
  // Try to get message by error type first
  if (error.type && ERROR_TYPE_MESSAGES[error.type]) {
    return ERROR_TYPE_MESSAGES[error.type];
  }
  
  // Fallback to pattern matching on the message
  if (error.msg) {
    for (const { pattern, getMessage } of ERROR_PATTERN_MESSAGES) {
      const match = error.msg.match(pattern);
      if (match) {
        return getMessage(match);
      }
    }
  }
  
  // Return the original message if no mapping found
  return error.msg || 'Invalid value';
};

/**
 * Process validation errors from FastAPI response
 * 
 * @param {Array} errors - Array of validation errors from FastAPI
 * @returns {string} - Formatted error message string
 */
export const processValidationErrors = (errors) => {
  if (!Array.isArray(errors)) return 'Validation failed';
  
  const formattedErrors = errors.map(error => {
    // Extract field name from location array
    const fieldName = error.loc?.[error.loc.length - 1] || 'unknown field';
    const friendlyFieldName = formatFieldName(fieldName);
    
    // Get user-friendly error message
    const errorMessage = getValidationErrorMessage(error);
    
    return `${friendlyFieldName}: ${errorMessage}`;
  });
  
  return formattedErrors.join('; ');
};

/**
 * Extract error message from API response
 * 
 * @param {Object} errorData - The error response data
 * @param {number} statusCode - The HTTP status code
 * @returns {string} - Extracted error message
 */
export const extractErrorMessage = (errorData, statusCode) => {
  // Handle validation errors (422)
  if (statusCode === 422) {
    // Check for FastAPI's validation error format
    if (errorData.detail && Array.isArray(errorData.detail)) {
      return processValidationErrors(errorData.detail);
    }
    
    // Check for custom validation error format
    if (errorData.validation_errors && Array.isArray(errorData.validation_errors)) {
      return errorData.validation_errors.join('; ');
    }
    
    // Check for description field
    if (errorData.description) {
      return errorData.description;
    }
  }
  
  // For other errors, use message or detail
  return errorData.message || errorData.detail || 'An error occurred';
};