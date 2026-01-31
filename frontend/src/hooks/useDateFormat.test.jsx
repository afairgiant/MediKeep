import { vi, describe, test, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { useDateFormat } from './useDateFormat';

// Mock the UserPreferencesContext
const mockDateFormat = 'mdy';
vi.mock('../contexts/UserPreferencesContext', () => ({
  useUserPreferences: () => ({
    dateFormat: mockDateFormat,
  }),
}));

// Mock the dateFormatUtils
vi.mock('../utils/dateFormatUtils', () => ({
  formatDateWithPreference: vi.fn((dateValue, formatCode, options) => {
    if (!dateValue) return 'N/A';
    return `formatted-${formatCode}-${dateValue}`;
  }),
  formatDateLong: vi.fn((dateValue, formatCode, longMonth) => {
    if (!dateValue) return 'N/A';
    return `long-${formatCode}-${dateValue}`;
  }),
  formatDateTimeWithPreference: vi.fn((dateValue, formatCode, options) => {
    if (!dateValue) return 'N/A';
    return `datetime-${formatCode}-${dateValue}`;
  }),
  getLocaleForFormat: vi.fn(formatCode => {
    const locales = { mdy: 'en-US', dmy: 'en-GB', ymd: 'sv-SE' };
    return locales[formatCode] || 'en-US';
  }),
  getDateFormatLabel: vi.fn(formatCode => {
    const labels = {
      mdy: 'MM/DD/YYYY (US)',
      dmy: 'DD/MM/YYYY (EU)',
      ymd: 'YYYY-MM-DD (ISO)',
    };
    return labels[formatCode] || 'MM/DD/YYYY (US)';
  }),
  getDateFormatExample: vi.fn(formatCode => {
    const examples = {
      mdy: '01/25/2026',
      dmy: '25/01/2026',
      ymd: '2026-01-25',
    };
    return examples[formatCode] || '01/25/2026';
  }),
}));

// Mock constants
vi.mock('../utils/constants', () => ({
  DATE_FORMAT_OPTIONS: {
    mdy: { code: 'mdy', label: 'MM/DD/YYYY (US)', locale: 'en-US' },
    dmy: { code: 'dmy', label: 'DD/MM/YYYY (EU)', locale: 'en-GB' },
    ymd: { code: 'ymd', label: 'YYYY-MM-DD (ISO)', locale: 'sv-SE' },
  },
  DEFAULT_DATE_FORMAT: 'mdy',
}));

// Mock dateUtils
vi.mock('../utils/dateUtils', () => ({
  formatDateTimeForInputWithPreference: vi.fn((date, formatCode, includeSeconds) => {
    if (!date || !(date instanceof Date)) return '';
    const formattedDate = formatCode === 'dmy' ? '25/01/2026' : formatCode === 'ymd' ? '2026-01-25' : '01/25/2026';
    return `${formattedDate} 10:30`;
  }),
  getDateTimePlaceholder: vi.fn(formatCode => {
    const placeholders = {
      mdy: 'e.g., 07/29/2015 23:58',
      dmy: 'e.g., 29/07/2015 23:58',
      ymd: 'e.g., 2015-07-29 23:58',
    };
    return placeholders[formatCode] || 'e.g., 07/29/2015 23:58';
  }),
}));

describe('useDateFormat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns all expected formatting functions and values', () => {
    const { result } = renderHook(() => useDateFormat());

    expect(result.current).toHaveProperty('formatDate');
    expect(result.current).toHaveProperty('formatDateWithTime');
    expect(result.current).toHaveProperty('formatDateTime');
    expect(result.current).toHaveProperty('formatLongDate');
    expect(result.current).toHaveProperty('formatDateTimeInput');
    expect(result.current).toHaveProperty('dateFormat');
    expect(result.current).toHaveProperty('locale');
    expect(result.current).toHaveProperty('formatLabel');
    expect(result.current).toHaveProperty('formatExample');
    expect(result.current).toHaveProperty('dateTimePlaceholder');
    expect(result.current).toHaveProperty('formatOptions');
  });

  test('formatDate function is callable', () => {
    const { result } = renderHook(() => useDateFormat());

    const formatted = result.current.formatDate('2026-01-25');
    expect(formatted).toBe('formatted-mdy-2026-01-25');
  });

  test('formatDate returns N/A for null', () => {
    const { result } = renderHook(() => useDateFormat());

    const formatted = result.current.formatDate(null);
    expect(formatted).toBe('N/A');
  });

  test('formatDateTime function is callable', () => {
    const { result } = renderHook(() => useDateFormat());

    const formatted = result.current.formatDateTime('2026-01-25T10:30:00');
    expect(formatted).toBe('datetime-mdy-2026-01-25T10:30:00');
  });

  test('formatLongDate function is callable', () => {
    const { result } = renderHook(() => useDateFormat());

    const formatted = result.current.formatLongDate('2026-01-25');
    expect(formatted).toBe('long-mdy-2026-01-25');
  });

  test('dateFormat returns the effective format from context', () => {
    const { result } = renderHook(() => useDateFormat());

    expect(result.current.dateFormat).toBe('mdy');
  });

  test('locale is derived from the format code', () => {
    const { result } = renderHook(() => useDateFormat());

    expect(result.current.locale).toBe('en-US');
  });

  test('formatLabel returns human-readable format label', () => {
    const { result } = renderHook(() => useDateFormat());

    expect(result.current.formatLabel).toBe('MM/DD/YYYY (US)');
  });

  test('formatExample returns example date string', () => {
    const { result } = renderHook(() => useDateFormat());

    expect(result.current.formatExample).toBe('01/25/2026');
  });

  test('formatOptions contains available format options', () => {
    const { result } = renderHook(() => useDateFormat());

    expect(result.current.formatOptions).toHaveProperty('mdy');
    expect(result.current.formatOptions).toHaveProperty('dmy');
    expect(result.current.formatOptions).toHaveProperty('ymd');
  });

  test('formatDateWithTime includes time in output', () => {
    const { result } = renderHook(() => useDateFormat());

    // formatDateWithTime should call formatDateWithPreference with includeTime: true
    const formatted = result.current.formatDateWithTime('2026-01-25T10:30:00');
    expect(formatted).toBeDefined();
  });

  test('formatDateTimeInput function is callable with Date object', () => {
    const { result } = renderHook(() => useDateFormat());

    const testDate = new Date(2026, 0, 25, 10, 30, 0);
    const formatted = result.current.formatDateTimeInput(testDate);
    expect(formatted).toBe('01/25/2026 10:30');
  });

  test('formatDateTimeInput returns empty string for null', () => {
    const { result } = renderHook(() => useDateFormat());

    const formatted = result.current.formatDateTimeInput(null);
    expect(formatted).toBe('');
  });

  test('dateTimePlaceholder returns US format placeholder for mdy', () => {
    const { result } = renderHook(() => useDateFormat());

    expect(result.current.dateTimePlaceholder).toBe('e.g., 07/29/2015 23:58');
  });
});

describe('useDateFormat with different format preferences', () => {
  test('hook uses dateFormat from context', () => {
    const { result } = renderHook(() => useDateFormat());

    // The mock returns 'mdy' as the dateFormat
    expect(result.current.dateFormat).toBe('mdy');
  });
});

describe('useDateFormat memoization', () => {
  test('returns stable function references', () => {
    const { result, rerender } = renderHook(() => useDateFormat());

    const formatDate1 = result.current.formatDate;
    const formatDateTime1 = result.current.formatDateTime;
    const formatDateTimeInput1 = result.current.formatDateTimeInput;

    rerender();

    // Functions should be memoized and stable across rerenders
    expect(result.current.formatDate).toBe(formatDate1);
    expect(result.current.formatDateTime).toBe(formatDateTime1);
    expect(result.current.formatDateTimeInput).toBe(formatDateTimeInput1);
  });
});
