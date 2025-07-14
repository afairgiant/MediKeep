/**
 * Utility functions for the Medical Records application
 */

import { DATE_FORMATS } from './constants';

import { timezoneService } from '../services/timezoneService';

/**
 * Format date for display using facility timezone
 * @param {string|Date} utcDate - UTC date to format
 * @param {string} format - Format string (legacy parameter, maintained for compatibility)
 * @returns {string} - Formatted date
 */
export const formatDate = (utcDate, format = DATE_FORMATS.DISPLAY) => {
  if (!utcDate) return 'N/A';
  
  // For date-only strings (like birth dates), parse them as local dates to avoid timezone issues
  if (typeof utcDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(utcDate.trim())) {
    const [year, month, day] = utcDate.trim().split('-').map(Number);
    const localDate = new Date(year, month - 1, day); // month is 0-indexed
    return localDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  }
  
  // For datetime strings, use the timezone service
  return timezoneService.formatDateTime(utcDate, { dateOnly: true });
};

/**
 * Format date and time for display using facility timezone
 * @param {string|Date} utcDate - UTC date to format
 * @param {boolean} includeTimezone - Whether to include timezone abbreviation
 * @returns {string} - Formatted date and time
 */
export const formatDateTime = (utcDate, includeTimezone = true) => {
  return timezoneService.formatDateTime(utcDate, { includeTimezone });
};

/**
 * Get current facility time for form defaults
 * @returns {string} - Current time in YYYY-MM-DDTHH:MM format
 */
export const getCurrentFacilityTime = () => {
  return timezoneService.getCurrentFacilityTime();
};

/**
 * Enhanced date handling for edge cases
 * @param {string|Date} dateInput - Date input to parse
 * @returns {Date|null} - Parsed date or null
 */
export const parseDateSafely = dateInput => {
  if (!dateInput) return null;

  try {
    // Handle date-only strings (YYYY-MM-DD)
    if (
      typeof dateInput === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())
    ) {
      const [year, month, day] = dateInput.trim().split('-');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    return new Date(dateInput);
  } catch (error) {
    console.error('Date parsing error:', error);
    return null;
  }
};

/**
 * Input validation for datetime fields
 * @param {string} dateTimeString - DateTime string to validate
 * @param {string} fieldName - Field name for error messages
 * @returns {Object} - Validation result with isValid and error
 */
export const validateDateTime = (dateTimeString, fieldName = 'datetime') => {
  if (!dateTimeString) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  try {
    const date = new Date(dateTimeString);

    if (isNaN(date.getTime())) {
      return { isValid: false, error: `Invalid ${fieldName} format` };
    }

    // Check for reasonable date range (1900-2100)
    const year = date.getFullYear();
    if (year < 1900 || year > 2100) {
      return {
        isValid: false,
        error: `${fieldName} year must be between 1900 and 2100`,
      };
    }

    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: `Invalid ${fieldName}: ${error.message}` };
  }
};

/**
 * Debounce function to limit API calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - Is valid email
 */
export const isValidEmail = email => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - Is valid phone number
 */
export const isValidPhone = phone => {
  const phoneRegex = /^\+?[\d\s\-()]{10,}$/;
  return phoneRegex.test(phone);
};

/**
 * Generate a unique ID
 * @returns {string} - Unique ID
 */
export const generateId = () => {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Capitalize first letter of each word
 * @param {string} str - String to capitalize
 * @returns {string} - Capitalized string
 */
export const capitalizeWords = str => {
  if (!str) return '';
  return str.replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
export const formatFileSize = bytes => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Get file extension from filename
 * @param {string} filename - File name
 * @returns {string} - File extension
 */
export const getFileExtension = filename => {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2);
};

/**
 * Check if file type is allowed
 * @param {string} fileType - MIME type of file
 * @param {Array} allowedTypes - Array of allowed MIME types
 * @returns {boolean} - Is file type allowed
 */
export const isFileTypeAllowed = (fileType, allowedTypes) => {
  return allowedTypes.includes(fileType);
};

/**
 * Sort array of objects by property
 * @param {Array} array - Array to sort
 * @param {string} property - Property to sort by
 * @param {string} order - 'asc' or 'desc'
 * @returns {Array} - Sorted array
 */
export const sortByProperty = (array, property, order = 'asc') => {
  return [...array].sort((a, b) => {
    const aVal = a[property];
    const bVal = b[property];

    if (order === 'desc') {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
    return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
  });
};

/**
 * Filter array by search term
 * @param {Array} array - Array to filter
 * @param {string} searchTerm - Search term
 * @param {Array} searchFields - Fields to search in
 * @returns {Array} - Filtered array
 */
export const filterBySearch = (array, searchTerm, searchFields) => {
  if (!searchTerm) return array;

  const term = searchTerm.toLowerCase();
  return array.filter(item =>
    searchFields.some(field => {
      const value = item[field];
      return value && value.toString().toLowerCase().includes(term);
    })
  );
};

/**
 * Deep clone an object
 * @param {Object} obj - Object to clone
 * @returns {Object} - Cloned object
 */
export const deepClone = obj => {
  return JSON.parse(JSON.stringify(obj));
};
