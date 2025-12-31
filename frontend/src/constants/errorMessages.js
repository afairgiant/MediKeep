/**
 * Centralized Error Messages
 *
 * This file contains standardized, user-friendly error messages used across
 * the application to ensure consistent UX and easier maintenance.
 *
 * Error Message Guidelines:
 * - Clear and actionable - Tell users what went wrong and what to do
 * - Consistent tone - Professional but friendly
 * - Specific enough - Help users understand the issue
 * - Solution-oriented - Include next steps when possible
 * - No technical jargon - Use language users understand
 *
 * Error Code System:
 * - Uses backend error codes (e.g., VAL-422, AUTH-401, DB-500)
 * - Format: CATEGORY-STATUS (follows RFC 7807 standard)
 * - Single source of truth: Backend defines codes, frontend displays them
 */

// Main error messages organized by category
export const ERROR_MESSAGES = {
  // Upload-related errors
  UPLOAD_FAILED: 'Failed to upload file. Please try again.',
  CONNECTION_ERROR: 'Connection error. Please check your network and try again.',
  FILE_TOO_LARGE: 'File size exceeds the maximum limit.',
  INVALID_FILE_TYPE: 'File type not supported.',
  PAPERLESS_UNAVAILABLE: 'Document management service is currently unavailable.',
  FORM_SUBMISSION_FAILED: 'Failed to save form. Please check your input and try again.',
  PERMISSION_DENIED: 'You do not have permission to perform this action.',
  SERVER_ERROR: 'Server error occurred. Please try again later.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  NETWORK_UNAVAILABLE: 'Network unavailable. Please check your connection.',
  FILE_PROCESSING_FAILED: 'Failed to process file. Please try a different file.',
  DUPLICATE_FILE: 'This file has already been uploaded.',
  STORAGE_FULL: 'Storage limit reached. Please free up space and try again.',
  
  // Paperless-specific errors
  PAPERLESS_NOT_ENABLED: 'Paperless integration is not enabled. Please enable it in Settings.',
  PAPERLESS_CONFIG_INCOMPLETE: 'Paperless configuration is incomplete. Please check your settings.',
  PAPERLESS_UPLOAD_FAILED: 'Failed to upload to Paperless document management system.',
  PAPERLESS_CONNECTION_FAILED: 'Unable to connect to Paperless service. Please check configuration.',
  PAPERLESS_AUTH_FAILED: 'Authentication failed with Paperless service. Please check credentials.',
  PAPERLESS_DUPLICATE_DOCUMENT: 'This document already exists in Paperless. Identical documents cannot be uploaded twice.',
  PAPERLESS_TASK_FAILED: 'Document upload to Paperless failed. Please try again or contact support.',
  PAPERLESS_TASK_TIMEOUT: 'Document processing timed out. The document may still be processing in Paperless.',
  
  // Form submission errors
  REQUIRED_FIELD_MISSING: 'Please fill in all required fields.',
  INVALID_DATE: 'Please enter a valid date.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  INVALID_PHONE: 'Please enter a valid phone number.',
  PATIENT_NOT_SELECTED: 'Please select a patient.',
  ENTITY_NOT_FOUND: 'The requested item could not be found.',
  
  // File management errors
  FILE_DELETE_FAILED: 'Failed to delete file. Please try again.',
  FILE_DOWNLOAD_FAILED: 'Failed to download file. Please try again.',
  FILE_VIEW_FAILED: 'Failed to open file for viewing. Please try again.',
  FILE_NOT_FOUND: 'File not found.',
  
  // Batch upload errors
  BATCH_UPLOAD_FAILED: 'Some files failed to upload. Please check individual file errors.',
  PARTIAL_UPLOAD_SUCCESS: 'Upload completed with some errors. Please review failed files.',
  ALL_UPLOADS_FAILED: 'All file uploads failed. Please check your connection and try again.',
  
  // General application errors
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait a moment and try again.',
  MAINTENANCE_MODE: 'The system is currently under maintenance. Please try again later.',
};

// Error categories for better organization and handling
export const ERROR_CATEGORIES = {
  NETWORK: 'network',
  VALIDATION: 'validation',
  SYSTEM: 'system',
  PERMISSION: 'permission',
  FILE: 'file',
  PAPERLESS: 'paperless',
  FORM: 'form',
};

// Map error types to categories
export const ERROR_TYPE_MAPPING = {
  [ERROR_MESSAGES.CONNECTION_ERROR]: ERROR_CATEGORIES.NETWORK,
  [ERROR_MESSAGES.NETWORK_UNAVAILABLE]: ERROR_CATEGORIES.NETWORK,
  [ERROR_MESSAGES.TIMEOUT_ERROR]: ERROR_CATEGORIES.NETWORK,
  [ERROR_MESSAGES.PAPERLESS_CONNECTION_FAILED]: ERROR_CATEGORIES.NETWORK,
  
  [ERROR_MESSAGES.VALIDATION_ERROR]: ERROR_CATEGORIES.VALIDATION,
  [ERROR_MESSAGES.REQUIRED_FIELD_MISSING]: ERROR_CATEGORIES.VALIDATION,
  [ERROR_MESSAGES.INVALID_DATE]: ERROR_CATEGORIES.VALIDATION,
  [ERROR_MESSAGES.INVALID_EMAIL]: ERROR_CATEGORIES.VALIDATION,
  [ERROR_MESSAGES.INVALID_PHONE]: ERROR_CATEGORIES.VALIDATION,
  [ERROR_MESSAGES.INVALID_FILE_TYPE]: ERROR_CATEGORIES.VALIDATION,
  [ERROR_MESSAGES.FILE_TOO_LARGE]: ERROR_CATEGORIES.VALIDATION,
  
  [ERROR_MESSAGES.SERVER_ERROR]: ERROR_CATEGORIES.SYSTEM,
  [ERROR_MESSAGES.UNKNOWN_ERROR]: ERROR_CATEGORIES.SYSTEM,
  [ERROR_MESSAGES.SESSION_EXPIRED]: ERROR_CATEGORIES.SYSTEM,
  [ERROR_MESSAGES.MAINTENANCE_MODE]: ERROR_CATEGORIES.SYSTEM,
  [ERROR_MESSAGES.STORAGE_FULL]: ERROR_CATEGORIES.SYSTEM,
  
  [ERROR_MESSAGES.PERMISSION_DENIED]: ERROR_CATEGORIES.PERMISSION,
  [ERROR_MESSAGES.PAPERLESS_AUTH_FAILED]: ERROR_CATEGORIES.PERMISSION,
  
  [ERROR_MESSAGES.UPLOAD_FAILED]: ERROR_CATEGORIES.FILE,
  [ERROR_MESSAGES.FILE_PROCESSING_FAILED]: ERROR_CATEGORIES.FILE,
  [ERROR_MESSAGES.DUPLICATE_FILE]: ERROR_CATEGORIES.FILE,
  [ERROR_MESSAGES.FILE_DELETE_FAILED]: ERROR_CATEGORIES.FILE,
  [ERROR_MESSAGES.FILE_DOWNLOAD_FAILED]: ERROR_CATEGORIES.FILE,
  [ERROR_MESSAGES.FILE_VIEW_FAILED]: ERROR_CATEGORIES.FILE,
  [ERROR_MESSAGES.FILE_NOT_FOUND]: ERROR_CATEGORIES.FILE,
  
  [ERROR_MESSAGES.PAPERLESS_UNAVAILABLE]: ERROR_CATEGORIES.PAPERLESS,
  [ERROR_MESSAGES.PAPERLESS_NOT_ENABLED]: ERROR_CATEGORIES.PAPERLESS,
  [ERROR_MESSAGES.PAPERLESS_CONFIG_INCOMPLETE]: ERROR_CATEGORIES.PAPERLESS,
  [ERROR_MESSAGES.PAPERLESS_UPLOAD_FAILED]: ERROR_CATEGORIES.PAPERLESS,
  [ERROR_MESSAGES.PAPERLESS_DUPLICATE_DOCUMENT]: ERROR_CATEGORIES.PAPERLESS,
  [ERROR_MESSAGES.PAPERLESS_TASK_FAILED]: ERROR_CATEGORIES.PAPERLESS,
  [ERROR_MESSAGES.PAPERLESS_TASK_TIMEOUT]: ERROR_CATEGORIES.PAPERLESS,
  
  [ERROR_MESSAGES.FORM_SUBMISSION_FAILED]: ERROR_CATEGORIES.FORM,
  [ERROR_MESSAGES.PATIENT_NOT_SELECTED]: ERROR_CATEGORIES.FORM,
  [ERROR_MESSAGES.ENTITY_NOT_FOUND]: ERROR_CATEGORIES.FORM,
};

// Success messages for consistency
export const SUCCESS_MESSAGES = {
  UPLOAD_SUCCESS: 'File uploaded successfully!',
  UPLOAD_MULTIPLE_SUCCESS: 'All files uploaded successfully!',
  FORM_SAVED: 'Form saved successfully!',
  FILE_DELETED: 'File deleted successfully.',
  PAPERLESS_SYNC_SUCCESS: 'Successfully synced with Paperless document management.',
  BATCH_UPLOAD_SUCCESS: 'All files uploaded successfully!',
};

// Warning messages
export const WARNING_MESSAGES = {
  PARTIAL_SUCCESS: 'Operation completed with some warnings.',
  SLOW_CONNECTION: 'Upload is taking longer than usual due to slow connection.',
  LARGE_FILE_WARNING: 'Large file detected. Upload may take several minutes.',
  DUPLICATE_WARNING: 'This file appears to be a duplicate.',
};

/**
 * Utility functions for error message handling
 */

/**
 * Get error category for a given error message
 * @param {string} errorMessage - The error message
 * @returns {string} The error category
 */
export const getErrorCategory = (errorMessage) => {
  return ERROR_TYPE_MAPPING[errorMessage] || ERROR_CATEGORIES.SYSTEM;
};

/**
 * Format error message with context
 * @param {string} baseMessage - The base error message
 * @param {string} context - Additional context (e.g., filename)
 * @returns {string} Formatted error message
 */
export const formatErrorWithContext = (baseMessage, context) => {
  if (!context) return baseMessage;
  
  // Add context to specific error types
  switch (baseMessage) {
    case ERROR_MESSAGES.UPLOAD_FAILED:
      return `Failed to upload "${context}". Please try again.`;
    case ERROR_MESSAGES.FILE_TOO_LARGE:
      return `File "${context}" exceeds the maximum size limit.`;
    case ERROR_MESSAGES.INVALID_FILE_TYPE:
      return `File type for "${context}" is not supported.`;
    case ERROR_MESSAGES.DUPLICATE_FILE:
      return `File "${context}" has already been uploaded.`;
    case ERROR_MESSAGES.FILE_PROCESSING_FAILED:
      return `Failed to process "${context}". Please try a different file.`;
    default:
      return baseMessage;
  }
};

/**
 * Enhanced error messages for Paperless integration
 * @param {string} originalError - The original error message
 * @returns {string} Enhanced error message
 */
export const enhancePaperlessError = (originalError) => {
  const lowerError = originalError.toLowerCase();
  
  if (lowerError.includes('not enabled')) {
    return ERROR_MESSAGES.PAPERLESS_NOT_ENABLED;
  }
  
  if (lowerError.includes('configuration is incomplete')) {
    return ERROR_MESSAGES.PAPERLESS_CONFIG_INCOMPLETE;
  }
  
  if (lowerError.includes('appears to be a duplicate') || 
      lowerError.includes('already exists') ||
      lowerError.includes('duplicate') ||
      lowerError.includes('hash collision') ||
      lowerError.includes('identical document')) {
    return ERROR_MESSAGES.PAPERLESS_DUPLICATE_DOCUMENT;
  }
  
  if (lowerError.includes('task') && lowerError.includes('timeout')) {
    return ERROR_MESSAGES.PAPERLESS_TASK_TIMEOUT;
  }
  
  if (lowerError.includes('task') && lowerError.includes('failed')) {
    return ERROR_MESSAGES.PAPERLESS_TASK_FAILED;
  }
  
  if (lowerError.includes('failed to upload to paperless') || 
      lowerError.includes('paperless upload failed')) {
    return ERROR_MESSAGES.PAPERLESS_UPLOAD_FAILED;
  }
  
  if (lowerError.includes('connection') || lowerError.includes('connect')) {
    return ERROR_MESSAGES.PAPERLESS_CONNECTION_FAILED;
  }
  
  if (lowerError.includes('authentication') || lowerError.includes('credentials')) {
    return ERROR_MESSAGES.PAPERLESS_AUTH_FAILED;
  }
  
  // If no specific match, return generic Paperless error
  return ERROR_MESSAGES.PAPERLESS_UNAVAILABLE;
};

/**
 * Extract error code from error object or infer from message
 * @param {Error|string} error - The error object or message
 * @returns {string|null} Error code or null if not found
 */
const extractErrorCode = (error) => {
  // Check if error object has error_code property
  if (error && typeof error === 'object' && error.error_code) {
    return error.error_code;
  }

  // Try to extract from message (e.g., "Message (Error: VAL)")
  const errorMessage = typeof error === 'string' ? error : error?.message || '';
  const codeMatch = errorMessage.match(/\(Error: ([A-Z0-9-]+)\)/);
  if (codeMatch) {
    return codeMatch[1];
  }

  return null;
};

/**
 * Get user-friendly error message from technical error
 * @param {Error|string} error - The error object or message
 * @param {string} operation - The operation that failed (e.g., 'upload', 'delete')
 * @returns {string} User-friendly error message with error code
 */
export const getUserFriendlyError = (error, operation = 'operation') => {
  const errorMessage = typeof error === 'string' ? error : error?.message || '';
  const lowerError = errorMessage.toLowerCase();

  // If message already has error code pattern, it's already been processed
  // Pattern: (Error: [A-Z]+-\d+) or (Error: [A-Z]+)
  if (/\(Error: [A-Z0-9-]+\)/.test(errorMessage)) {
    return errorMessage;
  }

  let friendlyMessage = '';
  let errorCode = extractErrorCode(error);

  // SIMPLE RULE: If error has field-level details (formatted by backend), keep it
  // Updated regex to handle single-letter fields, acronyms (ID, URL), and CamelCase
  if (/^[A-Z][^:]*:/.test(errorMessage)) {
    friendlyMessage = errorMessage;
    errorCode = errorCode || 'VAL-422'; // Validation errors use backend code
  }
  // Network-related errors
  else if (lowerError.includes('network') || lowerError.includes('connection')) {
    friendlyMessage = ERROR_MESSAGES.CONNECTION_ERROR;
    errorCode = errorCode || 'NET-503';
  }
  else if (lowerError.includes('timeout')) {
    friendlyMessage = ERROR_MESSAGES.TIMEOUT_ERROR;
    errorCode = errorCode || 'NET-504';
  }
  // File-related errors
  else if (lowerError.includes('file size') || lowerError.includes('too large')) {
    friendlyMessage = ERROR_MESSAGES.FILE_TOO_LARGE;
    errorCode = errorCode || 'FILE-413';
  }
  else if (lowerError.includes('file type') || lowerError.includes('not supported')) {
    friendlyMessage = ERROR_MESSAGES.INVALID_FILE_TYPE;
    errorCode = errorCode || 'FILE-400';
  }
  // Generic duplicate check (exclude Paperless-specific duplicates)
  else if (lowerError.includes('duplicate') && !lowerError.includes('paperless')) {
    friendlyMessage = ERROR_MESSAGES.DUPLICATE_FILE;
    errorCode = errorCode || 'FILE-409';
  }
  // Permission errors
  else if (lowerError.includes('permission') || lowerError.includes('unauthorized') || lowerError.includes('denied')) {
    friendlyMessage = ERROR_MESSAGES.PERMISSION_DENIED;
    errorCode = errorCode || 'PERM-403';
  }
  // Server errors
  else if (lowerError.includes('server error') || lowerError.includes('internal server')) {
    friendlyMessage = ERROR_MESSAGES.SERVER_ERROR;
    errorCode = errorCode || 'ISE-500';
  }
  // Paperless-specific errors
  else if (lowerError.includes('paperless')) {
    friendlyMessage = enhancePaperlessError(errorMessage);
    errorCode = errorCode || 'PAPER-503';
  }
  // Login errors (check BEFORE generic validation to avoid conflicts)
  else if (operation === 'login' &&
           (lowerError.includes('incorrect') ||
            lowerError.includes('invalid') ||
            lowerError.includes('login failed') ||
            lowerError.includes('401'))) {
    friendlyMessage = 'Incorrect credentials.';
    errorCode = errorCode || 'AUTH-401';
  }
  // Validation errors
  else if (lowerError.includes('validation') || lowerError.includes('invalid')) {
    friendlyMessage = ERROR_MESSAGES.VALIDATION_ERROR;
    errorCode = errorCode || 'VAL-422';
  }
  // Operation-specific fallbacks
  else {
    switch (operation) {
      case 'upload':
        friendlyMessage = ERROR_MESSAGES.UPLOAD_FAILED;
        errorCode = errorCode || 'FILE-500';
        break;
      case 'delete':
        friendlyMessage = ERROR_MESSAGES.FILE_DELETE_FAILED;
        errorCode = errorCode || 'FILE-500';
        break;
      case 'download':
        friendlyMessage = ERROR_MESSAGES.FILE_DOWNLOAD_FAILED;
        errorCode = errorCode || 'FILE-500';
        break;
      case 'view':
        friendlyMessage = ERROR_MESSAGES.FILE_VIEW_FAILED;
        errorCode = errorCode || 'FILE-500';
        break;
      case 'submit':
      case 'save':
        friendlyMessage = ERROR_MESSAGES.FORM_SUBMISSION_FAILED;
        errorCode = errorCode || 'FORM-400';
        break;
      case 'login':
        // Login-specific errors already handled before generic validation check
        friendlyMessage = ERROR_MESSAGES.UNKNOWN_ERROR;
        errorCode = errorCode || 'AUTH-500';
        break;
      default:
        friendlyMessage = ERROR_MESSAGES.UNKNOWN_ERROR;
        errorCode = errorCode || 'SYS-500';
    }
  }

  // Append error code if available
  if (errorCode) {
    return `${friendlyMessage} (Error: ${errorCode})`;
  }
  return friendlyMessage;
};

/**
 * Get appropriate icon name for error category
 * @param {string} category - Error category
 * @returns {string} Icon name for the category
 */
export const getErrorIcon = (category) => {
  switch (category) {
    case ERROR_CATEGORIES.NETWORK:
      return 'IconWifiOff';
    case ERROR_CATEGORIES.VALIDATION:
      return 'IconAlertTriangle';
    case ERROR_CATEGORIES.PERMISSION:
      return 'IconLock';
    case ERROR_CATEGORIES.FILE:
      return 'IconFile';
    case ERROR_CATEGORIES.PAPERLESS:
      return 'IconCloud';
    case ERROR_CATEGORIES.FORM:
      return 'IconForm';
    case ERROR_CATEGORIES.SYSTEM:
    default:
      return 'IconExclamationMark';
  }
};

export default {
  ERROR_MESSAGES,
  ERROR_CATEGORIES,
  ERROR_TYPE_MAPPING,
  SUCCESS_MESSAGES,
  WARNING_MESSAGES,
  getErrorCategory,
  formatErrorWithContext,
  enhancePaperlessError,
  getUserFriendlyError,
  getErrorIcon,
};