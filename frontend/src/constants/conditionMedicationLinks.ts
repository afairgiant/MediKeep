import { apiService } from '../services/api';
import { ENCOUNTER_LINK_TYPE_BY_KEY } from './encounterLinkTypes';
import type { LinkRow, LinkSource } from '../types/encounterLinks';
import { asList, asString, type Raw } from '../utils/rawValues';

/** Row from GET /conditions/{id}/medications (ConditionMedicationWithDetails). */
export const conditionMedicationRow = (raw: Raw): LinkRow => {
  const med = (raw.medication ?? {}) as Raw;
  const name = asString(med.medication_name);
  const dosage = asString(med.dosage);
  return {
    id: raw.id as number,
    targetId: raw.medication_id as number,
    name:
      (name && dosage ? `${name} (${dosage})` : name) ??
      `#${String(raw.medication_id)}`,
    date: asString(med.effective_period_start),
    status: asString(med.status),
    relevanceNote: asString(raw.relevance_note),
    purpose: null,
  };
};

/**
 * Link source for a condition's "Medications" card. The condition-side bulk route
 * links several medications with one shared note in a single request.
 */
export const conditionMedicationLinkSource = (
  conditionId: number,
  patientId: number | null | undefined
): LinkSource => ({
  loadRows: async signal =>
    asList(
      await apiService.getConditionMedicationLinks(conditionId, signal)
    ).map(conditionMedicationRow),
  fetchCandidates: signal =>
    patientId
      ? ENCOUNTER_LINK_TYPE_BY_KEY.medications.fetchCandidates(
          patientId,
          signal
        )
      : Promise.resolve([]),
  createLinks: async (ids, note) => {
    await apiService.createConditionMedicationsBulk(conditionId, {
      medication_ids: ids,
      relevance_note: note,
    });
  },
  updateLink: async (row, updates) => {
    await apiService.updateConditionMedication(conditionId, row.id, {
      relevance_note: updates.relevance_note ?? null,
    });
  },
  removeLink: async row => {
    await apiService.deleteConditionMedication(conditionId, row.id);
  },
});
