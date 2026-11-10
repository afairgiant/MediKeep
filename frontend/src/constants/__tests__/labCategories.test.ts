import { describe, it, expect } from 'vitest';
import { getDefaultResultTypeForCategory } from '../labCategories';

describe('getDefaultResultTypeForCategory', () => {
  it.each(['imaging', 'pathology'])(
    'starts %s results as qualitative',
    category => {
      expect(getDefaultResultTypeForCategory(category)).toBe('qualitative');
    }
  );

  it.each([
    'blood work',
    'chemistry',
    'hematology',
    'immunology',
    'genetics',
    'other',
  ])('starts %s results as quantitative', category => {
    expect(getDefaultResultTypeForCategory(category)).toBe('quantitative');
  });

  it.each([undefined, null, ''])(
    'starts quantitative when no category is chosen (%s)',
    category => {
      expect(getDefaultResultTypeForCategory(category)).toBe('quantitative');
    }
  );

  it('is case sensitive, matching the form option values', () => {
    expect(getDefaultResultTypeForCategory('Imaging')).toBe('quantitative');
  });
});
