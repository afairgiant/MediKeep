/**
 * Family History Sharing Error Mappings
 * Contains all error patterns and configurations specific to sharing functionality
 */

export const sharingErrors = {
    // User/Recipient Related Errors
    'recipient user not found': {
        title: 'User Not Found',
        message: 'We couldn\'t find a user with that username or email address.',
        color: 'red',
        icon: 'user-not-found',
        suggestions: [
            'Double-check the spelling of the username or email',
            'Try using their email address instead of username',
            'Ask the person to confirm their username or email',
            'Make sure they have created an account on this platform'
        ],
        severity: 'high',
        domain: 'sharing'
    },
    
    'cannot send invitation to yourself': {
        title: 'Invalid Recipient',
        message: 'You cannot share family history with yourself.',
        color: 'orange',
        icon: 'warning',
        suggestions: [
            'Enter a family member or friend\'s username',
            'Use a different email address',
            'Share with someone who would benefit from this medical information'
        ],
        severity: 'medium',
        domain: 'sharing'
    },

    'cannot share patient with yourself': {
        title: 'Invalid Recipient',
        message: 'You cannot share your patient record with yourself.',
        color: 'orange',
        icon: 'warning',
        suggestions: [
            'Enter a different username or email address',
            'Share with a family member or healthcare provider'
        ],
        severity: 'medium',
        domain: 'sharing'
    },

    // Permission & Access Errors
    'family member not found or not owned by user': {
        title: 'Access Denied',
        message: 'This family member doesn\'t exist or you don\'t have permission to share it.',
        color: 'red',
        icon: 'access-denied',
        suggestions: [
            'Make sure you own this family member record',
            'Check if the family member was deleted',
            'Contact support if you believe this is an error'
        ],
        severity: 'high',
        domain: 'sharing'
    },

    'patient not found or not owned by user': {
        title: 'Access Denied',
        message: 'This patient record doesn\'t exist or you don\'t have permission to share it.',
        color: 'red',
        icon: 'access-denied',
        suggestions: [
            'Make sure you own this patient record',
            'Check if the patient record was deleted',
            'Contact support if you believe this is an error'
        ],
        severity: 'high',
        domain: 'sharing'
    },

    'share not found or not authorized': {
        title: 'Permission Denied',
        message: 'You don\'t have permission to manage this sharing arrangement.',
        color: 'red',
        icon: 'permission-denied',
        suggestions: [
            'Only the person who shared can revoke access',
            'Contact the original sharer to make changes',
            'Recipients can remove their own access instead'
        ],
        severity: 'high',
        domain: 'sharing'
    },

    'no active share found or not authorized to remove access': {
        title: 'No Access Found',
        message: 'No active sharing was found, or you don\'t have permission to remove access.',
        color: 'orange',
        icon: 'info',
        suggestions: [
            'The sharing may have already been removed',
            'Check if you have the correct permissions',
            'Refresh the page and try again'
        ],
        severity: 'medium',
        domain: 'sharing'
    },

    // Invitation State Errors
    'invitation has expired': {
        title: 'Invitation Expired',
        message: 'This invitation has expired and can no longer be accepted.',
        color: 'yellow',
        icon: 'expired',
        suggestions: [
            'Ask the sender to create a new invitation',
            'Contact the person who shared this with you',
            'New invitations are typically valid for 7 days'
        ],
        severity: 'medium',
        domain: 'sharing'
    },

    'invitation not found or not pending': {
        title: 'Invitation Not Available',
        message: 'This invitation no longer exists or has already been responded to.',
        color: 'orange',
        icon: 'mail-error',
        suggestions: [
            'Check if you already accepted or declined this invitation',
            'Ask the sender to create a new invitation',
            'Look for the shared content in your "Shared with Me" section'
        ],
        severity: 'medium',
        domain: 'sharing'
    },

    'response must be \'accepted\' or \'rejected\'': {
        title: 'Invalid Response',
        message: 'Please choose to either accept or decline this invitation.',
        color: 'orange',
        icon: 'help-circle',
        suggestions: [
            'Click "Accept" to gain access to the shared information',
            'Click "Decline" if you don\'t want access',
            'You can change your mind later by asking for a new invitation'
        ],
        severity: 'low',
        domain: 'sharing'
    },

    // Data Validation Errors
    'invitation context data is missing': {
        title: 'Corrupted Invitation',
        message: 'This invitation is missing important information and cannot be processed.',
        color: 'red',
        icon: 'data-error',
        suggestions: [
            'Ask the sender to create a new invitation',
            'This may be due to a technical error',
            'Contact support if the problem persists'
        ],
        severity: 'high',
        domain: 'sharing'
    },

    'single invitation missing family_member_id': {
        title: 'Incomplete Invitation',
        message: 'This invitation is missing family member information.',
        color: 'red',
        icon: 'data-error',
        suggestions: [
            'Ask the sender to create a new invitation',
            'This appears to be a technical error',
            'Try refreshing the page'
        ],
        severity: 'high',
        domain: 'sharing'
    },

    'bulk invitation missing family_members data': {
        title: 'Incomplete Bulk Invitation',
        message: 'This bulk invitation is missing family member information.',
        color: 'red',
        icon: 'data-error',
        suggestions: [
            'Ask the sender to create a new bulk invitation',
            'This appears to be a technical error',
            'Try refreshing the page'
        ],
        severity: 'high',
        domain: 'sharing'
    },

    // Already Shared Errors
    'family history already shared with this user': {
        title: 'Already Shared',
        message: 'This family member is already shared with the specified user.',
        color: 'orange',
        icon: 'sharing-error',
        suggestions: [
            'Check the "Currently Shared With" section below',
            'Choose a different recipient',
            'You can update sharing permissions if needed'
        ],
        severity: 'low',
        domain: 'sharing'
    }
};