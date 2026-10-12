/**
 * Treatment-Lab Result Relationship Constants
 *
 * Purpose options and helpers for lab result links to treatments, conditions and
 * procedures, matching the valid `purpose` values accepted by the backend
 * (app/schemas/validators.py's `validate_lab_result_link_purpose`).
 */

export const PURPOSE_OPTIONS = [
  { value: 'baseline', labelKey: 'shared:linkPurposes.baseline' },
  { value: 'monitoring', labelKey: 'shared:linkPurposes.monitoring' },
  { value: 'outcome', labelKey: 'shared:linkPurposes.outcome' },
  { value: 'safety', labelKey: 'shared:linkPurposes.safety' },
  { value: 'other', labelKey: 'shared:linkPurposes.other' },
];

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
