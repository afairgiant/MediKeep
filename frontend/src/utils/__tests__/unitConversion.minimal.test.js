/**
 * Minimal unit conversion tests - just verify core functionality works
 */
import {
  convertWeight,
  convertHeight,
  convertForDisplay,
  convertForStorage
} from '../unitConversion';

describe('Core Unit Conversion', () => {
  test('weight conversions work', () => {
    // Test basic conversions work and return numbers
    expect(typeof convertWeight.lbsToKg(100)).toBe('number');
    expect(typeof convertWeight.kgToLbs(50)).toBe('number');
    
    // Test they're in the right ballpark
    expect(convertWeight.lbsToKg(100)).toBeGreaterThan(40);
    expect(convertWeight.lbsToKg(100)).toBeLessThan(50);
    
    expect(convertWeight.kgToLbs(50)).toBeGreaterThan(100);
    expect(convertWeight.kgToLbs(50)).toBeLessThan(120);
  });

  test('height conversions work', () => {
    expect(typeof convertHeight.inchesToCm(70)).toBe('number');
    expect(typeof convertHeight.cmToInches(180)).toBe('number');
    
    expect(convertHeight.inchesToCm(70)).toBeGreaterThan(170);
    expect(convertHeight.inchesToCm(70)).toBeLessThan(185);
    
    expect(convertHeight.cmToInches(180)).toBeGreaterThan(65);
    expect(convertHeight.cmToInches(180)).toBeLessThan(75);
  });

  test('display conversion works', () => {
    // Imperial - no conversion
    expect(convertForDisplay(70, 'height', 'imperial')).toBe(70);
    expect(convertForDisplay(150, 'weight', 'imperial')).toBe(150);
    
    // Metric - should convert and return numbers
    expect(typeof convertForDisplay(70, 'height', 'metric')).toBe('number');
    expect(typeof convertForDisplay(150, 'weight', 'metric')).toBe('number');
  });

  test('storage conversion works', () => {
    // Imperial - no conversion  
    expect(convertForStorage(70, 'height', 'imperial')).toBe(70);
    expect(convertForStorage(150, 'weight', 'imperial')).toBe(150);
    
    // Metric - should convert and return numbers
    expect(typeof convertForStorage(180, 'height', 'metric')).toBe('number');
    expect(typeof convertForStorage(80, 'weight', 'metric')).toBe('number');
  });

  test('null/undefined handling', () => {
    expect(convertWeight.lbsToKg(null)).toBeNull();
    expect(convertWeight.kgToLbs(null)).toBeNull();
    expect(convertHeight.inchesToCm(null)).toBeNull();
    expect(convertHeight.cmToInches(null)).toBeNull();
    
    expect(convertForDisplay(null, 'height', 'metric')).toBeNull();
    expect(convertForStorage(null, 'weight', 'metric')).toBeNull();
  });

  test('real world scenario - Admin Fair values', () => {
    // Admin Fair: 68.9 inches, 182.98 lbs
    const storedHeight = 68.9;
    const storedWeight = 182.98;
    
    // Convert to metric for display
    const metricHeight = convertForDisplay(storedHeight, 'height', 'metric');
    const metricWeight = convertForDisplay(storedWeight, 'weight', 'metric');
    
    // Should be reasonable metric values
    expect(metricHeight).toBeGreaterThan(170);
    expect(metricHeight).toBeLessThan(180);
    expect(metricWeight).toBeGreaterThan(80);
    expect(metricWeight).toBeLessThan(90);
  });

  test('real world scenario - metric input', () => {
    // User enters 175 cm, 83 kg in metric mode
    const metricHeight = 175;
    const metricWeight = 83;
    
    // Convert to imperial for storage
    const storageHeight = convertForStorage(metricHeight, 'height', 'metric');
    const storageWeight = convertForStorage(metricWeight, 'weight', 'metric');
    
    // Should be reasonable imperial values
    expect(storageHeight).toBeGreaterThan(65);
    expect(storageHeight).toBeLessThan(75);
    expect(storageWeight).toBeGreaterThan(175);
    expect(storageWeight).toBeLessThan(190);
  });
});