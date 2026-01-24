/**
 * Insurance page configuration
 */

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
      priority: (a, b) => {
        // Primary insurance first (only for medical insurance)
        if (a.insurance_type === 'medical' && a.is_primary && !(b.insurance_type === 'medical' && b.is_primary)) return -1;
        if (b.insurance_type === 'medical' && b.is_primary && !(a.insurance_type === 'medical' && a.is_primary)) return 1;

        // Then active insurance
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (b.status === 'active' && a.status !== 'active') return 1;

        // Then by insurance type
        if (a.status === b.status) {
          return a.insurance_type.localeCompare(b.insurance_type);
        }

        // Finally by status priority: active > pending > expired > inactive
        const statusOrder = ['active', 'pending', 'expired', 'inactive'];
        const aIndex = statusOrder.indexOf(a.status) !== -1 ? statusOrder.indexOf(a.status) : 999;
        const bIndex = statusOrder.indexOf(b.status) !== -1 ? statusOrder.indexOf(b.status) : 999;
        return aIndex - bIndex;
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
