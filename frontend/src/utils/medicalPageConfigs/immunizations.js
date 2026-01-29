/**
 * Immunizations page configuration
 */

export const immunizationsPageConfig = {
  filtering: {
    searchFields: ['vaccine_name', 'manufacturer', 'notes'],
    dateField: 'date_administered',
  },
  sorting: {
    defaultSortBy: 'date_administered',
    defaultSortOrder: 'desc',
    sortOptions: [
      { value: 'date_administered', label: 'Date Administered' },
      { value: 'vaccine_name', label: 'Vaccine Name' },
    ],
    sortTypes: {
      date_administered: 'date',
      vaccine_name: 'string',
    },
  },
  filterControls: {
    searchPlaceholder: 'searchPlaceholders.immunizations',
    title: 'Filter & Sort Immunizations',
    showStatus: false,
    showDateRange: true,
  },
};
