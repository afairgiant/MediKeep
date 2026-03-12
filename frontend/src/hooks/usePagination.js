import { useState, useCallback } from 'react';

const VALID_PAGE_SIZES = [10, 20, 25, 50];
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = VALID_PAGE_SIZES.map(s => ({ value: String(s), label: String(s) }));

/**
 * Shared pagination state hook for medical record pages.
 * Manages page number, page size, and provides data slicing.
 */
export const usePagination = ({ defaultPageSize = DEFAULT_PAGE_SIZE } = {}) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const totalPages = useCallback(
    (totalRecords) => Math.max(1, Math.ceil(totalRecords / pageSize)),
    [pageSize]
  );

  const paginateData = useCallback(
    (data) => {
      const start = (page - 1) * pageSize;
      return data.slice(start, start + pageSize);
    },
    [page, pageSize]
  );

  const handlePageSizeChange = useCallback((newSize) => {
    if (newSize === null || newSize === undefined) return;
    const numericValue = Number(newSize);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return;
    setPageSize(numericValue);
    setPage(1);
  }, []);

  const resetPage = useCallback(() => {
    setPage(1);
  }, []);

  // Clamp page when it exceeds total pages (e.g., after deleting last item on last page)
  const clampPage = useCallback(
    (totalRecords) => {
      const maxPage = totalPages(totalRecords);
      if (page > maxPage) {
        setPage(maxPage);
      }
    },
    [page, totalPages]
  );

  return {
    page,
    setPage,
    pageSize,
    handlePageSizeChange,
    paginateData,
    totalPages,
    resetPage,
    clampPage,
    PAGE_SIZE_OPTIONS,
  };
};
