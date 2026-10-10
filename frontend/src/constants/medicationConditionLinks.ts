import { apiService } from '../services/api';
import { ENCOUNTER_LINK_TYPE_BY_KEY } from './encounterLinkTypes';
import type { LinkRow, LinkSource } from '../types/encounterLinks';
import { asList, asString, type Raw } from '../utils/rawValues';

/** Row from GET /conditions/medication/{id}/conditions (the medication side of the link). */
export const medicationConditionRow = (raw: Raw): LinkRow => {
  const condition = (raw.condition ?? {}) as Raw;
  return {
    id: raw.id as number,
    targetId: raw.condition_id as number,
    name: asString(condition.diagnosis) ?? `#${String(raw.condition_id)}`,
    date: null,
    status: asString(condition.status),
    relevanceNote: asString(raw.relevance_note),
    purpose: null,
  };
};

/**
 * Link source for a medication's "Conditions" card. The link rows are the same ones the
 * condition's Medications card edits; the write routes belong to the condition, so
 * several conditions are linked one request at a time.
 */
export const medicationConditionLinkSource = (
  medicationId: number,
  patientId: number | null | undefined
): LinkSource => ({
  loadRows: async signal =>
    asList(await apiService.getMedicationConditions(medicationId, signal)).map(
      medicationConditionRow
    ),
  fetchCandidates: signal =>
    patientId
      ? ENCOUNTER_LINK_TYPE_BY_KEY.conditions.fetchCandidates(patientId, signal)
      : Promise.resolve([]),
  createLinks: async (ids, note) => {
    for (const conditionId of ids) {
      await apiService.createConditionMedication(conditionId, {
        medication_id: medicationId,
        relevance_note: note,
      });
    }
  },
  updateLink: async (row, updates) => {
    await apiService.updateConditionMedication(row.targetId, row.id, {
      relevance_note: updates.relevance_note ?? null,
    });
  },
  removeLink: async row => {
    await apiService.deleteConditionMedication(row.targetId, row.id);
  },
});
