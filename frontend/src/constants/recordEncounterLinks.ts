import { apiService } from '../services/api';
import type {
  LinkCandidate,
  LinkRow,
  LinkSource,
  LinkUpdate,
  RecordLinkKey,
} from '../types/encounterLinks';
import { asString, type Raw } from '../utils/rawValues';

/**
 * Row from a record-side response (/{type}/{id}/encounters). The linked
 * "target" here is the visit, so the encounter_* fields describe it.
 */
export const visitRow = (raw: Raw): LinkRow => ({
  id: raw.id as number,
  targetId: raw.encounter_id as number,
  name: asString(raw.encounter_reason) ?? `#${String(raw.encounter_id)}`,
  date: asString(raw.encounter_date),
  status: null,
  relevanceNote: asString(raw.relevance_note),
  // Only lab result links carry a purpose
  purpose: asString(raw.purpose),
});

/** Label for a visit in the link list: reason, with date and visit type. */
export const visitCandidateLabel = (visit: Raw): string => {
  const extras = [visit.date, visit.visit_type].filter(Boolean).join(', ');
  return extras ? `${String(visit.reason)} (${extras})` : String(visit.reason);
};

/** Visits the record can be linked to, labelled with reason, date and type. */
export const fetchVisitCandidates = async (
  patientId: number,
  signal?: AbortSignal
): Promise<LinkCandidate[]> => {
  const visits: unknown = await apiService.getPatientEncounters(
    patientId,
    signal
  );
  return (Array.isArray(visits) ? (visits as Raw[]) : []).map(visit => ({
    id: visit.id as number,
    label: visitCandidateLabel(visit),
  }));
};

/**
 * Link source for a record's "Visits" section, using the generic record-side
 * routes: procedures, injuries, symptoms, conditions and medications.
 */
export const genericVisitLinkSource = (
  recordPath: RecordLinkKey,
  recordId: number,
  patientId: number | null | undefined
): LinkSource => ({
  loadRows: async signal => {
    const raw: unknown = await apiService.getRecordEncounterLinks(
      recordPath,
      recordId,
      signal
    );
    return (Array.isArray(raw) ? (raw as Raw[]) : []).map(visitRow);
  },
  fetchCandidates: signal =>
    patientId ? fetchVisitCandidates(patientId, signal) : Promise.resolve([]),
  createLinks: async (ids, note) => {
    await apiService.createRecordEncounterLinksBulk(recordPath, recordId, {
      encounter_ids: ids,
      relevance_note: note,
    });
  },
  updateLink: async (row: LinkRow, updates: LinkUpdate) => {
    await apiService.updateRecordEncounterLink(
      recordPath,
      recordId,
      row.id,
      updates
    );
  },
  removeLink: async (row: LinkRow) => {
    await apiService.deleteRecordEncounterLink(recordPath, recordId, row.id);
  },
});

/**
 * Link source for a lab result's "Visits" card. Lab results use their own
 * record-side routes and carry a purpose on each link.
 */
export const labResultVisitLinkSource = (
  labResultId: number,
  patientId: number | null | undefined
): LinkSource => ({
  loadRows: async signal => {
    const raw: unknown = await apiService.getLabResultEncounters(
      labResultId,
      signal
    );
    return (Array.isArray(raw) ? (raw as Raw[]) : []).map(visitRow);
  },
  fetchCandidates: signal =>
    patientId ? fetchVisitCandidates(patientId, signal) : Promise.resolve([]),
  createLinks: async (ids, note, purpose) => {
    await apiService.createLabResultEncountersBulk(labResultId, {
      encounter_ids: ids,
      purpose,
      relevance_note: note,
    });
  },
  updateLink: async (row: LinkRow, updates: LinkUpdate) => {
    await apiService.updateLabResultEncounter(labResultId, row.id, updates);
  },
  removeLink: async (row: LinkRow) => {
    await apiService.deleteLabResultEncounter(labResultId, row.id);
  },
});
