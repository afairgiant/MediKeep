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
      searchFields: [
        'test_name',
        'test_code',
        'facility',
        'notes',
        'practitioner_name',
      ],
      statusField: 'status',
      statusOptions: [
        { value: 'all', label: 'All Statuses' },
        {
          value: 'ordered',
          label: 'Ordered',
          description: 'Tests that have been ordered',
        },
        {
          value: 'in-progress',
          label: 'In Progress',
          description: 'Tests currently being processed',
        },
        {
          value: 'completed',
          label: 'Completed',
          description: 'Tests with results available',
        },
        {
          value: 'cancelled',
          label: 'Cancelled',
          description: 'Cancelled or discontinued tests',
        },
      ],
      categoryField: 'test_category',
      categoryLabel: 'Test Categories',
      categoryOptions: [
        { value: 'all', label: 'All Categories' },
        {
          value: 'blood work',
          label: 'Blood Work',
          description: 'Blood tests and panels',
        },
        {
          value: 'imaging',
          label: 'Imaging',
          description: 'X-rays, CT, MRI, ultrasound',
        },
        {
          value: 'pathology',
          label: 'Pathology',
          description: 'Tissue and cell analysis',
        },
        {
          value: 'microbiology',
          label: 'Microbiology',
          description: 'Bacterial, viral, fungal cultures',
        },
        {
          value: 'chemistry',
          label: 'Chemistry',
          description: 'Metabolic panels, enzymes',
        },
        {
          value: 'hematology',
          label: 'Hematology',
          description: 'Blood cell counts and coagulation',
        },
        {
          value: 'immunology',
          label: 'Immunology',
          description: 'Immune system and antibody tests',
        },
        {
          value: 'genetics',
          label: 'Genetics',
          description: 'Genetic testing and analysis',
        },
        {
          value: 'cardiology',
          label: 'Cardiology',
          description: 'Heart-related tests',
        },
        {
          value: 'pulmonology',
          label: 'Pulmonology',
          description: 'Lung function tests',
        },
        {
          value: 'other',
          label: 'Other',
          description: 'Miscellaneous tests',
        },
      ],
      // Additional filter: Lab Results
      resultField: 'labs_result',
      resultLabel: 'Test Results',
      resultOptions: [
        { value: 'all', label: 'All Results' },
        {
          value: 'normal',
          label: 'Normal',
          description: 'Results within normal range',
        },
        {
          value: 'abnormal',
          label: 'Abnormal',
          description: 'Results outside normal range',
        },
        {
          value: 'critical',
          label: 'Critical',
          description: 'Critical values requiring attention',
        },
        { value: 'high', label: 'High', description: 'Above normal range' },
        { value: 'low', label: 'Low', description: 'Below normal range' },
        {
          value: 'borderline',
          label: 'Borderline',
          description: 'Near the edge of normal range',
        },
        {
          value: 'inconclusive',
          label: 'Inconclusive',
          description: 'Results unclear or incomplete',
        },
        {
          value: 'pending',
          label: 'Pending',
          description: 'No results yet available',
        },
      ],
      // Additional filter: Test Type (urgency)
      typeField: 'test_type',
      typeLabel: 'Test Priority',
      typeOptions: [
        { value: 'all', label: 'All Priorities' },
        {
          value: 'routine',
          label: 'Routine',
          description: 'Standard scheduling',
        },
        {
          value: 'urgent',
          label: 'Urgent',
          description: 'Expedited processing',
        },
        {
          value: 'emergency',
          label: 'Emergency',
          description: 'Emergency department priority',
        },
        {
          value: 'follow-up',
          label: 'Follow-up',
          description: 'Monitoring or repeat tests',
        },
        {
          value: 'screening',
          label: 'Screening',
          description: 'Preventive screening tests',
        },
      ],
      // Additional filter: Files
      filesField: 'has_files',
      filesLabel: 'File Attachments',
      filesOptions: [
        { value: 'all', label: 'All Records' },
        {
          value: 'with_files',
          label: '📎 With Files',
          description: 'Has attached files',
        },
        {
          value: 'without_files',
          label: '📄 No Files',
          description: 'No files attached',
        },
      ],
      dateField: 'ordered_date',
      dateRangeOptions: [
        { value: 'all', label: 'All Time Periods' },
        {
          value: 'today',
          label: 'Today',
          description: 'Tests ordered today',
        },
        {
          value: 'week',
          label: 'This Week',
          description: 'Tests ordered this week',
        },
        {
          value: 'current',
          label: 'Current Month',
          description: 'Tests ordered this month',
        },
        {
          value: 'past_month',
          label: 'Past Month',
          description: 'Tests from last month',
        },
        {
          value: 'past_3_months',
          label: 'Past 3 Months',
          description: 'Tests from last 3 months',
        },
        {
          value: 'past_6_months',
          label: 'Past 6 Months',
          description: 'Tests from last 6 months',
        },
        {
          value: 'year',
          label: 'This Year',
          description: 'Tests ordered this year',
        },
        {
          value: 'future',
          label: 'Future/Scheduled',
          description: 'Scheduled future tests',
        },
      ],
      // Custom filter functions for complex logic
      customFilters: {
        files: (item, filterValue, additionalData) => {
          const fileCount = additionalData?.filesCounts?.[item.id] || 0;
          switch (filterValue) {
            case 'with_files':
              return fileCount > 0;
            case 'without_files':
              return fileCount === 0;
            default:
              return true;
          }
        },
        labs_result: (item, filterValue) => {
          switch (filterValue) {
            case 'pending':
              return !item.labs_result || item.labs_result.trim() === '';
            default:
              return filterValue === 'all' || item.labs_result === filterValue;
          }
        },
      },
    },
    sorting: {
      defaultSortBy: 'ordered_date',
      defaultSortOrder: 'desc',
      sortOptions: [
        {
          value: 'ordered_date',
          label: 'Order Date',
          description: 'Sort by when test was ordered',
        },
        {
          value: 'completed_date',
          label: 'Completion Date',
          description: 'Sort by when results were available',
        },
        {
          value: 'test_name',
          label: 'Test Name',
          description: 'Sort alphabetically by test name',
        },
        {
          value: 'status',
          label: 'Status',
          description: 'Sort by test status',
        },
        {
          value: 'test_category',
          label: 'Category',
          description: 'Sort by test category',
        },
        {
          value: 'test_type',
          label: 'Priority',
          description: 'Sort by test urgency',
        },
        {
          value: 'labs_result',
          label: 'Result',
          description: 'Sort by test result',
        },
        {
          value: 'facility',
          label: 'Facility',
          description: 'Sort by testing facility',
        },
        {
          value: 'practitioner_name',
          label: 'Practitioner',
          description: 'Sort by ordering practitioner',
        },
      ],
      sortTypes: {
        ordered_date: 'date',
        completed_date: 'date',
        test_name: 'string',
        status: 'status',
        test_category: 'string',
        test_type: 'priority',
        labs_result: 'result',
        facility: 'string',
        practitioner_name: 'string',
      },
      // Custom sort functions for complex sorting
      customSortFunctions: {
        priority: (a, b, sortOrder) => {
          const priorityOrder = [
            'emergency',
            'urgent',
            'follow-up',
            'screening',
            'routine',
          ];
          const aIndex =
            priorityOrder.indexOf(a.test_type) !== -1
              ? priorityOrder.indexOf(a.test_type)
              : 999;
          const bIndex =
            priorityOrder.indexOf(b.test_type) !== -1
              ? priorityOrder.indexOf(b.test_type)
              : 999;
          return sortOrder === 'asc' ? aIndex - bIndex : bIndex - aIndex;
        },
        result: (a, b, sortOrder) => {
          const resultOrder = [
            'critical',
            'abnormal',
            'high',
            'low',
            'borderline',
            'normal',
            'inconclusive',
          ];
          const aResult = a.labs_result || 'pending';
          const bResult = b.labs_result || 'pending';
          const aIndex =
            resultOrder.indexOf(aResult) !== -1
              ? resultOrder.indexOf(aResult)
              : 999;
          const bIndex =
            resultOrder.indexOf(bResult) !== -1
              ? resultOrder.indexOf(bResult)
              : 999;
          return sortOrder === 'asc' ? aIndex - bIndex : bIndex - aIndex;
        },
        status: (a, b, sortOrder) => {
          const statusOrder = [
            'in-progress',
            'ordered',
            'completed',
            'cancelled',
          ];
          const aIndex =
            statusOrder.indexOf(a.status) !== -1
              ? statusOrder.indexOf(a.status)
              : 999;
          const bIndex =
            statusOrder.indexOf(b.status) !== -1
              ? statusOrder.indexOf(b.status)
              : 999;
          return sortOrder === 'asc' ? aIndex - bIndex : bIndex - aIndex;
        },
      },
    },
    filterControls: {
      searchPlaceholder:
        'Search lab results, test codes, facilities, practitioners...',
      title: 'Filter & Sort Lab Results',
      showCategory: true,
      showDateRange: true,
      showResult: true,
      showType: true,
      showFiles: true,
      description:
        'Filter lab results by status, category, results, priority, and more',
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

  emergency_contacts: {
    filtering: {
      searchFields: ['name', 'relationship', 'phone_number', 'email'],
      statusField: 'is_active',
      statusOptions: [
        { value: 'all', label: 'All Contacts' },
        { value: 'true', label: 'Active' },
        { value: 'false', label: 'Inactive' },
      ],
      categoryField: 'relationship',
      categoryLabel: 'Relationship',
      categoryOptions: [
        { value: 'all', label: 'All Relationships' },
        { value: 'spouse', label: 'Spouse' },
        { value: 'partner', label: 'Partner' },
        { value: 'parent', label: 'Parent' },
        { value: 'child', label: 'Child' },
        { value: 'sibling', label: 'Sibling' },
        { value: 'grandparent', label: 'Grandparent' },
        { value: 'grandchild', label: 'Grandchild' },
        { value: 'friend', label: 'Friend' },
        { value: 'neighbor', label: 'Neighbor' },
        { value: 'caregiver', label: 'Caregiver' },
        { value: 'guardian', label: 'Guardian' },
        { value: 'other', label: 'Other' },
      ],
      customFilters: {
        is_active: (item, filterValue) => {
          if (filterValue === 'all') return true;
          return item.is_active === (filterValue === 'true');
        },
        is_primary: (item, filterValue) => {
          if (filterValue === 'all') return true;
          return item.is_primary === (filterValue === 'true');
        },
      },
      additionalFilters: [
        {
          field: 'is_primary',
          label: 'Primary Contact',
          options: [
            { value: 'all', label: 'All Contacts' },
            { value: 'true', label: 'Primary Only' },
            { value: 'false', label: 'Non-Primary' },
          ],
        },
      ],
    },
    sorting: {
      defaultSortBy: 'priority',
      defaultSortOrder: 'desc',
      sortOptions: [
        { value: 'priority', label: 'Priority (Primary First)' },
        { value: 'name', label: 'Name' },
        { value: 'relationship', label: 'Relationship' },
        { value: 'is_active', label: 'Status' },
      ],
      sortTypes: {
        name: 'string',
        relationship: 'string',
        is_active: 'boolean',
      },
      customSortFunctions: {
        priority: (a, b, sortOrder) => {
          // Primary contacts first
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
          // Then active contacts
          if (a.is_active && !b.is_active) return -1;
          if (!a.is_active && b.is_active) return 1;
          // Finally by name
          return a.name.localeCompare(b.name);
        },
      },
    },
    filterControls: {
      searchPlaceholder: 'Search contacts, relationships, phone, email...',
      title: 'Filter & Sort Emergency Contacts',
      showCategory: true,
      showStatus: true,
      showAdditionalFilters: true,
      description:
        'Filter emergency contacts by status, relationship, and priority',
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
