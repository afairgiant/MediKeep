import { apiClient } from './apiClient';
import logger from './logger';
import {
  formatDateFromPattern,
  getPatternForFormat,
  shiftDateToTimezone,
} from '../utils/dateUtils';

class TimezoneService {
  constructor() {
    this.timezone = 'UTC';
    this.dateLocale = 'en-US';
    this.dateFormatCode = 'mdy';
    this.initialized = false;
  }

  setDateLocale(locale, formatCode) {
    this.dateLocale = locale || 'en-US';
    this.dateFormatCode = formatCode || 'mdy';
  }

  async init() {
    if (this.initialized) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._doInit();
    try {
      await this._initPromise;
    } finally {
      this._initPromise = null;
    }
  }

  async _doInit() {
    try {
      const response = await apiClient.get('/utils/timezone-info');
      this.timezone = response.data.facility_timezone || 'UTC';
      this.initialized = true;
      logger.debug(
        'timezone_service_initialized',
        'Timezone service initialized',
        {
          timezone: this.timezone,
          component: 'TimezoneService',
        }
      );
    } catch (error) {
      logger.warn(
        'timezone_service_fallback',
        'Failed to load timezone, using UTC as fallback',
        {
          error: error.message,
          component: 'TimezoneService',
        }
      );
      this.timezone = 'UTC';
      // Do not set initialized=true on failure, so init() retries after login
    }
  }

  formatDateTime(utcString, options = {}) {
    if (!utcString) return 'N/A';

    const { includeTimezone = true, dateOnly = false } = options;

    try {
      const date = new Date(utcString);
      if (Number.isNaN(date.getTime())) return 'Invalid Date';

      // Pattern-driven so the separator reflects the user's stored
      // preference (dmy_dot → dots, dmy → slashes) rather than the locale's
      // default.
      const datePart = formatDateFromPattern(
        shiftDateToTimezone(date, this.timezone),
        getPatternForFormat(this.dateFormatCode)
      );

      if (dateOnly) return datePart || 'Invalid Date';

      const timeOptions = {
        timeZone: this.timezone,
        hour: 'numeric',
        minute: '2-digit',
      };
      if (includeTimezone) timeOptions.timeZoneName = 'short';
      const timePart = date.toLocaleTimeString(this.dateLocale, timeOptions);

      if (!datePart) return 'Invalid Date';
      return `${datePart} ${timePart}`;
    } catch (error) {
      logger.debug('timezone_service_format_error', 'Date formatting failed', {
        utcString,
        error: error.message,
        component: 'TimezoneService',
      });
      return 'Invalid Date';
    }
  }

  getCurrentTime() {
    try {
      const now = new Date();
      return now
        .toLocaleString('sv-SE', {
          timeZone: this.timezone,
        })
        .replace(' ', 'T')
        .substring(0, 16);
    } catch (error) {
      return new Date().toISOString().substring(0, 16);
    }
  }

  getTimezone() {
    return this.timezone;
  }
}

export const timezoneService = new TimezoneService();
