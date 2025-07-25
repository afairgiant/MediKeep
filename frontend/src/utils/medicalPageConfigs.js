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
      dateField: 'onset_date',
    },
    sorting: {
      defaultSortBy: 'onset_date',
      defaultSortOrder: 'desc',
      sortOptions: [
        { value: 'onset_date', label: 'Onset Date' },
        { value: 'diagnosis', label: 'Diagnosis' },
        { value: 'status', label: 'Status' },
      ],
      sortTypes: {
        onset_date: 'date',
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
      startDateField: 'date',
      endDateField: 'date',
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
      startDateField: 'start_date',
      endDateField: 'end_date',
      customFilters: {
        dateRange: (item, dateRange, additionalData) => {
          if (dateRange === 'all') return true;

          const now = new Date();
          const startDate = item.start_date ? new Date(item.start_date) : null;
          const endDate = item.end_date ? new Date(item.end_date) : null;

          switch (dateRange) {
            case 'today':
              const today = now.toDateString();
              const effectiveEndDateToday = endDate || now;
              return (
                (startDate && startDate.toDateString() === today) ||
                effectiveEndDateToday.toDateString() === today ||
                (startDate && startDate <= now && effectiveEndDateToday >= now)
              );

            case 'week':
              const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              const effectiveEndDateWeek = endDate || now;
              return (
                (startDate && startDate >= weekAgo) ||
                effectiveEndDateWeek >= weekAgo ||
                (startDate &&
                  startDate <= now &&
                  effectiveEndDateWeek >= weekAgo)
              );

            case 'month':
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

            case 'year':
              const yearAgo = new Date(
                now.getFullYear() - 1,
                now.getMonth(),
                now.getDate()
              );
              const effectiveEndDateYear = endDate || now;
              return (
                (startDate && startDate >= yearAgo) ||
                effectiveEndDateYear >= yearAgo ||
                (startDate &&
                  startDate <= now &&
                  effectiveEndDateYear >= yearAgo)
              );

            case 'current':
              // Currently active treatments
              const effectiveEndDateCurrent = endDate || now;
              return (
                (!startDate || startDate <= now) &&
                effectiveEndDateCurrent >= now
              );

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
      dateField: 'onset_date',
      startDateField: 'onset_date',
      endDateField: 'onset_date',
    },
    sorting: {
      defaultSortBy: 'severity',
      defaultSortOrder: 'desc',
      sortOptions: [
        { value: 'severity', label: 'Severity' },
        { value: 'allergen', label: 'Allergen' },
        { value: 'onset_date', label: 'Onset Date' },
      ],
      sortTypes: {
        severity: 'severity',
        allergen: 'string',
        onset_date: 'date',
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
      // Ordered Date Filter
      orderedDateField: 'ordered_date',
      orderedDateLabel: 'Ordered Date',
      orderedDateOptions: [
        { value: 'all', label: 'All Ordered Dates' },
        {
          value: 'today',
          label: 'Ordered Today',
          description: 'Tests ordered today',
        },
        {
          value: 'week',
          label: 'Ordered This Week',
          description: 'Tests ordered this week',
        },
        {
          value: 'current_month',
          label: 'Ordered This Month',
          description: 'Tests ordered this month',
        },
        {
          value: 'past_month',
          label: 'Ordered Last Month',
          description: 'Tests ordered last month',
        },
        {
          value: 'past_3_months',
          label: 'Ordered Past 3 Months',
          description: 'Tests ordered in last 3 months',
        },
        {
          value: 'past_6_months',
          label: 'Ordered Past 6 Months',
          description: 'Tests ordered in last 6 months',
        },
        {
          value: 'year',
          label: 'Ordered This Year',
          description: 'Tests ordered this year',
        },
      ],
      // Completed Date Filter
      completedDateField: 'completed_date',
      completedDateLabel: 'Completed Date',
      completedDateOptions: [
        { value: 'all', label: 'All Completed Dates' },
        {
          value: 'today',
          label: 'Completed Today',
          description: 'Tests completed today',
        },
        {
          value: 'week',
          label: 'Completed This Week',
          description: 'Tests completed this week',
        },
        {
          value: 'current_month',
          label: 'Completed This Month',
          description: 'Tests completed this month',
        },
        {
          value: 'past_month',
          label: 'Completed Last Month',
          description: 'Tests completed last month',
        },
        {
          value: 'past_3_months',
          label: 'Completed Past 3 Months',
          description: 'Tests completed in last 3 months',
        },
        {
          value: 'past_6_months',
          label: 'Completed Past 6 Months',
          description: 'Tests completed in last 6 months',
        },
        {
          value: 'year',
          label: 'Completed This Year',
          description: 'Tests completed this year',
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
      defaultSortBy: 'completed_date',
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
      showOrderedDate: true,
      showCompletedDate: true,
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

  family_members: {
    filtering: {
      searchFields: ['name', 'relationship', 'notes'],
      customSearchFunction: (item, searchTerm) => {
        // Validate and sanitize search term
        if (!searchTerm || typeof searchTerm !== 'string') {
          return true; // Show all items if search term is invalid
        }
        
        let sanitizedTerm = searchTerm.trim().toLowerCase();
        if (sanitizedTerm.length === 0) {
          return true; // Show all items if search term is empty after trimming
        }
        
        // Additional validation: prevent extremely long search terms that could cause performance issues
        if (sanitizedTerm.length > 100) {
          console.warn('Search term too long, truncating to 100 characters');
          sanitizedTerm = sanitizedTerm.substring(0, 100);
        }
        
        // Search in basic family member fields
        const basicFields = ['name', 'relationship', 'notes'];
        const matchesBasic = basicFields.some(field => {
          const value = item[field];
          if (!value) return false;
          try {
            return value.toString().toLowerCase().includes(sanitizedTerm);
          } catch (error) {
            console.warn(`Error processing field ${field}:`, error);
            return false;
          }
        });
        
        if (matchesBasic) return true;
        
        // Search in family conditions
        if (item.family_conditions && Array.isArray(item.family_conditions)) {
          const conditionFields = ['condition_name', 'notes', 'condition_type', 'severity', 'status'];
          const matchesCondition = item.family_conditions.some(condition => {
            if (!condition || typeof condition !== 'object') return false;
            
            return conditionFields.some(field => {
              const value = condition[field];
              if (!value) return false;
              try {
                return value.toString().toLowerCase().includes(sanitizedTerm);
              } catch (error) {
                console.warn(`Error processing condition field ${field}:`, error);
                return false;
              }
            });
          });
          
          if (matchesCondition) return true;
        }
        
        return false;
      },
      categoryField: 'relationship',
      categoryLabel: 'Relationship',
      categoryOptions: [
        { value: 'all', label: 'All Relationships' },
        { value: 'father', label: 'Father' },
        { value: 'mother', label: 'Mother' },
        { value: 'brother', label: 'Brother' },
        { value: 'sister', label: 'Sister' },
        { value: 'paternal_grandfather', label: 'Paternal Grandfather' },
        { value: 'paternal_grandmother', label: 'Paternal Grandmother' },
        { value: 'maternal_grandfather', label: 'Maternal Grandfather' },
        { value: 'maternal_grandmother', label: 'Maternal Grandmother' },
        { value: 'uncle', label: 'Uncle' },
        { value: 'aunt', label: 'Aunt' },
        { value: 'cousin', label: 'Cousin' },
        { value: 'other', label: 'Other' },
      ],
      statusField: 'is_deceased',
      statusOptions: [
        { value: 'all', label: 'All Members' },
        { value: 'false', label: 'Living' },
        { value: 'true', label: 'Deceased' },
      ],
      customFilters: {
        is_deceased: (item, filterValue) => {
          if (filterValue === 'all') return true;
          return item.is_deceased === (filterValue === 'true');
        },
      },
    },
    sorting: {
      defaultSortBy: 'relationship',
      defaultSortOrder: 'asc',
      sortOptions: [
        { value: 'relationship', label: 'Relationship' },
        { value: 'name', label: 'Name' },
        { value: 'birth_year', label: 'Birth Year' },
      ],
      sortTypes: {
        name: 'string',
        relationship: 'string',
        birth_year: 'number',
      },
    },
    filterControls: {
      searchPlaceholder: 'Search family members, conditions, notes...',
      title: 'Filter & Sort Family Members',
      showCategory: true,
      showStatus: true,
      description: 'Filter family members by relationship and status',
    },
    // Table configuration for flattened conditions view
    table: {
      columns: [
        {
          key: 'familyMemberName',
          label: 'Family Member',
          sortable: true,
          width: '120px',
        },
        {
          key: 'relationship',
          label: 'Relationship',
          sortable: true,
          width: '100px',
          render: (value) => value?.replace('_', ' ') || '-',
        },
        {
          key: 'condition_name',
          label: 'Condition',
          sortable: true,
          width: '150px',
          render: (value) => value || 'No conditions',
          style: (row) => ({
            fontStyle: row.condition_name ? 'normal' : 'italic',
            color: row.condition_name ? 'inherit' : 'var(--mantine-color-dimmed)',
          }),
        },
        {
          key: 'condition_type',
          label: 'Type',
          sortable: true,
          width: '120px',
          render: (value) => value?.replace('_', ' ') || '-',
        },
        {
          key: 'severity',
          label: 'Severity',
          sortable: true,
          width: '100px',
          render: (value, row) => {
            if (!value) return '-';
            const colors = {
              mild: 'green',
              moderate: 'yellow', 
              severe: 'red',
              critical: 'red'
            };
            return {
              type: 'badge',
              color: colors[value] || 'gray',
              text: value,
            };
          },
        },
        {
          key: 'diagnosis_age',
          label: 'Diagnosis Age',
          sortable: true,
          width: '100px',
          render: (value) => value ? `${value} years` : '-',
        },
        {
          key: 'status',
          label: 'Status',
          sortable: true,
          width: '100px',
          render: (value) => {
            if (!value) return '-';
            const colors = {
              active: 'blue',
              resolved: 'green',
              chronic: 'orange'
            };
            return {
              type: 'badge',
              variant: 'light',
              color: colors[value] || 'gray',
              text: value,
            };
          },
        },
      ],
      actions: {
        view: (row) => row.familyMemberId,
        edit: (row) => row.conditionId ? { familyMember: row, condition: row } : null,
        delete: (row) => row.conditionId ? { familyMemberId: row.familyMemberId, conditionId: row.conditionId } : null,
      },
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
