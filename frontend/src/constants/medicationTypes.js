/**
 * Medication Type Constants
 * Shared constants for medication categorization across the application
 */

export const MEDICATION_TYPES = {
  PRESCRIPTION: 'prescription',
  OTC: 'otc',
  SUPPLEMENT: 'supplement',
  HERBAL: 'herbal',
};

export const MEDICATION_TYPE_LABELS = {
  [MEDICATION_TYPES.PRESCRIPTION]: 'Prescription',
  [MEDICATION_TYPES.OTC]: 'Over-the-Counter',
  [MEDICATION_TYPES.SUPPLEMENT]: 'Supplement/Vitamin',
  [MEDICATION_TYPES.HERBAL]: 'Herbal/Natural',
};

export const MEDICATION_TYPE_OPTIONS = Object.keys(MEDICATION_TYPES).map(
  key => ({
    value: MEDICATION_TYPES[key],
    label: MEDICATION_TYPE_LABELS[MEDICATION_TYPES[key]],
  })
);
