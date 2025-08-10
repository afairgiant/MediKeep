/**
 * Error formatting utilities
 * Converts raw errors into user-friendly display formats
 * Updated to address reviewer feedback about using constants instead of magic strings
 */

import { parseErrorMessage, parseHttpError } from './parsers';
import { getErrorMapping } from './errorMappings';
import { 
    ERROR_TYPES, 
    ERROR_SEVERITY, 
    ERROR_COLORS, 
    ERROR_ICONS, 
    ERROR_DOMAINS,
    NOTIFICATION_DURATIONS 
} from './constants';

/**
 * Formats user-friendly error messages for display
 * @param {string|Error} error - Raw error message or Error object
 * @param {Object} context - Additional context (bulkMode, component, etc.)
 * @returns {Object} Formatted error for display
 */
export const formatError = (error, context = {}) => {
    // Extract error message from different error types
    let errorMessage;
    if (typeof error === 'string') {
        errorMessage = error;
    } else if (error instanceof Error) {
        errorMessage = parseHttpError(error);
    } else if (error?.message) {
        errorMessage = error.message;
    } else {
        errorMessage = 'An unknown error occurred';
    }

    // Parse the error message for specific patterns
    const parsed = parseErrorMessage(errorMessage);
    
    if (!parsed) {
        return createGenericErrorFormat(errorMessage);
    }

    // Handle bulk already shared errors with custom formatting
    if (parsed.type === ERROR_TYPES.BULK_ALREADY_SHARED) {
        return formatBulkAlreadySharedError(parsed, context);
    }

    // Handle HTTP status codes
    if (parsed.type === ERROR_TYPES.HTTP_STATUS) {
        return formatHttpStatusError(parsed);
    }

    // Handle network errors
    if (parsed.type === ERROR_TYPES.NETWORK_ERROR) {
        return getErrorMapping('network error') || createGenericErrorFormat(errorMessage);
    }

    // Handle timeout errors
    if (parsed.type === ERROR_TYPES.TIMEOUT_ERROR) {
        return getErrorMapping('timeout') || createGenericErrorFormat(errorMessage);
    }

    // Try to find a mapped error configuration
    const mappedError = findMappedError(errorMessage);
    if (mappedError) {
        return {
            ...mappedError,
            type: ERROR_TYPES.MAPPED_ERROR,
            originalMessage: errorMessage
        };
    }

    // Fallback to generic error format
    return createGenericErrorFormat(errorMessage);
};

/**
 * Formats a list of names into a grammatically correct string
 * @param {string[]} names - Array of names to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted name list
 */
const formatNameList = (names, options = {}) => {
    const { 
        conjunction = 'and',
        finalConjunction = null, // Use different conjunction for final item (e.g., "and" vs "or")
    } = options;
    
    if (!names || names.length === 0) {
        return '';
    }
    
    if (names.length === 1) {
        return names[0];
    }
    
    if (names.length === 2) {
        return `${names[0]} ${conjunction} ${names[1]}`;
    }
    
    // For 3 or more names: "Name1, Name2, Name3, and Name4"
    const lastPerson = names[names.length - 1];
    const otherNames = names.slice(0, -1);
    const finalConj = finalConjunction || conjunction;
    
    return `${otherNames.join(', ')}, ${finalConj} ${lastPerson}`;
};

/**
 * Creates a formatted message using a name list template
 * @param {string[]} names - Array of names 
 * @param {string} template - Message template with {nameList} placeholder
 * @param {Object} options - Formatting options
 * @returns {string} Formatted message
 */
const formatListMessage = (names, template, options = {}) => {
    const nameList = formatNameList(names, options);
    return template.replace('{nameList}', nameList);
};

/**
 * Format bulk already shared errors with specific family member names
 * @param {Object} parsed - Parsed error information
 * @param {Object} context - Additional context
 * @returns {Object} Formatted error
 */
const formatBulkAlreadySharedError = (parsed, context) => {
    const { names, count } = parsed;
    
    // Use the reusable formatter to create the message
    const message = formatListMessage(
        names,
        count === 1 
            ? '{nameList} is already shared with this user.'
            : '{nameList} are already shared with this user.'
    );
    
    return {
        title: count > 1 ? 'Multiple Already Shared' : 'Already Shared',
        message,
        color: ERROR_COLORS.ORANGE,
        icon: ERROR_ICONS.SHARING_ERROR,
        suggestions: [
            'Choose a different recipient',
            'Remove the already-shared family members from your selection',
            'Check the "Currently Shared With" section for details'
        ],
        severity: ERROR_SEVERITY.LOW,
        type: ERROR_TYPES.BULK_ALREADY_SHARED,
        names,
        count,
        domain: ERROR_DOMAINS.SHARING
    };
};

/**
 * Format HTTP status code errors
 * @param {Object} parsed - Parsed error information
 * @returns {Object} Formatted error
 */
const formatHttpStatusError = (parsed) => {
    const statusMapping = getErrorMapping(parsed.statusCode);
    if (statusMapping) {
        return {
            ...statusMapping,
            type: 'http_status',
            statusCode: parsed.statusCode,
            originalMessage: parsed.originalMessage
        };
    }
    
    // Generic HTTP error format
    return {
        title: `HTTP ${parsed.statusCode} Error`,
        message: `Server returned status code ${parsed.statusCode}`,
        color: ERROR_COLORS.RED,
        icon: ERROR_ICONS.SERVER_OFF,
        suggestions: [
            'Try again in a few minutes',
            'Contact support if the problem persists'
        ],
        severity: ERROR_SEVERITY.HIGH,
        type: ERROR_TYPES.HTTP_STATUS,
        statusCode: parsed.statusCode,
        domain: ERROR_DOMAINS.NETWORK
    };
};

/**
 * Find mapped error configuration by checking all error patterns
 * @param {string} errorMessage - Error message to match
 * @returns {Object|null} Error configuration or null
 */
const findMappedError = (errorMessage) => {
    const lowerMessage = errorMessage.toLowerCase();
    
    // Try to find exact or partial matches
    return getErrorMapping(lowerMessage);
};

/**
 * Create generic error format for unmapped errors
 * @param {string} errorMessage - Original error message
 * @returns {Object} Generic error format
 */
const createGenericErrorFormat = (errorMessage) => {
    return {
        title: 'Error',
        message: errorMessage,
        color: ERROR_COLORS.RED,
        icon: ERROR_ICONS.ALERT_CIRCLE,
        suggestions: [
            'Please try again',
            'Refresh the page if the problem persists',
            'Contact support if you continue to experience issues'
        ],
        severity: ERROR_SEVERITY.MEDIUM,
        type: ERROR_TYPES.GENERIC,
        domain: ERROR_DOMAINS.GENERAL
    };
};

/**
 * Get notification auto-close time based on error severity
 * Updated to use constants as suggested by reviewer
 * @param {string} severity - Error severity level
 * @returns {number|false} Auto-close time in ms, or false for no auto-close
 */
export const getNotificationAutoClose = (severity) => {
    return NOTIFICATION_DURATIONS[severity] || NOTIFICATION_DURATIONS.DEFAULT;
};

/**
 * Format error for specific contexts (form validation, API calls, etc.)
 * @param {string|Error} error - Error to format
 * @param {string} context - Context type ('form', 'api', 'network', etc.)
 * @param {Object} additionalContext - Additional context data
 * @returns {Object} Context-specific formatted error
 */
export const formatErrorForContext = (error, context, additionalContext = {}) => {
    const baseFormat = formatError(error, additionalContext);
    
    // Enhance formatting based on context
    switch (context) {
        case 'form':
            return {
                ...baseFormat,
                showInline: true,
                focusField: additionalContext.fieldName
            };
        case 'api':
            return {
                ...baseFormat,
                showNotification: true,
                logError: true
            };
        case 'network':
            return {
                ...baseFormat,
                retryable: true,
                showRetryButton: true
            };
        default:
            return baseFormat;
    }
};

/**
 * Utility functions for formatting lists and messages (exported for reuse)
 */
export { formatNameList, formatListMessage };