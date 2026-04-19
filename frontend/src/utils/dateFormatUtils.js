/**
 * Date formatting utilities that respect user preferences
 * Centralizes all date display formatting logic
 */

import { DATE_FORMAT_OPTIONS, DEFAULT_DATE_FORMAT } from './constants';
import {
  formatDateFromPattern,
  getPatternForFormat,
  parseDateInput,
  shiftDateToTimezone,
} from './dateUtils';

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
  const pattern = getPatternForFormat(formatCode);
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

    const datePart = formatDateFromPattern(
      shiftDateToTimezone(date, timezone),
      pattern
    );

    if (!includeTime) return datePart;

    const timeOptions = { hour: 'numeric', minute: '2-digit' };
    if (timezone) timeOptions.timeZone = timezone;
    const timePart = date.toLocaleTimeString(locale, timeOptions);
    return `${datePart} ${timePart}`;
  } catch {
    return 'Invalid Date';
  }
};

/**
 * Format a date for display with month name (e.g., "Jan 25, 2026")
 * @param {string|Date|null} dateValue - The date to format
 * @param {string} formatCode - User's preferred format code
 * @param {Object} options - Formatting options
 * @param {boolean} options.longMonth - Use full month name instead of abbreviation
 * @param {string|null} options.displayLocale - Intl locale for month names (e.g. 'en-US', 'de-DE'),
 *   overrides the format-derived locale so month names match the UI language instead of the date
 *   ordering locale (which may be sv-SE for YMD format)
 * @returns {string} Formatted date string
 */
export const formatDateLong = (
  dateValue,
  formatCode = DEFAULT_DATE_FORMAT,
  { longMonth = false, displayLocale = null } = {}
) => {
  if (!dateValue) return 'N/A';

  const locale = displayLocale || getLocaleForFormat(formatCode);

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
  const pattern = getPatternForFormat(formatCode);
  const locale = getLocaleForFormat(formatCode);

  try {
    // parseDateInput handles YYYY-MM-DD as a local date so the day doesn't
    // shift under non-UTC timezones; full ISO timestamps go through new Date.
    const date = parseDateInput(dateValue);
    if (!date) return 'Invalid Date';

    const datePart = formatDateFromPattern(
      shiftDateToTimezone(date, timezone),
      pattern
    );

    const timeOptions = { hour: 'numeric', minute: '2-digit' };
    if (timezone) timeOptions.timeZone = timezone;
    if (includeTimezone) timeOptions.timeZoneName = 'short';

    const timePart = date.toLocaleTimeString(locale, timeOptions);
    return `${datePart} ${timePart}`;
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
