/**
 * Encounter-Lab Result Relationship Constants
 *
 * Shared purpose options and helpers used by both
 * EncounterLabResultRelationships and LabResultEncounterRelationships components.
 */

export const PURPOSE_OPTIONS = [
  { value: 'ordered_during', label: 'Ordered During Visit' },
  { value: 'results_reviewed', label: 'Results Reviewed' },
  { value: 'follow_up_for', label: 'Follow-up For Results' },
  { value: 'reference', label: 'Reference' },
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
    case 'ordered_during':
      return 'blue';
    case 'results_reviewed':
      return 'green';
    case 'follow_up_for':
      return 'orange';
    case 'reference':
      return 'gray';
    case 'other':
      return 'violet';
    default:
      return 'gray';
  }
}
