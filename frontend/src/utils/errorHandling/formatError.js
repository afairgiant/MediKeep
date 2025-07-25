/**
 * Error formatting utilities
 * Converts raw errors into user-friendly display formats
 */

import { parseErrorMessage, parseHttpError } from './parsers';
import { getErrorMapping } from './errorMappings';

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
    if (parsed.type === 'bulk_already_shared') {
        return formatBulkAlreadySharedError(parsed, context);
    }

    // Handle HTTP status codes
    if (parsed.type === 'http_status') {
        return formatHttpStatusError(parsed);
    }

    // Handle network errors
    if (parsed.type === 'network_error') {
        return getErrorMapping('network error') || createGenericErrorFormat(errorMessage);
    }

    // Handle timeout errors
    if (parsed.type === 'timeout_error') {
        return getErrorMapping('timeout') || createGenericErrorFormat(errorMessage);
    }

    // Try to find a mapped error configuration
    const mappedError = findMappedError(errorMessage);
    if (mappedError) {
        return {
            ...mappedError,
            type: 'mapped_error',
            originalMessage: errorMessage
        };
    }

    // Fallback to generic error format
    return createGenericErrorFormat(errorMessage);
};

/**
 * Format bulk already shared errors with specific family member names
 * @param {Object} parsed - Parsed error information
 * @param {Object} context - Additional context
 * @returns {Object} Formatted error
 */
const formatBulkAlreadySharedError = (parsed, context) => {
    const { names, count } = parsed;
    let message;
    
    if (count === 1) {
        message = `${names[0]} is already shared with this user.`;
    } else if (count === 2) {
        message = `${names[0]} and ${names[1]} are already shared with this user.`;
    } else {
        const lastPerson = names[names.length - 1];
        const otherNames = names.slice(0, -1);
        message = `${otherNames.join(', ')}, and ${lastPerson} are already shared with this user.`;
    }
    
    return {
        title: count > 2 ? 'Multiple Already Shared' : 'Already Shared',
        message,
        color: 'orange',
        icon: 'sharing-error',
        suggestions: [
            'Choose a different recipient',
            'Remove the already-shared family members from your selection',
            'Check the "Currently Shared With" section for details'
        ],
        severity: 'low',
        type: 'bulk_already_shared',
        names,
        count,
        domain: 'sharing'
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
        color: 'red',
        icon: 'server-off',
        suggestions: [
            'Try again in a few minutes',
            'Contact support if the problem persists'
        ],
        severity: 'high',
        type: 'http_status',
        statusCode: parsed.statusCode,
        domain: 'network'
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
        color: 'red',
        icon: 'alert-circle',
        suggestions: [
            'Please try again',
            'Refresh the page if the problem persists',
            'Contact support if you continue to experience issues'
        ],
        severity: 'medium',
        type: 'generic',
        domain: 'general'
    };
};

/**
 * Get notification auto-close time based on error severity
 * @param {string} severity - Error severity level
 * @returns {number|false} Auto-close time in ms, or false for no auto-close
 */
export const getNotificationAutoClose = (severity) => {
    switch (severity) {
        case 'low':
            return 4000; // 4 seconds
        case 'medium':
            return 6000; // 6 seconds
        case 'high':
            return 10000; // 10 seconds
        default:
            return 5000; // 5 seconds
    }
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