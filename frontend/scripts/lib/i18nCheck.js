/**
 * Pure helpers for scripts/check-translations.js.
 *
 * Kept free of file I/O so the rules can be unit tested with small fixtures.
 * CommonJS on purpose: CI runs Node 18, which cannot load ESM syntax from a
 * plain .js file in a package without "type": "module".
 */

const PLURAL_KEY_PATTERN = /^(.*)_(zero|one|two|few|many|other)$/;

// CLDR cardinal plural categories per locale. Hardcoded rather than read from
// Intl.PluralRules because the ICU data differs between Node versions (fr, es,
// it and pt gained `many` in newer CLDR), and this check must give the same
// answer locally and in CI.
const PLURAL_CATEGORIES = {
  en: ['one', 'other'],
  de: ['one', 'other'],
  nl: ['one', 'other'],
  sv: ['one', 'other'],
  el: ['one', 'other'],
  es: ['one', 'many', 'other'],
  fr: ['one', 'many', 'other'],
  it: ['one', 'many', 'other'],
  pt: ['one', 'many', 'other'],
  pl: ['one', 'few', 'many', 'other'],
  ru: ['one', 'few', 'many', 'other'],
  th: ['other'],
  zh: ['other'],
};

// Only `one` and `other` are required. `few`/`many` are accepted but not
// demanded: most Polish and Russian plural keys predate this check and only
// carry `_one`/`_other`.
const REQUIRED_PLURAL_SUFFIXES = ['one', 'other'];

// Brand and vendor names that are the same in every language.
const IDENTICAL_EXEMPT_KEY_PATTERNS = [
  /manufacturerOptions\./,
  /brand\.options\./,
];

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function flattenKeys(obj, prefix = '') {
  const out = {};
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(obj[key])) {
      Object.assign(out, flattenKeys(obj[key], fullKey));
    } else {
      out[fullKey] = obj[key];
    }
  }
  return out;
}

function splitPluralKey(key) {
  const match = PLURAL_KEY_PATTERN.exec(key);
  return match ? { base: match[1], suffix: match[2] } : null;
}

// Throws for an unknown locale so a newly added language cannot be checked
// against the wrong plural rules, or silently skipped.
function pluralCategoriesFor(locale) {
  const categories = PLURAL_CATEGORIES[locale];
  if (!categories) {
    throw new Error(
      `No plural categories defined for locale "${locale}". Add it to PLURAL_CATEGORIES in scripts/lib/i18nCheck.js.`
    );
  }
  return categories;
}

function placeholdersOf(value) {
  return (String(value).match(/{{\s*\w+\s*}}/g) || []).map(p =>
    p.replace(/\s+/g, '')
  );
}

// Unbalanced braces such as "{{type}" render as literal text.
function hasMalformedPlaceholder(value) {
  const stripped = String(value).replace(/{{\s*\w+\s*}}/g, '');
  return /{{|}}|{\s*\w+\s*}/.test(stripped);
}

// English grammar slots that other languages cannot always fill.
const DROPPABLE_PLACEHOLDERS = new Set(['{{verb}}']);
// Singular forms may say "one file" instead of "{{count}} file".
const SINGULAR_SUFFIXES = ['zero', 'one', 'two'];

/**
 * A translation may not introduce a {{placeholder}} English does not have or
 * leave braces unbalanced. It may drop only {{verb}}-style grammar slots, or
 * {{count}} on a singular plural form. Any other dropped placeholder means the
 * sentence no longer says what English says.
 */
function hasPlaceholderProblem(enValue, localeValue, key = '') {
  const enPlaceholders = new Set(placeholdersOf(enValue));
  const localePlaceholders = new Set(placeholdersOf(localeValue));
  const split = splitPluralKey(key);
  const singular = split && SINGULAR_SUFFIXES.includes(split.suffix);

  if (hasMalformedPlaceholder(localeValue)) return true;
  for (const p of localePlaceholders) {
    if (!enPlaceholders.has(p)) return true;
  }
  for (const p of enPlaceholders) {
    if (localePlaceholders.has(p)) continue;
    if (DROPPABLE_PLACEHOLDERS.has(p)) continue;
    if (singular && p === '{{count}}') continue;
    return true;
  }
  return false;
}

/**
 * Values that cannot meaningfully be translated: no words, URLs, emails,
 * acronyms and single technical tokens such as "my-alerts".
 */
function isExemptFromIdentical(value) {
  if (typeof value !== 'string') return true;
  const text = value.replace(/{{\s*\w+\s*}}/g, '').trim();
  if (!/[A-Za-z]{2}/.test(text)) return true;
  if (/https?:\/\/|@\w/.test(value)) return true;
  if (!/[a-z]/.test(text)) return true;
  if (!/\s/.test(text) && /[-./_:0-9]/.test(text)) return true;
  return false;
}

/**
 * Compare one locale namespace against English.
 *
 * Returns { missing, extra, empty, placeholderMismatch, identical, identicalValues,
 * identicalUnallowed }: `identical` lists keys, the two sets hold English values.
 */
function compareNamespace(enData, localeData, locale, allowlist = []) {
  const en = flattenKeys(enData);
  const loc = flattenKeys(localeData);
  const categories = pluralCategoriesFor(locale);
  const allowed = new Set(allowlist);

  const enPluralBases = new Set();
  for (const key of Object.keys(en)) {
    const split = splitPluralKey(key);
    if (split) enPluralBases.add(split.base);
  }

  const missing = [];
  for (const key of Object.keys(en)) {
    if (key in loc) continue;
    const split = splitPluralKey(key);
    if (split && enPluralBases.has(split.base)) {
      const required =
        REQUIRED_PLURAL_SUFFIXES.includes(split.suffix) &&
        categories.includes(split.suffix);
      if (!required) continue;
    }
    missing.push(key);
  }

  const extra = [];
  for (const key of Object.keys(loc)) {
    if (key in en) continue;
    const split = splitPluralKey(key);
    if (
      split &&
      enPluralBases.has(split.base) &&
      categories.includes(split.suffix)
    ) {
      continue;
    }
    extra.push(key);
  }

  const empty = Object.keys(loc).filter(
    key => typeof loc[key] === 'string' && loc[key].trim() === ''
  );

  const placeholderMismatch = [];
  const identical = [];
  const identicalValues = new Set();
  const identicalUnallowed = new Set();
  for (const key of Object.keys(loc)) {
    if (!(key in en) || typeof loc[key] !== 'string') continue;
    if (typeof en[key] === 'string') {
      if (hasPlaceholderProblem(en[key], loc[key], key)) {
        placeholderMismatch.push(key);
      }
    }
    if (loc[key] !== en[key]) continue;
    if (isExemptFromIdentical(en[key])) continue;
    if (IDENTICAL_EXEMPT_KEY_PATTERNS.some(p => p.test(key))) continue;
    identicalValues.add(en[key]);
    if (!allowed.has(en[key])) {
      identical.push(key);
      identicalUnallowed.add(en[key]);
    }
  }

  return {
    missing: missing.sort(),
    extra: extra.sort(),
    empty: empty.sort(),
    placeholderMismatch: placeholderMismatch.sort(),
    identical: identical.sort(),
    identicalValues,
    identicalUnallowed,
  };
}

module.exports = {
  PLURAL_CATEGORIES,
  REQUIRED_PLURAL_SUFFIXES,
  flattenKeys,
  splitPluralKey,
  pluralCategoriesFor,
  placeholdersOf,
  hasPlaceholderProblem,
  isExemptFromIdentical,
  compareNamespace,
};
