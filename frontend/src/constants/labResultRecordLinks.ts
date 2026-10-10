import {
  IconHeartbeat,
  IconPill,
  IconScissors,
  IconStethoscope,
  type TablerIcon,
} from '@tabler/icons-react';

import { apiService } from '../services/api';
import {
  PURPOSE_OPTIONS as TREATMENT_PURPOSE_OPTIONS,
  getPurposeColor as getTreatmentPurposeColor,
  getPurposeLabel as getTreatmentPurposeLabel,
} from './treatmentLabResultConstants';
import { ENCOUNTER_LINK_TYPE_BY_KEY } from './encounterLinkTypes';
import type {
  LinkRow,
  LinkSource,
  LinkUpdate,
  PendingLink,
  PurposeConfig,
} from '../types/encounterLinks';
import type { InlineCreateType } from '../contexts/InlineCreateContext';
import { asList, asString, type Raw } from '../utils/rawValues';

/** Record types a lab result links to, besides visits. */
export type LabResultLinkKey =
  | 'conditions'
  | 'medications'
  | 'procedures'
  | 'treatments';

export interface LabResultLinkConfig {
  key: LabResultLinkKey;
  /** Entity type understood by navigateToEntity */
  entityType: string;
  icon: TablerIcon;
  color: string;
  createType: InlineCreateType;
  /** Label for a record in the link list (also used for a newly created one) */
  candidateLabel: (_record: Raw) => string;
  /** Only treatment links carry a purpose and an expected frequency */
  supportsPurpose: boolean;
  supportsExpectedFrequency: boolean;
  purposeConfig?: PurposeConfig;
}

const asObject = (value: unknown): Raw =>
  value && typeof value === 'object' ? (value as Raw) : {};

/**
 * How a lab-result-side response (/lab-results/{id}/{type}) names its linked
 * record: the id field, and the nested record the name and date come from.
 */
interface RowFields {
  idField: string;
  nested: string;
  name: (_detail: Raw) => string | null;
  date?: (_detail: Raw) => string | null;
}

const toRow =
  ({ idField, nested, name, date }: RowFields) =>
  (raw: Raw): LinkRow => {
    const detail = asObject(raw[nested]);
    return {
      id: raw.id as number,
      targetId: raw[idField] as number,
      name: name(detail) ?? `#${String(raw[idField])}`,
      date: date ? date(detail) : null,
      status: asString(detail.status),
      relevanceNote: asString(raw.relevance_note),
      purpose: asString(raw.purpose),
      expectedFrequency: asString(raw.expected_frequency),
    };
  };

const medicationName = (detail: Raw): string | null => {
  const name = asString(detail.medication_name);
  const dosage = asString(detail.dosage);
  return name && dosage ? `${name} (${dosage})` : name;
};

const TREATMENT_PURPOSES: PurposeConfig = {
  options: TREATMENT_PURPOSE_OPTIONS,
  getLabel: getTreatmentPurposeLabel,
  getColor: getTreatmentPurposeColor,
};

export const LAB_RESULT_LINK_TYPES: LabResultLinkConfig[] = [
  {
    key: 'conditions',
    entityType: 'condition',
    icon: IconStethoscope,
    color: 'blue',
    createType: 'conditions',
    candidateLabel: ENCOUNTER_LINK_TYPE_BY_KEY.conditions.candidateLabel,
    supportsPurpose: false,
    supportsExpectedFrequency: false,
  },
  {
    key: 'medications',
    entityType: 'medication',
    icon: IconPill,
    color: 'teal',
    createType: 'medications',
    candidateLabel: ENCOUNTER_LINK_TYPE_BY_KEY.medications.candidateLabel,
    supportsPurpose: false,
    supportsExpectedFrequency: false,
  },
  {
    key: 'procedures',
    entityType: 'procedure',
    icon: IconScissors,
    color: 'grape',
    createType: 'procedures',
    candidateLabel: ENCOUNTER_LINK_TYPE_BY_KEY.procedures.candidateLabel,
    supportsPurpose: false,
    supportsExpectedFrequency: false,
  },
  {
    key: 'treatments',
    entityType: 'treatment',
    icon: IconHeartbeat,
    color: 'pink',
    createType: 'treatments',
    candidateLabel: ENCOUNTER_LINK_TYPE_BY_KEY.treatments.candidateLabel,
    supportsPurpose: true,
    supportsExpectedFrequency: true,
    purposeConfig: TREATMENT_PURPOSES,
  },
];

export const LAB_RESULT_LINK_TYPE_BY_KEY = Object.fromEntries(
  LAB_RESULT_LINK_TYPES.map(config => [config.key, config])
) as Record<LabResultLinkKey, LabResultLinkConfig>;

interface LabResultLinkApi {
  rowFields: RowFields;
  load: (_labResultId: number, _signal?: AbortSignal) => Promise<unknown>;
  create: (
    _labResultId: number,
    _targetId: number,
    _note: string | null,
    _purpose: string | null,
    _expectedFrequency: string | null
  ) => Promise<unknown>;
  update: (
    _labResultId: number,
    _linkId: number,
    _updates: LinkUpdate
  ) => Promise<unknown>;
  remove: (_labResultId: number, _linkId: number) => Promise<unknown>;
}

const API_BY_KEY: Record<LabResultLinkKey, LabResultLinkApi> = {
  conditions: {
    rowFields: {
      idField: 'condition_id',
      nested: 'condition',
      name: detail => asString(detail.diagnosis),
    },
    load: (id, signal) => apiService.getLabResultConditions(id, signal),
    create: (id, targetId, note) =>
      apiService.createLabResultCondition(id, {
        lab_result_id: id,
        condition_id: targetId,
        relevance_note: note,
      }),
    update: (id, linkId, updates) =>
      apiService.updateLabResultCondition(id, linkId, {
        relevance_note: updates.relevance_note ?? null,
      }),
    remove: (id, linkId) => apiService.deleteLabResultCondition(id, linkId),
  },
  medications: {
    rowFields: {
      idField: 'medication_id',
      nested: 'medication',
      name: medicationName,
    },
    load: (id, signal) => apiService.getLabResultMedications(id, signal),
    create: (id, targetId, note) =>
      apiService.createLabResultMedication(id, {
        lab_result_id: id,
        medication_id: targetId,
        relevance_note: note,
      }),
    update: (id, linkId, updates) =>
      apiService.updateLabResultMedication(id, linkId, {
        relevance_note: updates.relevance_note ?? null,
      }),
    remove: (id, linkId) => apiService.deleteLabResultMedication(id, linkId),
  },
  procedures: {
    rowFields: {
      idField: 'procedure_id',
      nested: 'procedure',
      name: detail => asString(detail.procedure_name),
      date: detail => asString(detail.date),
    },
    load: (id, signal) => apiService.getLabResultProcedures(id, signal),
    create: (id, targetId, note) =>
      apiService.createLabResultProcedure(id, {
        lab_result_id: id,
        procedure_id: targetId,
        relevance_note: note,
      }),
    update: (id, linkId, updates) =>
      apiService.updateLabResultProcedure(id, linkId, {
        relevance_note: updates.relevance_note ?? null,
      }),
    remove: (id, linkId) => apiService.deleteLabResultProcedure(id, linkId),
  },
  treatments: {
    rowFields: {
      idField: 'treatment_id',
      nested: 'treatment',
      name: detail => asString(detail.treatment_name),
    },
    load: (id, signal) => apiService.getLabResultTreatments(id, signal),
    create: (id, targetId, note, purpose, expectedFrequency) =>
      apiService.createLabResultTreatment(id, {
        treatment_id: targetId,
        purpose,
        expected_frequency: expectedFrequency,
        relevance_note: note,
      }),
    update: (id, linkId, updates) =>
      apiService.updateLabResultTreatment(id, linkId, {
        purpose: updates.purpose ?? null,
        expected_frequency: updates.expected_frequency ?? null,
        relevance_note: updates.relevance_note ?? null,
      }),
    remove: (id, linkId) => apiService.deleteLabResultTreatment(id, linkId),
  },
};

/**
 * Link source for one linked type's tab on a lab result. There is no bulk
 * route on the lab-result side, so several links are created one by one.
 */
export const labResultRecordLinkSource = (
  key: LabResultLinkKey,
  labResultId: number,
  patientId: number | null | undefined
): LinkSource => {
  const api = API_BY_KEY[key];
  const mapRow = toRow(api.rowFields);
  return {
    loadRows: async signal =>
      asList(await api.load(labResultId, signal)).map(mapRow),
    fetchCandidates: signal =>
      patientId
        ? ENCOUNTER_LINK_TYPE_BY_KEY[key].fetchCandidates(patientId, signal)
        : Promise.resolve([]),
    createLinks: async (ids, note, purpose, expectedFrequency) => {
      for (const id of ids) {
        await api.create(
          labResultId,
          id,
          note,
          purpose,
          expectedFrequency ?? null
        );
      }
    },
    updateLink: async (row, updates) => {
      await api.update(labResultId, row.id, updates);
    },
    removeLink: async row => {
      await api.remove(labResultId, row.id);
    },
  };
};

const PENDING_ID_FIELD: Record<LabResultLinkKey, string> = {
  conditions: 'condition_id',
  medications: 'medication_id',
  procedures: 'procedure_id',
  treatments: 'treatment_id',
};

/**
 * The Add form keeps its chosen links in the API's field names (the page
 * saves them as they are); the link card works with PendingLink.
 */
export const pendingToLinks = (
  key: LabResultLinkKey,
  pending: Raw[]
): PendingLink[] =>
  pending.map(item => ({
    entityId: item[PENDING_ID_FIELD[key]] as number,
    relevanceNote: asString(item.relevance_note),
    purpose: asString(item.purpose),
    expectedFrequency: asString(item.expected_frequency),
  }));

export const linksToPending = (
  key: LabResultLinkKey,
  links: PendingLink[]
): Raw[] =>
  links.map(link => ({
    [PENDING_ID_FIELD[key]]: link.entityId,
    ...(key === 'treatments'
      ? {
          purpose: link.purpose || null,
          expected_frequency: link.expectedFrequency || null,
        }
      : {}),
    relevance_note: link.relevanceNote || null,
  }));
