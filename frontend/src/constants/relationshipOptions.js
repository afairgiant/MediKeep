/**
 * Relationship to Self Options
 *
 * Defines the available relationship types for patient records.
 * This should match the RelationshipToSelf enum in the backend.
 */

export const RELATIONSHIP_OPTIONS = [
  { value: '', label: 'Select relationship (optional)' },
  { value: 'self', label: 'Self' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'partner', label: 'Partner' },
  { value: 'child', label: 'Child' },
  { value: 'son', label: 'Son' },
  { value: 'daughter', label: 'Daughter' },
  { value: 'parent', label: 'Parent' },
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'brother', label: 'Brother' },
  { value: 'sister', label: 'Sister' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'grandchild', label: 'Grandchild' },
  { value: 'other_family', label: 'Other Family' },
  { value: 'friend', label: 'Friend' },
  { value: 'other', label: 'Other' },
];

/**
 * Format relationship value for display
 * Converts snake_case to Title Case
 *
 * @param {string} relationship - The relationship value (e.g., 'other_family')
 * @returns {string|null} - Formatted label (e.g., 'Other Family') or null if empty
 */
export const formatRelationshipLabel = (relationship) => {
  if (!relationship) return null;

  // Convert snake_case to Title Case
  const formatted = relationship
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return formatted;
};

/**
 * Get relationship label from value
 *
 * @param {string} value - The relationship value
 * @returns {string|null} - The display label or null if not found
 */
export const getRelationshipLabel = (value) => {
  if (!value) return null;

  const option = RELATIONSHIP_OPTIONS.find(opt => opt.value === value);
  return option ? option.label : formatRelationshipLabel(value);
};
