/**
 * Encounter-Lab Result Relationship Constants
 *
 * Shared purpose options and helpers used by both
 * VisitRelationshipsTab (via LinkSection) and LabResultEncounterRelationships components.
 */

export const PURPOSE_OPTIONS = [
  { value: 'ordered_during', labelKey: 'shared:linkPurposes.orderedDuring' },
  {
    value: 'results_reviewed',
    labelKey: 'shared:linkPurposes.resultsReviewed',
  },
  { value: 'follow_up_for', labelKey: 'shared:linkPurposes.followUpFor' },
  { value: 'reference', labelKey: 'shared:linkPurposes.reference' },
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
