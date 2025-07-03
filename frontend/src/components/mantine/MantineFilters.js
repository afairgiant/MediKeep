import React from 'react';
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
} from '@mantine/core';
import {
  IconSearch,
  IconClearAll,
  IconSortAscending,
  IconSortDescending,
} from '@tabler/icons-react';

const MantineFilters = ({
  filters,
  updateFilter,
  clearFilters,
  hasActiveFilters,
  statusOptions,
  categoryOptions,
  dateRangeOptions,
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
    showResult = false,
    showType = false,
    showFiles = false,
    showSearch = true,
  } = config;

  return (
    <Card withBorder shadow="sm" p="md" mb="lg" className="no-print">
      <Stack gap="md">
        {/* Header */}
        <Flex justify="space-between" align="center">
          <div>
            <Text size="lg" fw={600}>
              {title}
            </Text>
            {description && (
              <Text size="sm" c="dimmed">
                {description}
              </Text>
            )}
          </div>
          <Group gap="xs">
            {hasActiveFilters && (
              <Badge color="blue" variant="light">
                Filters Active
              </Badge>
            )}
            <Text size="sm" c="dimmed">
              {filteredCount} of {totalCount} items
            </Text>
          </Group>
        </Flex>

        {/* All Filter Controls in One Row */}
        <Group gap="md" wrap="nowrap" align="flex-end">
          {/* Search */}
          {showSearch && (
            <TextInput
              placeholder={searchPlaceholder}
              value={filters.search || ''}
              onChange={e => updateFilter('search', e.target.value)}
              leftSection={<IconSearch size={16} />}
              style={{ minWidth: '200px', flexShrink: 0 }}
            />
          )}

          {/* Status Filter */}
          {showStatus && statusOptions && statusOptions.length > 1 && (
            <Select
              placeholder="Status"
              value={filters.status}
              onChange={value => updateFilter('status', value)}
              data={statusOptions.map(option => ({
                value: option.value,
                label: option.label,
              }))}
              clearable={false}
              style={{ minWidth: '120px', flexShrink: 0 }}
            />
          )}

          {/* Category Filter */}
          {showCategory && categoryOptions && categoryOptions.length > 1 && (
            <Select
              placeholder="Category"
              value={filters.category}
              onChange={value => updateFilter('category', value)}
              data={categoryOptions.map(option => ({
                value: option.value,
                label: option.label,
              }))}
              clearable={false}
              style={{ minWidth: '120px', flexShrink: 0 }}
            />
          )}

          {/* Date Range Filter */}
          {showDateRange && dateRangeOptions && dateRangeOptions.length > 1 && (
            <Select
              placeholder="Date Range"
              value={filters.dateRange}
              onChange={value => updateFilter('dateRange', value)}
              data={dateRangeOptions.map(option => ({
                value: option.value,
                label: option.label,
              }))}
              clearable={false}
              style={{ minWidth: '120px', flexShrink: 0 }}
            />
          )}

          {/* Result Filter */}
          {showResult && resultOptions && resultOptions.length > 1 && (
            <Select
              placeholder="Results"
              value={filters.result}
              onChange={value => updateFilter('result', value)}
              data={resultOptions.map(option => ({
                value: option.value,
                label: option.label,
              }))}
              clearable={false}
              style={{ minWidth: '120px', flexShrink: 0 }}
            />
          )}

          {/* Type Filter */}
          {showType && typeOptions && typeOptions.length > 1 && (
            <Select
              placeholder="Priority"
              value={filters.type}
              onChange={value => updateFilter('type', value)}
              data={typeOptions.map(option => ({
                value: option.value,
                label: option.label,
              }))}
              clearable={false}
              style={{ minWidth: '120px', flexShrink: 0 }}
            />
          )}

          {/* Files Filter */}
          {showFiles && filesOptions && filesOptions.length > 1 && (
            <Select
              placeholder="Files"
              value={filters.files}
              onChange={value => updateFilter('files', value)}
              data={filesOptions.map(option => ({
                value: option.value,
                label: option.label,
              }))}
              clearable={false}
              style={{ minWidth: '120px', flexShrink: 0 }}
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
                style={{ minWidth: '140px', flexShrink: 0 }}
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
                style={{ flexShrink: 0 }}
              >
                {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
              </Button>
            </>
          )}

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconClearAll size={16} />}
              onClick={clearFilters}
              style={{ flexShrink: 0 }}
            >
              Clear
            </Button>
          )}
        </Group>
      </Stack>
    </Card>
  );
};

export default MantineFilters;
