import { formatFieldValue } from './fieldFormatters';

describe('formatFieldValue', () => {
  it('formats is_primary as Yes/No (boolean field)', () => {
    expect(formatFieldValue('is_primary', true)).toBe('Yes');
    expect(formatFieldValue('is_primary', false)).toBe('No');
  });

  it('prints the actual value for primary_care_physician, not Yes/No', () => {
    // Regression test: BOOLEAN_FIELDS previously included a bare 'primary'
    // pattern that, via substring matching, also caught
    // primary_care_physician and printed "Yes" instead of the PCP's name.
    expect(formatFieldValue('primary_care_physician', 'Dr. Jane Doe')).toBe(
      'Dr. Jane Doe'
    );
  });

  it('returns "Not specified" for empty values', () => {
    expect(formatFieldValue('primary_care_physician', '')).toBe(
      'Not specified'
    );
    expect(formatFieldValue('primary_care_physician', null)).toBe(
      'Not specified'
    );
  });
});
