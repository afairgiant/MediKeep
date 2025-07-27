import { useMemo } from 'react';
import { useFiltering } from './useFiltering';
import { useSorting } from './useSorting';
import logger from '../services/logger';

/**
 * Combined data management hook for filtering and sorting
 * @param {Array} data - Array of items to filter and sort
 * @param {Object} config - Configuration for filtering and sorting
 * @param {Object} additionalData - Additional data for custom filters (e.g., filesCounts)
 * @returns {Object} - Complete data management interface
 */
export const useDataManagement = (
  data = [],
  config = {},
  additionalData = {}
) => {
  // Ensure data is always an array
  const safeData = Array.isArray(data) ? data : [];
  // Separate filtering and sorting configs
  const filterConfig = { ...config.filtering, additionalData };
  const sortConfig = config.sorting || {};

  // Use filtering hook
  const {
    filteredData = [],
    filters = {},
    updateFilter = () => {},
    clearFilters = () => {},
    hasActiveFilters = false,
    statusOptions = [],
    categoryOptions = [],
    dateRangeOptions = [],
    resultOptions = [],
    typeOptions = [],
    filesOptions = [],
    totalCount = 0,
    filteredCount = 0,
  } = useFiltering(safeData, filterConfig);

  // Debug data flow
  logger.debug('data_management_flow', 'Data management processing', {
    inputCount: safeData?.length || 0,
    filteredCount: filteredData?.length || 0,
    hasFilterConfig: !!filterConfig,
    hasSortConfig: !!sortConfig
  });

  // Use sorting hook on filtered data
  const {
    sortedData: finalData = [],
    sortBy = '',
    sortOrder = 'asc',
    handleSortChange = () => {},
    setSortWithOrder = () => {},
    getSortIndicator = () => '',
    isSorted = () => false,
    sortOptions = [],
  } = useSorting(filteredData, sortConfig);

  // Debug final output
  logger.debug('data_management_output', 'Final data management results', {
    finalCount: finalData?.length || 0,
    sortBy,
    sortOrder
  });

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
    resultOptions,
    typeOptions,
    filesOptions,

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
    rawData: safeData,
    filteredData,
  };
};

export default useDataManagement;
