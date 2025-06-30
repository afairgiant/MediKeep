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
    <Card withBorder shadow="sm" p="md" mb="lg">
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

        {/* Filter Controls Row 1: Search and Primary Filters */}
        <Group gap="md" grow>
          {/* Search */}
          {showSearch && (
            <TextInput
              placeholder={searchPlaceholder}
              value={filters.search || ''}
              onChange={e => updateFilter('search', e.target.value)}
              leftSection={<IconSearch size={16} />}
              style={{ minWidth: '300px' }}
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
              style={{ minWidth: '150px' }}
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
              style={{ minWidth: '150px' }}
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
              style={{ minWidth: '150px' }}
            />
          )}
        </Group>

        {/* Filter Controls Row 2: Additional Filters (if any are shown) */}
        {(showResult || showType || showFiles) && (
          <Group gap="md" grow>
            {/* Result Filter */}
            {showResult && resultOptions && resultOptions.length > 1 && (
              <Select
                placeholder="Test Results"
                value={filters.result}
                onChange={value => updateFilter('result', value)}
                data={resultOptions.map(option => ({
                  value: option.value,
                  label: option.label,
                }))}
                clearable={false}
                style={{ minWidth: '150px' }}
              />
            )}

            {/* Type Filter */}
            {showType && typeOptions && typeOptions.length > 1 && (
              <Select
                placeholder="Test Priority"
                value={filters.type}
                onChange={value => updateFilter('type', value)}
                data={typeOptions.map(option => ({
                  value: option.value,
                  label: option.label,
                }))}
                clearable={false}
                style={{ minWidth: '150px' }}
              />
            )}

            {/* Files Filter */}
            {showFiles && filesOptions && filesOptions.length > 1 && (
              <Select
                placeholder="File Attachments"
                value={filters.files}
                onChange={value => updateFilter('files', value)}
                data={filesOptions.map(option => ({
                  value: option.value,
                  label: option.label,
                }))}
                clearable={false}
                style={{ minWidth: '150px' }}
              />
            )}

            {/* Fill remaining space if needed */}
            {(!showResult || !showType || !showFiles) && (
              <div style={{ flex: 1 }} />
            )}
          </Group>
        )}

        {/* Sort Controls */}
        {sortOptions && sortOptions.length > 1 && (
          <Group gap="md" justify="flex-end">
            <Group gap="xs">
              <Select
                placeholder="Sort by"
                value={sortBy}
                onChange={value => handleSortChange(value)}
                data={sortOptions.map(option => ({
                  value: option.value,
                  label: option.label,
                }))}
                style={{ minWidth: '200px' }}
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
              >
                {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
              </Button>
            </Group>
          </Group>
        )}

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Group justify="flex-end">
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconClearAll size={16} />}
              onClick={clearFilters}
            >
              Clear Filters
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  );
};

export default MantineFilters;
