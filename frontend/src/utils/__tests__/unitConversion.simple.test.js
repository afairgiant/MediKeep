/**
 * Simplified unit tests for unit conversion utilities
 * Focus on core functionality and edge cases
 */
import {
  convertWeight,
  convertHeight,
  convertForDisplay,
  convertForStorage
} from '../unitConversion';

describe('Weight Conversion - Core Tests', () => {
  test('lbsToKg converts basic values', () => {
    expect(convertWeight.lbsToKg(220)).toBeCloseTo(99.8, 0);
    expect(convertWeight.lbsToKg(100)).toBeCloseTo(45.4, 0);
    expect(convertWeight.lbsToKg(0)).toBe(0);
  });

  test('kgToLbs converts basic values', () => {
    expect(convertWeight.kgToLbs(100)).toBeCloseTo(220.5, 0);
    expect(convertWeight.kgToLbs(50)).toBeCloseTo(110.2, 0);
    expect(convertWeight.kgToLbs(0)).toBe(0);
  });

  test('handles null and invalid values', () => {
    expect(convertWeight.lbsToKg(null)).toBeNull();
    expect(convertWeight.lbsToKg(undefined)).toBeNull();
    expect(convertWeight.lbsToKg('')).toBeNull();
    expect(convertWeight.lbsToKg('invalid')).toBeNull();

    expect(convertWeight.kgToLbs(null)).toBeNull();
    expect(convertWeight.kgToLbs(undefined)).toBeNull();
    expect(convertWeight.kgToLbs('')).toBeNull();
    expect(convertWeight.kgToLbs('invalid')).toBeNull();
  });
});

describe('Height Conversion - Core Tests', () => {
  test('inchesToCm converts basic values', () => {
    expect(convertHeight.inchesToCm(70)).toBeCloseTo(177.8, 0);
    expect(convertHeight.inchesToCm(60)).toBeCloseTo(152.4, 0);
    expect(convertHeight.inchesToCm(0)).toBe(0);
  });

  test('cmToInches converts basic values', () => {
    expect(convertHeight.cmToInches(180)).toBeCloseTo(70.9, 0);
    expect(convertHeight.cmToInches(150)).toBeCloseTo(59.1, 0);
    expect(convertHeight.cmToInches(0)).toBe(0);
  });

  test('handles null and invalid values', () => {
    expect(convertHeight.inchesToCm(null)).toBeNull();
    expect(convertHeight.inchesToCm(undefined)).toBeNull();
    expect(convertHeight.inchesToCm('')).toBeNull();

    expect(convertHeight.cmToInches(null)).toBeNull();
    expect(convertHeight.cmToInches(undefined)).toBeNull();
    expect(convertHeight.cmToInches('')).toBeNull();
  });
});

describe('Display and Storage Conversion', () => {
  test('convertForDisplay works for imperial (no conversion)', () => {
    expect(convertForDisplay(70, 'height', 'imperial')).toBe(70);
    expect(convertForDisplay(150, 'weight', 'imperial')).toBe(150);
  });

  test('convertForDisplay works for metric', () => {
    const heightCm = convertForDisplay(70, 'height', 'metric');
    expect(heightCm).toBeCloseTo(177.8, 0);
    
    const weightKg = convertForDisplay(150, 'weight', 'metric');
    expect(weightKg).toBeCloseTo(68.0, 0);
  });

  test('convertForStorage works for imperial (no conversion)', () => {
    expect(convertForStorage(70, 'height', 'imperial')).toBe(70);
    expect(convertForStorage(150, 'weight', 'imperial')).toBe(150);
  });

  test('convertForStorage works for metric', () => {
    const heightInches = convertForStorage(180, 'height', 'metric');
    expect(heightInches).toBeCloseTo(70.9, 0);
    
    const weightLbs = convertForStorage(70, 'weight', 'metric');
    expect(weightLbs).toBeCloseTo(154.3, 0);
  });

  test('handles null values', () => {
    expect(convertForDisplay(null, 'height', 'metric')).toBeNull();
    expect(convertForDisplay(undefined, 'weight', 'imperial')).toBeNull();
    expect(convertForDisplay('', 'height', 'metric')).toBeNull();

    expect(convertForStorage(null, 'height', 'metric')).toBeNull();
    expect(convertForStorage(undefined, 'weight', 'imperial')).toBeNull();
    expect(convertForStorage('', 'height', 'metric')).toBeNull();
  });
});

describe('Real-world Scenarios', () => {
  test('Admin Fair height/weight scenario', () => {
    // Admin Fair has 68.9 inches, 182.98 lbs stored
    const storedHeight = 68.9;
    const storedWeight = 182.98;

    // Convert for metric display
    const displayHeight = convertForDisplay(storedHeight, 'height', 'metric');
    const displayWeight = convertForDisplay(storedWeight, 'weight', 'metric');
    
    // Should be reasonable metric values
    expect(displayHeight).toBeGreaterThan(170);
    expect(displayHeight).toBeLessThan(180);
    expect(displayWeight).toBeGreaterThan(80);
    expect(displayWeight).toBeLessThan(90);
  });

  test('User input metric conversion scenario', () => {
    // User enters 175 cm, 80 kg
    const userHeightCm = 175;
    const userWeightKg = 80;

    // Convert for storage
    const storageHeight = convertForStorage(userHeightCm, 'height', 'metric');
    const storageWeight = convertForStorage(userWeightKg, 'weight', 'metric');

    // Should be reasonable imperial values for storage
    expect(storageHeight).toBeGreaterThan(65);
    expect(storageHeight).toBeLessThan(75);
    expect(storageWeight).toBeGreaterThan(170);
    expect(storageWeight).toBeLessThan(185);

    // Round trip should be close to original
    const backToCm = convertForDisplay(storageHeight, 'height', 'metric');
    const backToKg = convertForDisplay(storageWeight, 'weight', 'metric');
    
    expect(Math.abs(backToCm - userHeightCm)).toBeLessThan(2); // Within 2cm
    expect(Math.abs(backToKg - userWeightKg)).toBeLessThan(2);  // Within 2kg
  });
});

describe('Edge Cases', () => {
  test('handles string numbers', () => {
    expect(convertWeight.lbsToKg('150')).toBeCloseTo(68.0, 0);
    expect(convertHeight.inchesToCm('70')).toBeCloseTo(177.8, 0);
  });

  test('handles very small numbers', () => {
    expect(convertWeight.lbsToKg(0.1)).toBeCloseTo(0.045, 2);
    expect(convertHeight.inchesToCm(0.1)).toBeCloseTo(0.254, 2);
  });

  test('handles large numbers', () => {
    expect(convertWeight.lbsToKg(1000)).toBeCloseTo(453.6, 0);
    expect(convertHeight.inchesToCm(100)).toBeCloseTo(254.0, 0);
  });
});