/**
 * Medications page configuration
 */

import {
  MEDICATION_TYPES,
  MEDICATION_TYPE_LABELS,
} from '../../constants/medicationTypes';

export const medicationsPageConfig = {
  filtering: {
    searchFields: [
      'medication_name',
      'indication',
      'dosage',
      'practitioner_name',
      'pharmacy_name',
    ],
    statusField: 'status',
    statusOptions: [
      { value: 'all', label: 'medical:medications.filters.status.all' },
      { value: 'active', label: 'medical:medications.filters.status.active' },
      {
        value: 'completed',
        label: 'medical:medications.filters.status.completed',
      },
      {
        value: 'stopped',
        label: 'medical:medications.filters.status.stopped',
      },
      {
        value: 'on-hold',
        label: 'medical:medications.filters.status.onHold',
      },
    ],
    medicationTypeField: 'medication_type',
    medicationTypeOptions: [
      { value: 'all', label: 'All Types' },
      ...Object.keys(MEDICATION_TYPES).map(key => ({
        value: MEDICATION_TYPES[key],
        label: MEDICATION_TYPE_LABELS[MEDICATION_TYPES[key]],
      })),
    ],
    categoryField: 'route',
    categoryLabel: 'medical:medications.filters.category.all',
    practitionerField: 'practitioner_name',
    practitionerLabel: 'medical:medications.filters.practitioner.all',
    pharmacyField: 'pharmacy_name',
    pharmacyLabel: 'medical:medications.filters.pharmacy.all',
    dateField: 'effective_period_start',
    startDateField: 'effective_period_start',
    endDateField: 'effective_period_end',
    dateRangeOptions: [
      { value: 'all', label: 'medical:medications.filters.dateRange.all' },
      {
        value: 'current',
        label: 'medical:medications.filters.dateRange.current',
      },
      { value: 'past', label: 'medical:medications.filters.dateRange.past' },
      {
        value: 'future',
        label: 'medical:medications.filters.dateRange.future',
      },
    ],
  },
  sorting: {
    defaultSortBy: 'active',
    defaultSortOrder: 'desc',
    sortOptions: [
      { value: 'active', label: 'medical:medications.filters.sort.active' },
      {
        value: 'medication_name',
        label: 'medical:medications.filters.sort.medicationName',
      },
      {
        value: 'effective_period_start',
        label: 'medical:medications.filters.sort.startDate',
      },
      {
        value: 'practitioner_name',
        label: 'medical:medications.filters.sort.prescriber',
      },
      {
        value: 'pharmacy_name',
        label: 'medical:medications.filters.sort.pharmacy',
      },
    ],
    customSortFunctions: {
      active: (a, b, sortOrder) => {
        const aIsActive = a.status === 'active';
        const bIsActive = b.status === 'active';
        // Active medications first (desc) or last (asc)
        if (aIsActive !== bIsActive) {
          return sortOrder === 'asc'
            ? aIsActive
              ? 1
              : -1
            : aIsActive
              ? -1
              : 1;
        }
        // Always sub-sort alphabetically A-Z within each status group
        return a.medication_name.localeCompare(b.medication_name);
      },
    },
  },
  filterControls: {
    searchPlaceholder: 'searchPlaceholders.medications',
    title: 'Filter & Sort Medications',
    // Medication type already has a dedicated, always-visible Quick Filter
    // row (with counts) above the filter bar — showing it again here would
    // just be the same dataManagement.filters.medicationType state twice.
    showMedicationType: false,
    showCategory: true,
    showPractitioner: true,
    showPharmacy: true,
    showDateRange: true,
  },
};
