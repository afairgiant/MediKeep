/**
 * Validation Error Mappings
 * Contains all error patterns and configurations specific to data validation
 */

export const validationErrors = {
    // Form Validation Errors
    'required field missing': {
        title: 'Required Field Empty',
        message: 'Please fill in all required fields before submitting.',
        color: 'orange',
        icon: 'validation-error',
        suggestions: [
            'Check for fields marked with an asterisk (*)',
            'All highlighted fields must be completed',
            'Scroll up to see any missing fields'
        ],
        severity: 'medium',
        domain: 'validation'
    },

    'invalid email format': {
        title: 'Invalid Email',
        message: 'Please enter a valid email address.',
        color: 'orange',
        icon: 'mail-error',
        suggestions: [
            'Make sure your email includes @ and a domain',
            'Example: user@example.com',
            'Check for typos in your email address'
        ],
        severity: 'medium',
        domain: 'validation'
    },

    'invalid date format': {
        title: 'Invalid Date',
        message: 'Please enter a valid date in the correct format.',
        color: 'orange',
        icon: 'validation-error',
        suggestions: [
            'Use the date picker if available',
            'Make sure the date exists (e.g., not February 30)',
            'Check that the year is reasonable'
        ],
        severity: 'medium',
        domain: 'validation'
    },

    'value too short': {
        title: 'Input Too Short',
        message: 'This field requires more characters than you\'ve entered.',
        color: 'orange',
        icon: 'validation-error',
        suggestions: [
            'Check the minimum length requirement',
            'Add more detail to meet the requirement',
            'Review the field description for guidance'
        ],
        severity: 'low',
        domain: 'validation'
    },

    'value too long': {
        title: 'Input Too Long',
        message: 'This field has more characters than allowed.',
        color: 'orange',
        icon: 'validation-error',
        suggestions: [
            'Shorten your input to fit the limit',
            'Focus on the most important information',
            'Consider using abbreviations where appropriate'
        ],
        severity: 'low',
        domain: 'validation'
    },

    'invalid phone number': {
        title: 'Invalid Phone Number',
        message: 'Please enter a valid phone number.',
        color: 'orange',
        icon: 'validation-error',
        suggestions: [
            'Include your country code if international',
            'Use only numbers, spaces, dashes, or parentheses',
            'Example: (555) 123-4567 or +1-555-123-4567'
        ],
        severity: 'medium',
        domain: 'validation'
    },

    'passwords do not match': {
        title: 'Passwords Don\'t Match',
        message: 'The password confirmation doesn\'t match your password.',
        color: 'orange',
        icon: 'validation-error',
        suggestions: [
            'Make sure both password fields are identical',
            'Check for typos in either field',
            'Try typing the password again'
        ],
        severity: 'medium',
        domain: 'validation'
    },

    // Data Type Validation Errors
    'invalid number': {
        title: 'Invalid Number',
        message: 'Please enter a valid number.',
        color: 'orange',
        icon: 'validation-error',
        suggestions: [
            'Use only digits (0-9)',
            'Include a decimal point if needed',
            'Don\'t use commas or other characters'
        ],
        severity: 'medium',
        domain: 'validation'
    },

    'invalid url': {
        title: 'Invalid URL',
        message: 'Please enter a valid web address.',
        color: 'orange',
        icon: 'validation-error',
        suggestions: [
            'Include http:// or https:// at the beginning',
            'Example: https://www.example.com',
            'Check for typos in the web address'
        ],
        severity: 'medium',
        domain: 'validation'
    },

    // File Validation Errors
    'file too large': {
        title: 'File Too Large',
        message: 'The selected file exceeds the maximum size limit.',
        color: 'orange',
        icon: 'validation-error',
        suggestions: [
            'Compress the file before uploading',
            'Choose a smaller file',
            'Check the maximum file size allowed'
        ],
        severity: 'medium',
        domain: 'validation'
    },

    'invalid file type': {
        title: 'Invalid File Type',
        message: 'This file type is not allowed.',
        color: 'orange',
        icon: 'validation-error',
        suggestions: [
            'Check the list of allowed file types',
            'Convert your file to an accepted format',
            'Contact support if you need to upload this type'
        ],
        severity: 'medium',
        domain: 'validation'
    },

    // Range Validation Errors
    'value out of range': {
        title: 'Value Out of Range',
        message: 'The entered value is outside the allowed range.',
        color: 'orange',
        icon: 'validation-error',
        suggestions: [
            'Check the minimum and maximum values allowed',
            'Enter a value within the specified range',
            'Review the field requirements'
        ],
        severity: 'medium',
        domain: 'validation'
    },

    'future date not allowed': {
        title: 'Future Date Not Allowed',
        message: 'Please enter a date that is not in the future.',
        color: 'orange',
        icon: 'validation-error',
        suggestions: [
            'Choose today\'s date or earlier',
            'Check that you\'ve selected the correct year',
            'Make sure the date makes sense for this field'
        ],
        severity: 'medium',
        domain: 'validation'
    },

    'past date not allowed': {
        title: 'Past Date Not Allowed',
        message: 'Please enter a date that is not in the past.',
        color: 'orange',
        icon: 'validation-error',
        suggestions: [
            'Choose today\'s date or later',
            'Check that you\'ve selected the correct year',
            'Make sure the date makes sense for this field'
        ],
        severity: 'medium',
        domain: 'validation'
    }
};