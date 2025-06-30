import React, { useState } from 'react';
// CSS removed - component deprecated in favor of MantineFilters

const FilterControls = ({
  filters,
  updateFilter,
  clearFilters,
  hasActiveFilters,
  statusOptions,
  categoryOptions,
  dateRangeOptions,
  sortOptions,
  sortBy,
  sortOrder,
  handleSortChange,
  getSortIndicator,
  totalCount,
  filteredCount,
  config = {},
}) => {
  const {
    showSearch = true,
    showStatus = true,
    showCategory = false,
    showDateRange = false,
    showSort = true,
    searchPlaceholder = 'Search...',
    title = 'Filters & Search',
    compactMode = false,
    defaultCollapsed = false,
  } = config;

  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div
      className={`filter-controls ${compactMode ? 'compact' : ''} ${isCollapsed ? 'collapsed' : 'expanded'}`}
    >
      <div className="filter-controls-header">
        <div className="header-left">
          <h3 className="filter-title">{title}</h3>
          <button
            className="collapse-toggle"
            onClick={toggleCollapse}
            title={isCollapsed ? 'Expand filters' : 'Collapse filters'}
          >
            {isCollapsed ? '▼' : '▲'}
          </button>
        </div>
        <div className="header-right">
          {hasActiveFilters && (
            <button
              className="clear-filters-btn"
              onClick={clearFilters}
              title="Clear all filters"
            >
              ✕ Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Always show filter summary for quick reference */}
      <div className="filter-summary-top">
        {hasActiveFilters && (
          <span className="active-filters-indicator">Active Filters</span>
        )}
        <span className="count-display">
          Showing {filteredCount} of {totalCount} items
        </span>
      </div>

      <div
        className={`filter-controls-content ${isCollapsed ? 'collapsed' : 'expanded'}`}
      >
        {/* Search Filter */}
        {showSearch && (
          <div className="filter-group search-filter">
            <label htmlFor="search-filter">🔍 Search</label>
            <input
              id="search-filter"
              type="text"
              placeholder={searchPlaceholder}
              value={filters.search}
              onChange={e => updateFilter('search', e.target.value)}
              className="search-input"
            />
          </div>
        )}

        {/* Status Filter */}
        {showStatus && statusOptions && statusOptions.length > 1 && (
          <div className="filter-group">
            <label htmlFor="status-filter">📊 Status</label>
            <select
              id="status-filter"
              value={filters.status}
              onChange={e => updateFilter('status', e.target.value)}
              className="filter-select"
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Category Filter */}
        {showCategory && categoryOptions && categoryOptions.length > 1 && (
          <div className="filter-group">
            <label htmlFor="category-filter">🏷️ Category</label>
            <select
              id="category-filter"
              value={filters.category}
              onChange={e => updateFilter('category', e.target.value)}
              className="filter-select"
            >
              {categoryOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date Range Filter */}
        {showDateRange && dateRangeOptions && dateRangeOptions.length > 1 && (
          <div className="filter-group">
            <label htmlFor="date-range-filter">📅 Time Period</label>
            <select
              id="date-range-filter"
              value={filters.dateRange}
              onChange={e => updateFilter('dateRange', e.target.value)}
              className="filter-select"
            >
              {dateRangeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Sort Controls */}
        {showSort && sortOptions && sortOptions.length > 1 && (
          <div className="filter-group sort-controls">
            <label htmlFor="sort-select">⚡ Sort by</label>
            <div className="sort-control-group">
              <select
                id="sort-select"
                value={sortBy}
                onChange={e => handleSortChange(e.target.value)}
                className="filter-select"
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                className="sort-order-button"
                onClick={() => handleSortChange(sortBy)}
                title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
              >
                {getSortIndicator(sortBy) || '↕'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterControls;
