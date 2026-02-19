/**
 * Unit tests for unit conversion utilities
 */
import {
  convertWeight,
  convertHeight,
  convertTemperature,
  convertForDisplay,
  convertForStorage,
  formatMeasurement,
  validationRanges,
  unitLabels
} from '../unitConversion';

describe('Weight Conversion', () => {
  describe('lbsToKg', () => {
    test('converts pounds to kilograms correctly', () => {
      expect(convertWeight.lbsToKg(220)).toBeCloseTo(99.8, 0);
      expect(convertWeight.lbsToKg(150)).toBeCloseTo(68.0, 0);
      expect(convertWeight.lbsToKg(182.98)).toBeCloseTo(83.0, 0); // Admin Fair's weight
    });

    test('handles edge cases', () => {
      expect(convertWeight.lbsToKg(null)).toBeNull();
      expect(convertWeight.lbsToKg(undefined)).toBeNull();
      expect(convertWeight.lbsToKg('')).toBeNull();
      expect(convertWeight.lbsToKg('invalid')).toBeNull();
      expect(convertWeight.lbsToKg(0)).toBe(0);
    });

    test('handles string numbers', () => {
      expect(convertWeight.lbsToKg('150')).toBeCloseTo(68.0, 1);
      expect(convertWeight.lbsToKg('182.98')).toBeCloseTo(83.0, 1);
    });
  });

  describe('kgToLbs', () => {
    test('converts kilograms to pounds correctly', () => {
      expect(convertWeight.kgToLbs(100)).toBeCloseTo(220.5, 0);
      expect(convertWeight.kgToLbs(70)).toBeCloseTo(154.3, 0);
      expect(convertWeight.kgToLbs(83)).toBeCloseTo(183.0, 0); // Should convert to Admin Fair's weight
    });

    test('handles edge cases', () => {
      expect(convertWeight.kgToLbs(null)).toBeNull();
      expect(convertWeight.kgToLbs(undefined)).toBeNull();
      expect(convertWeight.kgToLbs('')).toBeNull();
      expect(convertWeight.kgToLbs('invalid')).toBeNull();
      expect(convertWeight.kgToLbs(0)).toBe(0);
    });

    test('round-trip conversion maintains precision', () => {
      const originalLbs = 182.98;
      const kg = convertWeight.lbsToKg(originalLbs);
      const backToLbs = convertWeight.kgToLbs(kg);
      expect(backToLbs).toBeCloseTo(originalLbs, 0);
    });
  });
});

describe('Height Conversion', () => {
  describe('inchesToCm', () => {
    test('converts inches to centimeters correctly', () => {
      expect(convertHeight.inchesToCm(70)).toBeCloseTo(177.8, 0);
      expect(convertHeight.inchesToCm(68.9)).toBeCloseTo(175.0, 0); // Admin Fair's height
      expect(convertHeight.inchesToCm(60)).toBeCloseTo(152.4, 0);
    });

    test('handles edge cases', () => {
      expect(convertHeight.inchesToCm(null)).toBeNull();
      expect(convertHeight.inchesToCm(undefined)).toBeNull();
      expect(convertHeight.inchesToCm('')).toBeNull();
      expect(convertHeight.inchesToCm('invalid')).toBeNaN();
      expect(convertHeight.inchesToCm(0)).toBe(0);
    });
  });

  describe('cmToInches', () => {
    test('converts centimeters to inches correctly', () => {
      expect(convertHeight.cmToInches(175)).toBeCloseTo(68.9, 1);
      expect(convertHeight.cmToInches(180)).toBeCloseTo(70.9, 1);
      expect(convertHeight.cmToInches(160)).toBeCloseTo(63.0, 1);
    });

    test('handles edge cases', () => {
      expect(convertHeight.cmToInches(null)).toBeNull();
      expect(convertHeight.cmToInches(undefined)).toBeNull();
      expect(convertHeight.cmToInches('')).toBeNull();
      expect(convertHeight.cmToInches('invalid')).toBeNaN();
      expect(convertHeight.cmToInches(0)).toBe(0);
    });

    test('round-trip conversion maintains precision', () => {
      const originalInches = 68.9;
      const cm = convertHeight.inchesToCm(originalInches);
      const backToInches = convertHeight.cmToInches(cm);
      expect(backToInches).toBeCloseTo(originalInches, 1);
    });
  });

  describe('inchesToFeetInches', () => {
    test('converts inches to feet and inches display format', () => {
      expect(convertHeight.inchesToFeetInches(72)).toBe('6\'0"');
      expect(convertHeight.inchesToFeetInches(68.9)).toBe('5\'8.9"');
      expect(convertHeight.inchesToFeetInches(60)).toBe('5\'0"');
      expect(convertHeight.inchesToFeetInches(75.5)).toBe('6\'3.5"');
    });

    test('handles edge cases', () => {
      expect(convertHeight.inchesToFeetInches(null)).toBeNull();
      expect(convertHeight.inchesToFeetInches('')).toBeNull();
    });
  });

  describe('cmToMeters', () => {
    test('converts centimeters to meters display format', () => {
      expect(convertHeight.cmToMeters(175)).toBe('1.75m');
      expect(convertHeight.cmToMeters(180)).toBe('1.8m');
      expect(convertHeight.cmToMeters(160)).toBe('1.6m');
    });

    test('handles edge cases', () => {
      expect(convertHeight.cmToMeters(null)).toBeNull();
      expect(convertHeight.cmToMeters('')).toBeNull();
    });
  });
});

describe('Temperature Conversion', () => {
  test('converts Fahrenheit to Celsius correctly', () => {
    expect(convertTemperature.fToC(98.6)).toBeCloseTo(37.0, 1);
    expect(convertTemperature.fToC(32)).toBeCloseTo(0, 1);
    expect(convertTemperature.fToC(212)).toBeCloseTo(100, 1);
  });

  test('converts Celsius to Fahrenheit correctly', () => {
    expect(convertTemperature.cToF(37)).toBeCloseTo(98.6, 1);
    expect(convertTemperature.cToF(0)).toBeCloseTo(32, 1);
    expect(convertTemperature.cToF(100)).toBeCloseTo(212, 1);
  });

  test('handles edge cases', () => {
    expect(convertTemperature.fToC(null)).toBeNull();
    expect(convertTemperature.cToF(undefined)).toBeNull();
    expect(convertTemperature.fToC('')).toBeNull();
  });
});

describe('Display Conversion', () => {
  test('converts for imperial display (no conversion)', () => {
    expect(convertForDisplay(68.9, 'height', 'imperial')).toBe(68.9);
    expect(convertForDisplay(182.98, 'weight', 'imperial')).toBe(182.98);
  });

  test('converts for metric display', () => {
    expect(convertForDisplay(68.9, 'height', 'metric')).toBeCloseTo(175.0, 1);
    expect(convertForDisplay(182.98, 'weight', 'metric')).toBeCloseTo(83.0, 1);
  });

  test('handles null/undefined values', () => {
    expect(convertForDisplay(null, 'height', 'metric')).toBeNull();
    expect(convertForDisplay(undefined, 'weight', 'imperial')).toBeNull();
    expect(convertForDisplay('', 'height', 'metric')).toBeNull();
  });
});

describe('Storage Conversion', () => {
  test('converts from imperial to storage (no conversion)', () => {
    expect(convertForStorage(68.9, 'height', 'imperial')).toBe(68.9);
    expect(convertForStorage(182.98, 'weight', 'imperial')).toBe(182.98);
  });

  test('converts from metric to storage', () => {
    expect(convertForStorage(175, 'height', 'metric')).toBeCloseTo(68.9, 1);
    expect(convertForStorage(83, 'weight', 'metric')).toBeCloseTo(183.0, 1);
  });

  test('handles null/undefined values', () => {
    expect(convertForStorage(null, 'height', 'metric')).toBeNull();
    expect(convertForStorage(undefined, 'weight', 'imperial')).toBeNull();
    expect(convertForStorage('', 'height', 'metric')).toBeNull();
  });
});

describe('Format Measurement', () => {
  test('formats measurements with units', () => {
    expect(formatMeasurement(68.9, 'height', 'imperial')).toBe('5\'8.9"');
    expect(formatMeasurement(175, 'height', 'metric')).toBe('1.75m');
    expect(formatMeasurement(182.98, 'weight', 'imperial')).toBe('183 lbs');
    expect(formatMeasurement(83, 'weight', 'metric')).toBe('83 kg');
  });

  test('formats measurements without units', () => {
    expect(formatMeasurement(182.98, 'weight', 'imperial', false)).toBe('183');
    expect(formatMeasurement(83, 'weight', 'metric', false)).toBe('83');
  });

  test('handles invalid values', () => {
    expect(formatMeasurement(null, 'weight', 'imperial')).toBe('--');
    expect(formatMeasurement('', 'height', 'metric')).toBe('--');
    expect(formatMeasurement('invalid', 'weight', 'imperial')).toBe('--');
  });
});

describe('Integration Tests - Real World Scenarios', () => {
  test('Admin Fair data conversion scenario', () => {
    // Admin Fair has height: 68.9 inches, weight: 182.98 lbs in database
    const storedHeight = 68.9;
    const storedWeight = 182.98;

    // Display in metric mode
    const displayHeight = convertForDisplay(storedHeight, 'height', 'metric');
    const displayWeight = convertForDisplay(storedWeight, 'weight', 'metric');
    
    expect(displayHeight).toBeCloseTo(175.0, 1);
    expect(displayWeight).toBeCloseTo(83.0, 1);

    // User updates to 175 cm, 83 kg and saves
    const newStorageHeight = convertForStorage(175, 'height', 'metric');
    const newStorageWeight = convertForStorage(83, 'weight', 'metric');

    expect(newStorageHeight).toBeCloseTo(68.9, 1);
    expect(newStorageWeight).toBeCloseTo(183.0, 1);
  });

  test('User enters 70.87 inches, 187.39 lbs (from your test)', () => {
    // These were the values seen in your network request
    const inputHeight = 70.87;
    const inputWeight = 187.39;

    // Convert back to metric to see what user originally entered
    const originalCm = convertForDisplay(inputHeight, 'height', 'metric');
    const originalKg = convertForDisplay(inputWeight, 'weight', 'metric');

    // Should be close to what user typed in metric mode
    expect(originalCm).toBeGreaterThan(170);
    expect(originalCm).toBeLessThan(185);
    expect(originalKg).toBeGreaterThan(80);
    expect(originalKg).toBeLessThan(90);
  });

  test('Validation ranges are reasonable', () => {
    // Check that validation ranges make sense
    expect(validationRanges.imperial.height.min).toBe(12); // 1 foot
    expect(validationRanges.imperial.height.max).toBe(108); // 9 feet
    expect(validationRanges.imperial.weight.min).toBe(1); // 1 lb
    expect(validationRanges.imperial.weight.max).toBe(992); // ~450 kg

    expect(validationRanges.metric.height.min).toBe(30); // 30 cm
    expect(validationRanges.metric.height.max).toBe(274); // 274 cm
    expect(validationRanges.metric.weight.min).toBe(0.5); // 0.5 kg
    expect(validationRanges.metric.weight.max).toBe(450); // 450 kg
  });

  test('Unit labels are present', () => {
    expect(unitLabels.imperial.weight).toBe('lbs');
    expect(unitLabels.imperial.height).toBe('inches');
    expect(unitLabels.metric.weight).toBe('kg');
    expect(unitLabels.metric.height).toBe('cm');
  });
});

describe('Edge Cases and Error Conditions', () => {
  test('handles very large numbers', () => {
    expect(convertWeight.lbsToKg(999999)).toBe(453591.5);
    expect(convertHeight.inchesToCm(999999)).toBe(2539997.5);
  });

  test('handles very small numbers', () => {
    // Values round to 0 due to 1-decimal precision in lbsToKg/inchesToCm
    expect(convertWeight.lbsToKg(0.001)).toBe(0);
    expect(convertHeight.inchesToCm(0.001)).toBe(0);
  });

  test('handles negative numbers gracefully', () => {
    expect(convertWeight.lbsToKg(-10)).toBeCloseTo(-4.5, 1);
    expect(convertHeight.inchesToCm(-5)).toBeCloseTo(-12.7, 1);
  });

  test('precision is maintained through multiple conversions', () => {
    const originalHeight = 68.897637795; // Very precise value
    const cm = convertHeight.inchesToCm(originalHeight);
    const backToInches = convertHeight.cmToInches(cm);
    
    // Should maintain reasonable precision
    expect(Math.abs(backToInches - originalHeight)).toBeLessThan(0.01);
  });
});