#!/usr/bin/env node

/**
 * Exposed Translation Key Detection Script
 *
 * Scans source code for t() calls, resolves their namespace context,
 * and verifies each key exists in the locale JSON files.
 *
 * Keys are classified by severity:
 *   - EXPOSED: t('key') with no fallback — raw key string shows in the UI
 *   - COVERED: t('key', 'Fallback') with an inline fallback — user sees the
 *              fallback text, but the key should still be added to locale files
 *
 * By default only EXPOSED keys are shown. Use --all to include COVERED keys.
 *
 * Usage:
 *   node scripts/check-exposed-keys.js                    # Exposed keys only
 *   node scripts/check-exposed-keys.js --all              # Include fallback-covered keys
 *   node scripts/check-exposed-keys.js --locale de        # Check specific locale
 *   node scripts/check-exposed-keys.js --json             # JSON output
 *   node scripts/check-exposed-keys.js --verbose          # Show dynamic keys
 *   node scripts/check-exposed-keys.js --unused           # Also report unused keys
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, '..', 'src');
const LOCALES_DIR = path.join(__dirname, '..', 'public', 'locales');
const ALL_LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt'];
const ALL_NAMESPACES = ['common', 'medical', 'errors', 'navigation', 'notifications'];
const DEFAULT_NS = 'common';

// ─── Argument Parsing ────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
};
const hasFlag = (flag) => args.includes(flag);

const filterLocale = getArg('--locale');
const jsonOutput = hasFlag('--json');
const verbose = hasFlag('--verbose');
const showAll = hasFlag('--all');
const showUnused = hasFlag('--unused');
const showHelp = hasFlag('--help') || hasFlag('-h');

if (showHelp) {
  console.log(`
Exposed Translation Key Checker
================================

Scans source code for t() calls and verifies each translation key
exists in the locale JSON files.

Keys are classified by severity:
  EXPOSED  - t('key') with no fallback string. If the key is missing
             from locale files, the raw key (e.g. "common:buttons.save")
             is shown to the user in the UI.
  COVERED  - t('key', 'Fallback text'). If the key is missing, the user
             sees the fallback text instead. Not visible in the UI but
             the key should still be added for proper i18n support.

By default only EXPOSED keys are reported.

Options:
  --all              Also show COVERED keys (have inline fallbacks)
  --locale <code>    Check against a specific locale (default: en)
  --json             Output results as JSON
  --verbose          Show dynamic keys that can't be statically checked
  --unused           Also report locale keys not referenced in source code
  --help, -h         Show this help message

Examples:
  node scripts/check-exposed-keys.js
  node scripts/check-exposed-keys.js --all
  node scripts/check-exposed-keys.js --locale de --verbose
  node scripts/check-exposed-keys.js --json > report.json
`);
  process.exit(0);
}

// ─── Locale Data Loading ─────────────────────────────────────────────

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

// Build a map of namespace -> Set of keys
const localeToCheck = filterLocale || 'en';
const localeKeyMap = {};
for (const ns of ALL_NAMESPACES) {
  const data = loadJSON(localeToCheck, ns);
  localeKeyMap[ns] = data ? new Set(extractKeys(data)) : new Set();
}

// ─── Source File Discovery ───────────────────────────────────────────

function findSourceFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name === 'test') continue;
      results.push(...findSourceFiles(fullPath));
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── Key Extraction from Source ──────────────────────────────────────

/**
 * Extracts the default namespace(s) from useTranslation() calls in the file.
 */
function getFileNamespaces(content) {
  const namespaces = [];

  // useTranslation('namespace')
  const singleNs = /useTranslation\(\s*['"](\w+)['"]\s*\)/g;
  let match;
  while ((match = singleNs.exec(content)) !== null) {
    namespaces.push(match[1]);
  }

  // useTranslation(['ns1', 'ns2'])
  const arrayNs = /useTranslation\(\s*\[([^\]]+)\]\s*\)/g;
  while ((match = arrayNs.exec(content)) !== null) {
    const items = match[1].match(/['"](\w+)['"]/g);
    if (items) {
      items.forEach(item => namespaces.push(item.replace(/['"]/g, '')));
    }
  }

  return namespaces.length > 0 ? namespaces : [DEFAULT_NS];
}

/**
 * Resolve a raw key string into { namespace, key }.
 */
function resolveKey(raw, defaultNs) {
  if (raw.includes(':')) {
    const colonIdx = raw.indexOf(':');
    const possibleNs = raw.substring(0, colonIdx);
    if (ALL_NAMESPACES.includes(possibleNs)) {
      return { namespace: possibleNs, key: raw.substring(colonIdx + 1) };
    }
  }
  return { namespace: defaultNs, key: raw };
}

/**
 * Check if the character after a t('key' match indicates a string fallback.
 *
 * After the closing quote of the key, the line should contain either:
 *   )           → no fallback
 *   , 'text'    → string fallback (COVERED)
 *   , "text"    → string fallback (COVERED)
 *   , `text`    → template fallback (COVERED)
 *   , { ... }   → interpolation object only (no fallback, EXPOSED)
 *   , variable  → can't tell, treat as no fallback (EXPOSED)
 */
function hasFallbackArg(line, afterIdx) {
  const rest = line.substring(afterIdx).trimStart();
  // After the closing quote, expect comma then second arg
  if (!rest.startsWith(',')) return false;
  const afterComma = rest.substring(1).trimStart();
  // Second arg is a string literal → fallback
  return /^['"`]/.test(afterComma);
}

/**
 * Extracts all translation key references from a source file.
 */
function extractTranslationKeys(content, filePath) {
  const staticKeys = [];
  const dynamicKeys = [];
  const fileNamespaces = getFileNamespaces(content);
  const defaultNs = fileNamespaces[0];

  const lines = content.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineNum = lineIdx + 1;

    // ── Direct t() calls ──────────────────────────────────────────
    // Match t('key'), i18n.t('key'), i18next.t('key')
    const tCallRegex = /(?:^|[^.\w])(?:i18n(?:ext)?\.)?t\(\s*(['"`])(.*?)\1/g;
    let m;
    while ((m = tCallRegex.exec(line)) !== null) {
      const quote = m[1];
      const raw = m[2];
      const afterQuoteIdx = m.index + m[0].length;

      // Template literals with interpolation are dynamic
      if (quote === '`' && raw.includes('${')) {
        dynamicKeys.push({ expression: `\`${raw}\``, line: lineNum, file: filePath });
        continue;
      }

      const { namespace, key } = resolveKey(raw, defaultNs);
      if (!key || key.trim() === '') continue;

      const hasFallback = hasFallbackArg(line, afterQuoteIdx);

      staticKeys.push({
        namespace, key, line: lineNum, raw, file: filePath,
        hasFallback, source: 'tCall',
      });
    }

    // ── Dynamic t(variable) calls ─────────────────────────────────
    const dynamicTRegex = /(?:^|[^.\w])(?:i18n(?:ext)?\.)?t\(\s*([a-zA-Z_$][\w$.]*(?:\.\w+)*)\s*[,)]/g;
    while ((m = dynamicTRegex.exec(line)) !== null) {
      const varName = m[1];
      if (/^['"`]/.test(varName)) continue;
      if (['true', 'false', 'null', 'undefined', 'this', 'void'].includes(varName)) continue;
      dynamicKeys.push({ expression: varName, line: lineNum, file: filePath });
    }

    // ── *Key property references ──────────────────────────────────
    // e.g. labelKey: 'medical:visits.form.fields.reason.label'
    // These go through translateField() which calls t(key) with NO fallback,
    // UNLESS the object also has a sibling non-Key property (e.g., name alongside nameKey)
    const keyPropRegex = /(label|placeholder|description|title|name)Key:\s*['"]([^'"]+)['"]/g;
    while ((m = keyPropRegex.exec(line)) !== null) {
      const propName = m[1]; // e.g. 'name', 'title', 'label'
      const raw = m[2];
      const { namespace, key } = resolveKey(raw, defaultNs);

      // Check if a sibling non-Key property exists nearby (same object)
      // e.g. nameKey: '...' + name: '...' means the name acts as fallback
      const siblingRegex = new RegExp(`(?:^|[,{\\s])${propName}:\\s*['"\`]`, 'm');
      const contextStart = Math.max(0, lineIdx - 10);
      const contextEnd = Math.min(lines.length, lineIdx + 10);
      const context = lines.slice(contextStart, contextEnd).join('\n');
      const hasSibling = siblingRegex.test(context);

      staticKeys.push({
        namespace, key, line: lineNum, raw, file: filePath,
        hasFallback: hasSibling, source: 'keyProp',
      });
    }
  }

  return { staticKeys, dynamicKeys };
}

// ─── Main Analysis ──────────────────────────────────────────────────

const sourceFiles = findSourceFiles(SRC_DIR);
const allStaticKeys = [];
const allDynamicKeys = [];

for (const file of sourceFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const { staticKeys, dynamicKeys } = extractTranslationKeys(content, file);
  allStaticKeys.push(...staticKeys);
  allDynamicKeys.push(...dynamicKeys);
}

// Check each static key against locale data
const exposedKeys = [];    // Missing + no fallback → visible in UI
const coveredKeys = [];    // Missing + has fallback → hidden but should be in locale
const validKeys = new Set();

for (const entry of allStaticKeys) {
  const nsKeys = localeKeyMap[entry.namespace];
  if (!nsKeys) {
    exposedKeys.push({ ...entry, reason: `Unknown namespace "${entry.namespace}"` });
    continue;
  }
  if (!nsKeys.has(entry.key)) {
    if (entry.hasFallback) {
      coveredKeys.push({ ...entry, reason: 'Key missing but has inline fallback' });
    } else {
      exposedKeys.push({ ...entry, reason: 'Key not found — no fallback' });
    }
  } else {
    validKeys.add(`${entry.namespace}:${entry.key}`);
  }
}

// Deduplicate (same ns:key can appear in multiple files)
function dedup(entries) {
  const seen = new Map();
  for (const entry of entries) {
    const id = `${entry.namespace}:${entry.key}`;
    if (!seen.has(id)) {
      seen.set(id, { ...entry, locations: [] });
    }
    const relPath = path.relative(path.join(__dirname, '..'), entry.file).replace(/\\/g, '/');
    seen.get(id).locations.push(`${relPath}:${entry.line}`);
  }
  return seen;
}

const dedupExposed = dedup(exposedKeys);
const dedupCovered = dedup(coveredKeys);

// Find unused keys
const unusedKeys = [];
if (showUnused) {
  for (const ns of ALL_NAMESPACES) {
    for (const key of localeKeyMap[ns]) {
      if (!validKeys.has(`${ns}:${key}`)) {
        unusedKeys.push({ namespace: ns, key });
      }
    }
  }
}

// ─── Output ──────────────────────────────────────────────────────────

function formatEntries(dedupMap) {
  return Array.from(dedupMap.values()).map(e => ({
    key: `${e.namespace}:${e.key}`,
    source: e.source,
    reason: e.reason,
    locations: e.locations,
  }));
}

const report = {
  summary: {
    filesScanned: sourceFiles.length,
    totalKeysFound: allStaticKeys.length,
    dynamicKeys: allDynamicKeys.length,
    exposed: dedupExposed.size,
    covered: dedupCovered.size,
    unusedKeys: unusedKeys.length,
    locale: localeToCheck,
  },
  exposed: formatEntries(dedupExposed),
  ...(showAll && { covered: formatEntries(dedupCovered) }),
  ...(showUnused && { unused: unusedKeys.map(e => `${e.namespace}:${e.key}`) }),
  ...(verbose && {
    dynamic: allDynamicKeys.map(e => ({
      expression: e.expression,
      location: `${path.relative(path.join(__dirname, '..'), e.file).replace(/\\/g, '/')}:${e.line}`,
    })),
  }),
};

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(dedupExposed.size > 0 ? 1 : 0);
}

// ─── Console Output ─────────────────────────────────────────────────

console.log('\n' + '='.repeat(64));
console.log('  Exposed Translation Key Report');
console.log('  Locale: ' + localeToCheck.toUpperCase());
console.log('='.repeat(64) + '\n');

console.log(`  Files scanned:      ${sourceFiles.length}`);
console.log(`  Static t() keys:    ${allStaticKeys.length}`);
console.log(`  Dynamic t() keys:   ${allDynamicKeys.length} (cannot be checked statically)`);
console.log('');
console.log(`  EXPOSED (no fallback):  ${dedupExposed.size}`);
console.log(`  COVERED (has fallback): ${dedupCovered.size}`);
console.log('');

function printKeyGroup(title, description, dedupMap) {
  if (dedupMap.size === 0) return;

  // Group by namespace
  const byNamespace = {};
  for (const [, entry] of dedupMap) {
    const ns = entry.namespace;
    if (!byNamespace[ns]) byNamespace[ns] = [];
    byNamespace[ns].push(entry);
  }

  console.log(`  ${title} (${dedupMap.size}):`);
  console.log(`  ${description}\n`);

  for (const ns of ALL_NAMESPACES) {
    if (!byNamespace[ns]) continue;
    console.log(`  ${ns} (${byNamespace[ns].length}):`);
    for (const entry of byNamespace[ns]) {
      console.log(`    - ${entry.key}`);
      for (const loc of entry.locations) {
        console.log(`      ${loc}`);
      }
    }
    console.log('');
  }
}

if (dedupExposed.size === 0) {
  console.log('  No exposed translation keys found.\n');
} else {
  printKeyGroup(
    'EXPOSED KEYS',
    'These keys have NO fallback — raw key strings will show in the UI.',
    dedupExposed,
  );
}

if (showAll) {
  printKeyGroup(
    'COVERED KEYS',
    'These keys have inline fallbacks — users see the fallback, not the raw key.',
    dedupCovered,
  );
}

if (showUnused && unusedKeys.length > 0) {
  const byNs = {};
  for (const entry of unusedKeys) {
    if (!byNs[entry.namespace]) byNs[entry.namespace] = [];
    byNs[entry.namespace].push(entry.key);
  }

  console.log(`  UNUSED KEYS (${unusedKeys.length}):`);
  console.log('  Keys in locale files not found in source code.\n');

  for (const ns of ALL_NAMESPACES) {
    if (!byNs[ns]) continue;
    console.log(`  ${ns} (${byNs[ns].length}):`);
    for (const key of byNs[ns]) {
      console.log(`    - ${key}`);
    }
    console.log('');
  }
}

if (verbose && allDynamicKeys.length > 0) {
  console.log(`  DYNAMIC KEYS (${allDynamicKeys.length}):`);
  console.log('  Variables or template literals — cannot be checked statically.\n');
  for (const entry of allDynamicKeys) {
    const relPath = path.relative(path.join(__dirname, '..'), entry.file).replace(/\\/g, '/');
    console.log(`    ${entry.expression}  (${relPath}:${entry.line})`);
  }
  console.log('');
}

console.log('-'.repeat(64));
const parts = [`Exposed: ${dedupExposed.size}`, `Covered: ${dedupCovered.size}`, `Dynamic: ${allDynamicKeys.length}`];
if (showUnused) parts.push(`Unused: ${unusedKeys.length}`);
console.log('  ' + parts.join('  |  '));
console.log('-'.repeat(64) + '\n');

process.exit(dedupExposed.size > 0 ? 1 : 0);
