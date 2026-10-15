import { describe, test, expect } from 'vitest';
import {
  DONATION_TYPES,
  DEFAULT_DONATION_INTERVALS,
  getDonationTypeLabel,
  getDonationTypeOptions,
  getDonationTypeColor,
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
