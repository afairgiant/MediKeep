#!/usr/bin/env node

/**
 * Translation Key Detection Script
 *
 * Compares all locale JSON files against the English (en) baseline
 * and reports missing keys, extra keys, and empty values.
 *
 * Usage:
 *   node scripts/check-translations.js              # Full report
 *   node scripts/check-translations.js --namespace common   # Single namespace
 *   node scripts/check-translations.js --locale de          # Single locale
 *   node scripts/check-translations.js --json               # JSON output
 *   node scripts/check-translations.js --fix                # Auto-copy missing keys from EN (English value)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCALES_DIR = path.join(__dirname, '..', 'public', 'locales');
const ALL_LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt'];
const ALL_NAMESPACES = ['common', 'medical', 'errors', 'navigation', 'notifications', 'admin'];

// ─── Argument Parsing ────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
};
const hasFlag = (flag) => args.includes(flag);

const filterLocale = getArg('--locale');
const filterNamespace = getArg('--namespace') || getArg('--ns');
const jsonOutput = hasFlag('--json');
const fixMode = hasFlag('--fix');
const showHelp = hasFlag('--help') || hasFlag('-h');

if (showHelp) {
  console.log(`
Translation Key Checker
=======================

Compares locale files against English (en) as the baseline.

Options:
  --locale <code>       Check only one locale (de, es, fr, it, pt)
  --namespace <name>    Check only one namespace (common, medical, errors, navigation, notifications)
  --ns <name>           Alias for --namespace
  --json                Output results as JSON
  --fix                 Auto-copy missing keys from EN (uses English value as placeholder)
  --help, -h            Show this help message

Examples:
  node scripts/check-translations.js
  node scripts/check-translations.js --locale de
  node scripts/check-translations.js --namespace notifications --fix
  node scripts/check-translations.js --json > report.json
`);
  process.exit(0);
}

// ─── Helpers ─────────────────────────────────────────────────────────

function loadJSON(locale, namespace) {
  const filePath = path.join(LOCALES_DIR, locale, `${namespace}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function extractKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(extractKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function getNestedValue(obj, dotPath) {
  return dotPath.split('.').reduce((acc, part) => acc && acc[part], obj);
}

const PROTO_POLLUTE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function setNestedValue(obj, dotPath, value) {
  const parts = dotPath.split('.');
  // Guard against prototype pollution
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

function findEmptyValues(obj, prefix = '') {
  const empties = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      empties.push(...findEmptyValues(obj[key], fullKey));
    } else if (typeof obj[key] === 'string' && obj[key].trim() === '') {
      empties.push(fullKey);
    }
  }
  return empties;
}

// ─── Main Logic ──────────────────────────────────────────────────────

const localesToCheck = filterLocale
  ? ALL_LOCALES.filter(l => l === filterLocale && l !== 'en')
  : ALL_LOCALES.filter(l => l !== 'en');

const namespacesToCheck = filterNamespace
  ? ALL_NAMESPACES.filter(n => n === filterNamespace)
  : ALL_NAMESPACES;

if (localesToCheck.length === 0) {
  console.error(`Invalid locale: ${filterLocale}. Must be one of: ${ALL_LOCALES.filter(l => l !== 'en').join(', ')}`);
  process.exit(1);
}

if (namespacesToCheck.length === 0) {
  console.error(`Invalid namespace: ${filterNamespace}. Must be one of: ${ALL_NAMESPACES.join(', ')}`);
  process.exit(1);
}

const report = {
  summary: { totalMissing: 0, totalExtra: 0, totalEmpty: 0 },
  locales: {},
};

for (const locale of localesToCheck) {
  report.locales[locale] = { namespaces: {} };

  for (const namespace of namespacesToCheck) {
    const enData = loadJSON('en', namespace);
    const localeData = loadJSON(locale, namespace);

    if (!enData) {
      report.locales[locale].namespaces[namespace] = { error: 'EN file not found' };
      continue;
    }

    if (!localeData) {
      report.locales[locale].namespaces[namespace] = { error: 'Locale file not found' };
      continue;
    }

    const enKeys = extractKeys(enData).sort();
    const localeKeys = extractKeys(localeData).sort();

    const missing = enKeys.filter(k => !localeKeys.includes(k));
    const extra = localeKeys.filter(k => !enKeys.includes(k));
    const empty = findEmptyValues(localeData);

    report.summary.totalMissing += missing.length;
    report.summary.totalExtra += extra.length;
    report.summary.totalEmpty += empty.length;

    report.locales[locale].namespaces[namespace] = {
      enKeyCount: enKeys.length,
      localeKeyCount: localeKeys.length,
      missing,
      extra,
      empty,
    };

    // ─── Fix Mode: copy missing keys from EN ──────────────────
    if (fixMode && missing.length > 0) {
      const updatedData = JSON.parse(JSON.stringify(localeData));
      for (const key of missing) {
        const enValue = getNestedValue(enData, key);
        setNestedValue(updatedData, key, enValue);
      }
      const filePath = path.join(LOCALES_DIR, locale, `${namespace}.json`);
      fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2) + '\n', 'utf8');
    }
  }
}

// ─── Output ──────────────────────────────────────────────────────────

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.summary.totalMissing > 0 ? 1 : 0);
}

// Console table output
const { totalMissing, totalExtra, totalEmpty } = report.summary;

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║              Translation Key Consistency Report             ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

let hasIssues = false;

for (const [locale, localeReport] of Object.entries(report.locales)) {
  for (const [namespace, nsReport] of Object.entries(localeReport.namespaces)) {
    if (nsReport.error) {
      console.log(`  ❌ ${locale.toUpperCase()}/${namespace}: ${nsReport.error}`);
      hasIssues = true;
      continue;
    }

    const { missing, extra, empty, enKeyCount, localeKeyCount } = nsReport;
    const ok = missing.length === 0 && extra.length === 0 && empty.length === 0;

    if (ok) {
      console.log(`  ✅ ${locale.toUpperCase()}/${namespace}.json — ${localeKeyCount}/${enKeyCount} keys`);
    } else {
      hasIssues = true;
      console.log(`  ⚠️  ${locale.toUpperCase()}/${namespace}.json — ${localeKeyCount}/${enKeyCount} keys`);

      if (missing.length > 0) {
        console.log(`     Missing (${missing.length}):`);
        missing.forEach(k => console.log(`       - ${k}`));
      }
      if (extra.length > 0) {
        console.log(`     Extra (${extra.length}):`);
        extra.forEach(k => console.log(`       + ${k}`));
      }
      if (empty.length > 0) {
        console.log(`     Empty (${empty.length}):`);
        empty.forEach(k => console.log(`       ~ ${k}`));
      }
    }
  }
}

console.log('\n──────────────────────────────────────────────────────────────');
console.log(`  Total: ${totalMissing} missing, ${totalExtra} extra, ${totalEmpty} empty`);

if (fixMode && totalMissing > 0) {
  console.log(`  📝 Fixed: copied ${totalMissing} missing keys from EN (English values as placeholders)`);
}

console.log('──────────────────────────────────────────────────────────────\n');

process.exit(hasIssues ? 1 : 0);
