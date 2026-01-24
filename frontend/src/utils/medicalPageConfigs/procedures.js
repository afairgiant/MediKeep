/**
 * Procedures page configuration
 */

export const proceduresPageConfig = {
  filtering: {
    searchFields: ['procedure_name', 'description', 'notes'],
    statusField: 'status',
    statusOptions: [
      { value: 'all', label: 'All Statuses' },
      { value: 'scheduled', label: 'Scheduled' },
      { value: 'in-progress', label: 'In Progress' },
      { value: 'completed', label: 'Completed' },
      { value: 'postponed', label: 'Postponed' },
      { value: 'cancelled', label: 'Cancelled' },
    ],
    dateField: 'date',
    startDateField: 'date',
    endDateField: 'date',
  },
  sorting: {
    defaultSortBy: 'date',
    defaultSortOrder: 'desc',
    sortOptions: [
      { value: 'date', label: 'Procedure Date' },
      { value: 'procedure_name', label: 'Procedure Name' },
      { value: 'status', label: 'Status' },
    ],
    sortTypes: {
      date: 'date',
      procedure_name: 'string',
      status: 'status',
    },
  },
  filterControls: {
    searchPlaceholder: 'searchPlaceholders.procedures',
    title: 'Filter & Sort Procedures',
    showDateRange: true,
  },
};
