import { apiService } from '../services/api';
import { ENCOUNTER_LINK_TYPE_BY_KEY } from './encounterLinkTypes';
import type { LinkRow, LinkSource } from '../types/encounterLinks';
import { asList, asString, type Raw } from '../utils/rawValues';

/** Records that show the lab results linked to them (the link is made on either side). */
export type RecordLabResultPath = 'medications' | 'procedures' | 'conditions';

/** Row from a record-side response (/{type}/{id}/lab-results). */
export const recordLabResultRow = (raw: Raw): LinkRow => {
  const lab = (raw.lab_result ?? {}) as Raw;
  return {
    id: raw.id as number,
    targetId: raw.lab_result_id as number,
    name: asString(lab.test_name) ?? `#${String(raw.lab_result_id)}`,
    date: asString(lab.completed_date),
    status: asString(lab.status),
    relevanceNote: asString(raw.relevance_note),
    purpose: null,
  };
};

/**
 * Link source for a medication's or procedure's "Lab Results" card. The record-side
 * route links one lab result at a time, so several are created one by one.
 */
export const recordLabResultLinkSource = (
  recordPath: RecordLabResultPath,
  recordId: number,
  patientId: number | null | undefined
): LinkSource => ({
  loadRows: async signal =>
    asList(
      await apiService.getRecordLabResultLinks(recordPath, recordId, signal)
    ).map(recordLabResultRow),
  fetchCandidates: signal =>
    patientId
      ? ENCOUNTER_LINK_TYPE_BY_KEY.labResults.fetchCandidates(patientId, signal)
      : Promise.resolve([]),
  createLinks: async (ids, note) => {
    for (const id of ids) {
      await apiService.createRecordLabResultLink(recordPath, recordId, {
        lab_result_id: id,
        relevance_note: note,
      });
    }
  },
  updateLink: async (row, updates) => {
    await apiService.updateRecordLabResultLink(recordPath, recordId, row.id, {
      relevance_note: updates.relevance_note ?? null,
    });
  },
  removeLink: async row => {
    await apiService.deleteRecordLabResultLink(recordPath, recordId, row.id);
  },
});
