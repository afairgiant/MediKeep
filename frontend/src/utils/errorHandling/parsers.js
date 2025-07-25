/**
 * Error parsing utilities
 * Extracts meaningful information from raw error messages
 */

/**
 * Enhanced error parser that extracts specific error information
 * @param {string} errorMessage - Raw error message from API
 * @returns {Object|null} Parsed error information
 */
export const parseErrorMessage = (errorMessage) => {
    if (!errorMessage || typeof errorMessage !== 'string') {
        return null;
    }

    const lowerMessage = errorMessage.toLowerCase();
    
    // Check for "already shared for: [names]" pattern (bulk errors)
    if (lowerMessage.includes('family history already shared for:')) {
        const namesMatch = errorMessage.match(/family history already shared for:\s*(.+)$/i);
        if (namesMatch) {
            const names = namesMatch[1].split(',').map(name => name.trim());
            return {
                type: 'bulk_already_shared',
                names,
                count: names.length,
                originalMessage: errorMessage
            };
        }
    }

    // Check for HTTP status codes
    const statusMatch = errorMessage.match(/(\d{3})/);
    if (statusMatch) {
        const statusCode = statusMatch[1];
        return {
            type: 'http_status',
            statusCode,
            originalMessage: errorMessage
        };
    }

    // Check for network-specific patterns
    if (lowerMessage.includes('network error') || lowerMessage.includes('failed to fetch')) {
        return {
            type: 'network_error',
            originalMessage: errorMessage
        };
    }

    if (lowerMessage.includes('timeout')) {
        return {
            type: 'timeout_error',
            originalMessage: errorMessage
        };
    }

    // Return parsed info for further processing
    return {
        type: 'unknown',
        originalMessage: errorMessage
    };
};

/**
 * Parse HTTP error responses
 * @param {Object} error - Error object from API call
 * @returns {string} Extracted error message
 */
export const parseHttpError = (error) => {
    // Handle different error response structures
    if (error.response) {
        // Server responded with error status
        return error.response.data?.detail || 
               error.response.data?.message || 
               error.response.data?.error ||
               `HTTP ${error.response.status}: ${error.response.statusText}`;
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
export const parseValidationErrors = (error) => {
    if (error.response?.data?.validation_errors) {
        return error.response.data.validation_errors;
    }
    
    if (error.response?.data?.errors && typeof error.response.data.errors === 'object') {
        return error.response.data.errors;
    }
    
    return null;
};

/**
 * Check if error is a specific type
 * @param {string} errorMessage - Error message to check
 * @param {string} type - Type to check for
 * @returns {boolean} Whether error matches type
 */
export const isErrorType = (errorMessage, type) => {
    const lowerMessage = errorMessage.toLowerCase();
    const lowerType = type.toLowerCase();
    
    switch (lowerType) {
        case 'network':
            return lowerMessage.includes('network') || 
                   lowerMessage.includes('failed to fetch') ||
                   lowerMessage.includes('connection');
        case 'timeout':
            return lowerMessage.includes('timeout');
        case 'auth':
            return lowerMessage.includes('unauthorized') ||
                   lowerMessage.includes('authentication') ||
                   lowerMessage.includes('login');
        case 'validation':
            return lowerMessage.includes('validation') ||
                   lowerMessage.includes('invalid') ||
                   lowerMessage.includes('required');
        case 'permission':
            return lowerMessage.includes('permission') ||
                   lowerMessage.includes('access denied') ||
                   lowerMessage.includes('forbidden');
        case 'sharing':
            return lowerMessage.includes('already shared') ||
                   lowerMessage.includes('invitation') ||
                   lowerMessage.includes('share');
        default:
            return false;
    }
};