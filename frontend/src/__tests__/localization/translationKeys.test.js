/**
 * Translation Key Validation Tests
 *
 * Ensures all translation keys are consistent across language files
 * and that no keys are missing between locales.
 *
 * Covers all 6 supported locales (en, de, es, fr, it, pt)
 * and all 5 namespaces (common, medical, errors, navigation, notifications).
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
  const locales = ['en', 'de', 'es', 'fr', 'it', 'pt'];
  const namespaces = ['common', 'medical', 'errors', 'navigation', 'notifications'];

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
    const nonEnLocales = locales.filter(l => l !== 'en');

    namespaces.forEach(namespace => {
      nonEnLocales.forEach(locale => {
        it(`should have matching keys in ${locale.toUpperCase()} for ${namespace}`, () => {
          const enTranslations = loadTranslations('en', namespace);
          const localeTranslations = loadTranslations(locale, namespace);

          if (!enTranslations || !localeTranslations) {
            return; // Skip if namespace doesn't exist
          }

          const enKeys = extractKeys(enTranslations).sort();
          const localeKeys = extractKeys(localeTranslations).sort();

          const missing = findMissingKeys(enKeys, localeKeys);
          const extra = findMissingKeys(localeKeys, enKeys);

          if (missing.length > 0) {
            console.warn(`⚠️  Missing in ${locale.toUpperCase()} (${namespace}):`, missing);
          }
          if (extra.length > 0) {
            console.warn(`⚠️  Extra in ${locale.toUpperCase()} (${namespace}):`, extra);
          }

          expect(missing, `Missing keys in ${locale.toUpperCase()}/${namespace}.json`).toEqual([]);
          expect(extra, `Extra keys in ${locale.toUpperCase()}/${namespace}.json`).toEqual([]);
        });
      });
    });
  });

  describe('No empty translation values', () => {
    locales.forEach(locale => {
      namespaces.forEach(namespace => {
        it(`should not have empty values in ${locale}/${namespace}.json`, () => {
          const translations = loadTranslations(locale, namespace);
          if (!translations) return;

          const checkForEmptyValues = (obj, keyPath = '') => {
            for (const key in obj) {
              const currentPath = keyPath ? `${keyPath}.${key}` : key;

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

  describe('Valid JSON structure', () => {
    locales.forEach(locale => {
      namespaces.forEach(namespace => {
        it(`should have valid JSON in ${locale}/${namespace}.json`, () => {
          const filePath = path.join(
            __dirname,
            '../../../public/locales',
            locale,
            `${namespace}.json`
          );

          if (!fs.existsSync(filePath)) return;

          const content = fs.readFileSync(filePath, 'utf8');

          // Should not throw
          expect(() => JSON.parse(content)).not.toThrow();

          // Should be a non-null object
          const parsed = JSON.parse(content);
          expect(parsed).not.toBeNull();
          expect(typeof parsed).toBe('object');
          expect(Array.isArray(parsed)).toBe(false);
        });
      });
    });
  });

  describe('Feature-specific key existence', () => {
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

    // Notification toast tests are EN-only until non-English notification files are populated.
    // The key consistency tests above will catch missing keys once translations are added.
    it('should have notification toast translations for auth (EN)', () => {
      const notifications = loadTranslations('en', 'notifications');

      expect(notifications.toasts).toBeDefined();
      expect(notifications.toasts.auth).toBeDefined();
      expect(notifications.toasts.auth.sessionExpired).toBeDefined();
      expect(notifications.toasts.auth.loginSuccess).toBeDefined();
      expect(notifications.toasts.auth.loginFailed).toBeDefined();
      expect(notifications.toasts.auth.logoutSuccess).toBeDefined();
      expect(notifications.toasts.auth.loginRequired).toBeDefined();
    });

    it('should have notification toast translations for patient operations (EN)', () => {
      const notifications = loadTranslations('en', 'notifications');

      expect(notifications.toasts.patient).toBeDefined();
      expect(notifications.toasts.patient.nowViewing).toBeDefined();
      expect(notifications.toasts.patient.deletedSuccess).toBeDefined();
      expect(notifications.toasts.patient.createdSuccess).toBeDefined();
    });

    it('should have notification toast translations for vitals (EN)', () => {
      const notifications = loadTranslations('en', 'notifications');

      expect(notifications.toasts.vitals).toBeDefined();
      expect(notifications.toasts.vitals.savedSuccess).toBeDefined();
      expect(notifications.toasts.vitals.deleteSuccess).toBeDefined();
      expect(notifications.toasts.vitals.deleteFailed).toBeDefined();
    });
  });
});
