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
    formatDate: utcString =>
      timezoneService.formatDateTime(utcString, { dateOnly: true }),
    getCurrentTime: () => timezoneService.getCurrentFacilityTime(),
    facilityTimezone: timezoneService.getFacilityTimezone(),
  };
};
