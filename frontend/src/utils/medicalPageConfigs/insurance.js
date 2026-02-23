/**
 * Insurance page configuration
 */

const STATUS_PRIORITY_ORDER = ['active', 'pending', 'expired', 'inactive'];

export const insurancesPageConfig = {
  filtering: {
    searchFields: ['company_name', 'member_name', 'plan_name', 'notes'],
    statusField: 'status',
    statusOptions: [
      { value: 'all', label: 'All Statuses' },
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'expired', label: 'Expired' },
      { value: 'pending', label: 'Pending' },
    ],
    categoryField: 'insurance_type',
    categoryLabel: 'Insurance Type',
    categoryOptions: [
      { value: 'all', label: 'All Types' },
      { value: 'medical', label: 'Medical' },
      { value: 'dental', label: 'Dental' },
      { value: 'vision', label: 'Vision' },
      { value: 'prescription', label: 'Prescription' },
    ],
    dateField: 'effective_date',
    dateRangeOptions: [
      { value: 'all', label: 'All Time' },
      { value: 'this_year', label: 'This Year' },
      { value: 'last_year', label: 'Last Year' },
      { value: 'previous_years', label: 'All Previous Years' },
      { value: 'current', label: 'Currently Active' },
      { value: 'expired', label: 'Expired Insurance' },
    ],
    customFilters: {
      dateRange: (item, dateRange) => {
        if (dateRange === 'all') return true;

        const now = new Date();
        const currentYear = now.getFullYear();
        const effectiveDate = item.effective_date ? new Date(item.effective_date) : null;
        const expirationDate = item.expiration_date ? new Date(item.expiration_date) : null;

        switch (dateRange) {
          case 'this_year':
            // Show if insurance is active during this year
            // Either started this year, or started earlier but still active (no end date or ends this year or later)
            if (!effectiveDate) return false;
            const effectiveEndDateThisYear = expirationDate || now;
            return (
              effectiveDate.getFullYear() <= currentYear &&
              effectiveEndDateThisYear.getFullYear() >= currentYear
            );

          case 'last_year':
            // Show if insurance was active during last year
            if (!effectiveDate) return false;
            const lastYear = currentYear - 1;
            const effectiveEndDateLastYear = expirationDate || now;
            return (
              effectiveDate.getFullYear() <= lastYear &&
              effectiveEndDateLastYear.getFullYear() >= lastYear
            );

          case 'previous_years':
            // Show insurance that was only active in years before current year
            if (!effectiveDate) return false;
            const effectiveEndDatePrevious = expirationDate || now;
            return effectiveEndDatePrevious.getFullYear() < currentYear;

          case 'current':
            // Currently active insurance
            const effectiveEndDate = expirationDate || now;
            return (
              (!effectiveDate || effectiveDate <= now) &&
              effectiveEndDate >= now
            );

          case 'expired':
            // Expired insurance
            return expirationDate && expirationDate < now;

          default:
            return true;
        }
      },
    },
  },
  sorting: {
    defaultSortBy: 'priority',
    defaultSortOrder: 'desc',
    sortOptions: [
      { value: 'priority', label: 'Priority (Primary First)' },
      { value: 'insurance_type', label: 'Insurance Type' },
      { value: 'company_name', label: 'Company Name' },
      { value: 'effective_date', label: 'Effective Date' },
      { value: 'expiration_date', label: 'Expiration Date' },
      { value: 'status', label: 'Status' },
    ],
    sortTypes: {
      insurance_type: 'string',
      company_name: 'string',
      effective_date: 'date',
      expiration_date: 'date',
      status: 'status',
    },
    customSortFunctions: {
      priority: (a, b, sortOrder) => {
        // Primary medical insurance first
        const aIsPrimary = a.insurance_type === 'medical' && a.is_primary;
        const bIsPrimary = b.insurance_type === 'medical' && b.is_primary;
        if (aIsPrimary !== bIsPrimary) {
          return sortOrder === 'asc' ? (aIsPrimary ? 1 : -1) : (aIsPrimary ? -1 : 1);
        }

        // Then by status priority: active > pending > expired > inactive
        const aStatusIndex = STATUS_PRIORITY_ORDER.indexOf(a.status);
        const bStatusIndex = STATUS_PRIORITY_ORDER.indexOf(b.status);
        const statusDiff = (aStatusIndex === -1 ? 999 : aStatusIndex) - (bStatusIndex === -1 ? 999 : bStatusIndex);
        if (statusDiff !== 0) {
          return sortOrder === 'asc' ? statusDiff : -statusDiff;
        }

        // Always sub-sort alphabetically A-Z within each group
        return a.insurance_type.localeCompare(b.insurance_type);
      },
    },
  },
  filterControls: {
    searchPlaceholder: 'searchPlaceholders.insurance',
    title: 'Filter & Sort Insurance',
    showDateRange: true,
    showCategory: true,
  },
};
