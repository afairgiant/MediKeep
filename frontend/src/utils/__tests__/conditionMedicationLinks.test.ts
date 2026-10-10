import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ createConditionMedicationsBulk: vi.fn() }));
vi.mock('../../services/api', () => ({ apiService: api }));
vi.mock('../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { savePendingConditionMedicationLinks } from '../conditionMedicationLinks';

beforeEach(() => {
  vi.clearAllMocks();
  api.createConditionMedicationsBulk.mockResolvedValue([]);
});

describe('savePendingConditionMedicationLinks', () => {
  it('links medications that share a note in one bulk call', async () => {
    const failed = await savePendingConditionMedicationLinks(9, [
      { entityId: 1, relevanceNote: 'a', purpose: null },
      { entityId: 2, relevanceNote: null, purpose: null },
      { entityId: 3, relevanceNote: 'a', purpose: null },
    ]);
    expect(failed).toBe(0);
    expect(api.createConditionMedicationsBulk).toHaveBeenCalledTimes(2);
    expect(api.createConditionMedicationsBulk).toHaveBeenCalledWith(9, {
      medication_ids: [1, 3],
      relevance_note: 'a',
    });
    expect(api.createConditionMedicationsBulk).toHaveBeenCalledWith(9, {
      medication_ids: [2],
      relevance_note: null,
    });
  });

  it('keeps going after a failed call and counts it', async () => {
    api.createConditionMedicationsBulk
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([]);
    expect(
      await savePendingConditionMedicationLinks(9, [
        { entityId: 1, relevanceNote: 'a', purpose: null },
        { entityId: 2, relevanceNote: 'b', purpose: null },
      ])
    ).toBe(1);
    expect(api.createConditionMedicationsBulk).toHaveBeenCalledTimes(2);
  });

  it('does nothing without pending links', async () => {
    expect(await savePendingConditionMedicationLinks(9)).toBe(0);
    expect(await savePendingConditionMedicationLinks(9, [])).toBe(0);
    expect(api.createConditionMedicationsBulk).not.toHaveBeenCalled();
  });
});
