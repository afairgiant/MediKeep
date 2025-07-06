import React, { useState } from 'react';
import {
  Group,
  TextInput,
  Select,
  Button,
  Card,
  Text,
  Badge,
  Stack,
  Flex,
  Collapse,
  ActionIcon,
} from '@mantine/core';
import {
  IconSearch,
  IconClearAll,
  IconSortAscending,
  IconSortDescending,
  IconFilter,
  IconChevronDown,
  IconChevronUp,
} from '@tabler/icons-react';

const MantineFilters = ({
  filters,
  updateFilter,
  clearFilters,
  hasActiveFilters,
  statusOptions,
  categoryOptions,
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
  config = {},
}) => {
  const {
    searchPlaceholder = 'Search...',
    title = 'Filters & Search',
    description,
    showStatus = true,
    showCategory = false,
    showDateRange = false,
    showOrderedDate = false,
    showCompletedDate = false,
    showResult = false,
    showType = false,
    showFiles = false,
    showSearch = true,
  } = config;

  const [isExpanded, setIsExpanded] = useState(false);

  // Count collapsible filters (excluding always-visible search)
  const filterCount = [
    showStatus && statusOptions?.length > 1,
    showCategory && categoryOptions?.length > 1,
    showDateRange && dateRangeOptions?.length > 1,
    showOrderedDate && orderedDateOptions?.length > 1,
    showCompletedDate && completedDateOptions?.length > 1,
    showResult && resultOptions?.length > 1,
    showType && typeOptions?.length > 1,
    showFiles && filesOptions?.length > 1,
    sortOptions?.length > 1,
  ].filter(Boolean).length;

  return (
    <Card withBorder shadow="sm" p="md" mb="lg" className="no-print">
      <Stack gap="md">
        {/* Compact Header with Filter Button */}
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <ActionIcon
              variant={isExpanded ? 'filled' : 'light'}
              color={hasActiveFilters ? 'blue' : 'gray'}
              size="lg"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <IconFilter size={18} />
            </ActionIcon>

            <div>
              <Group gap="xs" align="center">
                <Text size="md" fw={500}>
                  Filters & Search
                </Text>
                {hasActiveFilters && (
                  <Badge color="blue" variant="light" size="sm">
                    Active
                  </Badge>
                )}
              </Group>
              <Text size="xs" c="dimmed">
                {filteredCount} of {totalCount} items
                {filterCount > 0 ? ` • ${filterCount} more filters` : ''}
              </Text>
            </div>

            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <IconChevronUp size={16} />
              ) : (
                <IconChevronDown size={16} />
              )}
            </ActionIcon>
          </Group>

          <Group gap="xs">
            {/* Always visible search - most commonly used */}
            {showSearch && (
              <TextInput
                placeholder={searchPlaceholder}
                value={filters.search || ''}
                onChange={e => updateFilter('search', e.target.value)}
                leftSection={<IconSearch size={16} />}
                style={{ width: '200px' }}
                size="sm"
              />
            )}

            {hasActiveFilters && (
              <Button
                variant="subtle"
                color="gray"
                size="sm"
                leftSection={<IconClearAll size={14} />}
                onClick={clearFilters}
              >
                Clear
              </Button>
            )}
          </Group>
        </Group>

        {/* Collapsible Filter Controls */}
        <Collapse in={isExpanded}>
          <Card withBorder p="sm" bg="gray.0" style={{ borderStyle: 'dashed' }}>
            <Stack gap="md">
              <Text size="sm" fw={500} c="dimmed">
                Advanced Filters
              </Text>

              <Group gap="md" align="flex-end">
                {/* Status Filter */}
                {showStatus && statusOptions && statusOptions.length > 1 && (
                  <Select
                    placeholder="Status"
                    value={filters.status}
                    onChange={value => updateFilter('status', value || 'all')}
                    data={statusOptions.map(option => ({
                      value: option.value,
                      label: option.label,
                    }))}
                    clearable={true}
                    style={{ minWidth: '120px', flex: '0 1 150px' }}
                  />
                )}

                {/* Category Filter */}
                {showCategory &&
                  categoryOptions &&
                  categoryOptions.length > 1 && (
                    <Select
                      placeholder="Category"
                      value={filters.category}
                      onChange={value =>
                        updateFilter('category', value || 'all')
                      }
                      data={categoryOptions.map(option => ({
                        value: option.value,
                        label: option.label,
                      }))}
                      clearable={true}
                      style={{ minWidth: '120px', flex: '0 1 150px' }}
                    />
                  )}

                {/* Date Range Filter */}
                {showDateRange &&
                  dateRangeOptions &&
                  dateRangeOptions.length > 1 && (
                    <Select
                      placeholder="Date Range"
                      value={filters.dateRange}
                      onChange={value =>
                        updateFilter('dateRange', value || 'all')
                      }
                      data={dateRangeOptions.map(option => ({
                        value: option.value,
                        label: option.label,
                      }))}
                      clearable={true}
                      style={{ minWidth: '120px', flex: '0 1 150px' }}
                    />
                  )}

                {/* Ordered Date Filter */}
                {showOrderedDate &&
                  orderedDateOptions &&
                  orderedDateOptions.length > 1 && (
                    <Select
                      placeholder="Ordered Date"
                      value={filters.orderedDate}
                      onChange={value =>
                        updateFilter('orderedDate', value || 'all')
                      }
                      data={orderedDateOptions.map(option => ({
                        value: option.value,
                        label: option.label,
                      }))}
                      clearable={true}
                      style={{ minWidth: '140px', flex: '0 1 160px' }}
                    />
                  )}

                {/* Completed Date Filter */}
                {showCompletedDate &&
                  completedDateOptions &&
                  completedDateOptions.length > 1 && (
                    <Select
                      placeholder="Completed Date"
                      value={filters.completedDate}
                      onChange={value =>
                        updateFilter('completedDate', value || 'all')
                      }
                      data={completedDateOptions.map(option => ({
                        value: option.value,
                        label: option.label,
                      }))}
                      clearable={true}
                      style={{ minWidth: '140px', flex: '0 1 160px' }}
                    />
                  )}

                {/* Result Filter */}
                {showResult && resultOptions && resultOptions.length > 1 && (
                  <Select
                    placeholder="Results"
                    value={filters.result}
                    onChange={value => updateFilter('result', value || 'all')}
                    data={resultOptions.map(option => ({
                      value: option.value,
                      label: option.label,
                    }))}
                    clearable={true}
                    style={{ minWidth: '120px', flex: '0 1 150px' }}
                  />
                )}

                {/* Type Filter */}
                {showType && typeOptions && typeOptions.length > 1 && (
                  <Select
                    placeholder="Priority"
                    value={filters.type}
                    onChange={value => updateFilter('type', value || 'all')}
                    data={typeOptions.map(option => ({
                      value: option.value,
                      label: option.label,
                    }))}
                    clearable={true}
                    style={{ minWidth: '120px', flex: '0 1 150px' }}
                  />
                )}

                {/* Files Filter */}
                {showFiles && filesOptions && filesOptions.length > 1 && (
                  <Select
                    placeholder="Files"
                    value={filters.files}
                    onChange={value => updateFilter('files', value || 'all')}
                    data={filesOptions.map(option => ({
                      value: option.value,
                      label: option.label,
                    }))}
                    clearable={true}
                    style={{ minWidth: '120px', flex: '0 1 150px' }}
                  />
                )}

                {/* Sort Controls */}
                {sortOptions && sortOptions.length > 1 && (
                  <>
                    <Select
                      placeholder="Sort by"
                      value={sortBy}
                      onChange={value => handleSortChange(value)}
                      data={sortOptions.map(option => ({
                        value: option.value,
                        label: option.label,
                      }))}
                      style={{ minWidth: '140px', flex: '0 1 160px' }}
                    />
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() => handleSortChange(sortBy)}
                      leftSection={
                        sortOrder === 'asc' ? (
                          <IconSortAscending size={16} />
                        ) : (
                          <IconSortDescending size={16} />
                        )
                      }
                      style={{ flex: '0 0 auto' }}
                    >
                      {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
                    </Button>
                  </>
                )}
              </Group>
            </Stack>
          </Card>
        </Collapse>
      </Stack>
    </Card>
  );
};

export default MantineFilters;
