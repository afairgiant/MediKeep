/**
 * Utility functions for the Medical Records application
 */

import { DATE_FORMATS } from './constants';

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @param {string} format - Format string
 * @returns {string} - Formatted date
 */
export const formatDate = (date, format = DATE_FORMATS.DISPLAY) => {
  if (!date) return 'N/A';
  
  try {
    let dateObj;
    
    // Handle timezone issues for date-only strings (YYYY-MM-DD format)
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      // Parse as local date to avoid timezone conversion
      const [year, month, day] = date.trim().split('-');
      dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } else {
      dateObj = new Date(date);
    }
    
    if (isNaN(dateObj.getTime())) return 'Invalid Date';
      // Simple date formatting
    const options = {
      year: 'numeric',
      month: format.includes('MMMM') ? 'long' : 'short',
      day: '2-digit'
    };
    
    if (format.includes('HH:mm')) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }
    
    return dateObj.toLocaleDateString('en-US', options);
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Invalid Date';
  }
};

/**
 * Format date and time for display
 * @param {string|Date} date - Date to format
 * @returns {string} - Formatted date and time
 */
export const formatDateTime = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString();
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
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - Is valid phone number
 */
export const isValidPhone = (phone) => {
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
export const capitalizeWords = (str) => {
  if (!str) return '';
  return str.replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
export const formatFileSize = (bytes) => {
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
export const getFileExtension = (filename) => {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
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
export const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};
