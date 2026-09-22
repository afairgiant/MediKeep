import { formatCurrencyDisplay, getCurrencyInputDecoration } from './currency';

// Intl.NumberFormat separates a trailing/leading currency symbol from the
// number with a non-breaking space (U+00A0), not a regular space - matters
// for exact string comparisons below.
const NBSP = ' ';

describe('formatCurrencyDisplay', () => {
  test('formats USD in en with a leading $ and no decimals for whole numbers', () => {
    expect(formatCurrencyDisplay(25, 'en')).toBe('$25');
    expect(formatCurrencyDisplay(0, 'en')).toBe('$0');
  });

  test('formats USD with a trailing symbol for locales that place it after the number', () => {
    expect(formatCurrencyDisplay(25, 'de')).toBe(`25${NBSP}$`);
  });

  test('preserves a meaningful (non-zero) decimal without padding to two places', () => {
    expect(formatCurrencyDisplay(25.5, 'en')).toBe('$25.5');
  });

  test('defaults to en/USD when locale and currency are omitted', () => {
    expect(formatCurrencyDisplay(25)).toBe('$25');
  });

  test('respects an explicit non-USD currency code', () => {
    expect(formatCurrencyDisplay(25, 'de', 'EUR')).toBe(`25${NBSP}€`);
  });

  test('falls back to a plain $-prefixed string for an invalid currency code rather than throwing', () => {
    expect(formatCurrencyDisplay(25, 'en', 'NOT_A_CURRENCY')).toBe('$25');
  });
});

describe('getCurrencyInputDecoration', () => {
  test('returns a prefix for en/USD (symbol before the number)', () => {
    expect(getCurrencyInputDecoration('en')).toEqual({
      prefix: '$',
      suffix: undefined,
    });
  });

  test('returns a suffix for locales that place the symbol after the number', () => {
    expect(getCurrencyInputDecoration('de')).toEqual({
      prefix: undefined,
      suffix: `${NBSP}$`,
    });
  });

  test('includes the space MediKeep locales that use one expect (e.g. nl)', () => {
    expect(getCurrencyInputDecoration('nl')).toEqual({
      prefix: `US$${NBSP}`,
      suffix: undefined,
    });
  });

  test('defaults to a $ prefix when locale/currency are omitted', () => {
    expect(getCurrencyInputDecoration()).toEqual({
      prefix: '$',
      suffix: undefined,
    });
  });

  test('falls back to a plain $ prefix for an invalid currency code rather than throwing', () => {
    expect(getCurrencyInputDecoration('en', 'NOT_A_CURRENCY')).toEqual({
      prefix: '$',
      suffix: undefined,
    });
  });
});
