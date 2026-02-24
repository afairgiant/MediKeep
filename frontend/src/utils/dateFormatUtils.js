/**
 * Date formatting utilities that respect user preferences
 * Centralizes all date display formatting logic
 */

import { DATE_FORMAT_OPTIONS, DEFAULT_DATE_FORMAT } from './constants';

/**
 * Capitalize the first character of a string.
 * Useful for locale-formatted dates where some locales (e.g., sv-SE)
 * produce lowercase month/day names.
 * @param {string} str - String to capitalize
 * @returns {string} String with first character uppercased
 */
export const capitalizeFirst = str => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Get the locale string for a date format code
 * @param {string} formatCode - 'mdy', 'dmy', or 'ymd'
 * @returns {string} Locale string for toLocaleDateString
 */
export const getLocaleForFormat = formatCode => {
  const config =
    DATE_FORMAT_OPTIONS[formatCode] || DATE_FORMAT_OPTIONS[DEFAULT_DATE_FORMAT];
  return config.locale;
};

/**
 * Format a date according to user's preferred format
 * @param {string|Date|null} dateValue - The date to format (ISO string or Date object)
 * @param {string} formatCode - User's preferred format code ('mdy', 'dmy', 'ymd')
 * @param {Object} options - Additional formatting options
 * @param {boolean} options.includeTime - Include time in output
 * @param {string} options.timezone - Timezone to use (defaults to user's timezone)
 * @returns {string} Formatted date string
 */
export const formatDateWithPreference = (
  dateValue,
  formatCode = DEFAULT_DATE_FORMAT,
  options = {}
) => {
  if (!dateValue) return 'N/A';

  const { includeTime = false, timezone } = options;
  const locale = getLocaleForFormat(formatCode);

  try {
    let date;

    // Handle YYYY-MM-DD string format (date-only) to avoid timezone issues
    if (
      typeof dateValue === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim())
    ) {
      const [year, month, day] = dateValue.trim().split('-').map(Number);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        // Use local date to avoid timezone issues
        date = new Date(year, month - 1, day);
      }
    } else {
      date = new Date(dateValue);
    }

    if (isNaN(date.getTime())) return 'Invalid Date';

    const dateOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    };

    if (timezone) {
      dateOptions.timeZone = timezone;
    }

    if (includeTime) {
      dateOptions.hour = 'numeric';
      dateOptions.minute = '2-digit';
    }

    return date.toLocaleDateString(locale, dateOptions);
  } catch {
    return 'Invalid Date';
  }
};

/**
 * Format a date for display with month name (e.g., "Jan 25, 2026")
 * @param {string|Date|null} dateValue - The date to format
 * @param {string} formatCode - User's preferred format code
 * @param {boolean} longMonth - Use full month name instead of abbreviation
 * @returns {string} Formatted date string
 */
export const formatDateLong = (
  dateValue,
  formatCode = DEFAULT_DATE_FORMAT,
  longMonth = false
) => {
  if (!dateValue) return 'N/A';

  const locale = getLocaleForFormat(formatCode);

  try {
    let date;

    if (
      typeof dateValue === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim())
    ) {
      const [year, month, day] = dateValue.trim().split('-').map(Number);
      date = new Date(year, month - 1, day);
    } else {
      date = new Date(dateValue);
    }

    if (isNaN(date.getTime())) return 'Invalid Date';

    const result = date.toLocaleDateString(locale, {
      year: 'numeric',
      month: longMonth ? 'long' : 'short',
      day: 'numeric',
    });

    // Some locales (e.g. sv-SE) produce lowercase month names
    return capitalizeFirst(result);
  } catch {
    return 'Invalid Date';
  }
};

/**
 * Format a datetime with timezone support
 * @param {string|Date|null} dateValue - The date to format
 * @param {string} formatCode - User's preferred format code
 * @param {Object} options - Additional formatting options
 * @param {string} options.timezone - Timezone to use
 * @param {boolean} options.includeTimezone - Include timezone abbreviation
 * @returns {string} Formatted datetime string
 */
export const formatDateTimeWithPreference = (
  dateValue,
  formatCode = DEFAULT_DATE_FORMAT,
  options = {}
) => {
  if (!dateValue) return 'N/A';

  const { timezone, includeTimezone = false } = options;
  const locale = getLocaleForFormat(formatCode);

  try {
    const date = new Date(dateValue);

    if (isNaN(date.getTime())) return 'Invalid Date';

    const dateTimeOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
    };

    if (timezone) {
      dateTimeOptions.timeZone = timezone;
    }

    if (includeTimezone) {
      dateTimeOptions.timeZoneName = 'short';
    }

    return date.toLocaleString(locale, dateTimeOptions);
  } catch {
    return 'Invalid Date';
  }
};

/**
 * Get the display label for a date format
 * @param {string} formatCode - The format code
 * @returns {string} Human-readable label
 */
export const getDateFormatLabel = formatCode => {
  const config = DATE_FORMAT_OPTIONS[formatCode];
  return config ? config.label : DATE_FORMAT_OPTIONS[DEFAULT_DATE_FORMAT].label;
};

/**
 * Get an example of how a date will be displayed
 * @param {string} formatCode - The format code
 * @returns {string} Example date string
 */
export const getDateFormatExample = formatCode => {
  const config = DATE_FORMAT_OPTIONS[formatCode];
  return config
    ? config.example
    : DATE_FORMAT_OPTIONS[DEFAULT_DATE_FORMAT].example;
};
