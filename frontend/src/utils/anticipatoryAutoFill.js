/**
 * Anticipatory auto-fill helpers.
 *
 * "Anticipatory" here means a value the app derived on the user's behalf from
 * some other field, rather than one the user chose. Two invariants apply to
 * every rule in this file:
 *
 *   1. Reversible. When the trigger that produced a value changes, that value
 *      is dropped rather than left behind as a stale guess.
 *   2. Never destructive. A value the user entered themselves is never cleared
 *      or overwritten, even when it happens to match what we would have filled.
 *
 * Both depend on tracking provenance rather than comparing values, since a
 * user-entered value can be identical to a derived one (someone genuinely
 * recording 0 pain, for example). Callers own a `Set` of field names holding
 * currently-derived values and pass it in; these functions mutate it in place.
 * That set must be reset whenever a form is opened, so values loaded from the
 * API are never mistaken for values this module produced.
 */

import { SYMPTOM_SEVERITY, IMPACT_LEVEL } from '../constants/symptomEnums';

/**
 * Applies the severity=none auto-fill for a symptom occurrence's pain_scale
 * and impact_level, and reverts those same fields when severity changes away
 * from none, unless the user has since edited them directly.
 *
 * @param {Object} prev - Current form state.
 * @param {string} name - Name of the field being changed.
 * @param {*} value - New value for that field.
 * @param {Set<string>} autoFilledFields - Provenance set, mutated in place.
 * @returns {Object} Next form state.
 */
export function applyOccurrenceSeverityAutoFill(
  prev,
  name,
  value,
  autoFilledFields
) {
  const updated = { ...prev, [name]: value };

  // A direct edit hands ownership of the field back to the user, so we stop
  // tracking it and will never clear it later.
  if (name === 'pain_scale' || name === 'impact_level') {
    autoFilledFields.delete(name);
    return updated;
  }

  if (name === 'severity') {
    if (value === SYMPTOM_SEVERITY.NONE) {
      // Only fill fields the user has left empty.
      if (prev.pain_scale === '') {
        // Pain scale is a numeric 0-10 range rather than an enumerated set,
        // so there is no constant to reference here.
        updated.pain_scale = '0';
        autoFilledFields.add('pain_scale');
      }
      if (prev.impact_level === '') {
        updated.impact_level = IMPACT_LEVEL.NO_IMPACT;
        autoFilledFields.add('impact_level');
      }
    } else {
      // Trigger no longer applies: drop only values this logic produced.
      if (autoFilledFields.delete('pain_scale')) {
        updated.pain_scale = '';
      }
      if (autoFilledFields.delete('impact_level')) {
        updated.impact_level = '';
      }
    }
  }

  return updated;
}
