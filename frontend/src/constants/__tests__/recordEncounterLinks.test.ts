import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getRecordEncounterLinks: vi.fn(),
  createRecordEncounterLinksBulk: vi.fn(),
  updateRecordEncounterLink: vi.fn(),
  deleteRecordEncounterLink: vi.fn(),
  getPatientEncounters: vi.fn(),
}));

vi.mock('../../services/api', () => ({ apiService: api }));

import {
  fetchVisitCandidates,
  genericVisitLinkSource,
  visitCandidateLabel,
  visitRow,
} from '../recordEncounterLinks';

describe('visitRow', () => {
  it('maps the visit fields of a record-side response', () => {
    expect(
      visitRow({
        id: 77,
        encounter_id: 5,
        entity_id: 31,
        entity_name: 'Knee arthroscopy',
        encounter_reason: 'Annual checkup',
        encounter_date: '2026-03-01',
        relevance_note: 'note',
      })
    ).toEqual({
      id: 77,
      targetId: 5,
      name: 'Annual checkup',
      date: '2026-03-01',
      status: null,
      relevanceNote: 'note',
      purpose: null,
    });
  });

  it('falls back to the id when the visit has no reason and drops empty notes', () => {
    const row = visitRow({ id: 1, encounter_id: 9, relevance_note: '' });
    expect(row.name).toBe('#9');
    expect(row.relevanceNote).toBeNull();
    expect(row.date).toBeNull();
  });
});

describe('fetchVisitCandidates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('labels visits with reason, date and visit type from the real fields', async () => {
    api.getPatientEncounters.mockResolvedValue([
      { id: 1, reason: 'Checkup', date: '2026-03-01', visit_type: 'routine' },
      { id: 2, reason: 'Follow-up', date: '2026-04-02', visit_type: null },
      { id: 3, reason: 'Phone call' },
    ]);
    expect(await fetchVisitCandidates(7)).toEqual([
      { id: 1, label: 'Checkup (2026-03-01, routine)' },
      { id: 2, label: 'Follow-up (2026-04-02)' },
      { id: 3, label: 'Phone call' },
    ]);
  });

  it('returns an empty list for a non-array response', async () => {
    api.getPatientEncounters.mockResolvedValue(null);
    expect(await fetchVisitCandidates(7)).toEqual([]);
  });
});

describe('genericVisitLinkSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads and writes through the record-side routes for the given record type', async () => {
    api.getRecordEncounterLinks.mockResolvedValue([
      { id: 1, encounter_id: 5, encounter_reason: 'Checkup' },
    ]);
    const source = genericVisitLinkSource('injuries', 31, 7);

    expect(await source.loadRows()).toHaveLength(1);
    expect(api.getRecordEncounterLinks).toHaveBeenCalledWith(
      'injuries',
      31,
      undefined
    );

    await source.createLinks([5, 6], 'n', null);
    expect(api.createRecordEncounterLinksBulk).toHaveBeenCalledWith(
      'injuries',
      31,
      { encounter_ids: [5, 6], relevance_note: 'n' }
    );

    const row = visitRow({ id: 1, encounter_id: 5 });
    await source.updateLink(row, { relevance_note: 'x' });
    expect(api.updateRecordEncounterLink).toHaveBeenCalledWith(
      'injuries',
      31,
      1,
      { relevance_note: 'x' }
    );

    await source.removeLink(row);
    expect(api.deleteRecordEncounterLink).toHaveBeenCalledWith(
      'injuries',
      31,
      1
    );
  });

  it('returns no candidates without a patient', async () => {
    expect(
      await genericVisitLinkSource('symptoms', 1, undefined).fetchCandidates()
    ).toEqual([]);
    expect(api.getPatientEncounters).not.toHaveBeenCalled();
  });
});

describe('visitCandidateLabel', () => {
  it('shows reason with date and visit type, skipping what is missing', () => {
    expect(
      visitCandidateLabel({
        reason: 'Checkup',
        date: '2026-03-01',
        visit_type: 'routine',
      })
    ).toBe('Checkup (2026-03-01, routine)');
    expect(
      visitCandidateLabel({ reason: 'Follow-up', date: '2026-04-02' })
    ).toBe('Follow-up (2026-04-02)');
    expect(visitCandidateLabel({ reason: 'Phone call' })).toBe('Phone call');
  });
});
