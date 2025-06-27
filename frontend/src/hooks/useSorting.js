import { useState, useMemo } from 'react';

/**
 * Universal sorting hook for medical data
 * @param {Array} data - Array of items to sort
 * @param {Object} config - Sorting configuration
 * @returns {Object} - Sorted data and sort controls
 */
export const useSorting = (data = [], config = {}) => {
  const [sortBy, setSortBy] = useState(config.defaultSortBy || 'name');
  const [sortOrder, setSortOrder] = useState(config.defaultSortOrder || 'asc');

  // Sort options configuration
  const sortOptions = config.sortOptions || [{ value: 'name', label: 'Name' }];

  // Helper function to get nested object values
  const getNestedValue = (obj, path) => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  // Determine sort type for a field
  const getSortType = (field, sortTypes = {}) => {
    if (sortTypes[field]) return sortTypes[field];

    // Auto-detect based on field name
    if (field.includes('date') || field.includes('Date')) return 'date';
    if (
      field.includes('amount') ||
      field.includes('price') ||
      field.includes('rating')
    )
      return 'number';
    if (field.includes('active') || field.includes('enabled')) return 'boolean';
    if (field === 'status') return 'status';
    if (field === 'severity') return 'severity';

    return 'string';
  };

  // Sort data
  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const sorted = [...data].sort((a, b) => {
      // Custom sort function
      if (config.customSortFunctions && config.customSortFunctions[sortBy]) {
        return config.customSortFunctions[sortBy](a, b, sortOrder);
      }

      // Get values to compare
      let aValue = getNestedValue(a, sortBy);
      let bValue = getNestedValue(b, sortBy);

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortOrder === 'asc' ? 1 : -1;
      if (bValue == null) return sortOrder === 'asc' ? -1 : 1;

      // Determine sort type
      const sortType = getSortType(sortBy, config.sortTypes);

      switch (sortType) {
        case 'date':
          const aDate = new Date(aValue);
          const bDate = new Date(bValue);
          return sortOrder === 'asc' ? aDate - bDate : bDate - aDate;

        case 'number':
          const aNum = parseFloat(aValue) || 0;
          const bNum = parseFloat(bValue) || 0;
          return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;

        case 'boolean':
          const aBool = Boolean(aValue);
          const bBool = Boolean(bValue);
          if (aBool === bBool) return 0;
          return sortOrder === 'asc' ? (aBool ? 1 : -1) : aBool ? -1 : 1;

        case 'status':
          // Special sorting for status with priority order
          const statusOrder = config.statusOrder || {
            active: 1,
            pending: 2,
            completed: 3,
            cancelled: 4,
            inactive: 5,
          };
          const aOrder = statusOrder[aValue] || 999;
          const bOrder = statusOrder[bValue] || 999;
          return sortOrder === 'asc' ? aOrder - bOrder : bOrder - aOrder;

        case 'severity':
          // Special sorting for severity levels
          const severityOrder = config.severityOrder || {
            'life-threatening': 4,
            severe: 3,
            moderate: 2,
            mild: 1,
          };
          const aSeverity = severityOrder[aValue] || 0;
          const bSeverity = severityOrder[bValue] || 0;
          return sortOrder === 'asc'
            ? aSeverity - bSeverity
            : bSeverity - aSeverity;

        case 'string':
        default:
          const aStr = String(aValue).toLowerCase();
          const bStr = String(bValue).toLowerCase();
          return sortOrder === 'asc'
            ? aStr.localeCompare(bStr)
            : bStr.localeCompare(aStr);
      }
    });

    return sorted;
  }, [data, sortBy, sortOrder, config]);

  // Handle sort change
  const handleSortChange = newSortBy => {
    if (sortBy === newSortBy) {
      // Toggle sort order if same field
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      // New field, start with ascending
      setSortBy(newSortBy);
      setSortOrder('asc');
    }
  };

  // Set sort with specific order
  const setSortWithOrder = (field, order = 'asc') => {
    setSortBy(field);
    setSortOrder(order);
  };

  // Get sort indicator for UI
  const getSortIndicator = field => {
    if (sortBy !== field) return '';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  // Check if field is currently sorted
  const isSorted = field => sortBy === field;

  return {
    sortedData,
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder,
    handleSortChange,
    setSortWithOrder,
    getSortIndicator,
    isSorted,
    sortOptions,
  };
};

export default useSorting;
