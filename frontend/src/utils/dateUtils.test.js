import { describe, test, expect } from 'vitest';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { getDateParseFormats } from './dateUtils';

dayjs.extend(customParseFormat);

// Helper: try each format string in order, return first valid dayjs object or null
const tryParse = (input, formatCode) => {
  for (const fmt of getDateParseFormats(formatCode)) {
    const parsed = dayjs(input, fmt, true);
    if (parsed.isValid()) return parsed;
  }
  return null;
};

describe('getDateParseFormats', () => {
  test('returns an array for each format code', () => {
    expect(Array.isArray(getDateParseFormats('mdy'))).toBe(true);
    expect(Array.isArray(getDateParseFormats('dmy'))).toBe(true);
    expect(Array.isArray(getDateParseFormats('dmy_dot'))).toBe(true);
    expect(Array.isArray(getDateParseFormats('ymd'))).toBe(true);
  });

  test('dmy formats use slash separator only', () => {
    const formats = getDateParseFormats('dmy');
    expect(formats.every(f => f.includes('/'))).toBe(true);
    expect(formats.some(f => f.includes('.'))).toBe(false);
  });

  test('dmy formats include single-digit day/month variants', () => {
    const formats = getDateParseFormats('dmy');
    expect(formats.some(f => f.startsWith('D/'))).toBe(true);
  });

  test('mdy formats include single-digit month/day variants', () => {
    const formats = getDateParseFormats('mdy');
    expect(formats.some(f => f.startsWith('M/'))).toBe(true);
  });

  test('unknown format code falls back to mdy formats', () => {
    expect(getDateParseFormats('unknown')).toEqual(getDateParseFormats('mdy'));
  });
});

describe('getDateParseFormats — dmy parsing', () => {
  test('parses zero-padded DD/MM/YYYY with slash', () => {
    const parsed = tryParse('16/01/2018', 'dmy');
    expect(parsed?.isValid()).toBe(true);
    expect(parsed?.date()).toBe(16);
    expect(parsed?.month()).toBe(0); // January
    expect(parsed?.year()).toBe(2018);
  });

  test('parses single-digit D/M/YYYY with slash (the reported bug)', () => {
    const parsed = tryParse('5/1/2018', 'dmy');
    expect(parsed?.isValid()).toBe(true);
    expect(parsed?.date()).toBe(5);
    expect(parsed?.month()).toBe(0);
    expect(parsed?.year()).toBe(2018);
  });

  test('parses D/MM/YYYY (single-digit day, two-digit month)', () => {
    const parsed = tryParse('5/01/2018', 'dmy');
    expect(parsed?.isValid()).toBe(true);
    expect(parsed?.date()).toBe(5);
    expect(parsed?.month()).toBe(0);
  });

  test('parses DD/M/YYYY (two-digit day, single-digit month)', () => {
    const parsed = tryParse('16/1/2018', 'dmy');
    expect(parsed?.isValid()).toBe(true);
    expect(parsed?.date()).toBe(16);
    expect(parsed?.month()).toBe(0);
  });

  test('returns null for completely invalid input', () => {
    expect(tryParse('not-a-date', 'dmy')).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(tryParse('', 'dmy')).toBeNull();
  });

  test('parses valid dmy date 13/01/2018 as day=13, month=January', () => {
    const parsed = tryParse('13/01/2018', 'dmy');
    expect(parsed?.date()).toBe(13);
    expect(parsed?.month()).toBe(0);
  });
});

describe('getDateParseFormats — dmy_dot parsing', () => {
  test('parses zero-padded DD.MM.YYYY with dot separator', () => {
    const parsed = tryParse('16.01.2018', 'dmy_dot');
    expect(parsed?.isValid()).toBe(true);
    expect(parsed?.date()).toBe(16);
    expect(parsed?.month()).toBe(0); // January
    expect(parsed?.year()).toBe(2018);
  });

  test('parses single-digit D.M.YYYY', () => {
    const parsed = tryParse('5.1.2018', 'dmy_dot');
    expect(parsed?.isValid()).toBe(true);
    expect(parsed?.date()).toBe(5);
    expect(parsed?.month()).toBe(0);
    expect(parsed?.year()).toBe(2018);
  });

  test('parses D.MM.YYYY (single-digit day, two-digit month)', () => {
    const parsed = tryParse('5.01.2018', 'dmy_dot');
    expect(parsed?.isValid()).toBe(true);
    expect(parsed?.date()).toBe(5);
    expect(parsed?.month()).toBe(0);
  });

  test('parses DD.M.YYYY (two-digit day, single-digit month)', () => {
    const parsed = tryParse('16.1.2018', 'dmy_dot');
    expect(parsed?.isValid()).toBe(true);
    expect(parsed?.date()).toBe(16);
    expect(parsed?.month()).toBe(0);
  });

  test('rejects slash-separated input when dmy_dot is active', () => {
    expect(tryParse('16/01/2018', 'dmy_dot')).toBeNull();
  });

  test('returns null for invalid input', () => {
    expect(tryParse('not-a-date', 'dmy_dot')).toBeNull();
  });
});

describe('getDateParseFormats — format isolation', () => {
  test('US date 01/25/2026 is rejected when dmy is active (month=25 is invalid)', () => {
    expect(tryParse('01/25/2026', 'dmy')).toBeNull();
  });

  test('European date 25/01/2026 is rejected when mdy is active (month=25 is invalid)', () => {
    expect(tryParse('25/01/2026', 'mdy')).toBeNull();
  });

  test('ambiguous date 01/05/2026 with mdy resolves to January 5 (not May 1)', () => {
    const parsed = tryParse('01/05/2026', 'mdy');
    expect(parsed?.month()).toBe(0); // January
    expect(parsed?.date()).toBe(5);
  });

  test('ambiguous date 01/05/2026 with dmy resolves to May 1 (not January 5)', () => {
    const parsed = tryParse('01/05/2026', 'dmy');
    expect(parsed?.date()).toBe(1);
    expect(parsed?.month()).toBe(4); // May
  });
});

describe('getDateParseFormats — mdy parsing', () => {
  test('parses zero-padded MM/DD/YYYY', () => {
    const parsed = tryParse('01/25/2026', 'mdy');
    expect(parsed?.isValid()).toBe(true);
    expect(parsed?.month()).toBe(0); // January
    expect(parsed?.date()).toBe(25);
    expect(parsed?.year()).toBe(2026);
  });

  test('parses single-digit M/D/YYYY', () => {
    const parsed = tryParse('1/5/2026', 'mdy');
    expect(parsed?.isValid()).toBe(true);
    expect(parsed?.month()).toBe(0);
    expect(parsed?.date()).toBe(5);
  });

  test('returns null for invalid input', () => {
    expect(tryParse('not-a-date', 'mdy')).toBeNull();
  });
});

describe('getDateParseFormats — ymd parsing', () => {
  test('parses YYYY-MM-DD', () => {
    const parsed = tryParse('2018-01-16', 'ymd');
    expect(parsed?.isValid()).toBe(true);
    expect(parsed?.year()).toBe(2018);
    expect(parsed?.month()).toBe(0);
    expect(parsed?.date()).toBe(16);
  });

  test('returns null for invalid input', () => {
    expect(tryParse('not-a-date', 'ymd')).toBeNull();
  });
});
