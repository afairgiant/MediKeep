import { apiClient } from './apiClient';
import logger from './logger';

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

      if (dateOnly) {
        return date.toLocaleDateString(this.dateLocale, {
          timeZone: this.timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
      }

      const dateTimeOptions = {
        timeZone: this.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
      };

      if (includeTimezone) {
        dateTimeOptions.timeZoneName = 'short';
      }

      return date.toLocaleString(this.dateLocale, dateTimeOptions);
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
