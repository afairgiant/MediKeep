import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  createRecordLabResultLink: vi.fn(),
}));

vi.mock('../../services/api', () => ({ apiService: api }));
vi.mock('../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../notifyTranslated', () => ({ notifyWarning: vi.fn() }));

import { notifyWarning } from '../notifyTranslated';
import {
  linkPendingLabResultsOrWarn,
  savePendingRecordLabResultLinks,
} from '../recordLabResultLinks';

const pending = [
  { entityId: 3, relevanceNote: 'a', purpose: null },
  { entityId: 4, relevanceNote: null, purpose: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  api.createRecordLabResultLink.mockResolvedValue({});
});

describe('savePendingRecordLabResultLinks', () => {
  it('links each lab result to the new record, with its note', async () => {
    const failed = await savePendingRecordLabResultLinks(
      'medications',
      9,
      pending
    );
    expect(failed).toBe(0);
    expect(api.createRecordLabResultLink).toHaveBeenNthCalledWith(
      1,
      'medications',
      9,
      { lab_result_id: 3, relevance_note: 'a' }
    );
    expect(api.createRecordLabResultLink).toHaveBeenNthCalledWith(
      2,
      'medications',
      9,
      { lab_result_id: 4, relevance_note: null }
    );
  });

  it('keeps going after a failure and counts the failed links', async () => {
    api.createRecordLabResultLink
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({});
    expect(
      await savePendingRecordLabResultLinks('procedures', 9, pending)
    ).toBe(1);
    expect(api.createRecordLabResultLink).toHaveBeenCalledTimes(2);
  });

  it('does nothing without pending links', async () => {
    expect(await savePendingRecordLabResultLinks('procedures', 9)).toBe(0);
    expect(await savePendingRecordLabResultLinks('procedures', 9, [])).toBe(0);
    expect(api.createRecordLabResultLink).not.toHaveBeenCalled();
  });
});

describe('linkPendingLabResultsOrWarn', () => {
  it('stays quiet when every link is saved', async () => {
    await linkPendingLabResultsOrWarn('medications', 9, pending);
    expect(notifyWarning).not.toHaveBeenCalled();
  });

  it('warns once, about lab results, when any link fails', async () => {
    api.createRecordLabResultLink.mockRejectedValue(new Error('boom'));
    await linkPendingLabResultsOrWarn('medications', 9, pending);
    expect(notifyWarning).toHaveBeenCalledTimes(1);
    expect(notifyWarning).toHaveBeenCalledWith(
      'common:recordRelationships.labResultLinkFailed',
      { title: 'common:visits.notifications.relationshipLinkWarning' }
    );
  });

  it('does not call the API or warn with nothing pending', async () => {
    await linkPendingLabResultsOrWarn('medications', 9, []);
    await linkPendingLabResultsOrWarn('medications', 9, undefined);
    expect(api.createRecordLabResultLink).not.toHaveBeenCalled();
    expect(notifyWarning).not.toHaveBeenCalled();
  });
});
