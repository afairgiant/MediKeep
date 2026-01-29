/**
 * Visits page configuration
 */

export const visitsPageConfig = {
  filtering: {
    searchFields: ['reason', 'notes'],
    dateField: 'date',
  },
  sorting: {
    defaultSortBy: 'date',
    defaultSortOrder: 'desc',
    sortOptions: [
      { value: 'date', label: 'Date' },
      { value: 'reason', label: 'Reason' },
    ],
    sortTypes: {
      date: 'date',
      reason: 'string',
    },
  },
  filterControls: {
    searchPlaceholder: 'searchPlaceholders.visits',
    title: 'Filter & Sort Visits',
    showStatus: false,
    showDateRange: true,
  },
};
