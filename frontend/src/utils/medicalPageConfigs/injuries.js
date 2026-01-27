/**
 * Injuries page configuration
 */

export const injuriesPageConfig = {
  filtering: {
    searchFields: ['injury_name', 'body_part', 'mechanism', 'notes'],
    categoryField: 'status',
    categoryLabel: 'Status',
    categoryOptions: [
      { value: 'all', label: 'All Statuses' },
      { value: 'active', label: 'Active' },
      { value: 'healing', label: 'Healing' },
      { value: 'resolved', label: 'Resolved' },
      { value: 'chronic', label: 'Chronic' },
    ],
    dateField: 'date_of_injury',
    startDateField: 'date_of_injury',
    endDateField: 'date_of_injury',
  },
  sorting: {
    defaultSortBy: 'date_of_injury',
    defaultSortOrder: 'desc',
    sortOptions: [
      { value: 'date_of_injury', label: 'Date of Injury' },
      { value: 'injury_name', label: 'Injury Name' },
      { value: 'severity', label: 'Severity' },
      { value: 'status', label: 'Status' },
      { value: 'body_part', label: 'Body Part' },
    ],
    sortTypes: {
      date_of_injury: 'date',
      injury_name: 'string',
      severity: 'severity',
      status: 'string',
      body_part: 'string',
    },
  },
  filterControls: {
    searchPlaceholder: 'searchPlaceholders.injuries',
    title: 'Filter & Sort Injuries',
    showStatus: false,
    showCategory: true,
    showDateRange: true,
  },
};
