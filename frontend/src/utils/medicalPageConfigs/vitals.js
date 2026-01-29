/**
 * Vitals page configuration
 */

export const vitalsPageConfig = {
  filtering: {
    searchFields: ['notes', 'practitioner.name'],
    dateField: 'recorded_date',
    categoryLabel: 'Record Types',
    categoryOptions: [
      { value: 'all', label: 'All Records' },
      { value: 'with_bp', label: 'With Blood Pressure' },
      { value: 'with_heart_rate', label: 'With Heart Rate' },
      { value: 'with_temperature', label: 'With Temperature' },
      { value: 'with_weight', label: 'With Weight' },
      { value: 'with_blood_glucose', label: 'With Blood Glucose' },
      { value: 'with_a1c', label: 'With A1C' },
      { value: 'with_vitals', label: 'With Core Vitals' },
      { value: 'complete', label: 'Complete Records' },
    ],
    customFilters: {
      category: (item, filterValue) => {
        switch (filterValue) {
          case 'with_bp':
            return item.systolic_bp != null && item.diastolic_bp != null;
          case 'with_heart_rate':
            return item.heart_rate != null;
          case 'with_temperature':
            return item.temperature != null;
          case 'with_weight':
            return item.weight != null;
          case 'with_blood_glucose':
            return item.blood_glucose != null;
          case 'with_a1c':
            return item.a1c != null;
          case 'with_vitals':
            return (
              (item.systolic_bp != null && item.diastolic_bp != null) ||
              item.heart_rate != null ||
              item.temperature != null
            );
          case 'complete':
            return (
              item.systolic_bp != null &&
              item.diastolic_bp != null &&
              item.heart_rate != null &&
              item.temperature != null &&
              item.weight != null
            );
          default:
            return true;
        }
      },
    },
    dateRangeOptions: [
      { value: 'all', label: 'All Time' },
      { value: 'today', label: 'Today' },
      { value: 'week', label: 'This Week' },
      { value: 'month', label: 'This Month' },
      { value: 'quarter', label: 'Past 3 Months' },
      { value: 'year', label: 'This Year' },
    ],
  },
  sorting: {
    defaultSortBy: 'recorded_date',
    defaultSortOrder: 'desc',
    sortOptions: [
      { value: 'recorded_date', label: 'Date Recorded' },
      { value: 'systolic_bp', label: 'Systolic BP' },
      { value: 'heart_rate', label: 'Heart Rate' },
      { value: 'temperature', label: 'Temperature' },
      { value: 'weight', label: 'Weight' },
      { value: 'oxygen_saturation', label: 'Oxygen Saturation' },
    ],
    sortTypes: {
      recorded_date: 'date',
      systolic_bp: 'number',
      heart_rate: 'number',
      temperature: 'number',
      weight: 'number',
      oxygen_saturation: 'number',
    },
  },
  filterControls: {
    searchPlaceholder: 'searchPlaceholders.vitals',
    title: 'Filter & Sort Vital Signs',
    showStatus: false,
    showCategory: true,
    showDateRange: true,
  },
};
