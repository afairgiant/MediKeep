/**
 * Symptoms page configuration
 */

export const symptomsPageConfig = {
  filtering: {
    searchFields: ['symptom_name', 'description', 'notes'],
    categoryField: 'severity',
    categoryLabel: 'Severity Levels',
    categoryOptions: [
      { value: 'all', label: 'All Severity Levels' },
      { value: 'mild', label: 'Mild' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'severe', label: 'Severe' },
    ],
    statusField: 'status',
    statusOptions: [
      { value: 'all', label: 'All Statuses' },
      { value: 'active', label: 'Active' },
      { value: 'resolved', label: 'Resolved' },
      { value: 'improving', label: 'Improving' },
      { value: 'worsening', label: 'Worsening' },
    ],
    dateField: 'recorded_date',
    startDateField: 'recorded_date',
    endDateField: 'resolved_date',
  },
  sorting: {
    defaultSortBy: 'recorded_date',
    defaultSortOrder: 'desc',
    sortOptions: [
      { value: 'recorded_date', label: 'Recorded Date' },
      { value: 'severity', label: 'Severity' },
      { value: 'symptom_name', label: 'Symptom Name' },
      { value: 'pain_scale', label: 'Pain Scale' },
    ],
    sortTypes: {
      recorded_date: 'date',
      severity: 'severity',
      symptom_name: 'string',
      pain_scale: 'number',
    },
  },
  filterControls: {
    searchPlaceholder: 'searchPlaceholders.symptoms',
    title: 'Filter & Sort Symptoms',
    showStatus: true,
    showCategory: true,
    showDateRange: true,
  },
};
