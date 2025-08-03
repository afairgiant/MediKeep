import { apiClient } from './apiClient';
import logger from './logger';

class TimezoneService {
  constructor() {
    this.facilityTimezone = 'UTC';
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    try {
      const data = await apiClient.get('/utils/timezone-info');
      this.facilityTimezone = data.facility_timezone;
      logger.debug('timezone_service_initialized', 'Timezone service initialized', {
        timezone: this.facilityTimezone,
        component: 'TimezoneService'
      });
    } catch (error) {
      logger.warn('timezone_service_fallback', 'Failed to load timezone, using UTC as fallback', {
        error: error.message,
        component: 'TimezoneService'
      });
      this.facilityTimezone = 'UTC';
    }

    this.initialized = true;
  }

  formatDateTime(utcString, options = {}) {
    if (!utcString) return 'N/A';

    const { includeTimezone = true, dateOnly = false } = options;

    try {
      const date = new Date(utcString);

      if (dateOnly) {
        return date.toLocaleDateString('en-US', {
          timeZone: this.facilityTimezone,
          year: 'numeric',
          month: 'short',
          day: '2-digit',
        });
      }

      const dateTimeOptions = {
        timeZone: this.facilityTimezone,
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
      };

      if (includeTimezone) {
        dateTimeOptions.timeZoneName = 'short';
      }

      return date.toLocaleString('en-US', dateTimeOptions);
    } catch (error) {
      logger.debug('timezone_service_format_error', 'Date formatting failed', {
        utcString,
        error: error.message,
        component: 'TimezoneService'
      });
      return 'Invalid Date';
    }
  }

  getCurrentFacilityTime() {
    try {
      const now = new Date();
      return now
        .toLocaleString('sv-SE', {
          timeZone: this.facilityTimezone,
        })
        .replace(' ', 'T')
        .substring(0, 16);
    } catch (error) {
      return new Date().toISOString().substring(0, 16);
    }
  }

  getFacilityTimezone() {
    return this.facilityTimezone;
  }
}

export const timezoneService = new TimezoneService();
