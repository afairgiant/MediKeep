import { vi } from 'vitest';
import { GENDER_OPTIONS, getGenderOptions } from '../genderOptions';

describe('genderOptions', () => {
  it('defines canonical backend values matching validate_gender normalization', () => {
    const values = GENDER_OPTIONS.map(option => option.value);
    expect(values).toEqual(['', 'M', 'F', 'OTHER', 'U']);
  });

  it('maps every entry through the provided translation function', () => {
    const t = vi.fn(key => `translated:${key}`);
    const options = getGenderOptions(t);

    expect(t).toHaveBeenCalledTimes(GENDER_OPTIONS.length);
    options.forEach((option, index) => {
      expect(option.value).toBe(GENDER_OPTIONS[index].value);
      expect(option.label).toBe(`translated:${GENDER_OPTIONS[index].labelKey}`);
    });
  });

  it('passes each entry fallback string as the t() default value', () => {
    const t = vi.fn((key, fallback) => fallback);
    const options = getGenderOptions(t);

    GENDER_OPTIONS.forEach(({ labelKey, fallback }) => {
      expect(t).toHaveBeenCalledWith(labelKey, fallback);
    });
    options.forEach((option, index) => {
      expect(option.label).toBe(GENDER_OPTIONS[index].fallback);
    });
  });
});
