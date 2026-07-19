/**
 * Treatment-Lab Result Relationship Constants
 *
 * Purpose options and helpers for the LabResultTreatmentRelationships component,
 * matching the valid `purpose` values accepted by the backend
 * (app/schemas/treatment.py's `_validate_lab_result_purpose`).
 */

export const PURPOSE_OPTIONS = [
  { value: 'baseline', label: 'Baseline' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'outcome', label: 'Outcome' },
  { value: 'safety', label: 'Safety' },
  { value: 'other', label: 'Other' },
];

/**
 * Get the display label for a purpose value.
 *
 * @param {string} purpose - The purpose value
 * @returns {string} The display label, or the raw value if not found
 */
export function getPurposeLabel(purpose) {
  const option = PURPOSE_OPTIONS.find(o => o.value === purpose);
  return option ? option.label : purpose || '';
}

/**
 * Get the badge color for a purpose value.
 *
 * @param {string} purpose - The purpose value
 * @returns {string} A Mantine color string
 */
export function getPurposeColor(purpose) {
  switch (purpose) {
    case 'baseline':
      return 'blue';
    case 'monitoring':
      return 'cyan';
    case 'outcome':
      return 'green';
    case 'safety':
      return 'orange';
    case 'other':
      return 'violet';
    default:
      return 'gray';
  }
}
