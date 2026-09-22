/**
 * Resolves the display value for an insurance record's Primary Care
 * Physician: prefers the linked practitioner (resolved from the already
 * loaded practitioners list), falling back to the legacy free-text name
 * only when no practitioner is linked. Never silently swallows a link that
 * failed to resolve - callers should see "ID: X" rather than nothing.
 *
 * @param {Object} insurance - Insurance record (practitioner_id, coverage_details)
 * @param {Array} practitioners - Practitioners list from usePractitioners()
 * @returns {string|null} Display string, or null when nothing is recorded
 */
export const resolveInsurancePcpDisplay = (insurance, practitioners = []) => {
  if (insurance?.practitioner_id) {
    const match = practitioners.find(p => p.id === insurance.practitioner_id);
    return match
      ? `${match.name}${match.specialty ? ` - ${match.specialty}` : ''}`
      : `ID: ${insurance.practitioner_id}`;
  }
  return insurance?.coverage_details?.primary_care_physician || null;
};
