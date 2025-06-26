# Standardized Filtering & Sorting System

This document explains how to use the new standardized filtering and sorting system for medical pages, implementing DRY (Don't Repeat Yourself) principles.

## Overview

The system consists of:

- **useFiltering** - Reusable filtering hook
- **useSorting** - Reusable sorting hook
- **useDataManagement** - Combined hook for both filtering and sorting
- **FilterControls** - Standardized UI component
- **medicalPageConfigs** - Pre-configured settings for each medical page type

## Quick Start

### 1. Basic Usage

```javascript
import React from 'react';
import { useDataManagement } from '../../hooks';
import { FilterControls } from '../../components';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';

const MyMedicalPage = () => {
  const [data, setData] = useState([]); // Your medical data

  // Get pre-configured settings
  const config = getMedicalPageConfig('conditions'); // or 'medications', 'procedures', etc.

  // Apply filtering and sorting
  const dataManagement = useDataManagement(data, config);

  return (
    <div>
      {/* Standardized Filter Controls */}
      <FilterControls
        filters={dataManagement.filters}
        updateFilter={dataManagement.updateFilter}
        clearFilters={dataManagement.clearFilters}
        hasActiveFilters={dataManagement.hasActiveFilters}
        statusOptions={dataManagement.statusOptions}
        categoryOptions={dataManagement.categoryOptions}
        dateRangeOptions={dataManagement.dateRangeOptions}
        sortOptions={dataManagement.sortOptions}
        sortBy={dataManagement.sortBy}
        sortOrder={dataManagement.sortOrder}
        handleSortChange={dataManagement.handleSortChange}
        getSortIndicator={dataManagement.getSortIndicator}
        totalCount={dataManagement.totalCount}
        filteredCount={dataManagement.filteredCount}
        config={config.filterControls}
      />

      {/* Use filtered and sorted data */}
      {dataManagement.data.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
};
```

### 2. Available Pre-configurations

The following medical page types have pre-built configurations:

- **conditions** - Medical conditions with status and date filtering
- **medications** - Medications with route, status, and date range filtering
- **procedures** - Medical procedures with status and date filtering
- **treatments** - Treatments with status and date filtering
- **visits** - Medical visits with date-based filtering
- **immunizations** - Immunizations with date-based filtering
- **allergies** - Allergies with severity and date filtering
- **practitioners** - Healthcare practitioners with specialty filtering
- **pharmacies** - Pharmacies with brand and location filtering

## Detailed Usage

### useDataManagement Hook

Returns a comprehensive interface:

```javascript
const {
  // Final processed data
  data, // Array of filtered and sorted items

  // Filter controls
  filters, // Current filter values {search, status, category, dateRange}
  updateFilter, // Function to update a specific filter
  clearFilters, // Function to clear all filters
  hasActiveFilters, // Boolean indicating if any filters are active
  statusOptions, // Array of status filter options
  categoryOptions, // Array of category filter options
  dateRangeOptions, // Array of date range filter options

  // Sort controls
  sortBy, // Current sort field
  sortOrder, // Current sort order ('asc' or 'desc')
  handleSortChange, // Function to change sort field/order
  setSortWithOrder, // Function to set specific sort + order
  getSortIndicator, // Function to get sort indicator (↑/↓)
  isSorted, // Function to check if field is sorted
  sortOptions, // Array of available sort options

  // Counts
  totalCount, // Total number of items
  filteredCount, // Number of items after filtering
  finalCount, // Number of items after filtering + sorting

  // Utility
  isEmpty, // Boolean - true if no items after processing
  hasFilters, // Alias for hasActiveFilters
  rawData, // Original unprocessed data
  filteredData, // Data after filtering but before sorting
} = useDataManagement(data, config);
```

### Configuration Structure

```javascript
const config = {
  filtering: {
    searchFields: ['field1', 'field2'],           // Fields to search in
    statusField: 'status',                        // Field containing status
    statusOptions: [                              // Status filter options
      { value: 'all', label: 'All Statuses' },
      { value: 'active', label: 'Active' }
    ],
    categoryField: 'category',                    // Field for category filtering
    categoryLabel: 'Categories',                  // Label for category filter
    categoryOptions: [...],                       // Static category options (optional)
    dateField: 'created_date',                    // Primary date field
    startDateField: 'start_date',                 // Start date for range filtering
    endDateField: 'end_date',                     // End date for range filtering
    dateRangeOptions: [...],                      // Custom date range options
    initialFilters: {                             // Default filter values
      search: '',
      status: 'active'
    },
    customFilters: {                              // Custom filter functions
      myFilter: (item, filterValue) => { /* logic */ }
    }
  },

  sorting: {
    defaultSortBy: 'name',                        // Default sort field
    defaultSortOrder: 'asc',                      // Default sort order
    sortOptions: [                                // Available sort options
      { value: 'name', label: 'Name' },
      { value: 'date', label: 'Date' }
    ],
    sortTypes: {                                  // Field type definitions
      name: 'string',
      date: 'date',
      status: 'status',
      severity: 'severity',
      amount: 'number'
    },
    statusOrder: {                                // Custom status priority
      active: 1,
      pending: 2,
      completed: 3
    },
    severityOrder: {                              // Custom severity priority
      'life-threatening': 4,
      severe: 3,
      moderate: 2,
      mild: 1
    },
    customSortFunctions: {                        // Custom sort functions
      mySort: (a, b, sortOrder) => { /* logic */ }
    }
  },

  filterControls: {                               // UI configuration
    searchPlaceholder: 'Search...',
    title: 'Filters',
    showSearch: true,
    showStatus: true,
    showCategory: false,
    showDateRange: false,
    showSort: true,
    compactMode: false
  }
};
```

## Advanced Usage

### Custom Configuration

```javascript
// Create custom configuration for a unique page
const customConfig = {
  filtering: {
    searchFields: ['name', 'description', 'tags'],
    statusField: 'active',
    statusOptions: [
      { value: 'all', label: 'All Items' },
      { value: true, label: 'Active' },
      { value: false, label: 'Inactive' },
    ],
    customFilters: {
      priority: (item, priority) => {
        if (priority === 'all') return true;
        return item.priority === priority;
      },
    },
  },
  sorting: {
    defaultSortBy: 'priority',
    sortOptions: [
      { value: 'priority', label: 'Priority' },
      { value: 'name', label: 'Name' },
      { value: 'created_at', label: 'Created Date' },
    ],
    customSortFunctions: {
      priority: (a, b, sortOrder) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const aVal = priorityOrder[a.priority] || 0;
        const bVal = priorityOrder[b.priority] || 0;
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      },
    },
  },
};
```

### Individual Hooks

You can also use the filtering and sorting hooks separately:

```javascript
import { useFiltering, useSorting } from '../../hooks';

// Just filtering
const { filteredData, filters, updateFilter, clearFilters, hasActiveFilters } =
  useFiltering(data, filterConfig);

// Just sorting
const { sortedData, sortBy, sortOrder, handleSortChange } = useSorting(
  data,
  sortConfig
);
```

## Migration Guide

### Before (Old way)

```javascript
const [searchTerm, setSearchTerm] = useState('');
const [statusFilter, setStatusFilter] = useState('all');
const [sortBy, setSortBy] = useState('name');

const filteredData = data
  .filter(item => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  })
  .sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    return 0;
  });
```

### After (New way)

```javascript
const config = getMedicalPageConfig('myPageType');
const dataManagement = useDataManagement(data, config);
const filteredData = dataManagement.data;
```

## Benefits

1. **DRY Principle** - No more duplicated filtering/sorting logic
2. **Consistency** - Same UI and behavior across all medical pages
3. **Maintainability** - Changes in one place affect all pages
4. **Flexibility** - Easy to customize for specific needs
5. **Performance** - Optimized with useMemo and efficient algorithms
6. **Accessibility** - Built-in keyboard navigation and screen reader support

## Supported Filter Types

- **Search** - Text search across multiple fields
- **Status** - Dropdown filter for status fields
- **Category** - Dropdown filter for any categorical field
- **Date Range** - Preset date ranges (today, week, month, year, custom periods)
- **Custom** - Define your own filter functions

## Supported Sort Types

- **String** - Alphabetical sorting
- **Date** - Chronological sorting
- **Number** - Numerical sorting
- **Status** - Priority-based status sorting
- **Severity** - Medical severity level sorting
- **Boolean** - True/false sorting
- **Custom** - Define your own sort functions

This system dramatically reduces code duplication while providing a consistent, powerful filtering and sorting experience across all medical pages.
