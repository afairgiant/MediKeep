import { describe, it, expect, beforeAll } from 'vitest';
import i18next from 'i18next';
import reports from '../../public/locales/en/reports.json';
import { buildGenerateButtonLabel, sortCategoriesByName } from './reportLabels';

describe('buildGenerateButtonLabel', () => {
  let t;

  beforeAll(async () => {
    await i18next.init({
      lng: 'en',
      defaultNS: 'reports',
      ns: ['reports'],
      resources: { en: { reports } },
    });
    t = i18next.t.bind(i18next);
  });

  const label = (records, charts) =>
    buildGenerateButtonLabel(t, 'en', records, charts);

  it('uses singular for exactly one record', () => {
    expect(label(1, 0)).toBe('Generate Report (1 record)');
  });

  it('uses plural for several records', () => {
    expect(label(2, 0)).toBe('Generate Report (2 records)');
  });

  it('shows zero records when nothing is selected', () => {
    expect(label(0, 0)).toBe('Generate Report (0 records)');
  });

  it('pluralizes charts on their own', () => {
    expect(label(0, 1)).toBe('Generate Report (1 chart)');
    expect(label(0, 3)).toBe('Generate Report (3 charts)');
  });

  it('pluralizes records and charts independently when both are selected', () => {
    expect(label(1, 1)).toBe('Generate Report (1 record, 1 chart)');
    expect(label(1, 2)).toBe('Generate Report (1 record, 2 charts)');
    expect(label(2, 1)).toBe('Generate Report (2 records, 1 chart)');
    expect(label(5, 3)).toBe('Generate Report (5 records, 3 charts)');
  });
});

describe('sortCategoriesByName', () => {
  it('sorts by displayed name rather than by key', () => {
    const names = {
      treatments: 'Behandlungen',
      vitals: 'Alter',
      lab: 'Zucker',
    };
    expect(
      sortCategoriesByName(['lab', 'treatments', 'vitals'], names, 'de')
    ).toEqual(['vitals', 'treatments', 'lab']);
  });

  it('uses the language collation rules', () => {
    const names = { a: 'Zebra', b: 'Örebro' };
    expect(sortCategoriesByName(['a', 'b'], names, 'de')).toEqual(['b', 'a']);
    expect(sortCategoriesByName(['b', 'a'], names, 'sv')).toEqual(['a', 'b']);
  });

  it('is case-insensitive, falls back to the key, and keeps the input intact', () => {
    const input = ['y', 'x'];
    expect(sortCategoriesByName(input, { x: 'same', y: 'SAME' }, 'en')).toEqual(
      ['x', 'y']
    );
    expect(input).toEqual(['y', 'x']);
    expect(sortCategoriesByName(['b', 'a'], {}, 'en')).toEqual(['a', 'b']);
  });
});
