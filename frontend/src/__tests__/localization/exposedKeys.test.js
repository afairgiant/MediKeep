/**
 * Guards against translation keys that are referenced in source but absent from
 * the English locale files.
 *
 * English is `fallbackLng`, so a key missing there has nothing left to fall back
 * to and i18next renders the raw key string into the UI (issue #912).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_ROOT = path.join(__dirname, '../../..');
const CHECKER = path.join(FRONTEND_ROOT, 'scripts', 'check-exposed-keys.js');

const runChecker = srcDir => {
  const args = [CHECKER, '--locale', 'en', '--json'];
  if (srcDir) args.push('--src', srcDir);
  let stdout;
  try {
    stdout = execFileSync('node', args, {
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

describe('Exposed key detection', () => {
  let fixtureDir;

  beforeEach(() => {
    fixtureDir = mkdtempSync(path.join(tmpdir(), 'i18n-fixture-'));
  });

  afterEach(() => {
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  const scan = source => {
    writeFileSync(path.join(fixtureDir, 'Fixture.jsx'), source, 'utf8');
    return runChecker(fixtureDir).exposed.map(e => e.key);
  };

  it('detects a bare key that its namespace does not define', () => {
    const keys = scan(`
      const { t } = useTranslation('common');
      export const A = () => <p>{t('missingKey')}</p>;
    `);
    expect(keys).toContain('common:missingKey');
  });

  it('accepts a bare key the namespace does define', () => {
    const keys = scan(`
      const { t } = useTranslation('labresults');
      export const A = () => <p>{t('addNew')}</p>;
    `);
    expect(keys).toEqual([]);
  });

  it('reads both branches of a ternary but not its condition', () => {
    const keys = scan(`
      const { t } = useTranslation('common');
      export const A = ({ unitSystem }) => (
        <p>{t(
          unitSystem === 'imperial'
            ? 'patients.form.height.placeholder.imperial'
            : 'nope.not.a.real.key'
        )}</p>
      );
    `);
    expect(keys).toEqual(['common:nope.not.a.real.key']);
  });

  // No useTranslation() here, so the namespace half is unknowable; the key path
  // is what matters.
  it('treats a dot-less notify* argument as literal text, not a key', () => {
    const keys = scan(`
      notifySuccess('Saved');
      notifyError('errors.missing.key.here');
    `);
    expect(keys.map(k => k.split(':')[1])).toEqual(['errors.missing.key.here']);
  });

  it('ignores keys that appear only inside comments', () => {
    const keys = scan(`
      const { t } = useTranslation('common');
      /** Usage: t('definitely.not.defined') */
      export const A = () => <p>{t('labels.loading')}</p>;
    `);
    expect(keys).toEqual([]);
  });

  // 'addNew' exists in labresults but not common, so it only resolves if the
  // commented-out useTranslation is wrongly treated as a candidate namespace.
  it('ignores a commented-out useTranslation when resolving namespaces', () => {
    const keys = scan(`
      // const { t } = useTranslation('labresults');
      const { t } = useTranslation('common');
      export const A = () => <p>{t('addNew')}</p>;
    `);
    expect(keys).toEqual(['common:addNew']);
  });

  it('treats a sibling literal prop as a fallback for its *Key partner', () => {
    const keys = scan(`
      export const fields = [
        {
          nameKey: 'sidebarNav.items.nothingDefinedHere',
          name: 'Patient Info',
        },
      ];
    `);
    expect(keys).toEqual([]);
  });
});
