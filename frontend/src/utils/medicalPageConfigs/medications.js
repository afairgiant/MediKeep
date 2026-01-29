/**
 * Medications page configuration
 */

import {
  MEDICATION_TYPES,
  MEDICATION_TYPE_LABELS,
} from '../../constants/medicationTypes';

export const medicationsPageConfig = {
  filtering: {
    searchFields: ['medication_name', 'indication', 'dosage'],
    statusField: 'status',
    statusOptions: [
      { value: 'all', label: 'All Statuses' },
      { value: 'active', label: 'Active' },
      { value: 'completed', label: 'Completed' },
      { value: 'stopped', label: 'Stopped' },
      { value: 'on-hold', label: 'On Hold' },
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
    categoryLabel: 'Routes',
    dateField: 'effective_period_start',
    startDateField: 'effective_period_start',
    endDateField: 'effective_period_end',
    dateRangeOptions: [
      { value: 'all', label: 'All Time Periods' },
      { value: 'current', label: 'Currently Active' },
      { value: 'past', label: 'Past Medications' },
      { value: 'future', label: 'Future Medications' },
    ],
  },
  sorting: {
    defaultSortBy: 'active',
    defaultSortOrder: 'desc',
    sortOptions: [
      { value: 'active', label: 'Status (Active First)' },
      { value: 'medication_name', label: 'Medication Name' },
      { value: 'effective_period_start', label: 'Start Date' },
    ],
    customSortFunctions: {
      active: (a, b, sortOrder) => {
        const aIsActive = a.status === 'active';
        const bIsActive = b.status === 'active';
        // Active medications first
        if (aIsActive !== bIsActive) {
          return sortOrder === 'asc' ? (aIsActive ? 1 : -1) : (aIsActive ? -1 : 1);
        }
        // Then by medication name
        const nameDiff = a.medication_name.localeCompare(b.medication_name);
        return sortOrder === 'asc' ? -nameDiff : nameDiff;
      },
    },
  },
  filterControls: {
    searchPlaceholder: 'searchPlaceholders.medications',
    title: 'Filter & Sort Medications',
    showMedicationType: true,
    showCategory: true,
    showDateRange: true,
  },
};
