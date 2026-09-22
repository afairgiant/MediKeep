/**
 * Currency formatting utilities.
 *
 * MediKeep does not yet store a currency code anywhere (every amount is
 * implicitly USD) - `currencyCode` exists as a parameter here, defaulted to
 * 'USD', purely so that landing real per-record/per-user currency support
 * later means passing a real code into these same calls, not rewriting
 * currency formatting logic across every call site that displays money.
 *
 * `locale` should be the caller's active i18next locale (`i18n.language`)
 * so amounts render with the decimal separator, symbol, and symbol
 * placement each of MediKeep's supported languages actually expects,
 * instead of always looking like US-formatted USD.
 */

const DEFAULT_CURRENCY_CODE = 'USD';
const DEFAULT_LOCALE = 'en';

/**
 * Formats a numeric value as a locale-correct currency string for
 * read-only display (insurance Card, Print, View dialog).
 *
 * @param {number|string} value
 * @param {string} [locale] - BCP 47 locale, e.g. i18n.language.
 * @param {string} [currencyCode] - ISO 4217 code.
 * @returns {string}
 */
export const formatCurrencyDisplay = (
  value,
  locale = DEFAULT_LOCALE,
  currencyCode = DEFAULT_CURRENCY_CODE
) => {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
    }).format(value);
  } catch {
    // Unknown/invalid locale or currency code - fall back to the plain
    // USD-prefixed format this app has always used rather than throwing.
    return `$${value}`;
  }
};

/**
 * Derives the currency symbol/label and whether it belongs before or after
 * the number, for use as a live editable NumberInput's `prefix`/`suffix`
 * decoration. NumberInput can't take an opaque pre-formatted string the way
 * the read-only display surfaces can, so this splits the same Intl data
 * apart instead of hand-guessing placement per currency.
 *
 * Note: this only decorates the input with the right symbol in the right
 * position - it does not localize the input's own decimal/thousands
 * separators, which remain period/comma as Mantine's NumberInput defaults.
 *
 * @param {string} [locale]
 * @param {string} [currencyCode]
 * @returns {{ prefix: string|undefined, suffix: string|undefined }}
 */
export const getCurrencyInputDecoration = (
  locale = DEFAULT_LOCALE,
  currencyCode = DEFAULT_CURRENCY_CODE
) => {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
    }).formatToParts(0);

    const currencyIndex = parts.findIndex(part => part.type === 'currency');
    if (currencyIndex === -1) {
      return { prefix: undefined, suffix: undefined };
    }

    const symbol = parts[currencyIndex].value;
    const isLast = currencyIndex === parts.length - 1;
    const spacerPart = parts[currencyIndex + (isLast ? -1 : 1)];
    const spacer = spacerPart?.type === 'literal' ? spacerPart.value : '';

    return isLast
      ? { prefix: undefined, suffix: `${spacer}${symbol}` }
      : { prefix: `${symbol}${spacer}`, suffix: undefined };
  } catch {
    return { prefix: '$', suffix: undefined };
  }
};
