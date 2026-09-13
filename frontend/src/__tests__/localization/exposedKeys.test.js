/**
 * Guards against translation keys that are referenced in source but absent from
 * the English locale files.
 *
 * English is `fallbackLng`, so a key missing there has nothing left to fall back
 * to and i18next renders the raw key string into the UI (issue #912).
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_ROOT = path.join(__dirname, '../../..');
const CHECKER = path.join(FRONTEND_ROOT, 'scripts', 'check-exposed-keys.js');

const runChecker = () => {
  let stdout;
  try {
    stdout = execFileSync('node', [CHECKER, '--locale', 'en', '--json'], {
      cwd: FRONTEND_ROOT,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (error) {
    // The script exits non-zero when it finds exposed keys; the report is still
    // on stdout and is what the assertions below need.
    if (error.stdout === undefined) throw error;
    stdout = error.stdout;
  }
  return JSON.parse(stdout);
};

describe('Exposed translation keys', () => {
  const report = runChecker();

  const format = entries =>
    entries.map(e => `${e.key}  (${e.locations[0]})`).join('\n');

  it('finds no key that would render as a raw string in the UI', () => {
    expect(
      report.exposed,
      `Keys referenced in source but missing from public/locales/en:\n${format(
        report.exposed
      )}`
    ).toEqual([]);
  });

  it('scans the source tree it is pointed at', () => {
    expect(report.summary.filesScanned).toBeGreaterThan(0);
    expect(report.summary.totalKeysFound).toBeGreaterThan(0);
  });

  // The two keys from issue #912, each reached by a call shape the checker was
  // previously blind to: a ternary spanning several lines, and a key handed to a
  // notify* helper rather than t() directly.
  it.each([
    ['common:patients.form.height.placeholder.imperial'],
    ['common:patients.form.weight.placeholder.imperial'],
    ['shared:labels.success'],
  ])('resolves %s', key => {
    const [namespace, keyPath] = key.split(':');
    const messages = JSON.parse(
      readFileSync(
        path.join(FRONTEND_ROOT, 'public', 'locales', 'en', `${namespace}.json`),
        'utf8'
      )
    );
    const value = keyPath
      .split('.')
      .reduce((acc, part) => (acc == null ? acc : acc[part]), messages);
    expect(typeof value, `${key} is missing from ${namespace}.json`).toBe(
      'string'
    );
    expect(value.length).toBeGreaterThan(0);
  });
});
