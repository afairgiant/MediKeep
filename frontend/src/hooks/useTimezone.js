import { useState, useEffect } from 'react';
import { timezoneService } from '../services/timezoneService';

export const useTimezone = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      await timezoneService.init();
      setIsReady(true);
    };
    init();
  }, []);

  return {
    isReady,
    formatDateTime: (utcString, options) =>
      timezoneService.formatDateTime(utcString, options),
    formatDate: utcString => {
      if (!utcString) return 'N/A';
      
      // For date-only strings (like birth dates), parse them as local dates to avoid timezone issues
      if (typeof utcString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(utcString.trim())) {
        const [year, month, day] = utcString.trim().split('-').map(Number);
        const localDate = new Date(year, month - 1, day); // month is 0-indexed
        return localDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
        });
      }
      
      // For datetime strings, use the timezone service
      return timezoneService.formatDateTime(utcString, { dateOnly: true });
    },
    getCurrentTime: () => timezoneService.getCurrentFacilityTime(),
    facilityTimezone: timezoneService.getFacilityTimezone(),
  };
};
