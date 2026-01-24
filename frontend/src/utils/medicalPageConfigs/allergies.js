/**
 * Allergies page configuration
 */

export const allergiesPageConfig = {
  filtering: {
    searchFields: ['allergen', 'reaction', 'notes'],
    categoryField: 'severity',
    categoryLabel: 'Severity Levels',
    categoryOptions: [
      { value: 'all', label: 'All Severity Levels' },
      { value: 'mild', label: 'Mild' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'severe', label: 'Severe' },
      { value: 'life-threatening', label: 'Life-threatening' },
    ],
    dateField: 'onset_date',
    startDateField: 'onset_date',
    endDateField: 'onset_date',
  },
  sorting: {
    defaultSortBy: 'severity',
    defaultSortOrder: 'desc',
    sortOptions: [
      { value: 'severity', label: 'Severity' },
      { value: 'allergen', label: 'Allergen' },
      { value: 'onset_date', label: 'Onset Date' },
    ],
    sortTypes: {
      severity: 'severity',
      allergen: 'string',
      onset_date: 'date',
    },
  },
  filterControls: {
    searchPlaceholder: 'searchPlaceholders.allergies',
    title: 'Filter & Sort Allergies',
    showStatus: false,
    showCategory: true,
    showDateRange: true,
  },
};
