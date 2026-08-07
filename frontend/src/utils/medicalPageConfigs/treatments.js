/**
 * Treatments page configuration
 */

export const treatmentsPageConfig = {
  filtering: {
    searchFields: [
      'treatment_name',
      'description',
      'notes',
      'practitioner_name',
    ],
    statusField: 'status',
    statusOptions: [
      { value: 'all', label: 'medical:treatments.filters.status.all' },
      { value: 'active', label: 'medical:treatments.filters.status.active' },
      {
        value: 'completed',
        label: 'medical:treatments.filters.status.completed',
      },
      { value: 'planned', label: 'medical:treatments.filters.status.planned' },
      {
        value: 'on-hold',
        label: 'medical:treatments.filters.status.onHold',
      },
      {
        value: 'cancelled',
        label: 'medical:treatments.filters.status.cancelled',
      },
    ],
    dateField: 'start_date',
    startDateField: 'start_date',
    endDateField: 'end_date',
    practitionerField: 'practitioner_name',
    practitionerLabel: 'Practitioners',
    customFilters: {
      dateRange: (item, dateRange) => {
        if (dateRange === 'all') return true;

        const now = new Date();
        const startDate = item.start_date ? new Date(item.start_date) : null;
        const endDate = item.end_date ? new Date(item.end_date) : null;

        switch (dateRange) {
          case 'today': {
            const today = now.toDateString();
            const effectiveEndDateToday = endDate || now;
            return (
              (startDate && startDate.toDateString() === today) ||
              effectiveEndDateToday.toDateString() === today ||
              (startDate && startDate <= now && effectiveEndDateToday >= now)
            );
          }

          case 'week': {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const effectiveEndDateWeek = endDate || now;
            return (
              (startDate && startDate >= weekAgo) ||
              effectiveEndDateWeek >= weekAgo ||
              (startDate && startDate <= now && effectiveEndDateWeek >= weekAgo)
            );
          }

          case 'month': {
            // Current calendar month
            const currentMonthStart = new Date(
              now.getFullYear(),
              now.getMonth(),
              1
            );
            const currentMonthEnd = new Date(
              now.getFullYear(),
              now.getMonth() + 1,
              0
            );

            // If no end date, treat as ongoing (ending today)
            const effectiveEndDate = endDate || now;

            // Treatment overlaps with current month if:
            // 1. Start date is in current month, OR
            // 2. End date (or today if no end date) is in current month, OR
            // 3. Treatment spans across current month (starts before, ends after)
            return (
              (startDate &&
                startDate >= currentMonthStart &&
                startDate <= currentMonthEnd) ||
              (effectiveEndDate >= currentMonthStart &&
                effectiveEndDate <= currentMonthEnd) ||
              (startDate &&
                startDate <= currentMonthStart &&
                effectiveEndDate >= currentMonthEnd)
            );
          }

          case 'year': {
            const yearAgo = new Date(
              now.getFullYear() - 1,
              now.getMonth(),
              now.getDate()
            );
            const effectiveEndDateYear = endDate || now;
            return (
              (startDate && startDate >= yearAgo) ||
              effectiveEndDateYear >= yearAgo ||
              (startDate && startDate <= now && effectiveEndDateYear >= yearAgo)
            );
          }

          case 'current': {
            // Currently active treatments
            const effectiveEndDateCurrent = endDate || now;
            return (
              (!startDate || startDate <= now) && effectiveEndDateCurrent >= now
            );
          }

          case 'past':
            // Past treatments (ended)
            return endDate && endDate < now;

          case 'future':
            // Future treatments (not started yet)
            return startDate && startDate > now;

          default:
            return true;
        }
      },
    },
  },
  sorting: {
    defaultSortBy: 'start_date',
    defaultSortOrder: 'desc',
    sortOptions: [
      {
        value: 'start_date',
        label: 'medical:treatments.filters.sort.startDate',
      },
      {
        value: 'treatment_name',
        label: 'medical:treatments.filters.sort.treatmentName',
      },
      { value: 'status', label: 'medical:treatments.filters.sort.status' },
      {
        value: 'practitioner_name',
        label: 'medical:treatments.filters.sort.practitioner',
      },
    ],
    sortTypes: {
      start_date: 'date',
      treatment_name: 'string',
      status: 'status',
      practitioner_name: 'string',
    },
  },
  filterControls: {
    searchPlaceholder: 'searchPlaceholders.treatments',
    title: 'Filter & Sort Treatments',
    showDateRange: true,
    showPractitioner: true,
  },
};
