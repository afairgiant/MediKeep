/**
 * Translation Key Validation Tests
 *
 * Ensures all translation keys are consistent across language files
 * and that no keys are missing between locales.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load JSON files
const loadTranslations = (locale, namespace) => {
  const filePath = path.join(
    __dirname,
    '../../../public/locales',
    locale,
    `${namespace}.json`
  );

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
};

// Helper to extract all keys from nested object
const extractKeys = (obj, prefix = '') => {
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
};

// Helper to find missing keys
const findMissingKeys = (baseKeys, compareKeys) => {
  return baseKeys.filter(key => !compareKeys.includes(key));
};

describe('Translation Key Consistency', () => {
  const locales = ['en', 'de', 'fr'];
  const namespaces = ['common', 'medical', 'errors', 'navigation'];

  describe('All language files exist', () => {
    locales.forEach(locale => {
      namespaces.forEach(namespace => {
        it(`should have ${locale}/${namespace}.json`, () => {
          const translations = loadTranslations(locale, namespace);
          expect(translations).not.toBeNull();
          expect(typeof translations).toBe('object');
        });
      });
    });
  });

  describe('Key consistency between languages', () => {
    namespaces.forEach(namespace => {
      it(`should have matching keys in all languages for ${namespace}`, () => {
        const enTranslations = loadTranslations('en', namespace);
        const deTranslations = loadTranslations('de', namespace);
        const frTranslations = loadTranslations('fr', namespace);

        if (!enTranslations || !deTranslations || !frTranslations) {
          return; // Skip if namespace doesn't exist
        }

        const enKeys = extractKeys(enTranslations).sort();
        const deKeys = extractKeys(deTranslations).sort();
        const frKeys = extractKeys(frTranslations).sort();

        // Check DE vs EN
        const missingInDe = findMissingKeys(enKeys, deKeys);
        const extraInDe = findMissingKeys(deKeys, enKeys);

        // Check FR vs EN
        const missingInFr = findMissingKeys(enKeys, frKeys);
        const extraInFr = findMissingKeys(frKeys, enKeys);

        // Report missing keys
        if (missingInDe.length > 0) {
          console.warn(`⚠️  Missing in DE (${namespace}):`, missingInDe);
        }
        if (extraInDe.length > 0) {
          console.warn(`⚠️  Extra in DE (${namespace}):`, extraInDe);
        }
        if (missingInFr.length > 0) {
          console.warn(`⚠️  Missing in FR (${namespace}):`, missingInFr);
        }
        if (extraInFr.length > 0) {
          console.warn(`⚠️  Extra in FR (${namespace}):`, extraInFr);
        }

        // Test assertions
        expect(missingInDe, `Missing keys in DE/${namespace}.json`).toEqual([]);
        expect(extraInDe, `Extra keys in DE/${namespace}.json`).toEqual([]);
        expect(missingInFr, `Missing keys in FR/${namespace}.json`).toEqual([]);
        expect(extraInFr, `Extra keys in FR/${namespace}.json`).toEqual([]);
      });
    });
  });

  describe('New PR #350 features', () => {
    it('should have modal translations for medication/condition linking', () => {
      locales.forEach(locale => {
        const common = loadTranslations(locale, 'common');

        expect(common.modals).toBeDefined();
        expect(common.modals.linkMedicationToCondition).toBeDefined();
        expect(common.modals.linkConditionToLabResult).toBeDefined();
        expect(common.modals.selectMedication).toBeDefined();
        expect(common.modals.selectCondition).toBeDefined();
        expect(common.modals.relevanceNoteOptional).toBeDefined();
      });
    });

    it('should have patient form translations', () => {
      locales.forEach(locale => {
        const common = loadTranslations(locale, 'common');

        expect(common.patients?.form).toBeDefined();
        expect(common.patients.form.createTitle).toBeDefined();
        expect(common.patients.form.editTitle).toBeDefined();
        expect(common.patients.form.firstName?.label).toBeDefined();
        expect(common.patients.form.lastName?.label).toBeDefined();
        expect(common.patients.form.birthDate?.label).toBeDefined();
        expect(common.patients.form.gender?.options).toBeDefined();
      });
    });

    it('should have symptom episode translations', () => {
      locales.forEach(locale => {
        const common = loadTranslations(locale, 'common');

        expect(common.symptoms).toBeDefined();
        expect(common.symptoms.logEpisodeTitle).toBeDefined();
        expect(common.symptoms.editEpisodeTitle).toBeDefined();
        expect(common.symptoms.addSymptomTitle).toBeDefined();
        expect(common.symptoms.occurrence?.additionalNotes).toBeDefined();
      });
    });

    it('should have lab result enhanced translations', () => {
      locales.forEach(locale => {
        const medical = loadTranslations(locale, 'medical');

        expect(medical.labResults).toBeDefined();
        expect(medical.labResults.status).toBeDefined();
        expect(medical.labResults.category).toBeDefined();
        expect(medical.labResults.testType).toBeDefined();
        expect(medical.labResults.result).toBeDefined();
        expect(medical.labResults.form?.relatedConditions).toBeDefined();
      });
    });

    it('should have immunization site and route options', () => {
      locales.forEach(locale => {
        const medical = loadTranslations(locale, 'medical');

        expect(medical.immunizations?.siteOptions).toBeDefined();
        expect(medical.immunizations.siteOptions.leftDeltoid).toBeDefined();
        expect(medical.immunizations.siteOptions.rightDeltoid).toBeDefined();

        expect(medical.immunizations?.routeOptions).toBeDefined();
        expect(medical.immunizations.routeOptions.intramuscular).toBeDefined();
        expect(medical.immunizations.routeOptions.subcutaneous).toBeDefined();

        expect(medical.immunizations?.manufacturerOptions).toBeDefined();
      });
    });

    it('should have treatment frequency options', () => {
      locales.forEach(locale => {
        const medical = loadTranslations(locale, 'medical');

        expect(medical.treatments?.frequency).toBeDefined();
        expect(medical.treatments.frequency.label).toBeDefined();
        expect(medical.treatments.startDate?.label).toBeDefined();
        expect(medical.treatments.endDate?.label).toBeDefined();
      });
    });

    it('should have search placeholders for all medical pages', () => {
      locales.forEach(locale => {
        const common = loadTranslations(locale, 'common');

        expect(common.searchPlaceholders).toBeDefined();
        expect(common.searchPlaceholders.conditions).toBeDefined();
        expect(common.searchPlaceholders.medications).toBeDefined();
        expect(common.searchPlaceholders.labResults).toBeDefined();
        expect(common.searchPlaceholders.immunizations).toBeDefined();
        expect(common.searchPlaceholders.allergies).toBeDefined();
        expect(common.searchPlaceholders.symptoms).toBeDefined();
        expect(common.searchPlaceholders.practitioners).toBeDefined();
        expect(common.searchPlaceholders.pharmacies).toBeDefined();
      });
    });

    it('should have relationship error messages', () => {
      locales.forEach(locale => {
        const errors = loadTranslations(locale, 'errors');

        expect(errors.relationships).toBeDefined();
        expect(errors.relationships.addConditionFailed).toBeDefined();
        expect(errors.relationships.addMedicationFailed).toBeDefined();
      });
    });
  });

  describe('No empty translation values', () => {
    locales.forEach(locale => {
      namespaces.forEach(namespace => {
        it(`should not have empty values in ${locale}/${namespace}.json`, () => {
          const translations = loadTranslations(locale, namespace);
          if (!translations) return;

          const checkForEmptyValues = (obj, path = '') => {
            for (const key in obj) {
              const currentPath = path ? `${path}.${key}` : key;

              if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                checkForEmptyValues(obj[key], currentPath);
              } else if (typeof obj[key] === 'string') {
                expect(
                  obj[key].trim().length,
                  `Empty value at ${currentPath} in ${locale}/${namespace}.json`
                ).toBeGreaterThan(0);
              }
            }
          };

          checkForEmptyValues(translations);
        });
      });
    });
  });
});
