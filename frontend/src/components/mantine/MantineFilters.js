import React, { useState, useEffect } from 'react';
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
  useMantineColorScheme,
  Box,
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

  const { colorScheme } = useMantineColorScheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchWidth, setSearchWidth] = useState('150px');

  // Helper functions for theme-aware colors
  const getDividerColor = () =>
    colorScheme === 'dark' ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)';

  const getLabelColor = () =>
    colorScheme === 'dark' ? 'gray.4' : 'dark';

  // Adjust search width based on viewport
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width <= 768) {
        setSearchWidth('120px');
      } else if (width <= 1024) {
        setSearchWidth('140px');
      } else {
        setSearchWidth('180px');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    <Card withBorder shadow="sm" p={{ base: 'sm', sm: 'md' }} mb="lg" className="no-print" style={{ width: '100%', boxSizing: 'border-box' }}>
      <Stack gap="md">
        {/* Compact Header with Filter Button */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'row', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '0.5rem',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            flex: '1 1 50%',
            minWidth: '0',
            overflow: 'hidden'
          }}>
            <ActionIcon
              variant={isExpanded ? 'filled' : 'light'}
              color={hasActiveFilters ? 'blue' : 'gray'}
              size="lg"
              onClick={() => setIsExpanded(!isExpanded)}
              style={{ flexShrink: 0 }}
            >
              <IconFilter size={18} />
            </ActionIcon>

            <div style={{ 
              flex: '1 1 auto',
              minWidth: '0',
              overflow: 'hidden'
            }}>
              <Group gap="xs" align="center" style={{ flexWrap: 'nowrap' }}>
                <Text size="md" fw={500} style={{ whiteSpace: 'nowrap' }}>
                  Filters & Search
                </Text>
                {hasActiveFilters && (
                  <Badge color="blue" variant="light" size="sm">
                    Active
                  </Badge>
                )}
              </Group>
              <Text size="xs" c="dimmed" style={{ 
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {filteredCount} of {totalCount} items
                {filterCount > 0 ? ` • ${filterCount} more filters` : ''}
              </Text>
            </div>

            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={() => setIsExpanded(!isExpanded)}
              style={{ flexShrink: 0 }}
            >
              {isExpanded ? (
                <IconChevronUp size={16} />
              ) : (
                <IconChevronDown size={16} />
              )}
            </ActionIcon>
          </div>

          <div style={{ 
            display: 'flex', 
            gap: '0.5rem', 
            flex: '0 1 auto',
            minWidth: '0'
          }}>
            {/* Always visible search - most commonly used */}
            {showSearch && (
              <TextInput
                placeholder={searchPlaceholder}
                value={filters.search || ''}
                onChange={e => updateFilter('search', e.target.value)}
                leftSection={<IconSearch size={16} />}
                size="sm"
                style={{ 
                  width: searchWidth,
                  minWidth: '100px',
                  maxWidth: searchWidth
                }}
              />
            )}

            {hasActiveFilters && (
              <Button
                variant="subtle"
                color="gray"
                size="sm"
                leftSection={<IconClearAll size={14} />}
                onClick={clearFilters}
                compact
                style={{ flexShrink: 0 }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Collapsible Filter Controls */}
        <Collapse in={isExpanded}>
          <Card
            withBorder
            p="sm"
            bg={colorScheme === 'dark' ? 'dark.7' : 'gray.0'}
            style={{ borderStyle: 'dashed' }}
          >
            <Stack gap="md">
              <Text
                size="sm"
                fw={500}
                c={colorScheme === 'dark' ? 'gray.3' : 'dimmed'}
              >
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

                {/* Sort Controls - Visually separated from filters */}
                {sortOptions && sortOptions.length > 1 && (
                  <>
                    <Box
                      style={{
                        height: '36px',
                        width: '1px',
                        backgroundColor: getDividerColor(),
                        margin: '0 8px',
                        alignSelf: 'center'
                      }}
                    />
                    <Text
                      size="sm"
                      fw={500}
                      c={getLabelColor()}
                      style={{
                        alignSelf: 'center',
                        whiteSpace: 'nowrap',
                        marginRight: '8px'
                      }}
                    >
                      Sort by:
                    </Text>
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
