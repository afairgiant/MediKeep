import PropTypes from 'prop-types';
import MantineFilters from '../mantine/MantineFilters';

/**
 * MedicalPageFilters - A wrapper component that simplifies MantineFilters usage
 *
 * Consolidates the repetitive filter prop patterns used across 14+ medical pages.
 * Accepts dataManagement and config objects instead of 15+ individual props.
 *
 * @example
 * // Before (15-21 lines)
 * <MantineFilters
 *   filters={dataManagement.filters}
 *   updateFilter={dataManagement.updateFilter}
 *   clearFilters={dataManagement.clearFilters}
 *   hasActiveFilters={dataManagement.hasActiveFilters}
 *   statusOptions={dataManagement.statusOptions}
 *   categoryOptions={dataManagement.categoryOptions}
 *   dateRangeOptions={dataManagement.dateRangeOptions}
 *   sortOptions={dataManagement.sortOptions}
 *   sortBy={dataManagement.sortBy}
 *   sortOrder={dataManagement.sortOrder}
 *   handleSortChange={dataManagement.handleSortChange}
 *   totalCount={dataManagement.totalCount}
 *   filteredCount={dataManagement.filteredCount}
 *   config={config.filterControls}
 * />
 *
 * @example
 * // After (1 line)
 * <MedicalPageFilters dataManagement={dataManagement} config={config} />
 */
function MedicalPageFilters({ dataManagement, config }) {
  // Early return if dataManagement or filters is missing
  // This handles conditional rendering cases like in Vitals.jsx
  if (!dataManagement || !dataManagement.filters) {
    return null;
  }

  // Extract all properties from dataManagement
  const {
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    statusOptions,
    categoryOptions,
    medicationTypeOptions,
    dateRangeOptions,
    orderedDateOptions,
    completedDateOptions,
    resultOptions,
    typeOptions,
    filesOptions,
    sortOptions,
    sortBy,
    sortOrder,
    handleSortChange,
    totalCount,
    filteredCount,
  } = dataManagement;

  return (
    <MantineFilters
      filters={filters}
      updateFilter={updateFilter}
      clearFilters={clearFilters}
      hasActiveFilters={hasActiveFilters}
      statusOptions={statusOptions}
      categoryOptions={categoryOptions}
      medicationTypeOptions={medicationTypeOptions}
      dateRangeOptions={dateRangeOptions}
      orderedDateOptions={orderedDateOptions}
      completedDateOptions={completedDateOptions}
      resultOptions={resultOptions}
      typeOptions={typeOptions}
      filesOptions={filesOptions}
      sortOptions={sortOptions}
      sortBy={sortBy}
      sortOrder={sortOrder}
      handleSortChange={handleSortChange}
      totalCount={totalCount}
      filteredCount={filteredCount}
      config={config?.filterControls}
    />
  );
}

MedicalPageFilters.propTypes = {
  /** Data management object from useDataManagement hook */
  dataManagement: PropTypes.shape({
    filters: PropTypes.object,
    updateFilter: PropTypes.func,
    clearFilters: PropTypes.func,
    hasActiveFilters: PropTypes.bool,
    statusOptions: PropTypes.array,
    categoryOptions: PropTypes.array,
    medicationTypeOptions: PropTypes.array,
    dateRangeOptions: PropTypes.array,
    orderedDateOptions: PropTypes.array,
    completedDateOptions: PropTypes.array,
    resultOptions: PropTypes.array,
    typeOptions: PropTypes.array,
    filesOptions: PropTypes.array,
    sortOptions: PropTypes.array,
    sortBy: PropTypes.string,
    sortOrder: PropTypes.string,
    handleSortChange: PropTypes.func,
    totalCount: PropTypes.number,
    filteredCount: PropTypes.number,
  }),
  /** Page configuration object from getMedicalPageConfig */
  config: PropTypes.shape({
    filterControls: PropTypes.object,
  }),
};

export default MedicalPageFilters;
