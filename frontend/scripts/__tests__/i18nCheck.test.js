import { describe, it, expect } from 'vitest';
import {
  compareNamespace,
  isExemptFromIdentical,
  hasPlaceholderProblem,
  splitPluralKey,
  flattenKeys,
  pluralCategoriesFor,
} from '../lib/i18nCheck';

const en = {
  buttons: { save: 'Save', cancel: 'Cancel' },
  count: '{{count}} file',
  count_one: '{{count}} file',
  count_other: '{{count}} files',
  url: { placeholder: 'https://example.com' },
};

const de = {
  buttons: { save: 'Speichern', cancel: 'Abbrechen' },
  count: '{{count}} Datei',
  count_one: '{{count}} Datei',
  count_other: '{{count}} Dateien',
  url: { placeholder: 'https://example.com' },
};

const check = (localeData, locale = 'de', allowlist = []) =>
  compareNamespace(en, localeData, locale, allowlist);

describe('compareNamespace: missing keys', () => {
  it('reports nothing for a complete translation', () => {
    const r = check(de);
    expect(r.missing).toEqual([]);
    expect(r.extra).toEqual([]);
    expect(r.identical).toEqual([]);
  });

  it('reports a missing plain key', () => {
    const r = check({ ...de, buttons: { save: 'Speichern' } });
    expect(r.missing).toEqual(['buttons.cancel']);
  });

  it('requires _one for a locale that uses it', () => {
    const { count_one: _removed, ...rest } = de;
    expect(check(rest, 'de').missing).toEqual(['count_one']);
  });

  it('does not require _one for Thai and Chinese', () => {
    const { count_one: _removed, ...rest } = de;
    expect(check(rest, 'th').missing).toEqual([]);
    expect(check(rest, 'zh').missing).toEqual([]);
  });

  it('still requires _other for Thai', () => {
    const { count_other: _removed, ...rest } = de;
    expect(check(rest, 'th').missing).toEqual(['count_other']);
  });

  it('still requires the base key of a plural group', () => {
    const { count: _removed, ...rest } = de;
    expect(check(rest, 'th').missing).toEqual(['count']);
  });
});

describe('compareNamespace: extra keys', () => {
  it('reports an unknown key', () => {
    expect(check({ ...de, stale: 'x' }).extra).toEqual(['stale']);
  });

  it('allows _few and _many for Polish and Russian', () => {
    const plural = { ...de, count_few: 'x', count_many: 'y' };
    expect(check(plural, 'pl').extra).toEqual([]);
    expect(check(plural, 'ru').extra).toEqual([]);
  });

  it('rejects _few for a locale without that category', () => {
    expect(check({ ...de, count_few: 'x' }, 'zh').extra).toEqual(['count_few']);
    expect(check({ ...de, count_few: 'x' }, 'de').extra).toEqual(['count_few']);
  });

  it('rejects a plural-looking key whose group does not exist in English', () => {
    expect(check({ ...de, other_few: 'x' }, 'pl').extra).toEqual(['other_few']);
  });

  it('does not require _few or _many when English lacks them', () => {
    expect(check(de, 'ru').missing).toEqual([]);
  });
});

describe('compareNamespace: empty values and placeholders', () => {
  it('reports empty values', () => {
    expect(check({ ...de, count: '  ' }).empty).toEqual(['count']);
  });

  it('accepts a dropped placeholder', () => {
    expect(check({ ...de, count_one: 'Eine Datei' }).placeholderMismatch).toEqual(
      []
    );
  });

  it('rejects an unknown placeholder', () => {
    expect(check({ ...de, count: '{{total}} Dateien' }).placeholderMismatch).toEqual(
      ['count']
    );
  });

  it('rejects a dropped {{count}} on a non-plural key', () => {
    const r = compareNamespace(
      { warn: 'Delete {{count}} {{name}} records' },
      { warn: 'Delete this {{name}} entry' },
      'fr'
    );
    expect(r.placeholderMismatch).toEqual(['warn']);
  });

  it('accepts a dropped {{count}} on a singular plural form only', () => {
    const enPlural = { n_one: '{{count}} file', n_other: '{{count}} files' };
    const ok = compareNamespace(
      enPlural,
      { n_one: 'Eine Datei', n_other: '{{count}} Dateien' },
      'de'
    );
    expect(ok.placeholderMismatch).toEqual([]);
    const bad = compareNamespace(
      enPlural,
      { n_one: 'Eine Datei', n_other: 'Dateien' },
      'de'
    );
    expect(bad.placeholderMismatch).toEqual(['n_other']);
  });

  it('accepts a dropped {{verb}} grammar slot', () => {
    expect(hasPlaceholderProblem('There {{verb}} {{count}}', 'Es gibt {{count}}')).toBe(
      false
    );
  });

  it('rejects unbalanced braces', () => {
    expect(check({ ...de, count: '{{count} Dateien' }).placeholderMismatch).toEqual(
      ['count']
    );
  });
});

describe('compareNamespace: identical to English', () => {
  it('flags an untranslated value', () => {
    const r = check({ ...de, buttons: { save: 'Save', cancel: 'Abbrechen' } });
    expect(r.identical).toEqual(['buttons.save']);
    expect(r.identicalUnallowed.has('Save')).toBe(true);
  });

  it('accepts an allowlisted value', () => {
    const r = check({ ...de, buttons: { save: 'Save', cancel: 'Abbrechen' } }, 'de', [
      'Save',
    ]);
    expect(r.identical).toEqual([]);
    expect(r.identicalValues.has('Save')).toBe(true);
  });

  it('exempts URLs without an allowlist entry', () => {
    expect(check(de).identical).toEqual([]);
  });

  it('exempts brand option keys', () => {
    const enBrands = { brand: { options: { cvs: 'Costco Pharmacy' } } };
    const r = compareNamespace(enBrands, enBrands, 'de', []);
    expect(r.identical).toEqual([]);
  });
});

describe('isExemptFromIdentical', () => {
  it.each([
    ['https://example.com', true],
    ['doctor@example.com', true],
    ['BMI', true],
    ['{{count}}', true],
    ['my-alerts', true],
    ['120/80', true],
    ['Save', false],
    ['Delete relationship', false],
    ['GitHub ID:', false],
  ])('%s -> %s', (value, expected) => {
    expect(isExemptFromIdentical(value)).toBe(expected);
  });
});

describe('pluralCategoriesFor', () => {
  it('throws for a locale without defined plural rules', () => {
    expect(() => pluralCategoriesFor('ja')).toThrow(/ja/);
  });

  it('returns the CLDR categories for known locales', () => {
    expect(pluralCategoriesFor('th')).toEqual(['other']);
    expect(pluralCategoriesFor('ru')).toEqual(['one', 'few', 'many', 'other']);
  });
});

describe('helpers', () => {
  it('splits plural keys', () => {
    expect(splitPluralKey('a.b_other')).toEqual({ base: 'a.b', suffix: 'other' });
    expect(splitPluralKey('a.b')).toBeNull();
  });

  it('flattens nested keys', () => {
    expect(flattenKeys({ a: { b: 'x' }, c: 'y' })).toEqual({ 'a.b': 'x', c: 'y' });
  });

  it('accepts placeholders that only differ by whitespace', () => {
    expect(hasPlaceholderProblem('{{count}} x', '{{ count }} y')).toBe(false);
  });
});
