/**
 * Authentication Error Mappings
 * Contains all error patterns and configurations specific to authentication
 */

export const authErrors = {
    // Login/Authentication Errors
    'invalid credentials': {
        title: 'Login Failed',
        message: 'The username/email or password you entered is incorrect.',
        color: 'red',
        icon: 'user-x',
        suggestions: [
            'Double-check your username/email and password',
            'Try using your email address instead of username',
            'Use the "Forgot Password" link if you can\'t remember your password',
            'Make sure Caps Lock is not enabled'
        ],
        severity: 'high',
        domain: 'auth'
    },

    'account locked': {
        title: 'Account Locked',
        message: 'Your account has been temporarily locked due to multiple failed login attempts.',
        color: 'red',
        icon: 'lock',
        suggestions: [
            'Wait 15 minutes before trying again',
            'Use the "Forgot Password" link to reset your password',
            'Contact support if you believe this is an error'
        ],
        severity: 'high',
        domain: 'auth'
    },

    'account disabled': {
        title: 'Account Disabled',
        message: 'Your account has been disabled. Please contact support.',
        color: 'red',
        icon: 'banned',
        suggestions: [
            'Contact support to reactivate your account',
            'Check your email for any account notifications'
        ],
        severity: 'high',
        domain: 'auth'
    },

    'email not verified': {
        title: 'Email Not Verified',
        message: 'Please verify your email address before logging in.',
        color: 'orange',
        icon: 'mail-x',
        suggestions: [
            'Check your email for a verification link',
            'Click "Resend Verification Email" if needed',
            'Check your spam/junk folder'
        ],
        severity: 'medium',
        domain: 'auth'
    },

    // Session/Token Errors
    'session expired': {
        title: 'Session Expired',
        message: 'Your session has expired. Please log in again.',
        color: 'orange',
        icon: 'clock',
        suggestions: [
            'Log in again to continue',
            'Use "Remember Me" for longer sessions'
        ],
        severity: 'medium',
        domain: 'auth'
    },

    'invalid token': {
        title: 'Invalid Session',
        message: 'Your session is invalid. Please log in again.',
        color: 'red',
        icon: 'key',
        suggestions: [
            'Log in again to get a new session',
            'Clear your browser cache if the problem persists'
        ],
        severity: 'high',
        domain: 'auth'
    },

    'token expired': {
        title: 'Session Expired',
        message: 'Your session has expired. Please log in again.',
        color: 'orange',
        icon: 'expired',
        suggestions: [
            'Log in again to continue',
            'Save your work before the session expires next time'
        ],
        severity: 'medium',
        domain: 'auth'
    },

    // Registration Errors
    'username already exists': {
        title: 'Username Taken',
        message: 'This username is already in use. Please choose a different one.',
        color: 'orange',
        icon: 'user-x',
        suggestions: [
            'Try adding numbers or underscores to your username',
            'Use a variation of your desired username',
            'Consider using your email address instead'
        ],
        severity: 'medium',
        domain: 'auth'
    },

    'email already exists': {
        title: 'Email Already Registered',
        message: 'An account with this email address already exists.',
        color: 'orange',
        icon: 'mail-x',
        suggestions: [
            'Try logging in instead of registering',
            'Use the "Forgot Password" link if you can\'t remember your password',
            'Contact support if you believe this is an error'
        ],
        severity: 'medium',
        domain: 'auth'
    },

    'weak password': {
        title: 'Password Too Weak',
        message: 'Your password doesn\'t meet the security requirements.',
        color: 'orange',
        icon: 'shield-x',
        suggestions: [
            'Use at least 8 characters',
            'Include uppercase and lowercase letters',
            'Add numbers and special characters',
            'Avoid common words or personal information'
        ],
        severity: 'medium',
        domain: 'auth'
    },

    // Authentication state errors
    'not authenticated': {
        title: 'Authentication Required',
        message: 'Your session has expired or you are not logged in.',
        color: 'red',
        icon: 'user-x',
        suggestions: [
            'Please refresh the page to restore your session',
            'Log in again if the problem persists',
            'Make sure cookies are enabled in your browser'
        ],
        severity: 'high',
        domain: 'auth'
    },

    'unauthenticated': {
        title: 'Authentication Required',
        message: 'Your session has expired or you are not logged in.',
        color: 'red',
        icon: 'user-x',
        suggestions: [
            'Please refresh the page to restore your session',
            'Log in again if the problem persists',
            'Make sure cookies are enabled in your browser'
        ],
        severity: 'high',
        domain: 'auth'
    }
};