/**
 * Conditions page configuration
 */

export const conditionsPageConfig = {
  filtering: {
    searchFields: ['diagnosis', 'notes'],
    statusField: 'status',
    statusOptions: [
      { value: 'all', label: 'medical:conditions.filters.status.all' },
      { value: 'active', label: 'medical:conditions.filters.status.active' },
      {
        value: 'resolved',
        label: 'medical:conditions.filters.status.resolved',
      },
      { value: 'chronic', label: 'medical:conditions.filters.status.chronic' },
      {
        value: 'inactive',
        label: 'medical:conditions.filters.status.inactive',
      },
    ],
    dateField: 'onset_date',
  },
  sorting: {
    defaultSortBy: 'onset_date',
    defaultSortOrder: 'desc',
    sortOptions: [
      {
        value: 'onset_date',
        label: 'medical:conditions.filters.sort.onsetDate',
      },
      {
        value: 'diagnosis',
        label: 'medical:conditions.filters.sort.diagnosis',
      },
      { value: 'status', label: 'medical:conditions.filters.sort.status' },
    ],
    sortTypes: {
      onset_date: 'date',
      diagnosis: 'string',
      status: 'status',
    },
  },
  filterControls: {
    searchPlaceholder: 'searchPlaceholders.conditions',
    title: 'Filter & Sort Conditions',
    showDateRange: true,
  },
};
