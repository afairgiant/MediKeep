import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  recordLabResultLinkSource,
  recordLabResultRow,
  recordLabResultsHavePurpose,
} from '../recordLabResultLinks';

const api = vi.hoisted(() => ({
  getRecordLabResultLinks: vi.fn(),
  createRecordLabResultLink: vi.fn(),
  updateRecordLabResultLink: vi.fn(),
  deleteRecordLabResultLink: vi.fn(),
  getPatientLabResults: vi.fn(),
}));
vi.mock('../../services/api', () => ({ apiService: api }));
vi.mock('../../services/api/symptomApi', () => ({ symptomApi: {} }));

beforeEach(() => {
  Object.values(api).forEach(fn => fn.mockReset());
});

// Shaped like GET /{medications|procedures}/{id}/lab-results
// (RecordLabResultLinkResponse in app/schemas/lab_result.py)
const RESPONSE = {
  id: 11,
  lab_result_id: 3,
  medication_id: 8,
  relevance_note: 'liver function',
  lab_result: {
    id: 3,
    test_name: 'Liver Panel',
    test_category: 'chemistry',
    status: 'completed',
    labs_result: 'normal',
    completed_date: '2026-02-01',
  },
};

describe('recordLabResultRow', () => {
  it('maps the response to a link row', () => {
    expect(recordLabResultRow(RESPONSE)).toEqual({
      id: 11,
      targetId: 3,
      name: 'Liver Panel',
      date: '2026-02-01',
      status: 'completed',
      relevanceNote: 'liver function',
      purpose: null,
    });
    expect(recordLabResultRow({ ...RESPONSE, purpose: 'safety' }).purpose).toBe(
      'safety'
    );
  });

  it('falls back to the id when the lab result is missing', () => {
    expect(
      recordLabResultRow({ id: 1, lab_result_id: 99, lab_result: null }).name
    ).toBe('#99');
  });
});

describe('recordLabResultLinkSource', () => {
  it.each(['procedures', 'conditions'] as const)(
    'reads and writes the purpose and note through the %s record routes',
    async path => {
      api.getRecordLabResultLinks.mockResolvedValue([
        { ...RESPONSE, purpose: 'monitoring' },
      ]);
      api.createRecordLabResultLink.mockResolvedValue({});
      api.updateRecordLabResultLink.mockResolvedValue({});
      api.deleteRecordLabResultLink.mockResolvedValue({});
      const source = recordLabResultLinkSource(path, 8, 7);

      const rows = await source.loadRows();
      expect(rows).toHaveLength(1);
      expect(rows[0].purpose).toBe('monitoring');
      expect(api.getRecordLabResultLinks).toHaveBeenCalledWith(
        path,
        8,
        undefined
      );

      await source.createLinks([3, 4], 'n', 'baseline');
      expect(api.createRecordLabResultLink).toHaveBeenNthCalledWith(
        1,
        path,
        8,
        { lab_result_id: 3, relevance_note: 'n', purpose: 'baseline' }
      );
      expect(api.createRecordLabResultLink).toHaveBeenNthCalledWith(
        2,
        path,
        8,
        { lab_result_id: 4, relevance_note: 'n', purpose: 'baseline' }
      );

      await source.updateLink({ id: 11 } as never, {
        relevance_note: null,
        purpose: 'outcome',
      });
      expect(api.updateRecordLabResultLink).toHaveBeenCalledWith(path, 8, 11, {
        relevance_note: null,
        purpose: 'outcome',
      });
      await source.updateLink({ id: 11 } as never, { relevance_note: 'n' });
      expect(api.updateRecordLabResultLink).toHaveBeenLastCalledWith(
        path,
        8,
        11,
        { relevance_note: 'n', purpose: null }
      );

      await source.removeLink({ id: 11 } as never);
      expect(api.deleteRecordLabResultLink).toHaveBeenCalledWith(path, 8, 11);
    }
  );

  it('sends no purpose for medication links, which have none', async () => {
    api.createRecordLabResultLink.mockResolvedValue({});
    api.updateRecordLabResultLink.mockResolvedValue({});
    const source = recordLabResultLinkSource('medications', 8, 7);

    await source.createLinks([3], 'n', 'baseline');
    expect(api.createRecordLabResultLink).toHaveBeenCalledWith(
      'medications',
      8,
      { lab_result_id: 3, relevance_note: 'n' }
    );
    await source.updateLink({ id: 11 } as never, {
      relevance_note: 'n',
      purpose: 'baseline',
    });
    expect(api.updateRecordLabResultLink).toHaveBeenCalledWith(
      'medications',
      8,
      11,
      { relevance_note: 'n' }
    );
  });

  it('knows which record types have a purpose', () => {
    expect(recordLabResultsHavePurpose('procedures')).toBe(true);
    expect(recordLabResultsHavePurpose('conditions')).toBe(true);
    expect(recordLabResultsHavePurpose('medications')).toBe(false);
  });

  it('offers the patient lab results, labelled like the visit side', async () => {
    api.getPatientLabResults.mockResolvedValue([
      {
        id: 3,
        test_name: 'CBC',
        ordered_date: '2026-01-05',
        status: 'completed',
      },
    ]);
    expect(
      await recordLabResultLinkSource('medications', 8, 7).fetchCandidates()
    ).toEqual([{ id: 3, label: 'CBC (2026-01-05, completed)' }]);
    expect(api.getPatientLabResults).toHaveBeenCalledWith(7, undefined);
  });

  it('offers nothing without a patient', async () => {
    expect(
      await recordLabResultLinkSource('procedures', 8, null).fetchCandidates()
    ).toEqual([]);
    expect(api.getPatientLabResults).not.toHaveBeenCalled();
  });
});
