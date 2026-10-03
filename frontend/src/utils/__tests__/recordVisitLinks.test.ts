import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  createRecordEncounterLinksBulk: vi.fn(),
}));

vi.mock('../../services/api', () => ({ apiService: api }));
vi.mock('../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../notifyTranslated', () => ({ notifyWarning: vi.fn() }));

import { notifyWarning } from '../notifyTranslated';
import {
  groupByNoteAndPurpose,
  linkPendingVisitsOrWarn,
  savePendingRecordVisitLinks,
} from '../recordVisitLinks';

describe('groupByNoteAndPurpose', () => {
  it('groups links by note and purpose, keeping order', () => {
    const groups = groupByNoteAndPurpose([
      { entityId: 1, relevanceNote: 'a', purpose: null },
      { entityId: 2, relevanceNote: 'a', purpose: 'x' },
      { entityId: 3, relevanceNote: 'a', purpose: null },
    ]);
    expect(groups.map(g => g.map(l => l.entityId))).toEqual([[1, 3], [2]]);
  });

  it('returns no groups for an empty list', () => {
    expect(groupByNoteAndPurpose([])).toEqual([]);
  });
});

describe('savePendingRecordVisitLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.createRecordEncounterLinksBulk.mockResolvedValue([]);
  });

  it('makes no calls when nothing is pending', async () => {
    expect(await savePendingRecordVisitLinks('procedures', 4, [])).toBe(0);
    expect(await savePendingRecordVisitLinks('procedures', 4, undefined)).toBe(
      0
    );
    expect(api.createRecordEncounterLinksBulk).not.toHaveBeenCalled();
  });

  it('groups visits that share a note into one call', async () => {
    const failed = await savePendingRecordVisitLinks('injuries', 4, [
      { entityId: 1, relevanceNote: 'a', purpose: null },
      { entityId: 2, relevanceNote: 'b', purpose: null },
      { entityId: 3, relevanceNote: 'a', purpose: null },
    ]);
    expect(failed).toBe(0);
    expect(api.createRecordEncounterLinksBulk).toHaveBeenCalledTimes(2);
    expect(api.createRecordEncounterLinksBulk).toHaveBeenCalledWith(
      'injuries',
      4,
      { encounter_ids: [1, 3], relevance_note: 'a' }
    );
    expect(api.createRecordEncounterLinksBulk).toHaveBeenCalledWith(
      'injuries',
      4,
      { encounter_ids: [2], relevance_note: 'b' }
    );
  });

  it('keeps going after a failure and counts failed calls', async () => {
    api.createRecordEncounterLinksBulk
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([]);
    const failed = await savePendingRecordVisitLinks('symptoms', 4, [
      { entityId: 1, relevanceNote: 'a', purpose: null },
      { entityId: 2, relevanceNote: 'b', purpose: null },
    ]);
    expect(failed).toBe(1);
    expect(api.createRecordEncounterLinksBulk).toHaveBeenCalledTimes(2);
  });
});

describe('linkPendingVisitsOrWarn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.createRecordEncounterLinksBulk.mockResolvedValue([]);
  });

  it('does nothing without pending visits', async () => {
    await linkPendingVisitsOrWarn('conditions', 4, []);
    await linkPendingVisitsOrWarn('conditions', 4, undefined);
    expect(api.createRecordEncounterLinksBulk).not.toHaveBeenCalled();
    expect(notifyWarning).not.toHaveBeenCalled();
  });

  it('stays quiet when every call succeeds', async () => {
    await linkPendingVisitsOrWarn('conditions', 4, [
      { entityId: 1, relevanceNote: null, purpose: null },
    ]);
    expect(api.createRecordEncounterLinksBulk).toHaveBeenCalledTimes(1);
    expect(notifyWarning).not.toHaveBeenCalled();
  });

  it('shows one warning when a call fails', async () => {
    api.createRecordEncounterLinksBulk.mockRejectedValue(new Error('boom'));
    await linkPendingVisitsOrWarn('conditions', 4, [
      { entityId: 1, relevanceNote: 'a', purpose: null },
      { entityId: 2, relevanceNote: 'b', purpose: null },
    ]);
    expect(notifyWarning).toHaveBeenCalledTimes(1);
    expect(notifyWarning).toHaveBeenCalledWith(
      'common:recordRelationships.linkFailed',
      { title: 'common:visits.notifications.relationshipLinkWarning' }
    );
  });
});
