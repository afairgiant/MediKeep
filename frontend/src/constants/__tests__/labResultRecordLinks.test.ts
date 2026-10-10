import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LAB_RESULT_LINK_TYPES,
  labResultRecordLinkSource,
  linksToPending,
  pendingToLinks,
} from '../labResultRecordLinks';
import { ENCOUNTER_LINK_TYPE_BY_KEY } from '../encounterLinkTypes';

const api = vi.hoisted(() => ({
  getLabResultConditions: vi.fn(),
  createLabResultCondition: vi.fn(),
  updateLabResultCondition: vi.fn(),
  deleteLabResultCondition: vi.fn(),
  getLabResultMedications: vi.fn(),
  createLabResultMedication: vi.fn(),
  updateLabResultMedication: vi.fn(),
  deleteLabResultMedication: vi.fn(),
  getLabResultProcedures: vi.fn(),
  createLabResultProcedure: vi.fn(),
  updateLabResultProcedure: vi.fn(),
  deleteLabResultProcedure: vi.fn(),
  getLabResultTreatments: vi.fn(),
  createLabResultTreatment: vi.fn(),
  updateLabResultTreatment: vi.fn(),
  deleteLabResultTreatment: vi.fn(),
  getPatientConditions: vi.fn(),
}));
vi.mock('../../services/api', () => ({ apiService: api }));
vi.mock('../../services/api/symptomApi', () => ({ symptomApi: {} }));

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset());
});

// Responses shaped like GET /lab-results/{id}/{type} (app/api/v1/endpoints/lab_result.py)
const RESPONSES = {
  conditions: {
    id: 11,
    lab_result_id: 3,
    condition_id: 21,
    relevance_note: 'diabetes follow-up',
    condition: { id: 21, diagnosis: 'Diabetes', status: 'active' },
  },
  medications: {
    id: 12,
    lab_result_id: 3,
    medication_id: 22,
    relevance_note: null,
    medication: {
      id: 22,
      medication_name: 'Metformin',
      dosage: '500 mg',
      status: 'active',
    },
  },
  procedures: {
    id: 13,
    lab_result_id: 3,
    procedure_id: 23,
    relevance_note: 'biopsy',
    procedure: {
      id: 23,
      procedure_name: 'Colonoscopy',
      status: 'completed',
      date: '2025-02-01',
    },
  },
  treatments: {
    id: 14,
    lab_result_id: 3,
    treatment_id: 24,
    purpose: 'monitoring',
    expected_frequency: 'weekly',
    relevance_note: 'check levels',
    treatment: { id: 24, treatment_name: 'Insulin', status: 'active' },
  },
} as const;

const GETTERS = {
  conditions: api.getLabResultConditions,
  medications: api.getLabResultMedications,
  procedures: api.getLabResultProcedures,
  treatments: api.getLabResultTreatments,
};

describe('labResultRecordLinkSource.loadRows', () => {
  it('maps each lab-result-side response to link rows', async () => {
    const expected = {
      conditions: {
        id: 11,
        targetId: 21,
        name: 'Diabetes',
        date: null,
        status: 'active',
        relevanceNote: 'diabetes follow-up',
        purpose: null,
        expectedFrequency: null,
      },
      medications: {
        id: 12,
        targetId: 22,
        name: 'Metformin (500 mg)',
        date: null,
        status: 'active',
        relevanceNote: null,
        purpose: null,
        expectedFrequency: null,
      },
      procedures: {
        id: 13,
        targetId: 23,
        name: 'Colonoscopy',
        date: '2025-02-01',
        status: 'completed',
        relevanceNote: 'biopsy',
        purpose: null,
        expectedFrequency: null,
      },
      treatments: {
        id: 14,
        targetId: 24,
        name: 'Insulin',
        date: null,
        status: 'active',
        relevanceNote: 'check levels',
        purpose: 'monitoring',
        expectedFrequency: 'weekly',
      },
    };
    for (const config of LAB_RESULT_LINK_TYPES) {
      GETTERS[config.key].mockResolvedValue([RESPONSES[config.key]]);
      const rows = await labResultRecordLinkSource(config.key, 3, 7).loadRows();
      expect(rows).toEqual([expected[config.key]]);
      expect(GETTERS[config.key]).toHaveBeenCalledWith(3, undefined);
    }
  });

  it('falls back to the id when the linked record is missing, and to an empty list', async () => {
    api.getLabResultConditions.mockResolvedValue([
      { id: 1, lab_result_id: 3, condition_id: 99, condition: null },
    ]);
    const rows = await labResultRecordLinkSource('conditions', 3, 7).loadRows();
    expect(rows[0].name).toBe('#99');

    api.getLabResultConditions.mockResolvedValue(null);
    expect(
      await labResultRecordLinkSource('conditions', 3, 7).loadRows()
    ).toEqual([]);
  });
});

describe('labResultRecordLinkSource writes', () => {
  it('creates condition links with lab_result_id in the body, one request per record', async () => {
    api.createLabResultCondition.mockResolvedValue({});
    await labResultRecordLinkSource('conditions', 3, 7).createLinks(
      [21, 22],
      'note',
      null
    );
    expect(api.createLabResultCondition).toHaveBeenNthCalledWith(1, 3, {
      lab_result_id: 3,
      condition_id: 21,
      relevance_note: 'note',
    });
    expect(api.createLabResultCondition).toHaveBeenNthCalledWith(2, 3, {
      lab_result_id: 3,
      condition_id: 22,
      relevance_note: 'note',
    });
  });

  it('creates medication and procedure links', async () => {
    api.createLabResultMedication.mockResolvedValue({});
    api.createLabResultProcedure.mockResolvedValue({});
    await labResultRecordLinkSource('medications', 3, 7).createLinks(
      [22],
      null,
      null
    );
    await labResultRecordLinkSource('procedures', 3, 7).createLinks(
      [23],
      'n',
      null
    );
    expect(api.createLabResultMedication).toHaveBeenCalledWith(3, {
      lab_result_id: 3,
      medication_id: 22,
      relevance_note: null,
    });
    expect(api.createLabResultProcedure).toHaveBeenCalledWith(3, {
      lab_result_id: 3,
      procedure_id: 23,
      relevance_note: 'n',
    });
  });

  it('creates treatment links with purpose and expected frequency', async () => {
    api.createLabResultTreatment.mockResolvedValue({});
    await labResultRecordLinkSource('treatments', 3, 7).createLinks(
      [24],
      'n',
      'baseline',
      'daily'
    );
    expect(api.createLabResultTreatment).toHaveBeenCalledWith(3, {
      treatment_id: 24,
      purpose: 'baseline',
      expected_frequency: 'daily',
      relevance_note: 'n',
    });
  });

  it('does not send purpose or frequency when linking conditions', async () => {
    api.createLabResultCondition.mockResolvedValue({});
    await labResultRecordLinkSource('conditions', 3, 7).createLinks(
      [21],
      null,
      'baseline',
      'daily'
    );
    expect(api.createLabResultCondition).toHaveBeenCalledWith(3, {
      lab_result_id: 3,
      condition_id: 21,
      relevance_note: null,
    });
  });

  it('updates a treatment link with all three fields, and others with the note only', async () => {
    api.updateLabResultTreatment.mockResolvedValue({});
    api.updateLabResultMedication.mockResolvedValue({});
    const row = { id: 14 } as never;
    await labResultRecordLinkSource('treatments', 3, 7).updateLink(row, {
      purpose: 'safety',
      expected_frequency: null,
      relevance_note: 'n',
    });
    await labResultRecordLinkSource('medications', 3, 7).updateLink(row, {
      relevance_note: 'm',
    });
    expect(api.updateLabResultTreatment).toHaveBeenCalledWith(3, 14, {
      purpose: 'safety',
      expected_frequency: null,
      relevance_note: 'n',
    });
    expect(api.updateLabResultMedication).toHaveBeenCalledWith(3, 14, {
      relevance_note: 'm',
    });
  });

  it('removes a link by its relationship id', async () => {
    api.deleteLabResultProcedure.mockResolvedValue({});
    await labResultRecordLinkSource('procedures', 3, 7).removeLink({
      id: 13,
    } as never);
    expect(api.deleteLabResultProcedure).toHaveBeenCalledWith(3, 13);
  });
});

describe('labResultRecordLinkSource.fetchCandidates', () => {
  it('uses the patient records and the same labels as the visit side', async () => {
    api.getPatientConditions.mockResolvedValue([
      {
        id: 5,
        diagnosis: 'Asthma',
        onset_date: '2020-01-01',
        status: 'active',
      },
    ]);
    expect(
      await labResultRecordLinkSource('conditions', 3, 7).fetchCandidates()
    ).toEqual([{ id: 5, label: 'Asthma (2020-01-01, active)' }]);
    expect(api.getPatientConditions).toHaveBeenCalledWith(7, undefined);
  });

  it('offers nothing without a patient', async () => {
    expect(
      await labResultRecordLinkSource('conditions', 3, null).fetchCandidates()
    ).toEqual([]);
  });

  it('labels a new record the way the visit side does', () => {
    for (const config of LAB_RESULT_LINK_TYPES) {
      expect(config.candidateLabel).toBe(
        ENCOUNTER_LINK_TYPE_BY_KEY[config.key].candidateLabel
      );
    }
  });
});

describe('pending link mapping', () => {
  it('turns the form pending lists into links and back', () => {
    const treatments = [
      {
        treatment_id: 24,
        purpose: 'monitoring',
        expected_frequency: 'weekly',
        relevance_note: 'n',
      },
    ];
    const links = pendingToLinks('treatments', treatments);
    expect(links).toEqual([
      {
        entityId: 24,
        relevanceNote: 'n',
        purpose: 'monitoring',
        expectedFrequency: 'weekly',
      },
    ]);
    expect(linksToPending('treatments', links)).toEqual(treatments);
  });

  it('keeps only the note for conditions, medications and procedures', () => {
    expect(
      linksToPending('conditions', [
        {
          entityId: 21,
          relevanceNote: '',
          purpose: 'baseline',
          expectedFrequency: 'daily',
        },
      ])
    ).toEqual([{ condition_id: 21, relevance_note: null }]);
    expect(
      linksToPending('medications', [
        { entityId: 22, relevanceNote: 'n', purpose: null },
      ])
    ).toEqual([{ medication_id: 22, relevance_note: 'n' }]);
    expect(
      linksToPending('procedures', [
        { entityId: 23, relevanceNote: null, purpose: null },
      ])
    ).toEqual([{ procedure_id: 23, relevance_note: null }]);
  });
});
