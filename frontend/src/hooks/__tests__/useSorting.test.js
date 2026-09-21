import { describe, test, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSorting } from '../useSorting';

describe('useSorting', () => {
  test('sorts null/undefined date values to the end in descending order (default lab results sort)', () => {
    const data = [
      { id: 1, completed_date: '2024-01-15' },
      { id: 2, completed_date: null },
      { id: 3, completed_date: '2024-03-10' },
      { id: 4, completed_date: undefined },
      { id: 5, completed_date: '2024-02-01' },
    ];

    const { result } = renderHook(() =>
      useSorting(data, {
        defaultSortBy: 'completed_date',
        defaultSortOrder: 'desc',
        sortTypes: { completed_date: 'date' },
      })
    );

    expect(result.current.sortedData.map(item => item.id)).toEqual([
      3, 5, 1, 2, 4,
    ]);
  });

  test('sorts null/undefined date values to the end in ascending order', () => {
    const data = [
      { id: 1, completed_date: '2024-01-15' },
      { id: 2, completed_date: null },
      { id: 3, completed_date: '2024-03-10' },
      { id: 4, completed_date: undefined },
      { id: 5, completed_date: '2024-02-01' },
    ];

    const { result } = renderHook(() =>
      useSorting(data, {
        defaultSortBy: 'completed_date',
        defaultSortOrder: 'asc',
        sortTypes: { completed_date: 'date' },
      })
    );

    expect(result.current.sortedData.map(item => item.id)).toEqual([
      1, 5, 3, 2, 4,
    ]);
  });

  test('keeps items with both values null in a stable, non-crashing order', () => {
    const data = [
      { id: 1, completed_date: null },
      { id: 2, completed_date: null },
    ];

    const { result } = renderHook(() =>
      useSorting(data, {
        defaultSortBy: 'completed_date',
        defaultSortOrder: 'desc',
        sortTypes: { completed_date: 'date' },
      })
    );

    expect(result.current.sortedData.map(item => item.id).sort()).toEqual([
      1, 2,
    ]);
  });
});
