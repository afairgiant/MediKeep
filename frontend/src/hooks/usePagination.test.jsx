import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagination } from './usePagination';

describe('usePagination', () => {
  describe('initial state', () => {
    it('starts on page 1 with default page size of 20', () => {
      const { result } = renderHook(() => usePagination());
      expect(result.current.page).toBe(1);
      expect(result.current.pageSize).toBe(20);
    });

    it('accepts custom default page size', () => {
      const { result } = renderHook(() =>
        usePagination({ defaultPageSize: 10 })
      );
      expect(result.current.pageSize).toBe(10);
    });

    it('provides PAGE_SIZE_OPTIONS with correct format', () => {
      const { result } = renderHook(() => usePagination());
      expect(result.current.PAGE_SIZE_OPTIONS).toEqual([
        { value: '10', label: '10' },
        { value: '20', label: '20' },
        { value: '25', label: '25' },
        { value: '50', label: '50' },
      ]);
    });
  });

  describe('paginateData', () => {
    it('returns first page of data', () => {
      const { result } = renderHook(() =>
        usePagination({ defaultPageSize: 2 })
      );
      const data = [1, 2, 3, 4, 5];
      expect(result.current.paginateData(data)).toEqual([1, 2]);
    });

    it('returns correct slice for page 2', () => {
      const { result } = renderHook(() =>
        usePagination({ defaultPageSize: 2 })
      );
      act(() => {
        result.current.setPage(2);
      });
      const data = [1, 2, 3, 4, 5];
      expect(result.current.paginateData(data)).toEqual([3, 4]);
    });

    it('returns partial last page', () => {
      const { result } = renderHook(() =>
        usePagination({ defaultPageSize: 2 })
      );
      act(() => {
        result.current.setPage(3);
      });
      const data = [1, 2, 3, 4, 5];
      expect(result.current.paginateData(data)).toEqual([5]);
    });

    it('returns empty array when data is empty', () => {
      const { result } = renderHook(() => usePagination());
      expect(result.current.paginateData([])).toEqual([]);
    });
  });

  describe('totalPages', () => {
    it('calculates total pages correctly', () => {
      const { result } = renderHook(() =>
        usePagination({ defaultPageSize: 10 })
      );
      expect(result.current.totalPages(25)).toBe(3);
      expect(result.current.totalPages(10)).toBe(1);
      expect(result.current.totalPages(0)).toBe(1);
    });

    it('returns minimum of 1 page', () => {
      const { result } = renderHook(() => usePagination());
      expect(result.current.totalPages(0)).toBe(1);
    });
  });

  describe('handlePageSizeChange', () => {
    it('updates page size and resets to page 1', () => {
      const { result } = renderHook(() => usePagination());
      act(() => {
        result.current.setPage(3);
      });
      expect(result.current.page).toBe(3);

      act(() => {
        result.current.handlePageSizeChange('10');
      });
      expect(result.current.pageSize).toBe(10);
      expect(result.current.page).toBe(1);
    });

    it('ignores null/undefined values', () => {
      const { result } = renderHook(() => usePagination());
      act(() => {
        result.current.handlePageSizeChange(null);
      });
      expect(result.current.pageSize).toBe(20);

      act(() => {
        result.current.handlePageSizeChange(undefined);
      });
      expect(result.current.pageSize).toBe(20);
    });

    it('ignores invalid numeric values', () => {
      const { result } = renderHook(() => usePagination());
      act(() => {
        result.current.handlePageSizeChange('abc');
      });
      expect(result.current.pageSize).toBe(20);

      act(() => {
        result.current.handlePageSizeChange('-5');
      });
      expect(result.current.pageSize).toBe(20);
    });
  });

  describe('resetPage', () => {
    it('resets page to 1', () => {
      const { result } = renderHook(() => usePagination());
      act(() => {
        result.current.setPage(5);
      });
      expect(result.current.page).toBe(5);

      act(() => {
        result.current.resetPage();
      });
      expect(result.current.page).toBe(1);
    });
  });

  describe('clampPage', () => {
    it('clamps page to max when current page exceeds total', () => {
      const { result } = renderHook(() =>
        usePagination({ defaultPageSize: 10 })
      );
      act(() => {
        result.current.setPage(5);
      });

      // 15 records at pageSize 10 = 2 pages max
      act(() => {
        result.current.clampPage(15);
      });
      expect(result.current.page).toBe(2);
    });

    it('does not change page when within range', () => {
      const { result } = renderHook(() =>
        usePagination({ defaultPageSize: 10 })
      );
      act(() => {
        result.current.setPage(2);
      });

      // 30 records at pageSize 10 = 3 pages, page 2 is valid
      act(() => {
        result.current.clampPage(30);
      });
      expect(result.current.page).toBe(2);
    });

    it('clamps to page 1 when records shrink to zero', () => {
      const { result } = renderHook(() =>
        usePagination({ defaultPageSize: 10 })
      );
      act(() => {
        result.current.setPage(3);
      });

      act(() => {
        result.current.clampPage(0);
      });
      expect(result.current.page).toBe(1);
    });
  });
});
