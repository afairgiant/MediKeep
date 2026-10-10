import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  medicationConditionLinkSource,
  medicationConditionRow,
} from '../medicationConditionLinks';

const api = vi.hoisted(() => ({
  getMedicationConditions: vi.fn(),
  createConditionMedication: vi.fn(),
  updateConditionMedication: vi.fn(),
  deleteConditionMedication: vi.fn(),
  getPatientConditions: vi.fn(),
}));
vi.mock('../../services/api', () => ({ apiService: api }));
vi.mock('../../services/api/symptomApi', () => ({ symptomApi: {} }));

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset());
});

// Shaped like GET /conditions/medication/{id}/conditions
const RESPONSE = {
  id: 11,
  condition_id: 3,
  medication_id: 8,
  relevance_note: 'first line',
  condition: {
    id: 3,
    diagnosis: 'Hypertension',
    status: 'active',
    severity: 'mild',
  },
};

describe('medicationConditionRow', () => {
  it('maps the response to a link row', () => {
    expect(medicationConditionRow(RESPONSE)).toEqual({
      id: 11,
      targetId: 3,
      name: 'Hypertension',
      date: null,
      status: 'active',
      relevanceNote: 'first line',
      purpose: null,
    });
  });

  it('falls back to the id when the condition is missing', () => {
    expect(
      medicationConditionRow({ id: 1, condition_id: 99, condition: null }).name
    ).toBe('#99');
  });
});

describe('medicationConditionLinkSource', () => {
  it('reads through the medication route and writes through the condition routes', async () => {
    api.getMedicationConditions.mockResolvedValue([RESPONSE]);
    api.createConditionMedication.mockResolvedValue({});
    api.updateConditionMedication.mockResolvedValue({});
    api.deleteConditionMedication.mockResolvedValue({});
    const source = medicationConditionLinkSource(8, 7);

    const rows = await source.loadRows();
    expect(rows).toHaveLength(1);
    expect(api.getMedicationConditions).toHaveBeenCalledWith(8, undefined);

    // One request per condition: the write route belongs to the condition
    await source.createLinks([3, 4], 'note', null);
    expect(api.createConditionMedication).toHaveBeenNthCalledWith(1, 3, {
      medication_id: 8,
      relevance_note: 'note',
    });
    expect(api.createConditionMedication).toHaveBeenNthCalledWith(2, 4, {
      medication_id: 8,
      relevance_note: 'note',
    });

    // The condition id of the link row names the route, not the medication
    await source.updateLink(rows[0], { relevance_note: 'changed' });
    expect(api.updateConditionMedication).toHaveBeenCalledWith(3, 11, {
      relevance_note: 'changed',
    });
    await source.removeLink(rows[0]);
    expect(api.deleteConditionMedication).toHaveBeenCalledWith(3, 11);
  });

  it('offers the patient conditions, labelled like the visit side', async () => {
    api.getPatientConditions.mockResolvedValue([
      {
        id: 5,
        diagnosis: 'Asthma',
        onset_date: '2020-01-01',
        status: 'active',
      },
    ]);
    expect(await medicationConditionLinkSource(8, 7).fetchCandidates()).toEqual(
      [{ id: 5, label: 'Asthma (2020-01-01, active)' }]
    );
  });

  it('offers nothing without a patient', async () => {
    expect(
      await medicationConditionLinkSource(8, null).fetchCandidates()
    ).toEqual([]);
  });
});
