/**
 * Conditions page configuration
 */

export const conditionsPageConfig = {
  filtering: {
    searchFields: ['diagnosis', 'notes'],
    statusField: 'status',
    statusOptions: [
      { value: 'all', label: 'All Statuses' },
      { value: 'active', label: 'Active' },
      { value: 'resolved', label: 'Resolved' },
      { value: 'chronic', label: 'Chronic' },
      { value: 'inactive', label: 'Inactive' },
    ],
    dateField: 'onset_date',
  },
  sorting: {
    defaultSortBy: 'onset_date',
    defaultSortOrder: 'desc',
    sortOptions: [
      { value: 'onset_date', label: 'Onset Date' },
      { value: 'diagnosis', label: 'Diagnosis' },
      { value: 'status', label: 'Status' },
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
