#!/usr/bin/env node

/**
 * Fixes indirect translation key references (labelKey, placeholderKey, etc.)
 * in files like medicalFormFields/ and search/ that store key strings in config
 * objects rather than direct t() calls.
 *
 * Reads the dedup manifest to build old->new key mapping, then does string
 * replacement across affected files.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCALES_DIR = path.join(__dirname, '..', 'public', 'locales');
const SRC_DIR = path.join(__dirname, '..', 'src');
const ALL_NAMESPACES = ['common', 'medical', 'admin', 'navigation', 'notifications', 'errors', 'reportPdf'];
const ALL_LOCALES = ['en', 'de', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'sv'];
const DRY_RUN = process.argv.includes('--dry-run');

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

// Build reverse mapping: EN value -> shared key
const sharedData = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en', 'shared.json'), 'utf8'));
const sharedFlat = flatten(sharedData);
const valueToSharedKey = {};
for (const [key, value] of Object.entries(sharedFlat)) {
  valueToSharedKey[value] = `shared:${key}`;
}

// Read all remaining namespace data to find what values the exposed keys SHOULD have
// (some have been pruned, so we need to check git or infer from shared)
const nsData = {};
for (const ns of ALL_NAMESPACES) {
  const p = path.join(LOCALES_DIR, 'en', `${ns}.json`);
  if (fs.existsSync(p)) nsData[ns] = flatten(JSON.parse(fs.readFileSync(p, 'utf8')));
}

// Scan source files for key string patterns
function getAllFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '__tests__', 'test-utils', 'testing'].includes(entry.name)) continue;
      results.push(...getAllFiles(full));
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
      results.push(full);
    }
  }
  return results;
}

// Find all string literals that look like translation keys (contain namespace: or dots)
// and check if they reference a pruned key whose value is now in shared
const keyPattern = /['"]((common|medical|admin|navigation|notifications|errors):[\w.]+)['"]/g;
const bareKeyPattern = /Key:\s*['"](([\w]+\.)+[\w]+)['"]/g;

let totalFixes = 0;
let filesFixed = 0;
const keysToRestore = []; // Keys that can't be mapped to shared and need restoring

const files = getAllFiles(SRC_DIR);

for (const filePath of files) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Determine file's default namespace
  let defaultNS = 'common';
  const utMatch = content.match(/useTranslation\(\s*(?:'([^']+)'|"([^"]+)"|\[['"]([^'"]+)['"])/);
  if (utMatch) defaultNS = utMatch[1] || utMatch[2] || utMatch[3];

  // Find all key-like strings and check if they need updating
  // Pattern: 'namespace:key.path' or "namespace:key.path"
  content = content.replace(
    /(['"])((common|medical|admin|navigation|notifications|errors|reportPdf):([\w.]+))\1/g,
    (match, quote, fullKey, ns, keyPath) => {
      // Check if this key still exists in its namespace
      if (nsData[ns] && nsData[ns][keyPath] !== undefined) return match; // Key exists, no fix needed

      // Key was pruned - find the shared equivalent by value
      // We need to figure out what value this key had
      // Check if there's a shared key that covers this
      const sharedKey = findSharedKeyForPrunedKey(ns, keyPath);
      if (sharedKey) {
        totalFixes++;
        return `${quote}${sharedKey}${quote}`;
      }

      // Can't find shared equivalent - mark for restoration
      keysToRestore.push(`${ns}:${keyPath}`);
      return match;
    }
  );

  // Also handle bare keys (without namespace prefix) used in medicalFormFields
  content = content.replace(
    /((?:label|placeholder|description|title)Key:\s*)(['"])([\w.]+)\2/g,
    (match, prefix, quote, keyPath) => {
      // Resolve against default namespace
      if (nsData[defaultNS] && nsData[defaultNS][keyPath] !== undefined) return match;

      const sharedKey = findSharedKeyForPrunedKey(defaultNS, keyPath);
      if (sharedKey) {
        totalFixes++;
        return `${prefix}${quote}${sharedKey}${quote}`;
      }

      keysToRestore.push(`${defaultNS}:${keyPath}`);
      return match;
    }
  );

  if (content !== original) {
    if (!DRY_RUN) fs.writeFileSync(filePath, content, 'utf8');
    filesFixed++;
    const rel = path.relative(path.join(__dirname, '..'), filePath);
    console.log(`  Fixed: ${rel}`);
  }
}

function findSharedKeyForPrunedKey(ns, keyPath) {
  // Strategy: look through shared.json for a key whose name suggests it replaced this key
  // We match by the leaf key name and section

  // Common mappings based on field names
  const leaf = keyPath.split('.').pop();
  const parentParts = keyPath.split('.');

  // Check if any shared key was created for this exact pattern
  // e.g., common:labels.severity -> shared:labels.severity
  // e.g., common:search.types.conditions -> shared:categories.conditions

  // Try direct shared mapping
  for (const [sharedKey, sharedValue] of Object.entries(sharedFlat)) {
    const sharedLeaf = sharedKey.split('.').pop();
    // If leaf names match or values might match
    if (sharedLeaf === leaf && parentParts.some(p => sharedKey.includes(p))) {
      return `shared:${sharedKey}`;
    }
  }

  // Try by section inference
  if (keyPath.includes('.types.') || keyPath.includes('.categories.') || keyPath.includes('.scopes.')) {
    const catLeaf = leaf.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    if (sharedFlat[`categories.${catLeaf}`] !== undefined) return `shared:categories.${catLeaf}`;
    if (sharedFlat[`categories.${leaf}`] !== undefined) return `shared:categories.${leaf}`;
    // Try snake_case version
    const snaked = leaf.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
    if (sharedFlat[`categories.${snaked}`] !== undefined) return `shared:categories.${snaked}`;
  }

  if (leaf === 'placeholder' || leaf === 'label' || leaf === 'description') {
    // This is a form field descriptor - probably should be restored, not mapped
    return null;
  }

  return null;
}

console.log(`\nFixed ${totalFixes} indirect references across ${filesFixed} files`);

if (keysToRestore.length > 0) {
  // Deduplicate
  const unique = [...new Set(keysToRestore)];
  console.log(`\n${unique.length} keys need restoration (pruned but still referenced, no shared equivalent):`);
  unique.forEach(k => console.log(`  ${k}`));

  // Restore these keys from shared.json translations or git history
  // For now, we'll restore them with the shared value since the English text is the same
  if (!DRY_RUN) {
    console.log('\nRestoring keys...');
    for (const fullKey of unique) {
      const [ns, keyPath] = fullKey.split(':');

      // Find the value from shared.json by matching the leaf concept
      let value = null;
      const leaf = keyPath.split('.').pop();

      // Try to find the value in shared by matching the leaf name
      for (const [sk, sv] of Object.entries(sharedFlat)) {
        if (sk.endsWith('.' + leaf) || sk === leaf) {
          value = sv;
          break;
        }
      }

      if (!value) {
        console.log(`  WARNING: Could not determine value for ${fullKey}`);
        continue;
      }

      // Restore across all locales
      for (const locale of ALL_LOCALES) {
        const nsPath = path.join(LOCALES_DIR, locale, `${ns}.json`);
        if (!fs.existsSync(nsPath)) continue;
        const data = JSON.parse(fs.readFileSync(nsPath, 'utf8'));

        // Get translated value from shared
        const sharedLocalePath = path.join(LOCALES_DIR, locale, 'shared.json');
        const sharedLocale = JSON.parse(fs.readFileSync(sharedLocalePath, 'utf8'));
        const sharedLocaleFlat = flatten(sharedLocale);

        let translatedValue = value;
        for (const [sk, sv] of Object.entries(sharedLocaleFlat)) {
          if (sk.endsWith('.' + leaf) || sk === leaf) {
            translatedValue = sv;
            break;
          }
        }

        setKeyPath(data, keyPath, translatedValue);
        fs.writeFileSync(nsPath, JSON.stringify(data, null, 2) + '\n');
      }
      console.log(`  Restored: ${fullKey} = "${value}"`);
    }
  }
}

if (DRY_RUN) console.log('\n(DRY RUN - no files modified)');
