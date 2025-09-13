/**
 * Column Helper Utilities
 * Centralized utilities for working with table columns
 */

/**
 * Extract the key identifier from a column configuration object
 * Supports multiple column definition formats (Ant Design, Mantine, custom)
 * 
 * @param {Object} column - Column configuration object
 * @returns {string|number} - The column key/identifier
 */
export const getColumnKey = (column) => {
  return column.key || column.dataIndex || column.name || column.accessor;
};

/**
 * Get display name for a column
 * 
 * @param {Object} column - Column configuration object
 * @returns {string} - The display name for the column
 */
export const getColumnDisplayName = (column) => {
  return column.header || column.title || column.label || getColumnKey(column);
};

/**
 * Check if a column has a specific priority level
 * 
 * @param {Object} column - Column configuration object
 * @param {string} priority - Priority level to check for ('high', 'medium', 'low')
 * @returns {boolean} - Whether the column has the specified priority
 */
export const hasColumnPriority = (column, priority) => {
  return column.priority === priority;
};

/**
 * Filter columns by priority level
 * 
 * @param {Array} columns - Array of column configuration objects
 * @param {string} priority - Priority level to filter by
 * @returns {Array} - Filtered columns array
 */
export const filterColumnsByPriority = (columns, priority) => {
  return columns.filter(column => hasColumnPriority(column, priority));
};

/**
 * Get visible columns based on priority and breakpoint
 * 
 * @param {Array} columns - Array of column configuration objects
 * @param {string} breakpoint - Current responsive breakpoint
 * @returns {Array} - Visible columns for the breakpoint
 */
export const getVisibleColumnsByBreakpoint = (columns, breakpoint) => {
  if (!Array.isArray(columns)) return [];

  switch (breakpoint) {
    case 'xs':
    case 'sm':
      return filterColumnsByPriority(columns, 'high');
    case 'md':
      return columns.filter(col => 
        hasColumnPriority(col, 'high') || hasColumnPriority(col, 'medium')
      );
    case 'lg':
    case 'xl':
    case 'xxl':
    default:
      return columns; // Show all columns on large screens
  }
};