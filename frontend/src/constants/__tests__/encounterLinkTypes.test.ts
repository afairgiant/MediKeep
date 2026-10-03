import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getPatientProcedures: vi.fn(),
  getPatientTreatments: vi.fn(),
  getPatientInjuries: vi.fn(),
  getPatientConditions: vi.fn(),
  getPatientMedications: vi.fn(),
  getPatientLabResults: vi.fn(),
  getSymptoms: vi.fn(),
}));

vi.mock('../../services/api', () => ({ apiService: api }));
vi.mock('../../services/api/symptomApi', () => ({
  symptomApi: { getAll: api.getSymptoms },
}));

import {
  ENCOUNTER_LINK_TYPES,
  ENCOUNTER_LINK_TYPE_BY_KEY,
} from '../encounterLinkTypes';

/**
 * Records use the real column names from the backend models, so a wrong field
 * name in an adapter shows up as a missing label here.
 */
const records: Record<string, Record<string, unknown>> = {
  procedures: {
    id: 1,
    procedure_name: 'Knee arthroscopy',
    date: '2026-01-10',
    status: 'completed',
  },
  treatments: {
    id: 2,
    treatment_name: 'Physio plan',
    start_date: '2026-01-11',
    status: 'active',
  },
  injuries: {
    id: 3,
    injury_name: 'Sprained ankle',
    date_of_injury: '2026-01-12',
    status: 'active',
  },
  symptoms: {
    id: 4,
    symptom_name: 'Headache',
    first_occurrence_date: '2026-01-13',
    status: 'active',
  },
  conditions: {
    id: 5,
    diagnosis: 'Hypertension',
    onset_date: '2026-01-14',
    status: 'active',
  },
  medications: {
    id: 6,
    medication_name: 'Ibuprofen',
    dosage: '200mg',
    status: 'active',
  },
  labResults: {
    id: 7,
    test_name: 'Complete Blood Count',
    ordered_date: '2026-01-15',
    status: 'completed',
  },
};

const expectedLabel: Record<string, string> = {
  procedures: 'Knee arthroscopy (2026-01-10, completed)',
  treatments: 'Physio plan (2026-01-11, active)',
  injuries: 'Sprained ankle (2026-01-12, active)',
  symptoms: 'Headache (2026-01-13, active)',
  conditions: 'Hypertension (2026-01-14, active)',
  medications: 'Ibuprofen (200mg, active)',
  labResults: 'Complete Blood Count (2026-01-15, completed)',
};

const listMock: Record<string, ReturnType<typeof vi.fn>> = {
  procedures: api.getPatientProcedures,
  treatments: api.getPatientTreatments,
  injuries: api.getPatientInjuries,
  symptoms: api.getSymptoms,
  conditions: api.getPatientConditions,
  medications: api.getPatientMedications,
  labResults: api.getPatientLabResults,
};

describe('ENCOUNTER_LINK_TYPES', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('covers every linkable record type once, with unique keys and paths', () => {
    const keys = ENCOUNTER_LINK_TYPES.map(c => c.key);
    expect(keys).toEqual([
      'procedures',
      'treatments',
      'injuries',
      'symptoms',
      'conditions',
      'medications',
      'labResults',
    ]);
    expect(new Set(ENCOUNTER_LINK_TYPES.map(c => c.apiPath)).size).toBe(7);
    expect(Object.keys(ENCOUNTER_LINK_TYPE_BY_KEY)).toHaveLength(7);
  });

  it.each(ENCOUNTER_LINK_TYPES.map(c => [c.key]))(
    'builds a candidate label from the real %s fields',
    async key => {
      const config =
        ENCOUNTER_LINK_TYPE_BY_KEY[
          key as keyof typeof ENCOUNTER_LINK_TYPE_BY_KEY
        ];
      listMock[key].mockResolvedValue([records[key]]);

      const result = await config.fetchCandidates(9);

      expect(result).toEqual([
        { id: records[key].id, label: expectedLabel[key] },
      ]);
    }
  );

  it.each(ENCOUNTER_LINK_TYPES.map(c => [c.key]))(
    'exposes the same label for a single %s record as in the candidate list',
    key => {
      const config =
        ENCOUNTER_LINK_TYPE_BY_KEY[
          key as keyof typeof ENCOUNTER_LINK_TYPE_BY_KEY
        ];
      expect(config.candidateLabel(records[key])).toBe(expectedLabel[key]);
    }
  );

  it('offers creating a new record for every linked type, each with its own create dialog', () => {
    expect(
      ENCOUNTER_LINK_TYPES.filter(c => c.createType).map(c => [
        c.key,
        c.createType,
      ])
    ).toEqual([
      ['procedures', 'procedures'],
      ['treatments', 'treatments'],
      ['injuries', 'injuries'],
      ['symptoms', 'symptoms'],
      ['conditions', 'conditions'],
      ['medications', 'medications'],
      ['labResults', 'labResults'],
    ]);
  });

  it('tolerates a non-array candidate response', async () => {
    api.getPatientProcedures.mockResolvedValue(null);
    expect(
      await ENCOUNTER_LINK_TYPE_BY_KEY.procedures.fetchCandidates(9)
    ).toEqual([]);
  });

  it('maps generic visit-side rows and reads nulls safely', () => {
    const row = ENCOUNTER_LINK_TYPE_BY_KEY.conditions.toRow({
      id: 11,
      entity_id: 5,
      entity_name: 'Hypertension',
      entity_date: null,
      entity_status: 'active',
      relevance_note: '',
    });
    expect(row).toEqual({
      id: 11,
      targetId: 5,
      name: 'Hypertension',
      date: null,
      status: 'active',
      relevanceNote: null,
      purpose: null,
    });
  });

  it('maps lab result rows from the lab_result_* fields including purpose', () => {
    const row = ENCOUNTER_LINK_TYPE_BY_KEY.labResults.toRow({
      id: 21,
      lab_result_id: 9,
      lab_result_name: 'Complete Blood Count',
      lab_result_date: '2026-02-01',
      lab_result_status: 'completed',
      purpose: 'results_reviewed',
      relevance_note: 'n',
    });
    expect(row).toEqual({
      id: 21,
      targetId: 9,
      name: 'Complete Blood Count',
      date: '2026-02-01',
      status: 'completed',
      relevanceNote: 'n',
      purpose: 'results_reviewed',
    });
  });

  it('uses the generic body for all types except lab results', () => {
    expect(
      ENCOUNTER_LINK_TYPE_BY_KEY.procedures.bulkBody([1, 2], 'n', 'x')
    ).toEqual({
      entity_ids: [1, 2],
      relevance_note: 'n',
    });
    expect(
      ENCOUNTER_LINK_TYPE_BY_KEY.labResults.bulkBody([1], null, 'other')
    ).toEqual({
      lab_result_ids: [1],
      relevance_note: null,
      purpose: 'other',
    });
    expect(
      ENCOUNTER_LINK_TYPES.filter(c => c.supportsPurpose).map(c => c.key)
    ).toEqual(['labResults']);
  });
});
