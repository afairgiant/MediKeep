#!/usr/bin/env node

/**
 * i18n Phase 2 Deduplication Script
 *
 * Consolidates duplicate translation values into a shared.json namespace.
 * Runs in three tiers: high (10+), medium (5-9), full (3-4 occurrences).
 *
 * Usage:
 *   node scripts/i18n-phase2-dedup.js --tier high --dry-run     # Preview
 *   node scripts/i18n-phase2-dedup.js --tier high               # Apply
 *   node scripts/i18n-phase2-dedup.js --tier high --step analyze # Just show mapping
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCALES_DIR = path.join(__dirname, '..', 'public', 'locales');
const SRC_DIR = path.join(__dirname, '..', 'src');
const ALL_LOCALES = ['en', 'de', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'sv'];
const ALL_NAMESPACES = ['common', 'medical', 'admin', 'navigation', 'notifications', 'errors', 'reportPdf'];

// ─── CLI Args ───────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
};
const hasFlag = (flag) => args.includes(flag);

const TIER = getArg('--tier');
const DRY_RUN = hasFlag('--dry-run');
const STEP = getArg('--step') || 'all';
const VERBOSE = hasFlag('--verbose');

if (!TIER || !['high', 'medium', 'full'].includes(TIER)) {
  console.error('Usage: node i18n-phase2-dedup.js --tier high|medium|full [--dry-run] [--step analyze|populate|rewrite|prune|all]');
  process.exit(1);
}

const THRESHOLDS = { high: [10, Infinity], medium: [5, 9], full: [3, 4] };
const [MIN_COUNT, MAX_COUNT] = THRESHOLDS[TIER];

// ─── Helpers ────────────────────────────────────────────────────────

function flatten(obj, prefix = '') {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) Object.assign(result, flatten(v, key));
    else result[key] = v;
  }
  return result;
}

function setKeyPath(obj, keyPath, value) {
  const parts = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]] || typeof current[parts[i]] !== 'object') current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

function deleteKeyPath(obj, keyPath) {
  const parts = keyPath.split('.');
  let current = obj;
  const stack = [];
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined) return false;
    stack.push({ obj: current, key: parts[i] });
    current = current[parts[i]];
  }
  const lastKey = parts[parts.length - 1];
  if (current[lastKey] === undefined) return false;
  delete current[lastKey];
  for (let i = stack.length - 1; i >= 0; i--) {
    const { obj: parent, key } = stack[i];
    if (Object.keys(parent[key]).length === 0) delete parent[key];
    else break;
  }
  return true;
}

function loadJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function getValueAtPath(obj, keyPath) {
  const parts = keyPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

function getAllSourceFiles(dir, extensions = ['.js', '.jsx', '.ts', '.tsx']) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '__tests__', 'test-utils', 'testing'].includes(entry.name)) continue;
      results.push(...getAllSourceFiles(fullPath, extensions));
    } else if (extensions.some(ext => entry.name.endsWith(ext)) && !entry.name.includes('.test.')) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── Section Classification ─────────────────────────────────────────

function classifyKey(sourceKeys, englishValue) {
  // Check if most source keys are tab labels
  const tabKeys = sourceKeys.filter(sk =>
    sk.key.includes('.tabs.') || sk.key.includes('.form.tabs.') || sk.key.includes('.viewModal.tabs.')
  );
  if (tabKeys.length >= sourceKeys.length * 0.4) return 'tabs';

  // Check for category names (reportBuilder, exportPage, search types, navigation items)
  const categoryKeys = sourceKeys.filter(sk =>
    sk.key.includes('.categories.') || sk.key.includes('.scopes.') ||
    sk.key.includes('.types.') || sk.key.includes('medicalRecords.') ||
    sk.key.includes('.stats.') || sk.key.includes('.chartLabels.') ||
    sk.key.includes('dashboard.modules.')
  );
  if (categoryKeys.length >= sourceKeys.length * 0.3) return 'categories';

  // Check for empty state messages
  if (englishValue.length > 30 && (
    englishValue.includes('adjust') || englishValue.includes('filter') ||
    englishValue.includes('no ') || englishValue.includes('No ')
  )) return 'emptyStates';

  // Check for field labels
  const fieldKeys = sourceKeys.filter(sk =>
    sk.key.includes('.form.fields.') || sk.key.includes('.form.') ||
    sk.key.endsWith('.label')
  );
  if (fieldKeys.length >= sourceKeys.length * 0.4) return 'fields';

  return 'labels';
}

function generateSharedKeyName(section, englishValue) {
  if (section === 'emptyStates') {
    if (englishValue.includes('adjust')) return 'emptyStates.adjustSearch';
    if (englishValue.includes('No ') && englishValue.includes('found')) return 'emptyStates.noResultsFound';
    // Fallback: camelCase from first few words
    const words = englishValue.split(/\s+/).slice(0, 4);
    return 'emptyStates.' + words.map((w, i) => i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()).join('');
  }

  if (section === 'categories') {
    // Use snake_case for categories to match API entity names
    const snaked = englishValue.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_');
    return `categories.${snaked}`;
  }

  // For tabs, labels, fields: camelCase
  const camelCase = englishValue
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map((w, i) => i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join('');

  return `${section}.${camelCase}`;
}

// ─── Step 1: Analyze ────────────────────────────────────────────────

function analyze() {
  console.log('\n── Step 1: Analyze ──');

  // Load all EN namespace data
  const allValues = {}; // value -> [{ ns, key }]
  for (const ns of ALL_NAMESPACES) {
    const filePath = path.join(LOCALES_DIR, 'en', `${ns}.json`);
    if (!fs.existsSync(filePath)) continue;
    const flat = flatten(loadJSON(filePath));
    for (const [key, value] of Object.entries(flat)) {
      if (!value || typeof value !== 'string' || value.length <= 1) continue;
      if (!allValues[value]) allValues[value] = [];
      allValues[value].push({ ns, key });
    }
  }

  // Filter by tier threshold
  const manifest = [];
  for (const [value, sourceKeys] of Object.entries(allValues)) {
    const count = sourceKeys.length;
    if (count < MIN_COUNT || count > MAX_COUNT) continue;

    const section = classifyKey(sourceKeys, value);
    const sharedKey = generateSharedKeyName(section, value);

    manifest.push({
      sharedKey,
      englishValue: value,
      section,
      count,
      sourceKeys,
    });
  }

  // Sort by count descending
  manifest.sort((a, b) => b.count - a.count);

  // Check for shared key name collisions
  const keyNames = new Map();
  for (const entry of manifest) {
    if (keyNames.has(entry.sharedKey)) {
      // Append a suffix to disambiguate
      let i = 2;
      while (keyNames.has(`${entry.sharedKey}${i}`)) i++;
      entry.sharedKey = `${entry.sharedKey}${i}`;
    }
    keyNames.set(entry.sharedKey, true);
  }

  console.log(`  Tier: ${TIER} (${MIN_COUNT}-${MAX_COUNT === Infinity ? '+' : MAX_COUNT} occurrences)`);
  console.log(`  Unique strings to consolidate: ${manifest.length}`);
  console.log(`  Total keys to replace: ${manifest.reduce((s, m) => s + m.count, 0)}`);
  console.log(`  New shared keys: ${manifest.length}`);
  console.log(`  Net reduction: ${manifest.reduce((s, m) => s + m.count, 0) - manifest.length}`);

  if (VERBOSE || STEP === 'analyze') {
    console.log('\n  Manifest:');
    for (const entry of manifest) {
      console.log(`    shared:${entry.sharedKey} = ${JSON.stringify(entry.englishValue)} (${entry.count}x)`);
      if (VERBOSE) {
        for (const sk of entry.sourceKeys) {
          console.log(`      <- ${sk.ns}:${sk.key}`);
        }
      }
    }
  }

  return manifest;
}

// ─── Step 2: Populate ───────────────────────────────────────────────

function populate(manifest) {
  console.log('\n── Step 2: Populate shared.json ──');

  const divergenceReport = [];

  for (const locale of ALL_LOCALES) {
    const sharedPath = path.join(LOCALES_DIR, locale, 'shared.json');
    const sharedData = fs.existsSync(sharedPath) ? loadJSON(sharedPath) : {};

    for (const entry of manifest) {
      let bestValue = entry.englishValue; // fallback

      if (locale !== 'en') {
        // Collect all existing translations for this value
        const translations = {};
        for (const sk of entry.sourceKeys) {
          const nsPath = path.join(LOCALES_DIR, locale, `${sk.ns}.json`);
          if (!fs.existsSync(nsPath)) continue;
          const nsData = loadJSON(nsPath);
          const val = getValueAtPath(nsData, sk.key);
          if (val && typeof val === 'string' && val !== '') {
            translations[val] = (translations[val] || 0) + 1;
          }
        }

        // Majority vote: prefer non-English translations
        const candidates = Object.entries(translations)
          .filter(([v]) => v !== entry.englishValue)
          .sort((a, b) => b[1] - a[1]);

        if (candidates.length > 0) {
          bestValue = candidates[0][0];

          // Check for divergence
          if (candidates.length > 1 && candidates[0][1] === candidates[1][1]) {
            divergenceReport.push({
              locale,
              sharedKey: entry.sharedKey,
              englishValue: entry.englishValue,
              candidates: candidates.map(([v, c]) => ({ value: v, count: c })),
            });
          }
        } else {
          // All translations are still English or empty - keep English
          const anyValue = Object.keys(translations)[0];
          if (anyValue) bestValue = anyValue;
        }
      }

      setKeyPath(sharedData, entry.sharedKey, bestValue);
    }

    if (!DRY_RUN) writeJSON(sharedPath, sharedData);
    const keyCount = Object.keys(flatten(sharedData)).length;
    console.log(`  ${locale}/shared.json: ${keyCount} keys`);
  }

  if (divergenceReport.length > 0) {
    console.log(`\n  WARNING: ${divergenceReport.length} translation divergences found:`);
    for (const d of divergenceReport.slice(0, 10)) {
      console.log(`    ${d.locale} shared:${d.sharedKey} (${JSON.stringify(d.englishValue)}): ${d.candidates.map(c => `"${c.value}"(${c.count})`).join(' vs ')}`);
    }
    if (divergenceReport.length > 10) console.log(`    ... and ${divergenceReport.length - 10} more`);
  }

  return divergenceReport;
}

// ─── Step 3: Rewrite Source ─────────────────────────────────────────

function rewrite(manifest) {
  console.log('\n── Step 3: Rewrite t() calls ──');

  // Build lookup: "ns:key" -> "shared:sharedKey"
  const replacementMap = new Map();
  for (const entry of manifest) {
    for (const sk of entry.sourceKeys) {
      replacementMap.set(`${sk.ns}:${sk.key}`, `shared:${entry.sharedKey}`);
    }
  }

  const sourceFiles = getAllSourceFiles(SRC_DIR);
  let totalReplacements = 0;
  let filesModified = 0;

  for (const filePath of sourceFiles) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Determine the file's default namespace from useTranslation()
    let defaultNS = 'common';
    const utMatch = content.match(/useTranslation\(\s*(?:'([^']+)'|"([^"]+)"|\[['"]([^'"]+)['"])/);
    if (utMatch) {
      defaultNS = utMatch[1] || utMatch[2] || utMatch[3];
    }

    let fileReplacements = 0;

    // Replace t() calls with old keys
    // Match: t('key') or t('key', ...) or t("key") or t("key", ...)
    content = content.replace(
      /(\bt\(\s*)(['"])([^'"]+?)(\2)((?:\s*,\s*[^)]*)?)\)/g,
      (match, prefix, quote, key, _quote2, rest) => {
        // Resolve fully qualified key
        let fullKey;
        if (key.includes(':')) {
          fullKey = key;
        } else {
          fullKey = `${defaultNS}:${key}`;
        }

        const replacement = replacementMap.get(fullKey);
        if (replacement) {
          fileReplacements++;
          if (VERBOSE) {
            const rel = path.relative(SRC_DIR, filePath);
            console.log(`    ${rel}: ${fullKey} -> ${replacement}`);
          }
          return `${prefix}${quote}${replacement}${quote}${rest})`;
        }
        return match;
      }
    );

    // If we made replacements, ensure 'shared' is in the useTranslation() call
    if (fileReplacements > 0 && !content.includes("'shared'") && !content.includes('"shared"')) {
      // Pattern 1: useTranslation('namespace')
      content = content.replace(
        /useTranslation\(\s*'([^']+)'\s*\)/,
        (match, ns) => `useTranslation(['${ns}', 'shared'])`
      );
      content = content.replace(
        /useTranslation\(\s*"([^"]+)"\s*\)/,
        (match, ns) => `useTranslation(["${ns}", "shared"])`
      );

      // Pattern 2: useTranslation(['ns1', 'ns2'])
      content = content.replace(
        /useTranslation\(\s*\[([^\]]+)\]\s*\)/,
        (match, inner) => {
          if (inner.includes('shared')) return match;
          const trimmed = inner.trimEnd();
          // Add 'shared' at the end
          return `useTranslation([${trimmed}, 'shared'])`;
        }
      );
    }

    if (content !== originalContent) {
      if (!DRY_RUN) fs.writeFileSync(filePath, content, 'utf8');
      filesModified++;
      totalReplacements += fileReplacements;
      const rel = path.relative(path.join(__dirname, '..'), filePath);
      console.log(`  ${rel}: ${fileReplacements} replacements`);
    }
  }

  console.log(`\n  Total: ${totalReplacements} t() calls updated across ${filesModified} files`);
  return { totalReplacements, filesModified };
}

// ─── Step 4: Prune ──────────────────────────────────────────────────

function prune(manifest) {
  console.log('\n── Step 4: Prune old keys ──');

  const keysByNs = {};
  for (const entry of manifest) {
    for (const sk of entry.sourceKeys) {
      if (!keysByNs[sk.ns]) keysByNs[sk.ns] = [];
      keysByNs[sk.ns].push(sk.key);
    }
  }

  let totalPruned = 0;

  for (const locale of ALL_LOCALES) {
    for (const [ns, keys] of Object.entries(keysByNs)) {
      const filePath = path.join(LOCALES_DIR, locale, `${ns}.json`);
      if (!fs.existsSync(filePath)) continue;

      const data = loadJSON(filePath);
      const beforeCount = Object.keys(flatten(data)).length;

      let pruned = 0;
      for (const key of keys) {
        if (deleteKeyPath(data, key)) pruned++;
      }

      if (pruned > 0) {
        if (!DRY_RUN) writeJSON(filePath, data);
        const afterCount = Object.keys(flatten(data)).length;
        console.log(`  ${locale}/${ns}.json: ${pruned} keys pruned (${beforeCount} -> ${afterCount})`);
        totalPruned += pruned;
      }
    }
  }

  console.log(`\n  Total: ${totalPruned} keys pruned across ${ALL_LOCALES.length} locales`);
  return totalPruned;
}

// ─── Key Count Audit ────────────────────────────────────────────────

function auditKeyCounts() {
  console.log('\n── Key Count Audit (EN) ──');
  const allNs = [...ALL_NAMESPACES, 'shared'];
  let total = 0;
  for (const ns of allNs) {
    const filePath = path.join(LOCALES_DIR, 'en', `${ns}.json`);
    if (!fs.existsSync(filePath)) continue;
    const count = Object.keys(flatten(loadJSON(filePath))).length;
    console.log(`  ${ns}.json: ${count} keys`);
    total += count;
  }
  console.log(`  TOTAL: ${total} keys`);
}

// ─── Main ───────────────────────────────────────────────────────────

console.log(`i18n Phase 2 Dedup${DRY_RUN ? ' (DRY RUN)' : ''}`);
console.log(`Tier: ${TIER} (${MIN_COUNT}${MAX_COUNT === Infinity ? '+' : '-' + MAX_COUNT} occurrences)`);
console.log('='.repeat(50));

auditKeyCounts();

const manifest = analyze();

if (STEP === 'analyze') {
  process.exit(0);
}

if (['all', 'populate'].includes(STEP)) {
  populate(manifest);
}

if (['all', 'rewrite'].includes(STEP)) {
  rewrite(manifest);
}

if (['all', 'prune'].includes(STEP)) {
  prune(manifest);
}

console.log('\n' + '='.repeat(50));
auditKeyCounts();

if (DRY_RUN) console.log('\n(DRY RUN - no files were modified)');
