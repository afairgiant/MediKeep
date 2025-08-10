/**
 * General Error Mappings
 * Contains common error patterns that don't fit into specific domains
 */

export const generalErrors = {
    // Generic Operation Errors
    'operation failed': {
        title: 'Operation Failed',
        message: 'The requested operation could not be completed.',
        color: 'red',
        icon: 'alert-circle',
        suggestions: [
            'Please try again',
            'Refresh the page if the problem persists',
            'Contact support if you continue to experience issues'
        ],
        severity: 'medium',
        domain: 'general'
    },

    'something went wrong': {
        title: 'Something Went Wrong',
        message: 'An unexpected error occurred. Please try again.',
        color: 'red',
        icon: 'alert-circle',
        suggestions: [
            'Try refreshing the page',
            'Wait a moment and try again',
            'Contact support if the problem continues'
        ],
        severity: 'medium',
        domain: 'general'
    },

    'unexpected error': {
        title: 'Unexpected Error',
        message: 'An unexpected error occurred while processing your request.',
        color: 'red',
        icon: 'exclamation-circle',
        suggestions: [
            'This error has been logged for investigation',
            'Try again in a few minutes',
            'Contact support with details of what you were doing'
        ],
        severity: 'high',
        domain: 'general'
    },

    // Resource Errors
    'resource not found': {
        title: 'Resource Not Found',
        message: 'The requested resource could not be found.',
        color: 'orange',
        icon: 'alert-circle',
        suggestions: [
            'The item may have been deleted',
            'Check that you have the correct permissions',
            'Try refreshing the page'
        ],
        severity: 'medium',
        domain: 'general'
    },

    'resource unavailable': {
        title: 'Resource Unavailable',
        message: 'The requested resource is temporarily unavailable.',
        color: 'orange',
        icon: 'cloud-off',
        suggestions: [
            'Try again in a few minutes',
            'The resource may be under maintenance',
            'Contact support if the issue persists'
        ],
        severity: 'medium',
        domain: 'general'
    },

    // Permission Errors (General)
    'insufficient permissions': {
        title: 'Insufficient Permissions',
        message: 'You don\'t have the necessary permissions to perform this action.',
        color: 'red',
        icon: 'permission-denied',
        suggestions: [
            'Contact an administrator for access',
            'Make sure you\'re logged into the correct account',
            'This action may require special permissions'
        ],
        severity: 'high',
        domain: 'general'
    },

    'access denied': {
        title: 'Access Denied',
        message: 'You don\'t have permission to access this resource.',
        color: 'red',
        icon: 'access-denied',
        suggestions: [
            'Make sure you\'re logged in with the correct account',
            'Contact an administrator if you need access',
            'Check if your account has the necessary permissions'
        ],
        severity: 'high',
        domain: 'general'
    },

    // Data Errors (General)
    'data corruption': {
        title: 'Data Error',
        message: 'There appears to be an issue with the data. Please try again.',
        color: 'red',
        icon: 'data-error',
        suggestions: [
            'Try refreshing the page',
            'This issue has been reported for investigation',
            'Contact support if you continue to see this error'
        ],
        severity: 'high',
        domain: 'general'
    },

    'invalid request': {
        title: 'Invalid Request',
        message: 'The request could not be processed due to invalid data.',
        color: 'orange',
        icon: 'validation-error',
        suggestions: [
            'Check your input for errors',
            'Make sure all required fields are filled',
            'Try submitting the form again'
        ],
        severity: 'medium',
        domain: 'general'
    },

    // System Errors
    'maintenance mode': {
        title: 'Maintenance in Progress',
        message: 'The system is currently undergoing maintenance. Please try again later.',
        color: 'yellow',
        icon: 'info',
        suggestions: [
            'Maintenance is typically brief',
            'Try again in 10-15 minutes',
            'Check our status page for updates'
        ],
        severity: 'low',
        domain: 'general'
    },

    'system overload': {
        title: 'System Busy',
        message: 'The system is currently experiencing high traffic. Please try again.',
        color: 'orange',
        icon: 'server-off',
        suggestions: [
            'Wait a few minutes and try again',
            'Try during off-peak hours',
            'Contact support if you need immediate assistance'
        ],
        severity: 'medium',
        domain: 'general'
    }
};