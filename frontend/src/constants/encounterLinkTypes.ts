import {
  IconBandage,
  IconFlask,
  IconHeartbeat,
  IconPill,
  IconScissors,
  IconStethoscope,
  IconThermometer,
} from '@tabler/icons-react';

import { apiService } from '../services/api';
import { symptomApi } from '../services/api/symptomApi';
import type {
  EncounterLinkTypeConfig,
  EncounterLinkTypeKey,
  LinkCandidate,
  LinkRow,
  LinkSource,
} from '../types/encounterLinks';

type Raw = Record<string, unknown>;

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : null;

const asList = (value: unknown): Raw[] => (Array.isArray(value) ? value : []);

const withParts = (name: unknown, ...parts: unknown[]): string => {
  const extras = parts.filter(Boolean).join(', ');
  return extras ? `${String(name)} (${extras})` : String(name);
};

/** Row shape shared by every generic /encounters/{id}/{type} response. */
const genericRow = (raw: Raw): LinkRow => ({
  id: raw.id as number,
  targetId: raw.entity_id as number,
  name: asString(raw.entity_name) ?? `#${String(raw.entity_id)}`,
  date: asString(raw.entity_date),
  status: asString(raw.entity_status),
  relevanceNote: asString(raw.relevance_note),
  purpose: null,
});

const genericBody = (ids: number[], note: string | null) => ({
  entity_ids: ids,
  relevance_note: note,
});

/** The older lab-result route names its fields lab_result_*. */
const labResultRow = (raw: Raw): LinkRow => ({
  id: raw.id as number,
  targetId: raw.lab_result_id as number,
  name: asString(raw.lab_result_name) ?? `#${String(raw.lab_result_id)}`,
  date: asString(raw.lab_result_date),
  status: asString(raw.lab_result_status),
  relevanceNote: asString(raw.relevance_note),
  purpose: asString(raw.purpose),
});

const candidates = (
  records: Raw[],
  label: (_record: Raw) => string
): LinkCandidate[] =>
  records.map(record => ({ id: record.id as number, label: label(record) }));

const procedureLabel = (r: Raw) =>
  withParts(r.procedure_name, r.date, r.status);

const treatmentLabel = (r: Raw) =>
  withParts(r.treatment_name, r.start_date, r.status);

const injuryLabel = (r: Raw) =>
  withParts(r.injury_name, r.date_of_injury, r.status);

const symptomLabel = (r: Raw) =>
  withParts(r.symptom_name, r.first_occurrence_date, r.status);

const conditionLabel = (r: Raw) =>
  withParts(r.diagnosis, r.onset_date, r.status);

const medicationLabel = (r: Raw) =>
  withParts(r.medication_name, r.dosage, r.status);

const labResultLabel = (r: Raw) =>
  withParts(r.test_name, r.ordered_date, r.status);

export const ENCOUNTER_LINK_TYPES: EncounterLinkTypeConfig[] = [
  {
    key: 'procedures',
    apiPath: 'procedures',
    categoryKey: 'procedures',
    entityType: 'procedure',
    icon: IconScissors,
    color: 'grape',
    supportsPurpose: false,
    candidateLabel: procedureLabel,
    createType: 'procedures',
    fetchCandidates: async (patientId, signal) =>
      candidates(
        asList(await apiService.getPatientProcedures(patientId, signal)),
        procedureLabel
      ),
    toRow: genericRow,
    bulkBody: genericBody,
  },
  {
    key: 'treatments',
    apiPath: 'treatments',
    categoryKey: 'treatments',
    entityType: 'treatment',
    icon: IconHeartbeat,
    color: 'pink',
    supportsPurpose: false,
    candidateLabel: treatmentLabel,
    createType: 'treatments',
    fetchCandidates: async (patientId, signal) =>
      candidates(
        asList(await apiService.getPatientTreatments(patientId, signal)),
        treatmentLabel
      ),
    toRow: genericRow,
    bulkBody: genericBody,
  },
  {
    key: 'injuries',
    apiPath: 'injuries',
    categoryKey: 'injuries',
    entityType: 'injury',
    icon: IconBandage,
    color: 'red',
    supportsPurpose: false,
    candidateLabel: injuryLabel,
    createType: 'injuries',
    fetchCandidates: async (patientId, signal) =>
      candidates(
        asList(await apiService.getPatientInjuries(patientId, signal)),
        injuryLabel
      ),
    toRow: genericRow,
    bulkBody: genericBody,
  },
  {
    key: 'symptoms',
    apiPath: 'symptoms',
    categoryKey: 'symptoms',
    entityType: 'symptom',
    icon: IconThermometer,
    color: 'yellow',
    supportsPurpose: false,
    candidateLabel: symptomLabel,
    createType: 'symptoms',
    fetchCandidates: async (patientId, signal) =>
      candidates(
        asList(await symptomApi.getAll({ patient_id: patientId }, signal)),
        symptomLabel
      ),
    toRow: genericRow,
    bulkBody: genericBody,
  },
  {
    key: 'conditions',
    apiPath: 'conditions',
    categoryKey: 'conditions',
    entityType: 'condition',
    icon: IconStethoscope,
    color: 'blue',
    supportsPurpose: false,
    candidateLabel: conditionLabel,
    createType: 'conditions',
    fetchCandidates: async (patientId, signal) =>
      candidates(
        asList(await apiService.getPatientConditions(patientId, signal)),
        conditionLabel
      ),
    toRow: genericRow,
    bulkBody: genericBody,
  },
  {
    key: 'medications',
    apiPath: 'medications',
    categoryKey: 'medications',
    entityType: 'medication',
    icon: IconPill,
    color: 'teal',
    supportsPurpose: false,
    candidateLabel: medicationLabel,
    createType: 'medications',
    fetchCandidates: async (patientId, signal) =>
      candidates(
        asList(await apiService.getPatientMedications(patientId, signal)),
        medicationLabel
      ),
    toRow: genericRow,
    bulkBody: genericBody,
  },
  {
    key: 'labResults',
    apiPath: 'lab-results',
    categoryKey: 'lab_results',
    entityType: 'lab_result',
    icon: IconFlask,
    color: 'violet',
    supportsPurpose: true,
    candidateLabel: labResultLabel,
    createType: 'labResults',
    fetchCandidates: async (patientId, signal) =>
      candidates(
        asList(await apiService.getPatientLabResults(patientId, signal)),
        labResultLabel
      ),
    toRow: labResultRow,
    bulkBody: (ids, note, purpose) => ({
      lab_result_ids: ids,
      relevance_note: note,
      purpose,
    }),
  },
];

export const ENCOUNTER_LINK_TYPE_BY_KEY = Object.fromEntries(
  ENCOUNTER_LINK_TYPES.map(config => [config.key, config])
) as Record<EncounterLinkTypeKey, EncounterLinkTypeConfig>;

/** Link source for one linked type's tab on a saved visit. */
export const visitLinkSource = (
  config: EncounterLinkTypeConfig,
  visitId: number,
  patientId: number | null | undefined
): LinkSource => ({
  loadRows: async signal => {
    const raw: unknown = await apiService.getEncounterLinks(
      visitId,
      config.apiPath,
      signal
    );
    return (Array.isArray(raw) ? (raw as Raw[]) : []).map(config.toRow);
  },
  fetchCandidates: signal =>
    patientId ? config.fetchCandidates(patientId, signal) : Promise.resolve([]),
  createLinks: async (ids, note, purpose) => {
    await apiService.createEncounterLinksBulk(
      visitId,
      config.apiPath,
      config.bulkBody(ids, note, purpose)
    );
  },
  updateLink: async (row, updates) => {
    await apiService.updateEncounterLink(
      visitId,
      config.apiPath,
      row.id,
      updates
    );
  },
  removeLink: async row => {
    await apiService.deleteEncounterLink(visitId, config.apiPath, row.id);
  },
});
