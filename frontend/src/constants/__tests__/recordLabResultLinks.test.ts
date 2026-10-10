import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  recordLabResultLinkSource,
  recordLabResultRow,
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
  });

  it('falls back to the id when the lab result is missing', () => {
    expect(
      recordLabResultRow({ id: 1, lab_result_id: 99, lab_result: null }).name
    ).toBe('#99');
  });
});

describe('recordLabResultLinkSource', () => {
  it.each(['medications', 'procedures'] as const)(
    'reads and writes through the %s record routes',
    async path => {
      api.getRecordLabResultLinks.mockResolvedValue([RESPONSE]);
      api.createRecordLabResultLink.mockResolvedValue({});
      api.updateRecordLabResultLink.mockResolvedValue({});
      api.deleteRecordLabResultLink.mockResolvedValue({});
      const source = recordLabResultLinkSource(path, 8, 7);

      expect(await source.loadRows()).toHaveLength(1);
      expect(api.getRecordLabResultLinks).toHaveBeenCalledWith(
        path,
        8,
        undefined
      );

      await source.createLinks([3, 4], 'n', null);
      expect(api.createRecordLabResultLink).toHaveBeenNthCalledWith(
        1,
        path,
        8,
        { lab_result_id: 3, relevance_note: 'n' }
      );
      expect(api.createRecordLabResultLink).toHaveBeenNthCalledWith(
        2,
        path,
        8,
        { lab_result_id: 4, relevance_note: 'n' }
      );

      await source.updateLink({ id: 11 } as never, { relevance_note: null });
      expect(api.updateRecordLabResultLink).toHaveBeenCalledWith(path, 8, 11, {
        relevance_note: null,
      });

      await source.removeLink({ id: 11 } as never);
      expect(api.deleteRecordLabResultLink).toHaveBeenCalledWith(path, 8, 11);
    }
  );

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
