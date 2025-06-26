import { useMemo } from 'react';
import { useFiltering } from './useFiltering';
import { useSorting } from './useSorting';

/**
 * Combined data management hook for filtering and sorting
 * @param {Array} data - Array of items to filter and sort
 * @param {Object} config - Configuration for filtering and sorting
 * @returns {Object} - Complete data management interface
 */
export const useDataManagement = (data = [], config = {}) => {
  // Separate filtering and sorting configs
  const filterConfig = config.filtering || {};
  const sortConfig = config.sorting || {};

  // Use filtering hook
  const {
    filteredData,
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    statusOptions,
    categoryOptions,
    dateRangeOptions,
    totalCount,
    filteredCount,
  } = useFiltering(data, filterConfig);

  // Use sorting hook on filtered data
  const {
    sortedData: finalData,
    sortBy,
    sortOrder,
    handleSortChange,
    setSortWithOrder,
    getSortIndicator,
    isSorted,
    sortOptions,
  } = useSorting(filteredData, sortConfig);

  // Combined interface
  return {
    // Final processed data
    data: finalData,

    // Filter controls
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    statusOptions,
    categoryOptions,
    dateRangeOptions,

    // Sort controls
    sortBy,
    sortOrder,
    handleSortChange,
    setSortWithOrder,
    getSortIndicator,
    isSorted,
    sortOptions,

    // Counts
    totalCount,
    filteredCount,
    finalCount: finalData.length,

    // Utility functions
    isEmpty: finalData.length === 0,
    hasFilters: hasActiveFilters,

    // Raw data for custom operations
    rawData: data,
    filteredData,
  };
};

export default useDataManagement;
