import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ createConditionMedicationsBulk: vi.fn() }));
vi.mock('../../services/api', () => ({ apiService: api }));
vi.mock('../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../notifyTranslated', () => ({ notifyWarning: vi.fn() }));

import { linkPendingConditionMedicationsOrWarn } from '../conditionMedicationLinks';
import { notifyWarning } from '../notifyTranslated';

beforeEach(() => {
  vi.clearAllMocks();
  api.createConditionMedicationsBulk.mockResolvedValue([]);
});

describe('linkPendingConditionMedicationsOrWarn', () => {
  it('links medications that share a note in one bulk call', async () => {
    await linkPendingConditionMedicationsOrWarn(9, [
      { entityId: 1, relevanceNote: 'a', purpose: null },
      { entityId: 2, relevanceNote: null, purpose: null },
      { entityId: 3, relevanceNote: 'a', purpose: null },
    ]);
    expect(api.createConditionMedicationsBulk).toHaveBeenCalledTimes(2);
    expect(api.createConditionMedicationsBulk).toHaveBeenCalledWith(9, {
      medication_ids: [1, 3],
      relevance_note: 'a',
    });
    expect(api.createConditionMedicationsBulk).toHaveBeenCalledWith(9, {
      medication_ids: [2],
      relevance_note: null,
    });
    expect(notifyWarning).not.toHaveBeenCalled();
  });

  it('keeps going after a failed call and warns once', async () => {
    api.createConditionMedicationsBulk
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([]);
    await linkPendingConditionMedicationsOrWarn(9, [
      { entityId: 1, relevanceNote: 'a', purpose: null },
      { entityId: 2, relevanceNote: 'b', purpose: null },
    ]);
    expect(api.createConditionMedicationsBulk).toHaveBeenCalledTimes(2);
    expect(notifyWarning).toHaveBeenCalledTimes(1);
    expect(notifyWarning).toHaveBeenCalledWith(
      'common:conditions.notifications.medicationLinkFailed',
      { title: 'common:conditions.notifications.medicationLinkWarning' }
    );
  });

  it('does not call the API or warn with nothing pending', async () => {
    await linkPendingConditionMedicationsOrWarn(9);
    await linkPendingConditionMedicationsOrWarn(9, []);
    expect(api.createConditionMedicationsBulk).not.toHaveBeenCalled();
    expect(notifyWarning).not.toHaveBeenCalled();
  });
});
