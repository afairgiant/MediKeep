import { useState, useMemo, useCallback } from 'react';

/**
 * Universal filtering hook for medical data
 * @param {Array} data - Array of items to filter
 * @param {Object} config - Filtering configuration
 * @returns {Object} - Filtered data and filter controls
 */
export const useFiltering = (data = [], config = {}) => {
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    category: 'all',
    dateRange: 'all',
    orderedDate: 'all',
    completedDate: 'all',
    result: 'all',
    type: 'all',
    files: 'all',
    ...config.initialFilters,
  });

  // Search fields configuration
  const searchFields = config.searchFields || ['name'];

  // Status options
  const statusOptions = config.statusOptions || [
    { value: 'all', label: 'All Statuses' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  // Category options (dynamic from data or static config)
  const categoryOptions = useMemo(() => {
    if (config.categoryOptions) {
      return config.categoryOptions;
    }

    if (config.categoryField && Array.isArray(data) && data.length > 0) {
      const uniqueCategories = [
        ...new Set(
          data.map(item => item[config.categoryField]).filter(Boolean)
        ),
      ].sort();

      return [
        { value: 'all', label: `All ${config.categoryLabel || 'Categories'}` },
        ...uniqueCategories.map(cat => ({ value: cat, label: cat })),
      ];
    }

    return [{ value: 'all', label: 'All' }];
  }, [
    data,
    config.categoryField,
    config.categoryOptions,
    config.categoryLabel,
  ]);

  // Date range options
  const dateRangeOptions = config.dateRangeOptions || [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'year', label: 'This Year' },
  ];

  // Result options (for lab results)
  const resultOptions = config.resultOptions || [
    { value: 'all', label: 'All Results' },
  ];

  // Type options (for test types/priorities)
  const typeOptions = config.typeOptions || [
    { value: 'all', label: 'All Types' },
  ];

  // Files options (for file attachments)
  const filesOptions = config.filesOptions || [
    { value: 'all', label: 'All Records' },
  ];

  // Ordered date options
  const orderedDateOptions = config.orderedDateOptions || [
    { value: 'all', label: 'All Ordered Dates' },
  ];

  // Completed date options
  const completedDateOptions = config.completedDateOptions || [
    { value: 'all', label: 'All Completed Dates' },
  ];

  // Helper function to get nested object values
  const getNestedValue = useCallback((obj, path) => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }, []);

  // Helper function for date range filtering
  const matchesDateRange = useCallback(
    (dateValue, range, item = null) => {
      if (!dateValue) return false;

      const itemDate = new Date(dateValue);
      const now = new Date();

      switch (range) {
        case 'today':
          // If item has both start and end dates, check for overlap with today
          if (item && config.startDateField && config.endDateField) {
            const startDate = getNestedValue(item, config.startDateField);
            const endDate = getNestedValue(item, config.endDateField);

            if (startDate) {
              const itemStartDate = new Date(startDate);
              // If no end date, treat as ongoing (ending today)
              const itemEndDate = endDate ? new Date(endDate) : now;
              const todayStart = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate()
              );
              const todayEnd = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                23,
                59,
                59
              );

              // Check if the item's date range overlaps with today
              return itemStartDate <= todayEnd && itemEndDate >= todayStart;
            }
          }
          // Fallback to single date check
          return itemDate.toDateString() === now.toDateString();
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

          // If item has both start and end dates, check for overlap with this week
          if (item && config.startDateField && config.endDateField) {
            const startDate = getNestedValue(item, config.startDateField);
            const endDate = getNestedValue(item, config.endDateField);

            if (startDate) {
              const itemStartDate = new Date(startDate);
              // If no end date, treat as ongoing (ending today)
              const itemEndDate = endDate ? new Date(endDate) : now;

              // Check if the item's date range overlaps with this week
              return itemStartDate <= now && itemEndDate >= weekAgo;
            }
          }
          // Fallback to single date check
          return itemDate >= weekAgo;
        case 'month':
          // For current calendar month - check if date range overlaps with current month
          const currentMonthStart = new Date(
            now.getFullYear(),
            now.getMonth(),
            1
          );
          const currentMonthEnd = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0
          );

          // If item has both start and end dates, check for overlap
          if (item && config.startDateField && config.endDateField) {
            const startDate = getNestedValue(item, config.startDateField);
            const endDate = getNestedValue(item, config.endDateField);

            if (startDate) {
              const itemStartDate = new Date(startDate);
              // If no end date, treat as ongoing (ending today)
              const itemEndDate = endDate ? new Date(endDate) : now;

              // Check if the item's date range overlaps with current month
              return (
                itemStartDate <= currentMonthEnd &&
                itemEndDate >= currentMonthStart
              );
            }
          }

          // Fallback to single date check
          return itemDate >= currentMonthStart && itemDate <= currentMonthEnd;
        case 'quarter':
          const quarterAgo = new Date(
            now.getFullYear(),
            now.getMonth() - 3,
            now.getDate()
          );
          return itemDate >= quarterAgo;
        case 'year':
          const yearAgo = new Date(
            now.getFullYear() - 1,
            now.getMonth(),
            now.getDate()
          );
          return itemDate >= yearAgo;

        case 'past_month':
          // For previous calendar month
          const lastMonthStart = new Date(
            now.getFullYear(),
            now.getMonth() - 1,
            1
          );
          const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
          return itemDate >= lastMonthStart && itemDate <= lastMonthEnd;
        case 'past_3_months':
          // For past 3 months
          const threeMonthsAgo = new Date(
            now.getFullYear(),
            now.getMonth() - 3,
            now.getDate()
          );
          return itemDate >= threeMonthsAgo;
        case 'past_6_months':
          // For past 6 months
          const sixMonthsAgo = new Date(
            now.getFullYear(),
            now.getMonth() - 6,
            now.getDate()
          );
          return itemDate >= sixMonthsAgo;
        case 'current':
          // For active medications/treatments - requires item parameter
          if (!item) return true;
          const startDate = getNestedValue(
            item,
            config.startDateField || 'start_date'
          );
          const endDate = getNestedValue(
            item,
            config.endDateField || 'end_date'
          );
          return (
            (!startDate || new Date(startDate) <= now) &&
            (!endDate || new Date(endDate) >= now)
          );
        case 'past':
          // For past medications/treatments - requires item parameter
          if (!item) return true;
          const endField = getNestedValue(
            item,
            config.endDateField || 'end_date'
          );
          return endField && new Date(endField) < now;
        case 'future':
          // For future medications/treatments - requires item parameter
          if (!item) return true;
          const startField = getNestedValue(
            item,
            config.startDateField || 'start_date'
          );
          return startField && new Date(startField) > now;
        default:
          return true;
      }
    },
    [getNestedValue, config.startDateField, config.endDateField]
  );

  // Filter data
  const filteredData = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];

    return data.filter(item => {
      // Search filter
      if (filters.search && filters.search.trim()) {
        const searchTerm = filters.search.toLowerCase();
        
        // Check if there's a custom search function
        if (config.customSearchFunction) {
          const matchesCustomSearch = config.customSearchFunction(item, searchTerm);
          if (!matchesCustomSearch) return false;
        } else {
          // Default field-based search
          const matchesSearchFields = searchFields.some(field => {
            const value = getNestedValue(item, field);
            return value?.toString()?.toLowerCase()?.includes(searchTerm);
          });
          
          // Check tags if the field search doesn't match
          const matchesTags = item.tags && Array.isArray(item.tags) 
            ? item.tags.some(tag => tag?.toString()?.toLowerCase()?.includes(searchTerm))
            : false;
          
          const matchesSearch = matchesSearchFields || matchesTags;
          if (!matchesSearch) return false;
        }
      }

      // Status filter
      if (filters.status !== 'all') {
        const statusField = config.statusField || 'status';
        // Check if there's a custom filter for this status field
        if (config.customFilters && config.customFilters[statusField]) {
          const result = config.customFilters[statusField](
            item,
            filters.status,
            config.additionalData
          );
          if (!result) return false;
        } else {
          // Default status filtering
          if (item[statusField] !== filters.status) return false;
        }
      }

      // Category filter
      if (filters.category !== 'all' && config.categoryField) {
        if (item[config.categoryField] !== filters.category) return false;
      }

      // Result filter (for lab results)
      if (filters.result !== 'all' && config.resultField) {
        if (item[config.resultField] !== filters.result) return false;
      }

      // Type filter (for test types/priorities)
      if (filters.type !== 'all' && config.typeField) {
        if (item[config.typeField] !== filters.type) return false;
      }

      // Date range filter
      if (filters.dateRange !== 'all' && config.dateField) {
        if (!matchesDateRange(item[config.dateField], filters.dateRange, item))
          return false;
      }

      // Ordered date filter
      if (filters.orderedDate !== 'all' && config.orderedDateField) {
        if (
          !matchesDateRange(
            item[config.orderedDateField],
            filters.orderedDate,
            item
          )
        )
          return false;
      }

      // Completed date filter
      if (filters.completedDate !== 'all' && config.completedDateField) {
        if (
          !matchesDateRange(
            item[config.completedDateField],
            filters.completedDate,
            item
          )
        )
          return false;
      }

      // Custom filters
      if (config.customFilters) {
        for (const [key, filterFn] of Object.entries(config.customFilters)) {
          if (filters[key] !== undefined && filters[key] !== 'all') {
            const result = filterFn(item, filters[key], config.additionalData);
            if (!result) {
              return false;
            }
          }
        }
      }

      return true;
    });
  }, [data, filters, searchFields, config, getNestedValue, matchesDateRange]);

  // Update specific filter
  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      category: 'all',
      dateRange: 'all',
      orderedDate: 'all',
      completedDate: 'all',
      result: 'all',
      type: 'all',
      files: 'all',
      ...config.initialFilters,
    });
  };

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      if (key === 'search') return value && value.trim() !== '';
      return (
        value !== 'all' && value !== '' && value !== null && value !== undefined
      );
    });
  }, [filters]);

  return {
    filteredData,
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    statusOptions,
    categoryOptions,
    dateRangeOptions,
    orderedDateOptions,
    completedDateOptions,
    resultOptions,
    typeOptions,
    filesOptions,
    totalCount: Array.isArray(data) ? data.length : 0,
    filteredCount: filteredData.length,
  };
};

export default useFiltering;
