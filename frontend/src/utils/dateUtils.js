/**
 * Shared date utility functions for consistent date handling across the application
 */

import { timezoneService } from '../services/timezoneService';
import { DATE_FORMAT_OPTIONS, DEFAULT_DATE_FORMAT } from './constants';

const parserCache = new Map();

const buildDateParser = pattern => {
  const order = (pattern || '').toUpperCase().match(/YYYY|MM|DD/g) || [];
  if (order.length !== 3) return () => null;

  return input => {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (!trimmed) return null;

    const parts = trimmed.split(/[./\- ]+/).filter(Boolean);
    if (parts.length !== 3) return null;

    const nums = parts.map(p => (/^\d+$/.test(p) ? parseInt(p, 10) : NaN));
    if (nums.some(Number.isNaN)) return null;

    let day;
    let month;
    let year;
    order.forEach((token, idx) => {
      if (token === 'DD') day = nums[idx];
      else if (token === 'MM') month = nums[idx];
      else if (token === 'YYYY') year = nums[idx];
    });

    if (day === undefined || month === undefined || year === undefined) {
      return null;
    }
    if (year < 100) year += 2000;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;

    const date = new Date(year, month - 1, day);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  };
};

/**
 * Permissive date parser keyed on a user-preference pattern.
 *
 * Accepts 1- or 2-digit day/month and any of `.` `/` `-` ` ` as separators,
 * so `16.1.2018`, `16/01/2018` and `16-1-2018` all resolve to the same
 * date when the pattern is a DMY variant. Parsers are cached per pattern
 * since there are only a handful of them and DateInput instances mount
 * in bulk inside medical forms.
 *
 * @param {string} pattern - A pattern from DATE_FORMAT_OPTIONS (e.g. 'DD.MM.YYYY')
 * @returns {(input: string) => Date|null}
 */
export const createDateParser = pattern => {
  let parser = parserCache.get(pattern);
  if (!parser) {
    parser = buildDateParser(pattern);
    parserCache.set(pattern, parser);
  }
  return parser;
};

/**
 * Render a Date using a pattern template (pattern-driven, not locale-driven).
 *
 * Tokens recognised: `YYYY`, `MM`, `DD`. Everything else is kept verbatim,
 * so the chosen separator (`.`, `/`, `-`) survives into the output.
 *
 * @param {Date} date - Must be a valid Date; falsy/invalid returns ''
 * @param {string} pattern - e.g. 'DD.MM.YYYY'
 * @returns {string}
 */
export const formatDateFromPattern = (date, pattern) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  if (!pattern) return '';

  const pad2 = n => String(n).padStart(2, '0');
  return pattern
    .replace('YYYY', String(date.getFullYear()))
    .replace('MM', pad2(date.getMonth() + 1))
    .replace('DD', pad2(date.getDate()));
};

/**
 * Resolve the pattern string for a user's date_format preference code.
 * Falls back to the default when the code is unknown.
 */
export const getPatternForFormat = formatCode => {
  const opt =
    DATE_FORMAT_OPTIONS[formatCode] || DATE_FORMAT_OPTIONS[DEFAULT_DATE_FORMAT];
  return opt.pattern;
};

const tzFormatterCache = new Map();

const getTzDateFormatter = timezone => {
  const key = timezone || '__local__';
  let formatter = tzFormatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      ...(timezone ? { timeZone: timezone } : {}),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    tzFormatterCache.set(key, formatter);
  }
  return formatter;
};

/**
 * Return a Date whose local Y/M/D match the given moment *as seen in* the
 * target timezone. Lets callers do pattern-based token substitution on
 * `dateForPattern.getFullYear()` etc. without locale-specific separators
 * from toLocaleDateString sneaking back in.
 */
export const shiftDateToTimezone = (date, timezone) => {
  if (!timezone) return date;
  try {
    const parts = getTzDateFormatter(timezone).formatToParts(date);
    const lookup = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return new Date(
      Number(lookup.year),
      Number(lookup.month) - 1,
      Number(lookup.day)
    );
  } catch {
    return date;
  }
};

/**
 * Parse a date input value to a JavaScript Date object
 * Handles string dates in YYYY-MM-DD format to avoid timezone issues
 *
 * @param {string|Date|null} dateValue - The date value to parse
 * @returns {Date|null} - Parsed Date object or null
 */
export const parseDateInput = dateValue => {
  if (!dateValue) return null;

  // If it's already a Date object, return it
  if (dateValue instanceof Date) {
    return dateValue;
  }

  // Handle YYYY-MM-DD string format
  if (
    typeof dateValue === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateValue.trim())
  ) {
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
export const formatDateForAPI = dateValue => {
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
export const formatDateInputChange = date => {
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
  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23,
    59,
    59,
    999
  );
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
export const isDateInFuture = dateValue => {
  if (!dateValue) return false;

  const date = parseDateInput(dateValue);
  if (!date) return false;

  // Create new Date object to avoid mutation
  const today = new Date();
  const endOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23,
    59,
    59,
    999
  );

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
export const formatDateForDisplay = dateValue => {
  const date = parseDateInput(dateValue);
  if (!date) return '';

  // Pattern-driven so the separator (dot vs slash vs dash) matches the
  // user's stored preference rather than whatever the locale defaults to.
  const pattern = getPatternForFormat(timezoneService.dateFormatCode);
  return formatDateFromPattern(date, pattern);
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
export const parseDateTimeString = (
  dateTimeString,
  preferredFormat = 'mdy'
) => {
  if (!dateTimeString || typeof dateTimeString !== 'string') {
    return { date: null, error: null };
  }

  const trimmed = dateTimeString.trim();
  if (!trimmed) {
    return { date: null, error: null };
  }

  // Try ISO format first (YYYY-MM-DDTHH:mm:ss or YYYY-MM-DD HH:mm:ss)
  const isoMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/
  );
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
  const dateTimeMatch = trimmed.match(
    /^(\d{1,2})([/\-.])(\d{1,2})\2(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/
  );
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
    if (
      isNaN(date.getTime()) ||
      date.getDate() !== day ||
      date.getMonth() !== month - 1
    ) {
      return { date: null, error: 'Invalid date' };
    }

    return { date, error: null };
  }

  // No valid format matched
  return {
    date: null,
    error:
      'Unrecognized format. Supported: MM/DD/YYYY HH:mm, DD/MM/YYYY HH:mm, or YYYY-MM-DD HH:mm (seconds optional)',
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
 * Pad a number with leading zeros
 * @param {number} num - Number to pad
 * @returns {string} - Zero-padded string
 */
const padNumber = num => String(num).padStart(2, '0');

/**
 * Format a Date object to a datetime string for display
 *
 * @param {Date} date - The date to format
 * @param {boolean} includeSeconds - Whether to include seconds
 * @returns {string} - Formatted datetime string (MM/DD/YYYY HH:mm or MM/DD/YYYY HH:mm:ss)
 * @deprecated Use formatDateTimeForInputWithPreference instead for format-aware formatting
 */
export const formatDateTimeForInput = (date, includeSeconds = true) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }

  const month = padNumber(date.getMonth() + 1);
  const day = padNumber(date.getDate());
  const year = date.getFullYear();
  const hours = padNumber(date.getHours());
  const minutes = padNumber(date.getMinutes());

  const datePart = `${month}/${day}/${year}`;
  const timePart = includeSeconds
    ? `${hours}:${minutes}:${padNumber(date.getSeconds())}`
    : `${hours}:${minutes}`;

  return `${datePart} ${timePart}`;
};

/**
 * Format a Date object to a datetime string for input fields, respecting user's date format preference
 *
 * @param {Date} date - The date to format
 * @param {string} formatCode - User's preferred format: 'mdy' (US), 'dmy' (European), or 'ymd' (ISO)
 * @param {boolean} includeSeconds - Whether to include seconds
 * @returns {string} - Formatted datetime string based on preference
 */
export const formatDateTimeForInputWithPreference = (
  date,
  formatCode = DEFAULT_DATE_FORMAT,
  includeSeconds = false
) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }

  const hours = padNumber(date.getHours());
  const minutes = padNumber(date.getMinutes());

  // Pattern-driven so new format codes (e.g. dmy_dot → 'DD.MM.YYYY') flow
  // through automatically without touching this function.
  const datePart = formatDateFromPattern(date, getPatternForFormat(formatCode));

  const timePart = includeSeconds
    ? `${hours}:${minutes}:${padNumber(date.getSeconds())}`
    : `${hours}:${minutes}`;

  return `${datePart} ${timePart}`;
};

/**
 * Returns ordered list of dayjs format strings to try when parsing user-typed date input.
 * Accepts single-digit day/month variants (e.g. "5/1/2026") in addition to zero-padded versions.
 * Only the separator for the active format is accepted: slash for mdy/dmy, dash for ymd.
 *
 * @param {string} formatCode - 'mdy', 'dmy', or 'ymd'
 * @returns {string[]} dayjs format strings, most specific first
 */
export const getDateParseFormats = (formatCode = 'mdy') => {
  switch (formatCode) {
    case 'dmy':
      return ['DD/MM/YYYY', 'D/M/YYYY', 'D/MM/YYYY', 'DD/M/YYYY'];
    case 'dmy_dot':
      return ['DD.MM.YYYY', 'D.M.YYYY', 'D.MM.YYYY', 'DD.M.YYYY'];
    case 'ymd':
      return ['YYYY-MM-DD'];
    default: // mdy
      return ['MM/DD/YYYY', 'M/D/YYYY', 'M/DD/YYYY', 'MM/D/YYYY'];
  }
};

/**
 * Get placeholder text for datetime input based on user's date format preference
 *
 * @param {string} formatCode - User's preferred format code from DATE_FORMAT_OPTIONS
 * @returns {string} - Example placeholder text
 */
export const getDateTimePlaceholder = (formatCode = DEFAULT_DATE_FORMAT) => {
  // Render a fixed example date through the user's pattern so dmy_dot etc.
  // produce the right separator without per-code branching.
  const example = new Date(2015, 6, 29, 23, 58);
  const datePart = formatDateFromPattern(example, getPatternForFormat(formatCode));
  return `e.g., ${datePart} 23:58`;
};
