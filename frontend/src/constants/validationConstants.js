/**
 * Validation Constants
 *
 * Shared validation rules and patterns for form validation.
 */

/**
 * Password validation requirements
 */
export const PASSWORD_VALIDATION = {
  MIN_LENGTH: 6,
  LETTER_REGEX: /[a-zA-Z]/,
  NUMBER_REGEX: /\d/,
  MESSAGES: {
    MIN_LENGTH: 'Password must be at least 6 characters long',
    COMPLEXITY: 'Password must contain at least one letter and one number',
  },
};

/**
 * Email validation pattern
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Field types that should be excluded from validation in edit mode
 */
export const EDIT_EXCLUDED_FIELDS = ['password_hash', 'password'];

/**
 * Fields that should be hidden for user model creation
 */
export const USER_HIDDEN_CREATE_FIELDS = ['created_at', 'updated_at', 'active_patient'];
