import { describe, test, expect } from 'vitest';
import {
  DONATION_TYPES,
  DEFAULT_DONATION_INTERVALS,
  getDonationTypeLabel,
  getDonationTypeOptions,
  getDonationTypeColor,
  convertHemoglobinForDisplay,
  convertHemoglobinForStorage,
  getHemoglobinRange,
  getHemoglobinUnitLabel,
  SCREENING_RANGES,
} from '../bloodDonationConstants';

const t = (key, fallback) => fallback;

describe('bloodDonationConstants', () => {
  test('has a default interval for every donation type', () => {
    DONATION_TYPES.forEach(type => {
      expect(DEFAULT_DONATION_INTERVALS[type]).toBeGreaterThan(0);
    });
  });

  test('defaults match backend defaults', () => {
    expect(DEFAULT_DONATION_INTERVALS).toEqual({
      whole_blood: 56,
      plasma: 14,
      platelets: 14,
      double_red_cells: 112,
    });
  });

  test('getDonationTypeLabel returns translated fallback', () => {
    expect(getDonationTypeLabel('whole_blood', t)).toBe('Whole Blood');
    expect(getDonationTypeLabel('double_red_cells', t)).toBe(
      'Double Red Cells'
    );
  });

  test('getDonationTypeLabel returns raw value for unknown type', () => {
    expect(getDonationTypeLabel('unknown', t)).toBe('unknown');
    expect(getDonationTypeLabel(null, t)).toBe('');
  });

  test('getDonationTypeOptions builds select options', () => {
    expect(getDonationTypeOptions(t)).toEqual([
      { value: 'whole_blood', label: 'Whole Blood' },
      { value: 'plasma', label: 'Plasma' },
      { value: 'platelets', label: 'Platelets' },
      { value: 'double_red_cells', label: 'Double Red Cells' },
    ]);
  });

  test('getDonationTypeColor has a fallback', () => {
    expect(getDonationTypeColor('whole_blood')).toBe('red');
    expect(getDonationTypeColor('unknown')).toBe('gray');
  });
});

describe('hemoglobin units', () => {
  test('converts stored g/dL for display', () => {
    expect(convertHemoglobinForDisplay(14, 'g_dl')).toBe(14);
    expect(convertHemoglobinForDisplay(14, 'g_l')).toBe(140);
    expect(convertHemoglobinForDisplay(14, 'mmol_l')).toBe(8.7);
  });

  test('missing values stay null and unknown units fall back to g/dL', () => {
    expect(convertHemoglobinForDisplay(null, 'g_l')).toBeNull();
    expect(convertHemoglobinForDisplay('', 'g_l')).toBeNull();
    expect(convertHemoglobinForDisplay(13.5, 'bogus')).toBe(13.5);
    expect(getHemoglobinUnitLabel(undefined)).toBe('g/dL');
  });

  test('converts input back to g/dL', () => {
    expect(convertHemoglobinForStorage(140, 'g_l')).toBe(14);
    expect(convertHemoglobinForStorage(8.7, 'mmol_l')).toBe(14.02);
    expect(convertHemoglobinForStorage('', 'g_l')).toBeNull();
  });

  test('round trip keeps the displayed value', () => {
    ['g_dl', 'g_l', 'mmol_l'].forEach(unit => {
      const shown = convertHemoglobinForDisplay(13.5, unit);
      const stored = convertHemoglobinForStorage(shown, unit);
      expect(convertHemoglobinForDisplay(stored, unit)).toBe(shown);
    });
  });

  test('range edges convert back into the stored range', () => {
    ['g_dl', 'g_l', 'mmol_l'].forEach(unit => {
      const { min, max } = getHemoglobinRange(unit);
      expect(convertHemoglobinForStorage(min, unit)).toBeGreaterThanOrEqual(
        SCREENING_RANGES.hemoglobin.min
      );
      expect(convertHemoglobinForStorage(max, unit)).toBeLessThanOrEqual(
        SCREENING_RANGES.hemoglobin.max
      );
    });
  });
});
