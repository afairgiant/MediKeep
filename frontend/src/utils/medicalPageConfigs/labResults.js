/**
 * Lab Results page configuration
 */

export const labresultsPageConfig = {
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
    // Note: resultField removed - custom filter handles all result filtering including 'pending'
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
        label: 'With Files',
        description: 'Has attached files',
      },
      {
        value: 'without_files',
        label: 'No Files',
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
      result: (item, filterValue) => {
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
      test_type: (a, b, sortOrder) => {
        const priorityOrder = ['emergency', 'urgent', 'follow-up', 'screening', 'routine'];
        const aIndex = priorityOrder.indexOf(a.test_type);
        const bIndex = priorityOrder.indexOf(b.test_type);
        const diff = (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
        return sortOrder === 'asc' ? diff : -diff;
      },
      labs_result: (a, b, sortOrder) => {
        const resultOrder = ['critical', 'abnormal', 'high', 'low', 'borderline', 'normal', 'inconclusive'];
        const aIndex = resultOrder.indexOf(a.labs_result || 'pending');
        const bIndex = resultOrder.indexOf(b.labs_result || 'pending');
        const diff = (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
        return sortOrder === 'asc' ? diff : -diff;
      },
      status: (a, b, sortOrder) => {
        const statusOrder = ['in-progress', 'ordered', 'completed', 'cancelled'];
        const aIndex = statusOrder.indexOf(a.status);
        const bIndex = statusOrder.indexOf(b.status);
        const diff = (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
        return sortOrder === 'asc' ? diff : -diff;
      },
    },
  },
  filterControls: {
    searchPlaceholder: 'searchPlaceholders.labResults',
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
};
