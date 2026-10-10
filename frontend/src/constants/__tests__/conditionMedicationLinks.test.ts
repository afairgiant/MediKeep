import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  conditionMedicationLinkSource,
  conditionMedicationRow,
} from '../conditionMedicationLinks';

const api = vi.hoisted(() => ({
  getConditionMedicationLinks: vi.fn(),
  createConditionMedicationsBulk: vi.fn(),
  updateConditionMedication: vi.fn(),
  deleteConditionMedication: vi.fn(),
  getPatientMedications: vi.fn(),
}));
vi.mock('../../services/api', () => ({ apiService: api }));
vi.mock('../../services/api/symptomApi', () => ({ symptomApi: {} }));

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset());
});

// Shaped like GET /conditions/{id}/medications (ConditionMedicationWithDetails)
const RESPONSE = {
  id: 11,
  condition_id: 3,
  medication_id: 8,
  relevance_note: 'first line',
  medication: {
    id: 8,
    medication_name: 'Lisinopril',
    dosage: '10mg',
    status: 'active',
    effective_period_start: '2026-01-15',
  },
};

describe('conditionMedicationRow', () => {
  it('maps the response to a link row', () => {
    expect(conditionMedicationRow(RESPONSE)).toEqual({
      id: 11,
      targetId: 8,
      name: 'Lisinopril (10mg)',
      date: '2026-01-15',
      status: 'active',
      relevanceNote: 'first line',
      purpose: null,
    });
  });

  it('shows the name alone when there is no dosage, and the id when the medication is missing', () => {
    expect(
      conditionMedicationRow({
        ...RESPONSE,
        medication: { medication_name: 'Aspirin', dosage: null },
      }).name
    ).toBe('Aspirin');
    expect(
      conditionMedicationRow({ id: 1, medication_id: 99, medication: null })
        .name
    ).toBe('#99');
  });
});

describe('conditionMedicationLinkSource', () => {
  it('reads and writes through the condition routes', async () => {
    api.getConditionMedicationLinks.mockResolvedValue([RESPONSE]);
    api.createConditionMedicationsBulk.mockResolvedValue([]);
    api.updateConditionMedication.mockResolvedValue({});
    api.deleteConditionMedication.mockResolvedValue({});
    const source = conditionMedicationLinkSource(3, 7);

    expect(await source.loadRows()).toHaveLength(1);
    expect(api.getConditionMedicationLinks).toHaveBeenCalledWith(3, undefined);

    // One bulk request links several medications with the shared note
    await source.createLinks([8, 9], 'note', null);
    expect(api.createConditionMedicationsBulk).toHaveBeenCalledTimes(1);
    expect(api.createConditionMedicationsBulk).toHaveBeenCalledWith(3, {
      medication_ids: [8, 9],
      relevance_note: 'note',
    });

    await source.updateLink({ id: 11 } as never, { relevance_note: null });
    expect(api.updateConditionMedication).toHaveBeenCalledWith(3, 11, {
      relevance_note: null,
    });

    await source.removeLink({ id: 11 } as never);
    expect(api.deleteConditionMedication).toHaveBeenCalledWith(3, 11);
  });

  it('offers the patient medications, labelled like the visit side', async () => {
    api.getPatientMedications.mockResolvedValue([
      { id: 5, medication_name: 'Aspirin', dosage: '100mg', status: 'active' },
    ]);
    expect(await conditionMedicationLinkSource(3, 7).fetchCandidates()).toEqual(
      [{ id: 5, label: 'Aspirin (100mg, active)' }]
    );
    expect(api.getPatientMedications).toHaveBeenCalledWith(7, undefined);
  });

  it('offers nothing without a patient', async () => {
    expect(
      await conditionMedicationLinkSource(3, null).fetchCandidates()
    ).toEqual([]);
  });
});
