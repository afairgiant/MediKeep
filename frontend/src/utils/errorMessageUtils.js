/**
 * Error Message Utilities for Common Patterns
 * 
 * This file provides utility functions for common error handling patterns
 * used throughout the application, particularly for upload and form systems.
 */

import { 
  ERROR_MESSAGES, 
  SUCCESS_MESSAGES, 
  WARNING_MESSAGES,
  getUserFriendlyError,
  formatErrorWithContext,
  enhancePaperlessError,
  getErrorCategory
} from '../constants/errorMessages';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconExclamationMark, IconAlertTriangle } from '@tabler/icons-react';
import logger from '../services/logger';

/**
 * Show a standardized error notification
 * @param {string|Error} error - The error message or error object
 * @param {string} operation - The operation that failed (e.g., 'upload', 'save')
 * @param {Object} options - Additional options
 * @param {string} options.title - Custom title for the notification
 * @param {string} options.context - Additional context (e.g., filename)
 * @param {number} options.autoClose - Auto close time in ms
 * @param {boolean} options.withCloseButton - Whether to show close button
 */
export const showErrorNotification = (error, operation = 'operation', options = {}) => {
  const {
    title,
    context,
    autoClose = 7000,
    withCloseButton = true
  } = options;

  let errorMessage = getUserFriendlyError(error, operation);
  
  if (context) {
    errorMessage = formatErrorWithContext(errorMessage, context);
  }

  const defaultTitle = operation === 'upload' ? 'Upload Failed' :
                       operation === 'save' ? 'Save Failed' :
                       operation === 'delete' ? 'Delete Failed' :
                       operation === 'download' ? 'Download Failed' :
                       'Operation Failed';

  notifications.show({
    title: title || defaultTitle,
    message: errorMessage,
    color: 'red',
    icon: <IconX size={16} />,
    autoClose,
    withCloseButton,
  });
};

/**
 * Show a standardized success notification
 * @param {string} message - The success message
 * @param {Object} options - Additional options
 * @param {string} options.title - Custom title for the notification
 * @param {string} options.context - Additional context (e.g., filename)
 * @param {number} options.autoClose - Auto close time in ms
 */
export const showSuccessNotification = (message, options = {}) => {
  const {
    title = 'Success!',
    context,
    autoClose = 5000
  } = options;

  let finalMessage = message;
  
  if (context && message === SUCCESS_MESSAGES.UPLOAD_SUCCESS) {
    finalMessage = `"${context}" uploaded successfully!`;
  }

  notifications.show({
    title,
    message: finalMessage,
    color: 'green',
    icon: <IconCheck size={16} />,
    autoClose,
  });
};

/**
 * Show a standardized warning notification
 * @param {string} message - The warning message
 * @param {Object} options - Additional options
 */
export const showWarningNotification = (message, options = {}) => {
  const {
    title = 'Warning',
    autoClose = 7000
  } = options;

  notifications.show({
    title,
    message,
    color: 'orange',
    icon: <IconExclamationMark size={16} />,
    autoClose,
  });
};

/**
 * Handle upload completion with appropriate notifications
 * @param {boolean} success - Whether the upload was successful
 * @param {number} completedCount - Number of files that completed successfully
 * @param {number} failedCount - Number of files that failed
 * @param {number} totalCount - Total number of files
 */
export const handleUploadCompletion = (success, completedCount, failedCount, totalCount) => {
  if (success && failedCount === 0) {
    // Complete success
    const message = totalCount === 1 ? 
      SUCCESS_MESSAGES.UPLOAD_SUCCESS : 
      SUCCESS_MESSAGES.UPLOAD_MULTIPLE_SUCCESS;
    
    showSuccessNotification(message);
  } else if (completedCount > 0 && failedCount > 0) {
    // Partial success
    showWarningNotification(
      `${completedCount}/${totalCount} files uploaded successfully. ${failedCount} failed.`,
      { title: 'Upload Completed with Errors' }
    );
  } else {
    // Complete failure
    showErrorNotification(
      ERROR_MESSAGES.ALL_UPLOADS_FAILED,
      'upload',
      { title: 'Upload Failed' }
    );
  }
};

/**
 * Handle form validation errors
 * @param {Object} formData - The form data to validate
 * @param {Array} requiredFields - Array of required field names
 * @param {Function} setError - Error setter function
 * @returns {boolean} True if validation passes, false otherwise
 */
export const validateRequiredFields = (formData, requiredFields, setError) => {
  for (const field of requiredFields) {
    if (!formData[field] || (typeof formData[field] === 'string' && !formData[field].trim())) {
      setError(ERROR_MESSAGES.REQUIRED_FIELD_MISSING);
      return false;
    }
  }
  return true;
};

/**
 * Handle patient selection validation
 * @param {Object} currentPatient - The current patient object
 * @param {Function} setError - Error setter function
 * @returns {boolean} True if patient is selected, false otherwise
 */
export const validatePatientSelection = (currentPatient, setError) => {
  if (!currentPatient?.id) {
    setError(ERROR_MESSAGES.PATIENT_NOT_SELECTED);
    return false;
  }
  return true;
};

/**
 * Handle date validation
 * @param {string} dateValue - The date value to validate
 * @param {Function} setError - Error setter function
 * @param {string} fieldName - Name of the field for context
 * @returns {boolean} True if date is valid, false otherwise
 */
export const validateDate = (dateValue, setError, fieldName = 'date') => {
  if (!dateValue) {
    setError(ERROR_MESSAGES.INVALID_DATE);
    return false;
  }
  
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) {
    setError(ERROR_MESSAGES.INVALID_DATE);
    return false;
  }
  
  return true;
};

/**
 * Handle email validation
 * @param {string} email - The email to validate
 * @param {Function} setError - Error setter function
 * @returns {boolean} True if email is valid, false otherwise
 */
export const validateEmail = (email, setError) => {
  if (!email) return true; // Email might be optional
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    setError(ERROR_MESSAGES.INVALID_EMAIL);
    return false;
  }
  
  return true;
};

/**
 * Handle phone validation
 * @param {string} phone - The phone number to validate
 * @param {Function} setError - Error setter function
 * @returns {boolean} True if phone is valid, false otherwise
 */
export const validatePhone = (phone, setError) => {
  if (!phone) return true; // Phone might be optional
  
  // Basic phone validation - digits, spaces, dashes, parentheses
  const phoneRegex = /^[\d\s\-\(\)\+\.]+$/;
  if (!phoneRegex.test(phone) || phone.replace(/\D/g, '').length < 10) {
    setError(ERROR_MESSAGES.INVALID_PHONE);
    return false;
  }
  
  return true;
};

/**
 * Log and handle errors with context
 * @param {Error|string} error - The error to log and handle
 * @param {Object} context - Additional context for logging
 * @param {string} context.operation - The operation that failed
 * @param {string} context.component - The component where the error occurred
 * @param {string} context.entityType - The type of entity involved
 * @param {string} context.entityId - The ID of the entity involved
 */
export const logAndHandleError = (error, context = {}) => {
  const {
    operation = 'operation',
    component = 'Unknown',
    entityType,
    entityId,
    ...additionalContext
  } = context;

  const errorMessage = error?.message || error || 'Unknown error';
  const userFriendlyMessage = getUserFriendlyError(error, operation);

  logger.error(`${component.toLowerCase()}_${operation}_error`, {
    message: `${operation} failed in ${component}`,
    error: errorMessage,
    userFriendlyError: userFriendlyMessage,
    entityType,
    entityId,
    component,
    ...additionalContext,
  });

  return userFriendlyMessage;
};

/**
 * Handle file upload errors with specific context
 * @param {Error} error - The upload error
 * @param {string} fileName - Name of the file that failed
 * @param {string} storageBackend - The storage backend used
 * @param {Object} options - Additional options
 */
export const handleFileUploadError = (error, fileName, storageBackend = 'local', options = {}) => {
  let errorMessage;

  if (storageBackend === 'paperless') {
    errorMessage = enhancePaperlessError(error?.message || '');
  } else {
    errorMessage = getUserFriendlyError(error, 'upload');
  }

  // Add file context
  errorMessage = formatErrorWithContext(errorMessage, fileName);

  // Log the error
  logAndHandleError(error, {
    operation: 'upload',
    component: options.component || 'FileUpload',
    fileName,
    storageBackend,
    ...options.context
  });

  // Show notification unless disabled
  if (!options.skipNotification) {
    showErrorNotification(errorMessage, 'upload', {
      title: 'File Upload Failed',
      ...options.notificationOptions
    });
  }

  return errorMessage;
};

/**
 * Handle batch operation results
 * @param {Array} results - Array of operation results
 * @param {string} operation - The operation performed
 * @param {Object} options - Additional options
 */
export const handleBatchResults = (results, operation = 'operation', options = {}) => {
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;

  if (failed === 0) {
    // All successful
    const message = total === 1 ? 
      `${operation} completed successfully!` :
      `All ${total} ${operation}s completed successfully!`;
    
    showSuccessNotification(message, options.successOptions);
  } else if (successful > 0) {
    // Partial success
    showWarningNotification(
      `${successful}/${total} ${operation}s completed successfully. ${failed} failed.`,
      { 
        title: `${operation} Completed with Errors`,
        ...options.warningOptions 
      }
    );
  } else {
    // All failed
    showErrorNotification(
      `All ${operation}s failed. Please try again.`,
      operation,
      { 
        title: `${operation} Failed`,
        ...options.errorOptions 
      }
    );
  }

  return { successful, failed, total };
};

/**
 * Check if a Paperless task result indicates a duplicate document error
 * @param {Object} taskResult - The task result from Paperless
 * @returns {boolean} True if the error indicates a duplicate document
 */
export const isDuplicateDocumentError = (taskResult) => {
  if (!taskResult?.error && !taskResult?.result?.error) return false;
  
  const errorMessage = (taskResult.error || taskResult.result?.error || '').toLowerCase();
  
  return errorMessage.includes('already exists') || 
         errorMessage.includes('duplicate') ||
         errorMessage.includes('hash collision') ||
         errorMessage.includes('identical document') ||
         errorMessage.includes('same content hash') ||
         errorMessage.includes('document with identical content');
};

/**
 * Check if a Paperless task result indicates the task failed
 * @param {Object} taskResult - The task result from Paperless
 * @returns {boolean} True if the task failed
 */
export const isPaperlessTaskFailed = (taskResult) => {
  return taskResult?.status === 'FAILURE' || taskResult?.status === 'RETRY';
};

/**
 * Check if a Paperless task result indicates the task succeeded
 * @param {Object} taskResult - The task result from Paperless
 * @returns {boolean} True if the task succeeded and has a document ID
 */
export const isPaperlessTaskSuccessful = (taskResult) => {
  return taskResult?.status === 'SUCCESS' && 
         (taskResult?.result?.document_id || taskResult?.document_id);
};

/**
 * Extract document ID from successful Paperless task result
 * @param {Object} taskResult - The task result from Paperless
 * @returns {string|null} Document ID if available, null otherwise
 */
export const extractDocumentIdFromTaskResult = (taskResult) => {
  if (!isPaperlessTaskSuccessful(taskResult)) return null;
  
  return taskResult?.result?.document_id || taskResult?.document_id || null;
};

/**
 * Get user-friendly error message from Paperless task result
 * @param {Object} taskResult - The task result from Paperless
 * @param {string} fileName - Name of the file for context
 * @returns {string} User-friendly error message
 */
export const getPaperlessTaskErrorMessage = (taskResult, fileName) => {
  if (isDuplicateDocumentError(taskResult)) {
    return formatErrorWithContext(ERROR_MESSAGES.PAPERLESS_DUPLICATE_DOCUMENT, fileName);
  }
  
  if (isPaperlessTaskFailed(taskResult)) {
    return formatErrorWithContext(ERROR_MESSAGES.PAPERLESS_TASK_FAILED, fileName);
  }
  
  return formatErrorWithContext(ERROR_MESSAGES.PAPERLESS_UPLOAD_FAILED, fileName);
};

/**
 * Handle Paperless task completion with appropriate notifications
 * @param {Object} taskResult - The task result from Paperless
 * @param {string} fileName - Name of the file for context
 * @param {Object} options - Additional options
 * @returns {Object} Result object with success status and message
 */
export const handlePaperlessTaskCompletion = (taskResult, fileName, options = {}) => {
  if (isPaperlessTaskSuccessful(taskResult)) {
    const documentId = extractDocumentIdFromTaskResult(taskResult);
    const message = `"${fileName}" uploaded to Paperless successfully!`;
    
    if (!options.skipNotification) {
      showSuccessNotification(message, {
        title: 'Document Added to Paperless',
        ...options.notificationOptions
      });
    }
    
    return {
      success: true,
      message,
      documentId,
      isDuplicate: false
    };
  }
  
  if (isDuplicateDocumentError(taskResult)) {
    const message = getPaperlessTaskErrorMessage(taskResult, fileName);
    
    if (!options.skipNotification) {
      showWarningNotification(message, {
        title: 'Duplicate Document',
        ...options.notificationOptions
      });
    }
    
    return {
      success: false,
      message,
      documentId: null,
      isDuplicate: true
    };
  }
  
  // Task failed for other reasons
  const message = getPaperlessTaskErrorMessage(taskResult, fileName);
  
  if (!options.skipNotification) {
    showErrorNotification(message, 'upload', {
      title: 'Paperless Upload Failed',
      ...options.notificationOptions
    });
  }
  
  return {
    success: false,
    message,
    documentId: null,
    isDuplicate: false
  };
};

/**
 * Create a standardized error handler for async operations
 * @param {string} operation - The operation being performed
 * @param {Object} context - Context for error logging
 * @returns {Function} Error handler function
 */
export const createErrorHandler = (operation, context = {}) => {
  return (error) => {
    const errorMessage = logAndHandleError(error, {
      operation,
      ...context
    });

    showErrorNotification(error, operation, {
      title: `${operation.charAt(0).toUpperCase() + operation.slice(1)} Failed`
    });

    return errorMessage;
  };
};

export default {
  showErrorNotification,
  showSuccessNotification,
  showWarningNotification,
  handleUploadCompletion,
  validateRequiredFields,
  validatePatientSelection,
  validateDate,
  validateEmail,
  validatePhone,
  logAndHandleError,
  handleFileUploadError,
  handleBatchResults,
  createErrorHandler,
  isDuplicateDocumentError,
  isPaperlessTaskFailed,
  isPaperlessTaskSuccessful,
  extractDocumentIdFromTaskResult,
  getPaperlessTaskErrorMessage,
  handlePaperlessTaskCompletion,
};