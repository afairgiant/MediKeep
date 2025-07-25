/**
 * Network Error Mappings
 * Contains all error patterns and configurations specific to network/connectivity issues
 */

export const networkErrors = {
    // Connection Errors
    'network error': {
        title: 'Connection Error',
        message: 'Unable to connect to the server. Please check your internet connection.',
        color: 'red',
        icon: 'network-error',
        suggestions: [
            'Check your internet connection',
            'Try refreshing the page',
            'Wait a moment and try again',
            'Contact support if the problem persists'
        ],
        severity: 'high',
        domain: 'network'
    },

    'failed to fetch': {
        title: 'Connection Failed',
        message: 'Could not reach the server. Please check your connection.',
        color: 'red',
        icon: 'wifi-off',
        suggestions: [
            'Check your internet connection',
            'Try again in a few moments',
            'Refresh the page',
            'Contact your network administrator if on a corporate network'
        ],
        severity: 'high',
        domain: 'network'
    },

    'timeout': {
        title: 'Request Timeout',
        message: 'The request took too long to complete.',
        color: 'orange',
        icon: 'timeout',
        suggestions: [
            'Your internet connection may be slow',
            'Try again in a moment',
            'Check if you\'re sharing many items at once',
            'Contact support if timeouts persist'
        ],
        severity: 'medium',
        domain: 'network'
    },

    'server error': {
        title: 'Server Error',
        message: 'The server encountered an error while processing your request.',
        color: 'red',
        icon: 'server-off',
        suggestions: [
            'Try again in a few minutes',
            'The issue is likely temporary',
            'Contact support if the problem persists',
            'Check our status page for ongoing issues'
        ],
        severity: 'high',
        domain: 'network'
    },

    'service unavailable': {
        title: 'Service Unavailable',
        message: 'The service is temporarily unavailable. Please try again later.',
        color: 'orange',
        icon: 'cloud-off',
        suggestions: [
            'The service may be undergoing maintenance',
            'Try again in a few minutes',
            'Check our status page for updates',
            'Contact support if the issue persists'
        ],
        severity: 'medium',
        domain: 'network'
    },

    // HTTP Status Code Errors
    '400': {
        title: 'Bad Request',
        message: 'There was an error with your request. Please check your input.',
        color: 'orange',
        icon: 'validation-error',
        suggestions: [
            'Check that all required fields are filled',
            'Ensure your input follows the correct format',
            'Try refreshing the page and submitting again'
        ],
        severity: 'medium',
        domain: 'network'
    },

    '401': {
        title: 'Authentication Required',
        message: 'You need to log in to access this resource.',
        color: 'orange',
        icon: 'unauthorized',
        suggestions: [
            'Log in again to continue',
            'Your session may have expired'
        ],
        severity: 'medium',
        domain: 'network'
    },

    '403': {
        title: 'Access Forbidden',
        message: 'You don\'t have permission to access this resource.',
        color: 'red',
        icon: 'permission-denied',
        suggestions: [
            'Contact an administrator for access',
            'Make sure you\'re logged into the correct account',
            'This resource may require special permissions'
        ],
        severity: 'high',
        domain: 'network'
    },

    '404': {
        title: 'Not Found',
        message: 'The requested resource could not be found.',
        color: 'orange',
        icon: 'alert-circle',
        suggestions: [
            'Check that the URL is correct',
            'The resource may have been moved or deleted',
            'Try going back and accessing it again'
        ],
        severity: 'medium',
        domain: 'network'
    },

    '429': {
        title: 'Too Many Requests',
        message: 'You\'ve made too many requests. Please wait before trying again.',
        color: 'orange',
        icon: 'clock',
        suggestions: [
            'Wait a few minutes before trying again',
            'Avoid making requests too quickly',
            'Contact support if you need higher rate limits'
        ],
        severity: 'medium',
        domain: 'network'
    },

    '500': {
        title: 'Server Error',
        message: 'An internal server error occurred. This is not your fault.',
        color: 'red',
        icon: 'server-off',
        suggestions: [
            'Try again in a few minutes',
            'The development team has been notified',
            'Contact support if the problem persists'
        ],
        severity: 'high',
        domain: 'network'
    },

    '502': {
        title: 'Bad Gateway',
        message: 'The server is temporarily unable to handle your request.',
        color: 'red',
        icon: 'server-off',
        suggestions: [
            'Try again in a few minutes',
            'This is usually a temporary issue',
            'Contact support if the problem persists'
        ],
        severity: 'high',
        domain: 'network'
    },

    '503': {
        title: 'Service Unavailable',
        message: 'The service is temporarily unavailable, likely due to maintenance.',
        color: 'orange',
        icon: 'cloud-off',
        suggestions: [
            'The service may be undergoing maintenance',
            'Try again in a few minutes',
            'Check our status page for updates'
        ],
        severity: 'medium',
        domain: 'network'
    }
};