import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { EMERGENCY_CONTACT_RELATIONSHIPS } from './emergencyContactRelationships';

const LOCALES_DIR = join(process.cwd(), 'public', 'locales');

describe('EMERGENCY_CONTACT_RELATIONSHIPS', () => {
  const locales = readdirSync(LOCALES_DIR);

  it('finds the locale directories', () => {
    expect(locales.length).toBeGreaterThan(0);
  });

  it.each(locales)('has a label for every relationship in %s', locale => {
    const medical = JSON.parse(
      readFileSync(join(LOCALES_DIR, locale, 'medical.json'), 'utf-8')
    );
    const emergency = medical.emergencyContacts;
    const options = emergency.form.relationship.options;

    for (const key of EMERGENCY_CONTACT_RELATIONSHIPS) {
      expect(options[key], `${locale}: ${key}`).toBeTruthy();
    }
    expect(emergency.filters.allRelationships).toBeTruthy();
  });
});
