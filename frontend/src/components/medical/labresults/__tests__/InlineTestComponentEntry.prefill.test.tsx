import { describe, it, expect } from 'vitest';
import { pickPreviousReferenceRange } from '../../../../utils/labTestComponentUtils';

const point = (over: Record<string, unknown>) => ({
  unit: 'mg/dL',
  ref_range_min: null,
  ref_range_max: null,
  ref_range_text: null,
  recorded_date: null,
  created_at: '2020-01-01T00:00:00Z',
  lab_result: { completed_date: null },
  ...over,
});

describe('pickPreviousReferenceRange', () => {
  it('returns null for empty history', () => {
    expect(pickPreviousReferenceRange([], 'mg/dL')).toBeNull();
  });

  it('picks the most recent point regardless of array order', () => {
    const points = [
      point({ ref_range_min: 1, ref_range_max: 2, lab_result: { completed_date: '2021-01-01' } }),
      point({ ref_range_min: 10, ref_range_max: 20, lab_result: { completed_date: '2023-06-01' } }),
      point({ ref_range_min: 5, ref_range_max: 6, lab_result: { completed_date: '2022-01-01' } }),
    ];
    expect(pickPreviousReferenceRange(points, 'mg/dL')).toEqual({
      ref_range_min: 10,
      ref_range_max: 20,
      ref_range_text: '',
    });
  });

  it('skips newer points that have no range', () => {
    const points = [
      point({ lab_result: { completed_date: '2023-01-01' } }),
      point({ ref_range_min: 70, ref_range_max: 100, lab_result: { completed_date: '2022-01-01' } }),
    ];
    expect(pickPreviousReferenceRange(points, 'mg/dL')?.ref_range_min).toBe(70);
  });

  it('skips points recorded in a different unit', () => {
    const points = [
      point({ unit: 'mmol/L', ref_range_min: 3, ref_range_max: 5, lab_result: { completed_date: '2023-01-01' } }),
    ];
    expect(pickPreviousReferenceRange(points, 'mg/dL')).toBeNull();
  });

  it('matches units case-insensitively', () => {
    const points = [point({ unit: 'MG/DL', ref_range_min: 1, ref_range_max: 2 })];
    expect(pickPreviousReferenceRange(points, 'mg/dL')).not.toBeNull();
  });

  it('only matches unit-less points when the requested unit is blank', () => {
    const points = [
      point({ unit: 'mg/dL', ref_range_min: 1, ref_range_max: 2, lab_result: { completed_date: '2024-01-01' } }),
      point({ unit: '', ref_range_min: 7, ref_range_max: 8, lab_result: { completed_date: '2023-01-01' } }),
    ];
    expect(pickPreviousReferenceRange(points, '')?.ref_range_min).toBe(7);
    expect(pickPreviousReferenceRange([points[0]], '')).toBeNull();
  });

  it('uses a text-only range', () => {
    const points = [point({ ref_range_text: '<200' })];
    expect(pickPreviousReferenceRange(points, 'mg/dL')).toEqual({
      ref_range_min: '',
      ref_range_max: '',
      ref_range_text: '<200',
    });
  });
});
