import { describe, it, expect, vi } from 'vitest';
import {
  isTranslationKey,
  getTranslationKey,
  translateFieldProperty,
  translateFieldConfig,
} from '../formFieldTranslations';

describe('formFieldTranslations', () => {
  describe('isTranslationKey', () => {
    it('should return true for valid translation keys', () => {
      expect(isTranslationKey('medical:allergies.allergen.label')).toBe(true);
      expect(isTranslationKey('common:buttons.save')).toBe(true);
      expect(isTranslationKey('errors:validation.required')).toBe(true);
    });

    it('should return false for non-translation keys', () => {
      expect(isTranslationKey('Notes')).toBe(false);
      expect(isTranslationKey('Allergen')).toBe(false);
      expect(isTranslationKey('some random text')).toBe(false);
    });

    it('should return false for invalid inputs', () => {
      expect(isTranslationKey(null)).toBe(false);
      expect(isTranslationKey(undefined)).toBe(false);
      expect(isTranslationKey('')).toBe(false);
      expect(isTranslationKey(123)).toBe(false);
      expect(isTranslationKey({})).toBe(false);
    });

    it('should return false for strings with multiple colons', () => {
      expect(isTranslationKey('one:two:three')).toBe(false);
    });

    it('should handle edge case of single colon', () => {
      // ':' splits into ['', ''] which has length 2, so it's technically valid by the current implementation
      expect(isTranslationKey(':')).toBe(true);
    });
  });

  describe('getTranslationKey', () => {
    it('should return translation key for common labels', () => {
      expect(getTranslationKey('Notes')).toBe('common.labels.notes');
      expect(getTranslationKey('Tags')).toBe('common.labels.tags');
      // Note: Some keys have multiple mappings in the file, last one wins (object key overwrite)
      expect(getTranslationKey('Status')).toBe('familyHistory.form.condition.status.label');
      expect(getTranslationKey('Severity')).toBe('familyHistory.form.condition.severity.label');
    });

    it('should return translation key for allergy form fields', () => {
      expect(getTranslationKey('Allergen')).toBe('allergies.allergen.label');
      expect(getTranslationKey('Reaction')).toBe('allergies.reaction.label');
    });

    it('should return translation key for placeholders', () => {
      expect(getTranslationKey('e.g., Penicillin, Peanuts, Latex')).toBe('allergies.allergen.placeholder');
      expect(getTranslationKey('Add tags to organize and find this record')).toBe('common.fields.tags.placeholder');
    });

    it('should return translation key for descriptions', () => {
      expect(getTranslationKey('What substance causes the allergic reaction')).toBe('allergies.allergen.description');
      expect(getTranslationKey('Add tags to help organize and search for this record later')).toBe('common.fields.tags.description');
    });

    it('should return translation key for treatment form fields', () => {
      expect(getTranslationKey('Treatment Name')).toBe('treatments.treatmentName.label');
      expect(getTranslationKey('Treatment Type')).toBe('treatments.treatmentType.label');
    });

    it('should return translation key for treatment options', () => {
      expect(getTranslationKey('Surgery - Surgical procedure')).toBe('treatments.treatmentType.options.surgery');
      expect(getTranslationKey('Once daily')).toBe('treatments.frequencyOptions.onceDaily');
    });

    it('should return null for unmapped strings', () => {
      expect(getTranslationKey('This is not mapped')).toBe(null);
      expect(getTranslationKey('Random text')).toBe(null);
    });

    it('should return null for invalid inputs', () => {
      expect(getTranslationKey(null)).toBe(null);
      expect(getTranslationKey(undefined)).toBe(null);
      expect(getTranslationKey('')).toBe(null);
    });
  });

  describe('translateFieldProperty', () => {
    const mockT = vi.fn((key) => `translated_${key}`);

    beforeEach(() => {
      mockT.mockClear();
    });

    it('should translate using translation key directly', () => {
      const result = translateFieldProperty('medical:allergies.allergen.label', mockT);
      expect(mockT).toHaveBeenCalledWith('medical:allergies.allergen.label');
      expect(result).toBe('translated_medical:allergies.allergen.label');
    });

    it('should map and translate mapped strings', () => {
      const result = translateFieldProperty('Notes', mockT);
      expect(mockT).toHaveBeenCalledWith('common.labels.notes');
      expect(result).toBe('translated_common.labels.notes');
    });

    it('should return original text if no mapping found', () => {
      const result = translateFieldProperty('Unmapped Text', mockT);
      expect(result).toBe('Unmapped Text');
    });

    it('should return original value for null/undefined', () => {
      expect(translateFieldProperty(null, mockT)).toBe(null);
      expect(translateFieldProperty(undefined, mockT)).toBe(undefined);
      expect(translateFieldProperty('', mockT)).toBe('');
    });

    it('should handle allergy-specific fields', () => {
      const result = translateFieldProperty('Allergen', mockT);
      expect(mockT).toHaveBeenCalledWith('allergies.allergen.label');
      expect(result).toBe('translated_allergies.allergen.label');
    });

    it('should handle treatment-specific fields', () => {
      const result = translateFieldProperty('Treatment Name', mockT);
      expect(mockT).toHaveBeenCalledWith('treatments.treatmentName.label');
      expect(result).toBe('translated_treatments.treatmentName.label');
    });
  });

  describe('translateFieldConfig', () => {
    const mockT = vi.fn((key) => `translated_${key}`);

    beforeEach(() => {
      mockT.mockClear();
    });

    it('should translate label, placeholder, and description', () => {
      const fieldConfig = {
        name: 'notes',
        label: 'Notes',
        placeholder: 'Add tags to organize and find this record',
        description: 'Add tags to help organize and search for this record later',
      };

      const result = translateFieldConfig(fieldConfig, mockT);

      expect(result.label).toBe('translated_common.labels.notes');
      expect(result.placeholder).toBe('translated_common.fields.tags.placeholder');
      expect(result.description).toBe('translated_common.fields.tags.description');
    });

    it('should preserve untranslated properties', () => {
      const fieldConfig = {
        name: 'customField',
        type: 'text',
        required: true,
        label: 'Notes',
      };

      const result = translateFieldConfig(fieldConfig, mockT);

      expect(result.name).toBe('customField');
      expect(result.type).toBe('text');
      expect(result.required).toBe(true);
      expect(result.label).toBe('translated_common.labels.notes');
    });

    it('should translate select options array', () => {
      const fieldConfig = {
        name: 'treatmentType',
        type: 'select',
        label: 'Treatment Type',
        options: [
          { value: 'surgery', label: 'Surgery - Surgical procedure' },
          { value: 'medication', label: 'Medication - Drug therapy' },
        ],
      };

      const result = translateFieldConfig(fieldConfig, mockT);

      expect(result.options[0].label).toBe('translated_treatments.treatmentType.options.surgery');
      expect(result.options[1].label).toBe('translated_treatments.treatmentType.options.medication');
      expect(result.options[0].value).toBe('surgery'); // value should not change
    });

    it('should handle options without labels', () => {
      const fieldConfig = {
        name: 'field',
        options: [
          { value: 'option1' },
          { value: 'option2', label: 'Notes' },
        ],
      };

      const result = translateFieldConfig(fieldConfig, mockT);

      expect(result.options[0].value).toBe('option1');
      expect(result.options[0].label).toBeUndefined();
      expect(result.options[1].label).toBe('translated_common.labels.notes');
    });

    it('should return original config if no translations apply', () => {
      const fieldConfig = {
        name: 'customField',
        label: 'Unmapped Label',
        placeholder: 'Unmapped Placeholder',
      };

      const result = translateFieldConfig(fieldConfig, mockT);

      expect(result.label).toBe('Unmapped Label');
      expect(result.placeholder).toBe('Unmapped Placeholder');
    });

    it('should handle field configs with missing properties', () => {
      const fieldConfig = {
        name: 'field',
      };

      const result = translateFieldConfig(fieldConfig, mockT);

      expect(result.name).toBe('field');
      expect(result.label).toBeUndefined();
      expect(result.placeholder).toBeUndefined();
    });

    it('should handle translation keys directly in config', () => {
      const fieldConfig = {
        name: 'field',
        label: 'medical:allergies.allergen.label',
        placeholder: 'medical:allergies.allergen.placeholder',
      };

      const result = translateFieldConfig(fieldConfig, mockT);

      expect(result.label).toBe('translated_medical:allergies.allergen.label');
      expect(result.placeholder).toBe('translated_medical:allergies.allergen.placeholder');
    });

    it('should not modify the original fieldConfig object', () => {
      const fieldConfig = {
        name: 'notes',
        label: 'Notes',
        placeholder: 'Enter notes',
      };

      const originalLabel = fieldConfig.label;
      translateFieldConfig(fieldConfig, mockT);

      expect(fieldConfig.label).toBe(originalLabel); // Should not mutate
    });

    it('should handle empty options array', () => {
      const fieldConfig = {
        name: 'field',
        options: [],
      };

      const result = translateFieldConfig(fieldConfig, mockT);

      expect(result.options).toEqual([]);
    });

    it('should translate severity options', () => {
      const fieldConfig = {
        name: 'severity',
        options: [
          { value: 'mild', label: 'Mild - Minor discomfort' },
          { value: 'severe', label: 'Severe - Significant distress' },
        ],
      };

      const result = translateFieldConfig(fieldConfig, mockT);

      expect(result.options[0].label).toBe('translated_common.severity.mild');
      expect(result.options[1].label).toBe('translated_common.severity.severe');
    });
  });
});
