#!/usr/bin/env node

/**
 * Translation consistency check.
 *
 * Compares every locale in public/locales against English (en) and fails on:
 *   - missing keys (plural forms are checked against each locale's rules)
 *   - extra keys that do not exist in English (plural forms valid for the
 *     locale, such as Polish/Russian _few and _many, are allowed)
 *   - empty values
 *   - {{placeholders}} that differ from the English string
 *   - values identical to English that are not on the per-locale allowlist
 *     (scripts/i18n-identical-allowlist.json)
 *
 * Usage:
 *   node scripts/check-translations.js                     # Full report
 *   node scripts/check-translations.js --namespace common  # Single namespace
 *   node scripts/check-translations.js --locale de         # Single locale
 *   node scripts/check-translations.js --json              # JSON output
 *   node scripts/check-translations.js --suggest-allowlist # Print unallowlisted identical values
 *   node scripts/check-translations.js --fix               # Copy missing keys from EN (placeholders)
 *
 * CommonJS on purpose: CI runs Node 18, which cannot load ESM syntax from a
 * plain .js file in a package without "type": "module".
 */

const fs = require('fs');
const path = require('path');
const { compareNamespace, pluralCategoriesFor } = require('./lib/i18nCheck');

const LOCALES_DIR = path.join(__dirname, '..', 'public', 'locales');
const ALLOWLIST_PATH = path.join(__dirname, 'i18n-identical-allowlist.json');

// Derived from disk so a new locale or namespace file is checked automatically
// instead of being silently skipped (hardcoded lists once left `th` and `zh`
// unchecked for months).
const ALL_LOCALES = fs
  .readdirSync(LOCALES_DIR, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();
const listNamespaces = locale =>
  fs
    .readdirSync(path.join(LOCALES_DIR, locale))
    .filter(name => name.endsWith('.json'))
    .map(name => name.slice(0, -'.json'.length))
    .sort();

if (!ALL_LOCALES.includes('en')) {
  console.error(`English baseline not found in ${LOCALES_DIR}`);
  process.exit(1);
}
const ALL_NAMESPACES = listNamespaces('en');

// --- Argument parsing ---------------------------------------------------
const args = process.argv.slice(2);
const getArg = flag => {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
};
const hasFlag = flag => args.includes(flag);

const filterLocale = getArg('--locale');
const filterNamespace = getArg('--namespace') || getArg('--ns');
const jsonOutput = hasFlag('--json');
const fixMode = hasFlag('--fix');
const suggestAllowlist = hasFlag('--suggest-allowlist');

if (hasFlag('--help') || hasFlag('-h')) {
  console.log(`
Translation Key Checker
=======================

Compares locale files against English (en) as the baseline. Exits 1 on any
missing key, extra key, empty value, placeholder mismatch, or value identical
to English that is not allowlisted.

Options:
  --locale <code>       Check only one locale (${ALL_LOCALES.filter(l => l !== 'en').join(', ')})
  --namespace <name>    Check only one namespace (${ALL_NAMESPACES.join(', ')})
  --ns <name>           Alias for --namespace
  --json                Output results as JSON
  --suggest-allowlist   Print identical-to-English values not yet allowlisted
  --fix                 Copy missing keys from EN. The English placeholders will
                        then fail the identical-to-English check until translated.
  --help, -h            Show this help message

Allowlist: scripts/i18n-identical-allowlist.json maps a locale to the English
values that are legitimately the same in that language (for example "Status" in
German). Add an entry only after confirming the English word is correct there.
`);
  process.exit(0);
}

// --- Helpers ------------------------------------------------------------

function loadJSON(locale, namespace) {
  const filePath = path.join(LOCALES_DIR, locale, `${namespace}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// Entries are arrays of English values keyed by locale; "*" applies to every
// locale. Non-array keys (such as "_readme") are ignored.
function loadAllowlist() {
  if (!fs.existsSync(ALLOWLIST_PATH)) return {};
  const raw = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  const allowlist = {};
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) allowlist[key] = value;
  }
  return allowlist;
}

const PROTO_POLLUTE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function getNestedValue(obj, dotPath) {
  return dotPath.split('.').reduce((acc, part) => acc && acc[part], obj);
}

function setNestedValue(obj, dotPath, value) {
  const parts = dotPath.split('.');
  if (parts.some(p => PROTO_POLLUTE_KEYS.has(p))) return;
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

// --- Main ---------------------------------------------------------------

const localesToCheck = ALL_LOCALES.filter(
  l => l !== 'en' && (!filterLocale || l === filterLocale)
);
const namespacesToCheck = filterNamespace
  ? ALL_NAMESPACES.filter(n => n === filterNamespace)
  : ALL_NAMESPACES;

if (localesToCheck.length === 0) {
  console.error(
    `Invalid locale: ${filterLocale}. Must be one of: ${ALL_LOCALES.filter(l => l !== 'en').join(', ')}`
  );
  process.exit(1);
}
if (namespacesToCheck.length === 0) {
  console.error(
    `Invalid namespace: ${filterNamespace}. Must be one of: ${ALL_NAMESPACES.join(', ')}`
  );
  process.exit(1);
}

try {
  ALL_LOCALES.forEach(pluralCategoriesFor);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const allowlist = loadAllowlist();
const seenByLocale = {};
const report = {
  summary: {
    totalMissing: 0,
    totalExtra: 0,
    totalEmpty: 0,
    totalPlaceholderMismatch: 0,
    totalIdentical: 0,
    totalErrors: 0,
  },
  staleAllowlist: {},
  locales: {},
};

for (const locale of localesToCheck) {
  report.locales[locale] = { namespaces: {} };
  for (const namespace of listNamespaces(locale)) {
    if (!ALL_NAMESPACES.includes(namespace) && !filterNamespace) {
      report.summary.totalErrors += 1;
      report.locales[locale].namespaces[namespace] = {
        error: 'File has no English counterpart',
      };
    }
  }
  const seenIdentical = new Set();
  const localeAllowlist = [
    ...(allowlist['*'] || []),
    ...(allowlist[locale] || []),
  ];

  for (const namespace of namespacesToCheck) {
    const enData = loadJSON('en', namespace);
    const localeData = loadJSON(locale, namespace);

    if (!enData || !localeData) {
      report.summary.totalErrors += 1;
      report.locales[locale].namespaces[namespace] = {
        error: !enData ? 'EN file not found' : 'Locale file not found',
      };
      continue;
    }

    const result = compareNamespace(enData, localeData, locale, localeAllowlist);
    result.identicalValues.forEach(v => seenIdentical.add(v));

    report.summary.totalMissing += result.missing.length;
    report.summary.totalExtra += result.extra.length;
    report.summary.totalEmpty += result.empty.length;
    report.summary.totalPlaceholderMismatch += result.placeholderMismatch.length;
    report.summary.totalIdentical += result.identical.length;

    report.locales[locale].namespaces[namespace] = {
      missing: result.missing,
      extra: result.extra,
      empty: result.empty,
      placeholderMismatch: result.placeholderMismatch,
      identical: result.identical,
      identicalUnallowed: [...result.identicalUnallowed],
    };

    if (fixMode && result.missing.length > 0) {
      const updated = JSON.parse(JSON.stringify(localeData));
      for (const key of result.missing) {
        setNestedValue(updated, key, getNestedValue(enData, key));
      }
      fs.writeFileSync(
        path.join(LOCALES_DIR, locale, `${namespace}.json`),
        JSON.stringify(updated, null, 2) + '\n',
        'utf8'
      );
    }
  }

  seenByLocale[locale] = seenIdentical;
  // Only meaningful when every namespace was scanned.
  if (!filterNamespace) {
    const stale = (allowlist[locale] || []).filter(v => !seenIdentical.has(v));
    if (stale.length > 0) report.staleAllowlist[locale] = stale;
  }
}

if (!filterNamespace && !filterLocale) {
  const staleGlobal = (allowlist['*'] || []).filter(
    v => !Object.values(seenByLocale).some(seen => seen.has(v))
  );
  if (staleGlobal.length > 0) report.staleAllowlist['*'] = staleGlobal;
}

const s = report.summary;
const hasIssues =
  s.totalMissing +
    s.totalExtra +
    s.totalEmpty +
    s.totalPlaceholderMismatch +
    s.totalIdentical +
    s.totalErrors >
  0;

if (suggestAllowlist) {
  const suggestions = {};
  for (const [locale, localeReport] of Object.entries(report.locales)) {
    const values = new Set();
    for (const nsReport of Object.values(localeReport.namespaces)) {
      (nsReport.identicalUnallowed || []).forEach(v => values.add(v));
    }
    if (values.size > 0) suggestions[locale] = [...values].sort();
  }
  console.log(JSON.stringify(suggestions, null, 2));
  process.exit(0);
}

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(hasIssues ? 1 : 0);
}

const list = (label, marker, items) => {
  if (items.length === 0) return;
  console.log(`     ${label} (${items.length}):`);
  items.forEach(k => console.log(`       ${marker} ${k}`));
};

console.log('\nTranslation consistency report\n');

for (const [locale, localeReport] of Object.entries(report.locales)) {
  for (const [namespace, nsReport] of Object.entries(localeReport.namespaces)) {
    const label = `${locale.toUpperCase()}/${namespace}.json`;
    if (nsReport.error) {
      console.log(`  FAIL ${label}: ${nsReport.error}`);
      continue;
    }
    const { missing, extra, empty, placeholderMismatch, identical } = nsReport;
    const ok =
      missing.length +
        extra.length +
        empty.length +
        placeholderMismatch.length +
        identical.length ===
      0;
    if (ok) {
      console.log(`  OK   ${label}`);
      continue;
    }
    console.log(`  FAIL ${label}`);
    list('Missing', '-', missing);
    list('Extra', '+', extra);
    list('Empty', '~', empty);
    list('Placeholder mismatch', '!', placeholderMismatch);
    list('Identical to English (translate, or allowlist if correct)', '=', identical);
  }
}

for (const [locale, values] of Object.entries(report.staleAllowlist)) {
  console.log(
    `\n  Note: ${values.length} allowlist entr${values.length === 1 ? 'y' : 'ies'} for ${locale} no longer match anything: ${values.join(', ')}`
  );
}

console.log('\n----------------------------------------------------------------');
console.log(
  `  ${s.totalMissing} missing, ${s.totalExtra} extra, ${s.totalEmpty} empty, ` +
    `${s.totalPlaceholderMismatch} placeholder mismatches, ${s.totalIdentical} identical to English`
);
if (fixMode && s.totalMissing > 0) {
  console.log(
    `  Fixed: copied ${s.totalMissing} missing keys from EN (English placeholders)`
  );
}
console.log('----------------------------------------------------------------\n');

process.exit(hasIssues ? 1 : 0);
