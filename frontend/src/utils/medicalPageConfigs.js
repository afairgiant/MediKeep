/**
 * Standardized configuration templates for medical pages filtering and sorting
 */

export const medicalPageConfigs = {
  conditions: {
    filtering: {
      searchFields: ['diagnosis', 'notes'],
      statusField: 'status',
      statusOptions: [
        { value: 'all', label: 'All Statuses' },
        { value: 'active', label: 'Active' },
        { value: 'resolved', label: 'Resolved' },
        { value: 'chronic', label: 'Chronic' },
        { value: 'inactive', label: 'Inactive' },
      ],
      dateField: 'onsetDate',
    },
    sorting: {
      defaultSortBy: 'onsetDate',
      defaultSortOrder: 'desc',
      sortOptions: [
        { value: 'onsetDate', label: 'Onset Date' },
        { value: 'diagnosis', label: 'Diagnosis' },
        { value: 'status', label: 'Status' },
      ],
      sortTypes: {
        onsetDate: 'date',
        diagnosis: 'string',
        status: 'status',
      },
    },
    filterControls: {
      searchPlaceholder: 'Search conditions, notes...',
      title: 'Filter & Sort Conditions',
      showDateRange: true,
    },
  },

  medications: {
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
      categoryField: 'route',
      categoryLabel: 'Routes',
      dateField: 'effectivePeriod_start',
      startDateField: 'effectivePeriod_start',
      endDateField: 'effectivePeriod_end',
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
        { value: 'effectivePeriod_start', label: 'Start Date' },
      ],
      customSortFunctions: {
        active: (a, b, sortOrder) => {
          const aIsActive = a.status === 'active';
          const bIsActive = b.status === 'active';
          if (aIsActive && !bIsActive) return -1;
          if (!aIsActive && bIsActive) return 1;
          return a.medication_name.localeCompare(b.medication_name);
        },
      },
    },
    filterControls: {
      searchPlaceholder: 'Search medications, indications, dosages...',
      title: 'Filter & Sort Medications',
      showCategory: true,
      showDateRange: true,
    },
  },

  procedures: {
    filtering: {
      searchFields: ['procedure_name', 'description', 'notes'],
      statusField: 'status',
      statusOptions: [
        { value: 'all', label: 'All Statuses' },
        { value: 'scheduled', label: 'Scheduled' },
        { value: 'in-progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
        { value: 'postponed', label: 'Postponed' },
        { value: 'cancelled', label: 'Cancelled' },
      ],
      dateField: 'date',
    },
    sorting: {
      defaultSortBy: 'date',
      defaultSortOrder: 'desc',
      sortOptions: [
        { value: 'date', label: 'Procedure Date' },
        { value: 'procedure_name', label: 'Procedure Name' },
        { value: 'status', label: 'Status' },
      ],
      sortTypes: {
        date: 'date',
        procedure_name: 'string',
        status: 'status',
      },
    },
    filterControls: {
      searchPlaceholder: 'Search procedures...',
      title: 'Filter & Sort Procedures',
      showDateRange: true,
    },
  },

  treatments: {
    filtering: {
      searchFields: ['treatment_name', 'description', 'notes'],
      statusField: 'status',
      statusOptions: [
        { value: 'all', label: 'All Statuses' },
        { value: 'active', label: 'Active' },
        { value: 'completed', label: 'Completed' },
        { value: 'planned', label: 'Planned' },
        { value: 'on-hold', label: 'On Hold' },
        { value: 'cancelled', label: 'Cancelled' },
      ],
      dateField: 'start_date',
    },
    sorting: {
      defaultSortBy: 'start_date',
      defaultSortOrder: 'desc',
      sortOptions: [
        { value: 'start_date', label: 'Start Date' },
        { value: 'treatment_name', label: 'Treatment Name' },
        { value: 'status', label: 'Status' },
      ],
      sortTypes: {
        start_date: 'date',
        treatment_name: 'string',
        status: 'status',
      },
    },
    filterControls: {
      searchPlaceholder: 'Search treatments...',
      title: 'Filter & Sort Treatments',
      showDateRange: true,
    },
  },

  visits: {
    filtering: {
      searchFields: ['reason', 'notes'],
      dateField: 'date',
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
    },
    filterControls: {
      searchPlaceholder: 'Search visits...',
      title: 'Filter & Sort Visits',
      showStatus: false,
      showDateRange: true,
    },
  },

  immunizations: {
    filtering: {
      searchFields: ['vaccine_name', 'manufacturer', 'notes'],
      dateField: 'date_administered',
    },
    sorting: {
      defaultSortBy: 'date_administered',
      defaultSortOrder: 'desc',
      sortOptions: [
        { value: 'date_administered', label: 'Date Administered' },
        { value: 'vaccine_name', label: 'Vaccine Name' },
      ],
      sortTypes: {
        date_administered: 'date',
        vaccine_name: 'string',
      },
    },
    filterControls: {
      searchPlaceholder: 'Search immunizations...',
      title: 'Filter & Sort Immunizations',
      showStatus: false,
      showDateRange: true,
    },
  },

  allergies: {
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
      dateField: 'onsetDate',
    },
    sorting: {
      defaultSortBy: 'severity',
      defaultSortOrder: 'desc',
      sortOptions: [
        { value: 'severity', label: 'Severity' },
        { value: 'allergen', label: 'Allergen' },
        { value: 'onsetDate', label: 'Onset Date' },
      ],
      sortTypes: {
        severity: 'severity',
        allergen: 'string',
        onsetDate: 'date',
      },
    },
    filterControls: {
      searchPlaceholder: 'Search allergies...',
      title: 'Filter & Sort Allergies',
      showStatus: false,
      showCategory: true,
      showDateRange: true,
    },
  },

  practitioners: {
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
      searchPlaceholder: 'Search practitioners...',
      title: 'Filter & Sort Practitioners',
      showStatus: false,
      showCategory: true,
    },
  },

  pharmacies: {
    filtering: {
      searchFields: ['name', 'brand', 'city', 'store_number'],
      categoryField: 'brand',
      categoryLabel: 'Brands',
    },
    sorting: {
      defaultSortBy: 'name',
      defaultSortOrder: 'asc',
      sortOptions: [
        { value: 'name', label: 'Name' },
        { value: 'brand', label: 'Brand' },
        { value: 'city', label: 'City' },
      ],
      sortTypes: {
        name: 'string',
        brand: 'string',
        city: 'string',
      },
    },
    filterControls: {
      searchPlaceholder: 'Search pharmacies...',
      title: 'Filter & Sort Pharmacies',
      showStatus: false,
      showCategory: true,
    },
  },

  labresults: {
    filtering: {
      searchFields: ['test_name', 'test_code', 'facility', 'notes'],
      statusField: 'status',
      statusOptions: [
        { value: 'all', label: 'All Statuses' },
        { value: 'ordered', label: 'Ordered' },
        { value: 'in-progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
      ],
      categoryField: 'test_category',
      categoryLabel: 'Categories',
      categoryOptions: [
        { value: 'all', label: 'All Categories' },
        { value: 'blood work', label: 'Blood Work' },
        { value: 'imaging', label: 'Imaging' },
        { value: 'pathology', label: 'Pathology' },
        { value: 'microbiology', label: 'Microbiology' },
        { value: 'chemistry', label: 'Chemistry' },
        { value: 'hematology', label: 'Hematology' },
        { value: 'immunology', label: 'Immunology' },
        { value: 'genetics', label: 'Genetics' },
        { value: 'cardiology', label: 'Cardiology' },
        { value: 'pulmonology', label: 'Pulmonology' },
        { value: 'other', label: 'Other' },
      ],
      dateField: 'ordered_date',
      dateRangeOptions: [
        { value: 'all', label: 'All Time Periods' },
        { value: 'current', label: 'Current Month' },
        { value: 'past', label: 'Past 3 Months' },
        { value: 'future', label: 'Future/Scheduled' },
      ],
    },
    sorting: {
      defaultSortBy: 'ordered_date',
      defaultSortOrder: 'desc',
      sortOptions: [
        { value: 'ordered_date', label: 'Order Date' },
        { value: 'test_name', label: 'Test Name' },
        { value: 'status', label: 'Status' },
        { value: 'test_category', label: 'Category' },
        { value: 'completed_date', label: 'Completion Date' },
      ],
      sortTypes: {
        ordered_date: 'date',
        test_name: 'string',
        status: 'status',
        test_category: 'string',
        completed_date: 'date',
      },
    },
    filterControls: {
      searchPlaceholder: 'Search lab results, test codes, facilities...',
      title: 'Filter & Sort Lab Results',
      showCategory: true,
      showDateRange: true,
    },
  },

  vitals: {
    filtering: {
      searchFields: ['notes', 'practitioner.name'],
      dateField: 'recorded_date',
      categoryLabel: 'Record Types',
      categoryOptions: [
        { value: 'all', label: 'All Records' },
        { value: 'with_bp', label: 'With Blood Pressure' },
        { value: 'with_weight', label: 'With Weight' },
        { value: 'with_vitals', label: 'With Core Vitals' },
        { value: 'complete', label: 'Complete Records' },
      ],
      customFilters: {
        category: (item, filterValue) => {
          switch (filterValue) {
            case 'with_bp':
              return item.systolic_bp != null && item.diastolic_bp != null;
            case 'with_weight':
              return item.weight != null;
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
      searchPlaceholder: 'Search vitals notes...',
      title: 'Filter & Sort Vital Signs',
      showStatus: false,
      showCategory: true,
      showDateRange: true,
    },
  },
};

/**
 * Get configuration for a specific medical page
 * @param {string} pageName - Name of the medical page
 * @returns {Object} Configuration object
 */
export const getMedicalPageConfig = pageName => {
  return (
    medicalPageConfigs[pageName] || {
      filtering: {
        searchFields: ['name'],
        statusField: 'status',
      },
      sorting: {
        defaultSortBy: 'name',
        defaultSortOrder: 'asc',
        sortOptions: [{ value: 'name', label: 'Name' }],
      },
      filterControls: {
        searchPlaceholder: 'Search...',
        title: 'Filters',
      },
    }
  );
};
