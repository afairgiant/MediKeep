/**
 * Procedures page configuration
 */

export const proceduresPageConfig = {
  filtering: {
    searchFields: [
      'procedure_name',
      'description',
      'notes',
      'practitioner_name',
    ],
    statusField: 'status',
    statusOptions: [
      { value: 'all', label: 'medical:procedures.filters.status.all' },
      {
        value: 'scheduled',
        label: 'medical:procedures.filters.status.scheduled',
      },
      {
        value: 'in-progress',
        label: 'medical:procedures.filters.status.inProgress',
      },
      {
        value: 'completed',
        label: 'medical:procedures.filters.status.completed',
      },
      {
        value: 'postponed',
        label: 'medical:procedures.filters.status.postponed',
      },
      {
        value: 'cancelled',
        label: 'medical:procedures.filters.status.cancelled',
      },
    ],
    dateField: 'date',
    startDateField: 'date',
    endDateField: 'date',
    practitionerField: 'practitioner_name',
    practitionerLabel: 'medical:procedures.filters.practitioner.all',
  },
  sorting: {
    defaultSortBy: 'date',
    defaultSortOrder: 'desc',
    sortOptions: [
      { value: 'date', label: 'medical:procedures.filters.sort.date' },
      {
        value: 'procedure_name',
        label: 'medical:procedures.filters.sort.procedureName',
      },
      { value: 'status', label: 'medical:procedures.filters.sort.status' },
      {
        value: 'practitioner_name',
        label: 'medical:procedures.filters.sort.practitioner',
      },
    ],
    sortTypes: {
      date: 'date',
      procedure_name: 'string',
      status: 'status',
      practitioner_name: 'string',
    },
  },
  filterControls: {
    searchPlaceholder: 'searchPlaceholders.procedures',
    title: 'Filter & Sort Procedures',
    showDateRange: true,
    showPractitioner: true,
  },
};
