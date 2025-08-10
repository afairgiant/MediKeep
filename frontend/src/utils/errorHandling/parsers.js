/**
 * Error parsing utilities
 * Extracts meaningful information from raw error messages
 * Updated to use constants as suggested by reviewer feedback
 */

import { ERROR_TYPES, ERROR_PATTERNS, ERROR_REGEX_PATTERNS } from './constants';

/**
 * Enhanced error parser that extracts specific error information
 * @param {string} errorMessage - Raw error message from API
 * @returns {Object|null} Parsed error information
 */
export const parseErrorMessage = errorMessage => {
  if (!errorMessage || typeof errorMessage !== 'string') {
    return null;
  }

  // Check for bulk sharing errors using robust regex
  const bulkSharedMatch = errorMessage.match(ERROR_REGEX_PATTERNS.BULK_ALREADY_SHARED);
  if (bulkSharedMatch) {
    const names = bulkSharedMatch[1].split(',').map(name => name.trim());
    return {
      type: ERROR_TYPES.BULK_ALREADY_SHARED,
      names,
      count: names.length,
      originalMessage: errorMessage,
    };
  }

  // Check for authentication errors
  if (ERROR_REGEX_PATTERNS.AUTH_ERRORS.test(errorMessage)) {
    return {
      type: ERROR_TYPES.AUTH_ERROR,
      originalMessage: errorMessage,
    };
  }

  // Check for user not found errors
  if (ERROR_REGEX_PATTERNS.USER_NOT_FOUND.test(errorMessage)) {
    return {
      type: ERROR_TYPES.USER_NOT_FOUND,
      originalMessage: errorMessage,
    };
  }

  // Check for permission errors
  if (ERROR_REGEX_PATTERNS.PERMISSION_ERRORS.test(errorMessage)) {
    return {
      type: ERROR_TYPES.PERMISSION_ERROR,
      originalMessage: errorMessage,
    };
  }

  // Check for validation errors
  if (ERROR_REGEX_PATTERNS.VALIDATION_ERRORS.test(errorMessage)) {
    return {
      type: ERROR_TYPES.VALIDATION_ERROR,
      originalMessage: errorMessage,
    };
  }

  // Check for invitation specific errors
  if (ERROR_REGEX_PATTERNS.INVITATION_EXPIRED.test(errorMessage)) {
    return {
      type: ERROR_TYPES.INVITATION_EXPIRED,
      originalMessage: errorMessage,
    };
  }

  if (ERROR_REGEX_PATTERNS.INVITATION_NOT_FOUND.test(errorMessage)) {
    return {
      type: ERROR_TYPES.INVITATION_NOT_FOUND,
      originalMessage: errorMessage,
    };
  }

  // Check for network-specific patterns using robust regex
  if (ERROR_REGEX_PATTERNS.NETWORK_ERRORS.test(errorMessage)) {
    return {
      type: ERROR_TYPES.NETWORK_ERROR,
      originalMessage: errorMessage,
    };
  }

  // Check for timeout errors using robust regex
  if (ERROR_REGEX_PATTERNS.TIMEOUT_ERRORS.test(errorMessage)) {
    return {
      type: ERROR_TYPES.TIMEOUT_ERROR,
      originalMessage: errorMessage,
    };
  }

  // Check for HTTP status codes using robust regex
  const statusMatch = errorMessage.match(ERROR_REGEX_PATTERNS.HTTP_STATUS);
  if (statusMatch) {
    const statusCode = statusMatch[1];
    return {
      type: ERROR_TYPES.HTTP_STATUS,
      statusCode,
      originalMessage: errorMessage,
    };
  }

  // Check for generic sharing errors
  if (ERROR_REGEX_PATTERNS.SHARING_ERRORS.test(errorMessage)) {
    return {
      type: ERROR_TYPES.SHARING_ERROR,
      originalMessage: errorMessage,
    };
  }

  // Return parsed info for further processing
  return {
    type: ERROR_TYPES.UNKNOWN,
    originalMessage: errorMessage,
  };
};

/**
 * Parse HTTP error responses
 * @param {Object} error - Error object from API call
 * @returns {string} Extracted error message
 */
export const parseHttpError = error => {
  // Handle different error response structures
  if (error.response) {
    // Server responded with error status
    return (
      error.response.data?.detail ||
      error.response.data?.message ||
      error.response.data?.error ||
      `HTTP ${error.response.status}: ${error.response.statusText}`
    );
  } else if (error.request) {
    // Request was made but no response received
    return 'Network error: Unable to reach the server';
  } else {
    // Something else happened
    return error.message || 'An unexpected error occurred';
  }
};

/**
 * Extract field validation errors from API response
 * @param {Object} error - Error object from API call
 * @returns {Object|null} Field validation errors or null
 */
export const parseValidationErrors = error => {
  if (error.response?.data?.validation_errors) {
    return error.response.data.validation_errors;
  }

  if (
    error.response?.data?.errors &&
    typeof error.response.data.errors === 'object'
  ) {
    return error.response.data.errors;
  }

  return null;
};

/**
 * Check if error is a specific type using robust regex patterns
 * @param {string} errorMessage - Error message to check
 * @param {string} type - Type to check for
 * @returns {boolean} Whether error matches type
 */
export const isErrorType = (errorMessage, type) => {
  if (!errorMessage || typeof errorMessage !== 'string') {
    return false;
  }

  const lowerType = type.toLowerCase();

  switch (lowerType) {
    case 'network':
      return ERROR_REGEX_PATTERNS.NETWORK_ERRORS.test(errorMessage);
    case 'timeout':
      return ERROR_REGEX_PATTERNS.TIMEOUT_ERRORS.test(errorMessage);
    case 'auth':
    case 'authentication':
      return ERROR_REGEX_PATTERNS.AUTH_ERRORS.test(errorMessage);
    case 'validation':
      return ERROR_REGEX_PATTERNS.VALIDATION_ERRORS.test(errorMessage);
    case 'permission':
      return ERROR_REGEX_PATTERNS.PERMISSION_ERRORS.test(errorMessage);
    case 'sharing':
      return ERROR_REGEX_PATTERNS.SHARING_ERRORS.test(errorMessage) ||
             ERROR_REGEX_PATTERNS.BULK_ALREADY_SHARED.test(errorMessage);
    case 'user_not_found':
    case 'user':
      return ERROR_REGEX_PATTERNS.USER_NOT_FOUND.test(errorMessage);
    case 'invitation_expired':
    case 'expired':
      return ERROR_REGEX_PATTERNS.INVITATION_EXPIRED.test(errorMessage);
    case 'invitation_not_found':
    case 'invitation':
      return ERROR_REGEX_PATTERNS.INVITATION_NOT_FOUND.test(errorMessage);
    case 'http':
    case 'status':
      return ERROR_REGEX_PATTERNS.HTTP_STATUS.test(errorMessage);
    default:
      return false;
  }
};
