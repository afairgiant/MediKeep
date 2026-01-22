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

/**
 * Parse a datetime string in various common formats
 * Supports formats commonly used in CSV exports (e.g., Withings)
 *
 * Supported formats:
 * - MM/DD/YYYY HH:mm:ss (US format - default)
 * - MM/DD/YYYY HH:mm (US format without seconds)
 * - DD/MM/YYYY HH:mm:ss (European/Withings format)
 * - DD/MM/YYYY HH:mm (European without seconds)
 * - YYYY-MM-DD HH:mm:ss (ISO-like format)
 * - YYYY-MM-DD HH:mm (ISO-like without seconds)
 * - YYYY-MM-DDTHH:mm:ss (ISO format)
 * - MM-DD-YYYY HH:mm:ss (US with dashes)
 * - MM.DD.YYYY HH:mm:ss (US with dots)
 *
 * @param {string} dateTimeString - The datetime string to parse
 * @param {string} preferredFormat - Preferred format hint: 'dmy' (day-month-year) or 'mdy' (month-day-year)
 * @returns {{ date: Date|null, error: string|null }} - Parsed Date object and any error message
 */
export const parseDateTimeString = (dateTimeString, preferredFormat = 'mdy') => {
  if (!dateTimeString || typeof dateTimeString !== 'string') {
    return { date: null, error: null };
  }

  const trimmed = dateTimeString.trim();
  if (!trimmed) {
    return { date: null, error: null };
  }

  // Try ISO format first (YYYY-MM-DDTHH:mm:ss or YYYY-MM-DD HH:mm:ss)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (isoMatch) {
    const [, year, month, day, hour, minute, second = '0'] = isoMatch;
    const date = new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10),
      parseInt(second, 10)
    );
    if (!isNaN(date.getTime())) {
      return { date, error: null };
    }
  }

  // Try formats with separators (/, -, .)
  const dateTimeMatch = trimmed.match(/^(\d{1,2})([/\-\.])(\d{1,2})\2(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (dateTimeMatch) {
    const [, part1, , part2, year, hour, minute, second = '0'] = dateTimeMatch;
    const p1 = parseInt(part1, 10);
    const p2 = parseInt(part2, 10);
    const y = parseInt(year, 10);
    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    const s = parseInt(second, 10);

    // Validate time
    if (h > 23 || m > 59 || s > 59) {
      return { date: null, error: 'Invalid time values' };
    }

    let day, month;

    // Determine if DMY or MDY based on values and preference
    if (p1 > 12) {
      // First part > 12, must be day (DMY)
      day = p1;
      month = p2;
    } else if (p2 > 12) {
      // Second part > 12, must be day (MDY)
      month = p1;
      day = p2;
    } else {
      // Ambiguous, use preferred format
      if (preferredFormat === 'mdy') {
        month = p1;
        day = p2;
      } else {
        // Default to DMY (European/Withings format)
        day = p1;
        month = p2;
      }
    }

    // Validate day and month
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return { date: null, error: 'Invalid date values' };
    }

    const date = new Date(y, month - 1, day, h, m, s);

    // Verify the date is valid (catches invalid dates like Feb 30)
    if (isNaN(date.getTime()) || date.getDate() !== day || date.getMonth() !== month - 1) {
      return { date: null, error: 'Invalid date' };
    }

    return { date, error: null };
  }

  // No valid format matched
  return {
    date: null,
    error: 'Unrecognized format. Supported: MM/DD/YYYY HH:mm:ss, DD/MM/YYYY HH:mm:ss, or YYYY-MM-DD HH:mm:ss'
  };
};

/**
 * Format a time string (HH:MM or HH:MM:SS) to 12-hour AM/PM format
 *
 * @param {string} timeString - Time in HH:MM or HH:MM:SS format
 * @returns {string} - Formatted time string (e.g., "2:30 PM") or empty string if invalid
 */
export function formatTimeToAmPm(timeString) {
  if (!timeString) return '';

  const [hours, minutesPart] = timeString.split(':');
  const hour = parseInt(hours, 10);

  if (isNaN(hour)) return '';

  // Default minutes to "00" if missing or invalid
  let minutes = '00';
  if (minutesPart) {
    const minutesNum = parseInt(minutesPart, 10);
    if (!isNaN(minutesNum) && minutesNum >= 0 && minutesNum < 60) {
      minutes = String(minutesNum).padStart(2, '0');
    }
  }

  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

/**
 * Format a Date object to a datetime string for display
 *
 * @param {Date} date - The date to format
 * @param {boolean} includeSeconds - Whether to include seconds
 * @returns {string} - Formatted datetime string (MM/DD/YYYY HH:mm or MM/DD/YYYY HH:mm:ss)
 */
export const formatDateTimeForInput = (date, includeSeconds = true) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }

  const pad = num => String(num).padStart(2, '0');
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const year = date.getFullYear();
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  const datePart = `${month}/${day}/${year}`;
  const timePart = includeSeconds
    ? `${hours}:${minutes}:${pad(date.getSeconds())}`
    : `${hours}:${minutes}`;

  return `${datePart} ${timePart}`;
};