/**
 * Custom hook for date formatting with user preferences
 * Provides formatting functions that automatically use the user's preferred date format
 */

import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import {
  formatDateWithPreference,
  formatDateLong,
  formatDateTimeWithPreference,
  getLocaleForFormat,
  getDateFormatLabel,
  getDateFormatExample,
} from '../utils/dateFormatUtils';
import { timezoneService } from '../services/timezoneService';
import {
  formatDateTimeForInputWithPreference,
  getDateTimePlaceholder,
} from '../utils/dateUtils';
import { DATE_FORMAT_OPTIONS, DEFAULT_DATE_FORMAT, getIntlLocale } from '../utils/constants';

/**
 * Hook that provides date formatting functions using user's preferred format
 * @returns {Object} Date formatting utilities
 */
export const useDateFormat = () => {
  const { dateFormat } = useUserPreferences();
  // useSuspense: false — we only read i18n.language for locale mapping, not translated strings,
  // so this hook should not trigger Suspense boundaries during language changes.
  const { i18n } = useTranslation(undefined, { useSuspense: false });
  const effectiveFormat = dateFormat || DEFAULT_DATE_FORMAT;

  const displayLocale = getIntlLocale(i18n.language);

  const formatDate = useCallback(
    (dateValue, options = {}) => {
      return formatDateWithPreference(dateValue, effectiveFormat, options);
    },
    [effectiveFormat]
  );

  const formatDateWithTime = useCallback(
    (dateValue, options = {}) => {
      return formatDateWithPreference(dateValue, effectiveFormat, {
        timezone: timezoneService.getTimezone(),
        ...options,
        includeTime: true,
      });
    },
    [effectiveFormat]
  );

  const formatDateTime = useCallback(
    (dateValue, options = {}) => {
      return formatDateTimeWithPreference(dateValue, effectiveFormat, {
        timezone: timezoneService.getTimezone(),
        ...options,
      });
    },
    [effectiveFormat]
  );

  const formatLongDate = useCallback(
    (dateValue, longMonth = false) => {
      return formatDateLong(dateValue, effectiveFormat, { longMonth, displayLocale });
    },
    [effectiveFormat, displayLocale]
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

  // Date-only input format pattern (e.g., "MM/DD/YYYY") for DateInput valueFormat/placeholder
  const dateInputFormat = useMemo(
    () => DATE_FORMAT_OPTIONS[effectiveFormat]?.pattern || DATE_FORMAT_OPTIONS[DEFAULT_DATE_FORMAT].pattern,
    [effectiveFormat]
  );

  return {
    formatDate,
    formatDateWithTime,
    formatDateTime,
    formatLongDate,
    formatDateTimeInput,
    dateFormat: effectiveFormat,
    dateInputFormat,
    locale,
    formatLabel,
    formatExample,
    dateTimePlaceholder,
    formatOptions: DATE_FORMAT_OPTIONS,
  };
};

export default useDateFormat;
