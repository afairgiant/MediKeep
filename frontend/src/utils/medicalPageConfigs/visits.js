/**
 * Visits page configuration
 */

import { compareVisitsByDate, matchesVisitTiming } from '../upcomingVisits';

export const visitsPageConfig = {
  filtering: {
    searchFields: ['reason', 'notes'],
    dateField: 'date',
    // Visits have no status column; the filter splits on upcoming vs past.
    statusField: 'timing',
    statusOptions: [
      { value: 'all', label: 'medical:visits.filters.timing.all' },
      { value: 'upcoming', label: 'medical:visits.filters.timing.upcoming' },
      { value: 'past', label: 'medical:visits.filters.timing.past' },
    ],
    customFilters: {
      timing: matchesVisitTiming,
    },
  },
  sorting: {
    defaultSortBy: 'date',
    defaultSortOrder: 'desc',
    sortOptions: [
      { value: 'date', label: 'Date' },
      { value: 'reason', label: 'Reason' },
    ],
    sortTypes: {
      date: 'date',
      reason: 'string',
    },
    customSortFunctions: {
      date: compareVisitsByDate,
    },
  },
  filterControls: {
    searchPlaceholder: 'searchPlaceholders.visits',
    title: 'Filter & Sort Visits',
    showStatus: true,
    statusPlaceholder: 'medical:visits.filters.timing.placeholder',
    showDateRange: true,
  },
};
