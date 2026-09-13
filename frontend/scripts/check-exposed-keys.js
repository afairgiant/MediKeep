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

const DEFAULT_SRC_DIR = path.join(__dirname, '..', 'src');
const LOCALES_DIR = path.join(__dirname, '..', 'public', 'locales');
const ALL_LOCALES = ['en', 'de', 'el', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'sv', 'th', 'zh'];
const ALL_NAMESPACES = ['admin', 'auth', 'common', 'documents', 'errors', 'invitations', 'labresults', 'medical', 'navigation', 'notifications', 'reportPdf', 'reports', 'settings', 'shared', 'vitals'];
const DEFAULT_NS = 'common';
const PLURAL_SUFFIXES = ['zero', 'one', 'two', 'few', 'many', 'other'];

// ─── Argument Parsing ────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
};
const hasFlag = (flag) => args.includes(flag);

const filterLocale = getArg('--locale');
// Tests point this at a fixture tree; everything else scans the real source.
const SRC_DIR = getArg('--src') || DEFAULT_SRC_DIR;
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
  --src <dir>        Scan this directory instead of src/
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
 * Namespaces a key in this file may resolve against, in i18next's search order.
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

  // A file with no useTranslation() does not pick the namespace, its consumer does.
  return namespaces.length > 0 ? namespaces : ALL_NAMESPACES;
}

/**
 * Blank comment bodies, preserving length and newlines so line numbers still map.
 */
function stripComments(content) {
  let out = content.split('');
  let i = 0;
  let quote = null;
  while (i < content.length) {
    const ch = content[i];
    const next = content[i + 1];
    if (quote) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; i++; continue; }
    if (ch === '/' && next === '*') {
      const end = content.indexOf('*/', i + 2);
      const stop = end === -1 ? content.length : end + 2;
      for (let j = i; j < stop; j++) if (out[j] !== '\n') out[j] = ' ';
      i = stop;
      continue;
    }
    if (ch === '/' && next === '/' && content[i - 1] !== ':') {
      let end = content.indexOf('\n', i);
      if (end === -1) end = content.length;
      for (let j = i; j < end; j++) out[j] = ' ';
      i = end;
      continue;
    }
    i++;
  }
  return out.join('');
}

/**
 * Resolve a raw key string into { namespace, key, candidates }.
 *
 * `candidates` is every namespace i18next would search, in order: a single
 * entry for an explicit `ns:key`, otherwise the file's whole useTranslation
 * list, which i18next falls through before declaring a key missing.
 */
function resolveKey(raw, fileNamespaces) {
  if (raw.includes(':')) {
    const colonIdx = raw.indexOf(':');
    const possibleNs = raw.substring(0, colonIdx);
    if (ALL_NAMESPACES.includes(possibleNs)) {
      const key = raw.substring(colonIdx + 1);
      return { namespace: possibleNs, key, candidates: [possibleNs] };
    }
  }
  return { namespace: fileNamespaces[0], key: raw, candidates: fileNamespaces };
}

/**
 * Callers whose first argument is a translation key.
 *
 * The notify* helpers in utils/notifyTranslated forward their first argument to
 * i18n.t(), so a key only ever named there is still user-visible; `resolve` is
 * that module's own internal forwarder.
 */
const KEY_CALLERS = [
  't',
  'i18n.t',
  'i18next.t',
  'notifySuccess',
  'notifyError',
  'notifyWarning',
  'notifyInfo',
  'resolve',
];

/**
 * Index of the paren closing the one at `openIdx`, or -1 if unbalanced.
 * Skips over string and template-literal contents so quoted parens don't count.
 */
function findClosingParen(content, openIdx) {
  let depth = 0;
  let quote = null;
  for (let i = openIdx; i < content.length; i++) {
    const ch = content[i];
    if (quote) {
      if (ch === '\\') { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Split a call's argument text on top-level commas only.
 */
function splitArgs(argText) {
  const args = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < argText.length; i++) {
    const ch = argText[i];
    if (quote) {
      if (ch === '\\') { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    else if (ch === ',' && depth === 0) {
      args.push(argText.slice(start, i));
      start = i + 1;
    }
  }
  args.push(argText.slice(start));
  return args;
}

// t() resolves any key its namespace holds, including a bare top-level one. The
// notify*/resolve wrappers pass a dot-less string through as literal text, so for
// those a literal is only a key when resolve() would treat it as one at runtime.
const KEY_SHAPE = /^[A-Za-z_$][\w$-]*(?::[\w$.-]+)?(?:\.[\w$-]+)*$/;
function looksLikeKey(literal, requireNamespaceOrDots) {
  if (!literal || /\s/.test(literal)) return false;
  if (requireNamespaceOrDots && !literal.includes(':')) {
    const dots = literal.match(/\./g);
    if (!dots || dots.length < 2) return false;
  }
  return KEY_SHAPE.test(literal);
}

/**
 * Drop a ternary's condition, keeping only the branches.
 *
 * `t(metric ? 'a.b' : 'a.c')` has string literals in the condition too
 * (`unitSystem === 'imperial'`); those are values, not keys.
 */
function stripTernaryCondition(argText) {
  let depth = 0;
  let quote = null;
  for (let i = 0; i < argText.length; i++) {
    const ch = argText[i];
    if (quote) {
      if (ch === '\\') { i++; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    else if (ch === '?' && depth === 0) {
      // Skip ?. optional chaining and ?? nullish coalescing.
      if (argText[i + 1] === '.' || argText[i + 1] === '?') { i++; continue; }
      return argText.slice(i + 1);
    }
  }
  return argText;
}


/**
 * Every key literal in an argument expression.
 *
 * Returns more than one for a ternary such as
 * `t(metric ? 'a.b.metric' : 'a.b.imperial')` — both branches reach the UI, so
 * both must exist in the locale files.
 */
function extractKeyLiterals(argText, requireNamespaceOrDots) {
  argText = stripTernaryCondition(argText);
  const literals = [];
  const dynamic = [];
  const re = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  let m;
  while ((m = re.exec(argText)) !== null) {
    const quote = m[1];
    const raw = m[2];
    if (quote === '`' && raw.includes('${')) {
      dynamic.push('`' + raw + '`');
      continue;
    }
    if (looksLikeKey(raw, requireNamespaceOrDots)) literals.push(raw);
  }
  return { literals, dynamic };
}

/**
 * Extracts all translation key references from a source file.
 */
function extractTranslationKeys(content, filePath) {
  const staticKeys = [];
  const dynamicKeys = [];
  content = stripComments(content);
  const fileNamespaces = getFileNamespaces(content);

  // Precompute newline offsets so a match index maps back to a line number.
  const lineStarts = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') lineStarts.push(i + 1);
  }
  const lineOf = idx => {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (lineStarts[mid] <= idx) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };

  const callerRe = new RegExp(
    `(?:^|[^.\\w$])(${KEY_CALLERS.map(c => c.replace('.', '\\.')).join('|')})\\s*\\(`,
    'g'
  );

  let m;
  while ((m = callerRe.exec(content)) !== null) {
    const callerName = m[1];
    const openIdx = m.index + m[0].length - 1;
    const closeIdx = findClosingParen(content, openIdx);
    if (closeIdx === -1) continue;

    const argText = content.slice(openIdx + 1, closeIdx);
    const args = splitArgs(argText);
    const lineNum = lineOf(m.index);

    // Only t() takes a string fallback second; notify* takes an options object.
    const isTCall = callerName.endsWith('t');
    const { literals, dynamic } = extractKeyLiterals(args[0] || '', !isTCall);
    for (const expr of dynamic) {
      dynamicKeys.push({ expression: expr, line: lineNum, file: filePath });
    }
    if (literals.length === 0) {
      const firstArg = (args[0] || '').trim();
      // A bare identifier as the key is only resolvable at runtime.
      if (firstArg && !/^['"`]/.test(firstArg) && /^[a-zA-Z_$][\w$.]*$/.test(firstArg)) {
        dynamicKeys.push({ expression: firstArg, line: lineNum, file: filePath });
      }
      continue;
    }

    const hasFallback =
      isTCall && args.length > 1 && /^\s*['"`]/.test(args[1]);

    for (const raw of literals) {
      const { namespace, key, candidates } = resolveKey(raw, fileNamespaces);
      if (!key || key.trim() === '') continue;
      staticKeys.push({
        namespace, key, candidates, line: lineNum, raw, file: filePath,
        hasFallback, source: 'tCall',
      });
    }
  }

  // ── *Key property references ──────────────────────────────────
  // e.g. labelKey: 'medical:visits.form.fields.reason.label'
  // These go through translateField() which calls t(key) with NO fallback,
  // UNLESS the object also has a sibling non-Key property (e.g., name alongside nameKey)
  const lines = content.split('\n');
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const keyPropRegex = /(label|placeholder|description|title|name)Key:\s*['"]([^'"]+)['"]/g;
    let km;
    while ((km = keyPropRegex.exec(line)) !== null) {
      const propName = km[1];
      const raw = km[2];
      const { namespace, key, candidates } = resolveKey(raw, fileNamespaces);

      const siblingRegex = new RegExp(`(?:^|[,{\\s])${propName}:\\s*['"\`]`, 'm');
      const contextStart = Math.max(0, lineIdx - 10);
      const contextEnd = Math.min(lines.length, lineIdx + 10);
      const context = lines.slice(contextStart, contextEnd).join('\n');
      const hasSibling = siblingRegex.test(context);

      staticKeys.push({
        namespace, key, candidates, line: lineIdx + 1, raw, file: filePath,
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
  const candidates = entry.candidates || [entry.namespace];
  const known = candidates.filter(ns => localeKeyMap[ns]);
  if (known.length === 0) {
    exposedKeys.push({ ...entry, reason: `Unknown namespace "${entry.namespace}"` });
    continue;
  }
  // A counted key is stored only under its plural suffixes, never bare.
  const resolvedNs = known.find(
    ns =>
      localeKeyMap[ns].has(entry.key) ||
      PLURAL_SUFFIXES.some(sfx => localeKeyMap[ns].has(`${entry.key}_${sfx}`))
  );
  if (!resolvedNs) {
    if (entry.hasFallback) {
      coveredKeys.push({ ...entry, reason: 'Key missing but has inline fallback' });
    } else {
      exposedKeys.push({ ...entry, reason: 'Key not found — no fallback' });
    }
  } else {
    validKeys.add(`${resolvedNs}:${entry.key}`);
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
