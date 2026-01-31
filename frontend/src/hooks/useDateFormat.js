/**
 * Custom hook for date formatting with user preferences
 * Provides formatting functions that automatically use the user's preferred date format
 */

import { useCallback, useMemo } from 'react';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import {
  formatDateWithPreference,
  formatDateLong,
  formatDateTimeWithPreference,
  getLocaleForFormat,
  getDateFormatLabel,
  getDateFormatExample,
} from '../utils/dateFormatUtils';
import {
  formatDateTimeForInputWithPreference,
  getDateTimePlaceholder,
} from '../utils/dateUtils';
import { DATE_FORMAT_OPTIONS, DEFAULT_DATE_FORMAT } from '../utils/constants';

/**
 * Hook that provides date formatting functions using user's preferred format
 * @returns {Object} Date formatting utilities
 */
export const useDateFormat = () => {
  const { dateFormat } = useUserPreferences();
  const effectiveFormat = dateFormat || DEFAULT_DATE_FORMAT;

  const formatDate = useCallback(
    (dateValue, options = {}) => {
      return formatDateWithPreference(dateValue, effectiveFormat, options);
    },
    [effectiveFormat]
  );

  const formatDateWithTime = useCallback(
    (dateValue, options = {}) => {
      return formatDateWithPreference(dateValue, effectiveFormat, {
        ...options,
        includeTime: true,
      });
    },
    [effectiveFormat]
  );

  const formatDateTime = useCallback(
    (dateValue, options = {}) => {
      return formatDateTimeWithPreference(dateValue, effectiveFormat, options);
    },
    [effectiveFormat]
  );

  const formatLongDate = useCallback(
    (dateValue, longMonth = false) => {
      return formatDateLong(dateValue, effectiveFormat, longMonth);
    },
    [effectiveFormat]
  );

  const locale = useMemo(
    () => getLocaleForFormat(effectiveFormat),
    [effectiveFormat]
  );

  const formatLabel = useMemo(
    () => getDateFormatLabel(effectiveFormat),
    [effectiveFormat]
  );

  const formatExample = useMemo(
    () => getDateFormatExample(effectiveFormat),
    [effectiveFormat]
  );

  // Format datetime for input fields (respects user's date format preference)
  const formatDateTimeInput = useCallback(
    (dateValue, includeSeconds = false) => {
      return formatDateTimeForInputWithPreference(dateValue, effectiveFormat, includeSeconds);
    },
    [effectiveFormat]
  );

  // Get placeholder text for datetime input based on user's format preference
  const dateTimePlaceholder = useMemo(
    () => getDateTimePlaceholder(effectiveFormat),
    [effectiveFormat]
  );

  return {
    formatDate,
    formatDateWithTime,
    formatDateTime,
    formatLongDate,
    formatDateTimeInput,
    dateFormat: effectiveFormat,
    locale,
    formatLabel,
    formatExample,
    dateTimePlaceholder,
    formatOptions: DATE_FORMAT_OPTIONS,
  };
};

export default useDateFormat;
