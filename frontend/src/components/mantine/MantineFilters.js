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
    showStatus = true,
    showCategory = false,
    showDateRange = false,
    showSearch = true,
  } = config;

  return (
    <Card withBorder shadow="sm" p="md" mb="lg">
      <Stack gap="md">
        {/* Header */}
        <Flex justify="space-between" align="center">
          <Text size="lg" fw={600}>
            {title}
          </Text>
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

        {/* Filter Controls */}
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

          {/* Sort */}
          {sortOptions && sortOptions.length > 1 && (
            <Group gap="xs" style={{ minWidth: '200px' }}>
              <Select
                placeholder="Sort by"
                value={sortBy}
                onChange={value => handleSortChange(value)}
                data={sortOptions.map(option => ({
                  value: option.value,
                  label: option.label,
                }))}
                style={{ flex: 1 }}
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
          )}
        </Group>

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
