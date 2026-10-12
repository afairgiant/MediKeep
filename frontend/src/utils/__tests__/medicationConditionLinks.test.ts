import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ createConditionMedication: vi.fn() }));
vi.mock('../../services/api', () => ({ apiService: api }));
vi.mock('../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../notifyTranslated', () => ({ notifyWarning: vi.fn() }));

import { linkPendingMedicationConditionsOrWarn } from '../medicationConditionLinks';
import { notifyWarning } from '../notifyTranslated';

const pending = [
  { entityId: 3, relevanceNote: 'a', purpose: null },
  { entityId: 4, relevanceNote: null, purpose: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.createConditionMedication.mockResolvedValue({});
});

describe('linkPendingMedicationConditionsOrWarn', () => {
  it('links the new medication to each chosen condition, with its note', async () => {
    await linkPendingMedicationConditionsOrWarn(9, pending);
    expect(api.createConditionMedication).toHaveBeenNthCalledWith(1, 3, {
      medication_id: 9,
      relevance_note: 'a',
    });
    expect(api.createConditionMedication).toHaveBeenNthCalledWith(2, 4, {
      medication_id: 9,
      relevance_note: null,
    });
    expect(notifyWarning).not.toHaveBeenCalled();
  });

  it('keeps going after a failure and warns once with the failed count', async () => {
    api.createConditionMedication
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({});
    await linkPendingMedicationConditionsOrWarn(9, pending);
    expect(api.createConditionMedication).toHaveBeenCalledTimes(2);
    expect(notifyWarning).toHaveBeenCalledTimes(1);
    expect(notifyWarning).toHaveBeenCalledWith(
      'medical:medications.form.conditionLinkFailed',
      {
        title: 'medical:medications.form.conditionLinkPartialFailure',
        interpolation: { count: 1 },
      }
    );
  });

  it('does not call the API or warn with nothing pending', async () => {
    await linkPendingMedicationConditionsOrWarn(9);
    await linkPendingMedicationConditionsOrWarn(9, []);
    expect(api.createConditionMedication).not.toHaveBeenCalled();
    expect(notifyWarning).not.toHaveBeenCalled();
  });
});
