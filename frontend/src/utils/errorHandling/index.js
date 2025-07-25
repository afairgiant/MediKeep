/**
 * Centralized Error Handling System
 * 
 * A modular, scalable error handling system for the entire application.
 * 
 * Usage:
 * import { useErrorHandler } from '@/utils/errorHandling';
 * 
 * const { handleError, clearError, currentError } = useErrorHandler('ComponentName');
 * 
 * try {
 *   await apiCall();
 * } catch (error) {
 *   handleError(error);
 * }
 */

// Re-export everything from the main modules
export { useErrorHandler } from './useErrorHandler';
export { useErrorQueue } from './useErrorQueue'; // New error queue system (addresses reviewer feedback)
export { ErrorBoundary } from './ErrorBoundary';
export { formatError } from './formatError';
export { ErrorAlert, CompactErrorAlert, ErrorQueueAlert } from './ErrorAlert';
export { errorMappings } from './errorMappings';

// Core error handling utilities
export { parseErrorMessage } from './parsers';
export { getErrorConfig } from './config';
export { ErrorIcon } from './ErrorIcon';

// Constants (addresses reviewer feedback about magic strings)
export { 
    ERROR_SEVERITY, 
    ERROR_TYPES, 
    ERROR_DOMAINS, 
    ERROR_COLORS, 
    ERROR_ICONS,
    ERROR_PATTERNS,
    NOTIFICATION_DURATIONS,
    ERROR_QUEUE_CONFIG
} from './constants';