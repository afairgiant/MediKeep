/**
 * Practitioners page configuration
 */

export const practitionersPageConfig = {
  filtering: {
    searchFields: ['name', 'specialty', 'practice'],
    categoryField: 'specialty',
    categoryLabel: 'Specialties',
  },
  sorting: {
    defaultSortBy: 'name',
    defaultSortOrder: 'asc',
    sortOptions: [
      { value: 'name', label: 'Name' },
      { value: 'specialty', label: 'Specialty' },
      { value: 'practice', label: 'Practice' },
    ],
    sortTypes: {
      name: 'string',
      specialty: 'string',
      practice: 'string',
    },
  },
  filterControls: {
    searchPlaceholder: 'searchPlaceholders.practitioners',
    title: 'Filter & Sort Practitioners',
    showStatus: false,
    showCategory: true,
  },
};
