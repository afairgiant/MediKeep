/**
 * Gender Options
 *
 * Canonical gender option values, matching the backend's normalized storage
 * format (see app/schemas/validators.py validate_gender / GENDER_NORMALIZATION).
 * Both patient forms must use these same values so a value saved by one form
 * is correctly re-selected when read back by either form's Select.
 */

export const GENDER_OPTIONS = [
  {
    value: '',
    labelKey: 'shared:fields.selectGender',
    fallback: 'Select gender',
  },
  { value: 'M', labelKey: 'shared:fields.male', fallback: 'Male' },
  { value: 'F', labelKey: 'shared:fields.female', fallback: 'Female' },
  { value: 'OTHER', labelKey: 'shared:fields.other', fallback: 'Other' },
  {
    value: 'U',
    labelKey: 'patients.form.gender.options.preferNotToSay',
    fallback: 'Prefer not to say',
  },
];

/**
 * Build translated gender Select options.
 *
 * @param {Function} t - i18next translation function
 * @returns {Array<{value: string, label: string}>}
 */
export const getGenderOptions = t =>
  GENDER_OPTIONS.map(({ value, labelKey, fallback }) => ({
    value,
    label: t(labelKey, fallback),
  }));
