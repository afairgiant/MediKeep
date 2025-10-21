/**
 * Shared date utility functions for consistent date handling across the application
 */

/**
 * Parse a date input value to a JavaScript Date object
 * Handles string dates in YYYY-MM-DD format to avoid timezone issues
 * 
 * @param {string|Date|null} dateValue - The date value to parse
 * @returns {Date|null} - Parsed Date object or null
 */
export const parseDateInput = (dateValue) => {
  if (!dateValue) return null;
  
  // If it's already a Date object, return it
  if (dateValue instanceof Date) {
    return dateValue;
  }
  
  // Handle YYYY-MM-DD string format
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim())) {
    const [year, month, day] = dateValue.trim().split('-').map(Number);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      // Use local date to avoid timezone issues (month is 0-indexed)
      return new Date(year, month - 1, day);
    }
  }
  
  // Fallback to standard Date parsing
  const parsed = new Date(dateValue);
  return isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Format a date value to YYYY-MM-DD string format for API consumption
 * 
 * @param {string|Date|null} dateValue - The date value to format
 * @returns {string|null} - Formatted date string or null
 */
export const formatDateForAPI = (dateValue) => {
  if (!dateValue) return null;
  
  // If it's already a YYYY-MM-DD string, return as is
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }
  
  // Parse the date
  const date = parseDateInput(dateValue);
  if (!date) return null;
  
  // Format as YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Format a date value for DateInput onChange handlers
 * Handles both Date objects and strings, returns empty string for invalid/null values
 *
 * @param {string|Date|null} date - The date value from DateInput onChange
 * @returns {string} - Formatted date string (YYYY-MM-DD) or empty string
 */
export const formatDateInputChange = (date) => {
  if (!date) return '';

  // If it's already a YYYY-MM-DD string, return as is
  if (typeof date === 'string') {
    return date;
  }

  // If it's a Date object, format it
  if (date instanceof Date && !isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return '';
};

/**
 * Get today's date as a Date object set to end of day
 * Useful for date picker max constraints
 *
 * @returns {Date} - Today's date at 23:59:59.999
 */
export const getTodayEndOfDay = () => {
  const today = new Date();
  // Create new Date object to avoid mutation
  return new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
};

/**
 * Get today's date as a YYYY-MM-DD string
 * 
 * @returns {string} - Today's date formatted as YYYY-MM-DD
 */
export const getTodayString = () => {
  const today = new Date();
  return formatDateForAPI(today);
};

/**
 * Check if a date is in the future
 * 
 * @param {string|Date} dateValue - The date to check
 * @returns {boolean} - True if the date is in the future
 */
export const isDateInFuture = (dateValue) => {
  if (!dateValue) return false;
  
  const date = parseDateInput(dateValue);
  if (!date) return false;
  
  // Create new Date object to avoid mutation
  const today = new Date();
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  
  return date > endOfToday;
};

/**
 * Check if end date is before start date
 * 
 * @param {string|Date} startDate - The start date
 * @param {string|Date} endDate - The end date
 * @returns {boolean} - True if end date is before start date
 */
export const isEndDateBeforeStartDate = (startDate, endDate) => {
  if (!startDate || !endDate) return false;
  
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  
  if (!start || !end) return false;
  
  return end < start;
};

/**
 * Get a user-friendly date display format
 * 
 * @param {string|Date} dateValue - The date to format
 * @returns {string} - Formatted date string for display
 */
export const formatDateForDisplay = (dateValue) => {
  const date = parseDateInput(dateValue);
  if (!date) return '';
  
  // Use browser's locale for user-friendly display
  return date.toLocaleDateString();
};