import { describe, test, expect } from 'vitest';
import {
  getLocaleForFormat,
  formatDateWithPreference,
  formatDateLong,
  formatDateTimeWithPreference,
  getDateFormatLabel,
  getDateFormatExample,
} from './dateFormatUtils';

describe('dateFormatUtils', () => {
  describe('getLocaleForFormat', () => {
    test('returns en-US locale for mdy format', () => {
      expect(getLocaleForFormat('mdy')).toBe('en-US');
    });

    test('returns en-GB locale for dmy format', () => {
      expect(getLocaleForFormat('dmy')).toBe('en-GB');
    });

    test('returns sv-SE locale for ymd format (ISO)', () => {
      expect(getLocaleForFormat('ymd')).toBe('sv-SE');
    });

    test('returns default locale for invalid format code', () => {
      expect(getLocaleForFormat('invalid')).toBe('en-US');
    });

    test('returns default locale for undefined format code', () => {
      expect(getLocaleForFormat(undefined)).toBe('en-US');
    });
  });

  describe('formatDateWithPreference', () => {
    test('returns N/A for null value', () => {
      expect(formatDateWithPreference(null)).toBe('N/A');
    });

    test('returns N/A for undefined value', () => {
      expect(formatDateWithPreference(undefined)).toBe('N/A');
    });

    test('returns N/A for empty string', () => {
      expect(formatDateWithPreference('')).toBe('N/A');
    });

    test('returns Invalid Date for invalid date string', () => {
      expect(formatDateWithPreference('not-a-date')).toBe('Invalid Date');
    });

    test('formats YYYY-MM-DD string correctly for mdy format', () => {
      const result = formatDateWithPreference('2026-01-25', 'mdy');
      // en-US format: MM/DD/YYYY
      expect(result).toBe('01/25/2026');
    });

    test('formats YYYY-MM-DD string correctly for dmy format', () => {
      const result = formatDateWithPreference('2026-01-25', 'dmy');
      // en-GB format: DD/MM/YYYY
      expect(result).toBe('25/01/2026');
    });

    test('formats YYYY-MM-DD string correctly for ymd format', () => {
      const result = formatDateWithPreference('2026-01-25', 'ymd');
      // sv-SE format: YYYY-MM-DD
      expect(result).toBe('2026-01-25');
    });

    test('handles Date object input', () => {
      const date = new Date(2026, 0, 25); // January 25, 2026
      const result = formatDateWithPreference(date, 'mdy');
      expect(result).toBe('01/25/2026');
    });

    test('handles ISO datetime string by parsing full datetime', () => {
      const result = formatDateWithPreference('2026-01-25T10:30:00Z', 'mdy');
      // Should parse the datetime and format the date portion
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    test('uses default format when none specified', () => {
      const result = formatDateWithPreference('2026-01-25');
      // Default is mdy (en-US)
      expect(result).toBe('01/25/2026');
    });

    test('includes time when includeTime option is true', () => {
      const result = formatDateWithPreference('2026-01-25T10:30:00', 'mdy', {
        includeTime: true,
      });
      // Should include time component
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });
  });

  describe('formatDateLong', () => {
    test('returns N/A for null value', () => {
      expect(formatDateLong(null)).toBe('N/A');
    });

    test('returns N/A for undefined value', () => {
      expect(formatDateLong(undefined)).toBe('N/A');
    });

    test('returns Invalid Date for invalid date string', () => {
      expect(formatDateLong('not-a-date')).toBe('Invalid Date');
    });

    test('formats date with short month name for mdy', () => {
      const result = formatDateLong('2026-01-25', 'mdy');
      // en-US: "Jan 25, 2026"
      expect(result).toMatch(/Jan/);
      expect(result).toMatch(/25/);
      expect(result).toMatch(/2026/);
    });

    test('formats date with short month name for dmy', () => {
      const result = formatDateLong('2026-01-25', 'dmy');
      // en-GB: "25 Jan 2026"
      expect(result).toMatch(/Jan/);
      expect(result).toMatch(/25/);
      expect(result).toMatch(/2026/);
    });

    test('formats date with long month name when longMonth is true', () => {
      const result = formatDateLong('2026-01-25', 'mdy', true);
      // Should have "January" instead of "Jan"
      expect(result).toMatch(/January/);
    });

    test('handles YYYY-MM-DD string without timezone issues', () => {
      // This should create the date in local time, not UTC
      const result = formatDateLong('2026-01-25', 'mdy');
      // Should show 25, not 24 (which would happen with UTC conversion)
      expect(result).toMatch(/25/);
    });
  });

  describe('formatDateTimeWithPreference', () => {
    test('returns N/A for null value', () => {
      expect(formatDateTimeWithPreference(null)).toBe('N/A');
    });

    test('returns N/A for undefined value', () => {
      expect(formatDateTimeWithPreference(undefined)).toBe('N/A');
    });

    test('returns Invalid Date for invalid date string', () => {
      expect(formatDateTimeWithPreference('not-a-date')).toBe('Invalid Date');
    });

    test('formats datetime with mdy format', () => {
      const result = formatDateTimeWithPreference(
        '2026-01-25T10:30:00',
        'mdy'
      );
      // Should include both date and time
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    test('formats datetime with dmy format', () => {
      const result = formatDateTimeWithPreference(
        '2026-01-25T10:30:00',
        'dmy'
      );
      // en-GB format for date portion
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    test('includes timezone name when includeTimezone is true', () => {
      const result = formatDateTimeWithPreference(
        '2026-01-25T10:30:00Z',
        'mdy',
        { includeTimezone: true }
      );
      // Should include a timezone abbreviation (varies by system)
      expect(result.length).toBeGreaterThan(15);
    });
  });

  describe('getDateFormatLabel', () => {
    test('returns correct label for mdy', () => {
      expect(getDateFormatLabel('mdy')).toBe('MM/DD/YYYY (US)');
    });

    test('returns correct label for dmy', () => {
      expect(getDateFormatLabel('dmy')).toBe('DD/MM/YYYY (EU)');
    });

    test('returns correct label for ymd', () => {
      expect(getDateFormatLabel('ymd')).toBe('YYYY-MM-DD (ISO)');
    });

    test('returns default label for invalid format', () => {
      expect(getDateFormatLabel('invalid')).toBe('MM/DD/YYYY (US)');
    });
  });

  describe('getDateFormatExample', () => {
    test('returns correct example for mdy', () => {
      expect(getDateFormatExample('mdy')).toBe('01/25/2026');
    });

    test('returns correct example for dmy', () => {
      expect(getDateFormatExample('dmy')).toBe('25/01/2026');
    });

    test('returns correct example for ymd', () => {
      expect(getDateFormatExample('ymd')).toBe('2026-01-25');
    });

    test('returns default example for invalid format', () => {
      expect(getDateFormatExample('invalid')).toBe('01/25/2026');
    });
  });

  describe('Edge cases', () => {
    test('handles date at year boundary', () => {
      const result = formatDateWithPreference('2025-12-31', 'mdy');
      expect(result).toBe('12/31/2025');
    });

    test('handles leap year date', () => {
      const result = formatDateWithPreference('2024-02-29', 'mdy');
      expect(result).toBe('02/29/2024');
    });

    test('handles date with leading zeros', () => {
      const result = formatDateWithPreference('2026-01-05', 'mdy');
      expect(result).toBe('01/05/2026');
    });

    test('handles whitespace in date string', () => {
      const result = formatDateWithPreference('  2026-01-25  ', 'mdy');
      expect(result).toBe('01/25/2026');
    });
  });
});
