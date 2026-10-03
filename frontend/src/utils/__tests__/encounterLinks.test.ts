import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  createEncounterLinksBulk: vi.fn(),
  getPatientProcedures: vi.fn(),
  getPatientTreatments: vi.fn(),
  getPatientInjuries: vi.fn(),
  getPatientConditions: vi.fn(),
  getPatientMedications: vi.fn(),
  getPatientLabResults: vi.fn(),
}));

vi.mock('../../services/api', () => ({ apiService: api }));
vi.mock('../../services/api/symptomApi', () => ({
  symptomApi: { getAll: vi.fn() },
}));
vi.mock('../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  countPendingLinks,
  savePendingEncounterLinks,
} from '../encounterLinks';

describe('countPendingLinks', () => {
  it('returns 0 for empty or missing input', () => {
    expect(countPendingLinks(undefined)).toBe(0);
    expect(countPendingLinks({})).toBe(0);
    expect(countPendingLinks({ procedures: [] })).toBe(0);
  });

  it('adds up links across types', () => {
    expect(
      countPendingLinks({
        procedures: [{ entityId: 1, relevanceNote: null, purpose: null }],
        labResults: [
          { entityId: 2, relevanceNote: null, purpose: null },
          { entityId: 3, relevanceNote: null, purpose: null },
        ],
      })
    ).toBe(3);
  });
});

describe('savePendingEncounterLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.createEncounterLinksBulk.mockResolvedValue([]);
  });

  it('makes no calls when nothing is pending', async () => {
    expect(await savePendingEncounterLinks(5, undefined)).toBe(0);
    expect(await savePendingEncounterLinks(5, {})).toBe(0);
    expect(api.createEncounterLinksBulk).not.toHaveBeenCalled();
  });

  it('sends one bulk call per type with the generic body', async () => {
    const failed = await savePendingEncounterLinks(5, {
      procedures: [
        { entityId: 1, relevanceNote: 'n', purpose: null },
        { entityId: 2, relevanceNote: 'n', purpose: null },
      ],
      medications: [{ entityId: 8, relevanceNote: null, purpose: null }],
    });

    expect(failed).toBe(0);
    expect(api.createEncounterLinksBulk).toHaveBeenCalledTimes(2);
    expect(api.createEncounterLinksBulk).toHaveBeenCalledWith(5, 'procedures', {
      entity_ids: [1, 2],
      relevance_note: 'n',
    });
    expect(api.createEncounterLinksBulk).toHaveBeenCalledWith(
      5,
      'medications',
      {
        entity_ids: [8],
        relevance_note: null,
      }
    );
  });

  it('splits links with different notes or purposes into separate calls', async () => {
    await savePendingEncounterLinks(5, {
      labResults: [
        { entityId: 1, relevanceNote: null, purpose: 'reference' },
        { entityId: 2, relevanceNote: null, purpose: 'other' },
        { entityId: 3, relevanceNote: null, purpose: 'reference' },
      ],
    });

    expect(api.createEncounterLinksBulk).toHaveBeenCalledTimes(2);
    expect(api.createEncounterLinksBulk).toHaveBeenCalledWith(
      5,
      'lab-results',
      {
        lab_result_ids: [1, 3],
        relevance_note: null,
        purpose: 'reference',
      }
    );
    expect(api.createEncounterLinksBulk).toHaveBeenCalledWith(
      5,
      'lab-results',
      {
        lab_result_ids: [2],
        relevance_note: null,
        purpose: 'other',
      }
    );
  });

  it('keeps going after a failure and reports how many calls failed', async () => {
    api.createEncounterLinksBulk.mockImplementation(
      (_id: number, linkType: string) =>
        linkType === 'procedures'
          ? Promise.reject(new Error('boom'))
          : Promise.resolve([])
    );

    const failed = await savePendingEncounterLinks(5, {
      procedures: [{ entityId: 1, relevanceNote: null, purpose: null }],
      conditions: [{ entityId: 2, relevanceNote: null, purpose: null }],
    });

    expect(failed).toBe(1);
    expect(api.createEncounterLinksBulk).toHaveBeenCalledWith(
      5,
      'conditions',
      expect.any(Object)
    );
  });
});
