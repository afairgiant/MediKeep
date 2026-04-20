import { describe, test, expect } from 'vitest';
import { createDateParser, formatDateFromPattern } from './dateUtils';

describe('createDateParser', () => {
  describe('DD.MM.YYYY (European / dmy_dot)', () => {
    const parse = createDateParser('DD.MM.YYYY');

    test.each([
      ['16.01.2018', 2018, 0, 16],
      // leading zero missing on month - the reported regression
      ['16.1.2018', 2018, 0, 16],
      // leading zero missing on day
      ['6.01.2018', 2018, 0, 6],
      ['6.1.2018', 2018, 0, 6],
      // accept slashes even when preference is dots
      ['16/01/2018', 2018, 0, 16],
      // accept dashes
      ['16-01-2018', 2018, 0, 16],
    ])('parses %s as %d-%d-%d', (input, year, monthIndex, day) => {
      const date = parse(input);
      expect(date).toBeInstanceOf(Date);
      expect(date.getFullYear()).toBe(year);
      expect(date.getMonth()).toBe(monthIndex);
      expect(date.getDate()).toBe(day);
    });

    test('rejects invalid month', () => {
      expect(parse('01.13.2018')).toBeNull();
    });

    test('rejects invalid day (Feb 30)', () => {
      expect(parse('30.02.2020')).toBeNull();
    });

    test('rejects non-date strings', () => {
      expect(parse('hello')).toBeNull();
      expect(parse('')).toBeNull();
      expect(parse(null)).toBeNull();
      expect(parse(undefined)).toBeNull();
    });

    test('rejects too few parts', () => {
      expect(parse('16.01')).toBeNull();
    });
  });

  describe('DD/MM/YYYY (UK/International / dmy)', () => {
    const parse = createDateParser('DD/MM/YYYY');

    test('parses slash form with leading zeros', () => {
      const date = parse('16/01/2018');
      expect(date.getDate()).toBe(16);
      expect(date.getMonth()).toBe(0);
    });

    test('parses without leading zeros', () => {
      const date = parse('6/1/2018');
      expect(date.getDate()).toBe(6);
      expect(date.getMonth()).toBe(0);
    });

    test('accepts dots as separator too', () => {
      const date = parse('16.01.2018');
      expect(date.getDate()).toBe(16);
      expect(date.getMonth()).toBe(0);
    });
  });

  describe('MM/DD/YYYY (US / mdy)', () => {
    const parse = createDateParser('MM/DD/YYYY');

    test('parses US order', () => {
      const date = parse('1/16/2018');
      expect(date.getMonth()).toBe(0);
      expect(date.getDate()).toBe(16);
    });

    test('rejects day>12 in month slot', () => {
      // "16/1/2018" under MM/DD/YYYY means month=16 which is invalid
      expect(parse('16/1/2018')).toBeNull();
    });
  });

  describe('YYYY-MM-DD (ISO / ymd)', () => {
    const parse = createDateParser('YYYY-MM-DD');

    test('parses ISO form', () => {
      const date = parse('2018-01-16');
      expect(date.getFullYear()).toBe(2018);
      expect(date.getMonth()).toBe(0);
      expect(date.getDate()).toBe(16);
    });

    test('parses with dots as separator', () => {
      const date = parse('2018.01.16');
      expect(date.getFullYear()).toBe(2018);
    });
  });
});

describe('formatDateFromPattern', () => {
  const date = new Date(2018, 0, 16); // 16 Jan 2018

  test.each([
    ['DD.MM.YYYY', '16.01.2018'],
    ['DD/MM/YYYY', '16/01/2018'],
    ['MM/DD/YYYY', '01/16/2018'],
    ['YYYY-MM-DD', '2018-01-16'],
  ])('pattern %s renders as %s', (pattern, expected) => {
    expect(formatDateFromPattern(date, pattern)).toBe(expected);
  });

  test('returns empty string for invalid date', () => {
    expect(formatDateFromPattern(new Date('not-a-date'), 'DD.MM.YYYY')).toBe(
      ''
    );
  });

  test('returns empty string for non-Date input', () => {
    expect(formatDateFromPattern('2018-01-16', 'DD.MM.YYYY')).toBe('');
  });

  test('returns empty string for missing pattern', () => {
    expect(formatDateFromPattern(date, '')).toBe('');
  });
});
