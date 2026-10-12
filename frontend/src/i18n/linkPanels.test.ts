import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const LOCALES_DIR = join(__dirname, '../../public/locales');
const ITEMS = [
  'medications',
  'labResults',
  'visits',
  'procedures',
  'treatments',
  'injuries',
  'symptoms',
  'conditions',
  'equipment',
];
const RECORDS = [
  'visit',
  'labResult',
  'medication',
  'procedure',
  'condition',
  'treatment',
  'injury',
  'symptom',
];

const linkPanels = (locale: string) =>
  JSON.parse(readFileSync(join(LOCALES_DIR, locale, 'common.json'), 'utf-8'))
    .linkPanels;

const fill = (panels: Record<string, any>, items: string, record: string) =>
  (panels.addRelated as string)
    .replace('{{items}}', panels.items[items])
    .replace('{{record}}', panels.records[record]);

const locales = readdirSync(LOCALES_DIR, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name);

describe('link panel descriptions', () => {
  it('has every locale', () => {
    expect(locales).toHaveLength(13);
  });

  it.each(locales)(
    '%s: the sentence and every noun form are present',
    locale => {
      const panels = linkPanels(locale);
      expect(panels.addRelated).toContain('{{items}}');
      expect(panels.addRelated).toContain('{{record}}');
      expect(Object.keys(panels.items).sort()).toEqual([...ITEMS].sort());
      expect(Object.keys(panels.records).sort()).toEqual([...RECORDS].sort());
      for (const value of [
        ...Object.values<string>(panels.items),
        ...Object.values<string>(panels.records),
      ]) {
        expect(value.trim()).not.toBe('');
        // The nouns are plain text: all interpolation happens in the one sentence
        expect(value).not.toContain('{{');
      }
    }
  );

  it('reads as "Add XYZ related to this ZZZ." in English', () => {
    const en = linkPanels('en');
    expect(fill(en, 'labResults', 'condition')).toBe(
      'Add Lab Results related to this Condition.'
    );
    expect(fill(en, 'medications', 'condition')).toBe(
      'Add Medications related to this Condition.'
    );
    expect(fill(en, 'visits', 'labResult')).toBe(
      'Add Visits related to this Lab Result.'
    );
    expect(fill(en, 'equipment', 'treatment')).toBe(
      'Add Medical Equipment related to this Treatment.'
    );
    expect(fill(en, 'injuries', 'visit')).toBe(
      'Add Injuries related to this Visit.'
    );
  });

  it('no longer has the condition-only sentences', () => {
    for (const locale of locales) {
      expect(linkPanels(locale)).not.toHaveProperty('condition');
    }
  });
});
