import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ createConditionMedication: vi.fn() }));
vi.mock('../../services/api', () => ({ apiService: api }));
vi.mock('../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { savePendingMedicationConditionLinks } from '../medicationConditionLinks';

const pending = [
  { entityId: 3, relevanceNote: 'a', purpose: null },
  { entityId: 4, relevanceNote: null, purpose: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.createConditionMedication.mockResolvedValue({});
});

describe('savePendingMedicationConditionLinks', () => {
  it('links the new medication to each chosen condition, with its note', async () => {
    expect(await savePendingMedicationConditionLinks(9, pending)).toBe(0);
    expect(api.createConditionMedication).toHaveBeenNthCalledWith(1, 3, {
      medication_id: 9,
      relevance_note: 'a',
    });
    expect(api.createConditionMedication).toHaveBeenNthCalledWith(2, 4, {
      medication_id: 9,
      relevance_note: null,
    });
  });

  it('keeps going after a failure and counts the failed links', async () => {
    api.createConditionMedication
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({});
    expect(await savePendingMedicationConditionLinks(9, pending)).toBe(1);
    expect(api.createConditionMedication).toHaveBeenCalledTimes(2);
  });

  it('does nothing without pending links', async () => {
    expect(await savePendingMedicationConditionLinks(9)).toBe(0);
    expect(await savePendingMedicationConditionLinks(9, [])).toBe(0);
    expect(api.createConditionMedication).not.toHaveBeenCalled();
  });
});
