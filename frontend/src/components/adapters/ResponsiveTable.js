import React, { memo, useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { 
  Table as MantineTable, 
  ScrollArea, 
  Card, 
  Group, 
  Text, 
  Badge, 
  Stack, 
  Pagination,
  ActionIcon,
  rem,
  Box,
  Skeleton,
  Center
} from '@mantine/core';
import { IconSearch, IconSort, IconSortAscending, IconSortDescending } from '@tabler/icons-react';
import { useResponsive } from '../../hooks/useResponsive';
import { TableLayoutStrategy } from '../../strategies/TableLayoutStrategy';
import logger from '../../services/logger';

/**
 * ResponsiveTable Component
 * 
 * Enhanced Mantine Table component with responsive behavior optimized for medical data display.
 * Uses TableLayoutStrategy for intelligent responsive behavior based on screen size and data type.
 * 
 * Features:
 * - Mobile: Card view with priority-based field display
 * - Tablet: Horizontal scroll table with visible columns
 * - Desktop: Full table with all columns and features
 * - Column priority system (hide low priority on small screens)
 * - Virtual scrolling for large datasets
 * - Medical data type optimizations
 * - Accessibility: ARIA labels, keyboard navigation, screen reader support
 * - Performance: Memoized rendering, optimized re-renders
 */
export const ResponsiveTable = memo(({
  // Core data props
  data = [],
  columns = [],
  loading = false,
  error = null,
  
  // Table configuration
  dataType = 'general',
  displayStrategy,
  columnPriorities,
  
  // Sorting and filtering
  sortable = true,
  sortBy = null,
  sortDirection = 'asc',
  onSort,
  filterable = false,
  onFilter,
  
  // Pagination
  pagination = true,
  page = 1,
  pageSize = 20,
  totalRecords,
  onPageChange,
  
  // Selection
  selectable = false,
  selectedRows = [],
  onRowSelect,
  onRowsSelect,
  
  // Row actions
  onRowClick,
  onRowDoubleClick,
  
  // Styling and behavior
  className = '',
  size,
  variant = 'default',
  striped = true,
  highlightOnHover = true,
  withBorder = true,
  
  // Virtualization
  virtualization = 'auto',
  rowHeight,
  
  // Medical context specific
  medicalContext = 'general',
  showSecondaryInfo = true,
  compactCards = false,
  
  // Container props
  maxHeight,
  fullWidth = false,
  
  // Loading states
  loadingText = 'Loading data...',
  emptyText = 'No data available',
  errorText = 'Error loading data',
  
  // Accessibility
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  
  ...props
}) => {
  const { breakpoint, deviceType, isMobile, isTablet, isDesktop } = useResponsive();
  const [internalSortBy, setInternalSortBy] = useState(sortBy);
  const [internalSortDirection, setInternalSortDirection] = useState(sortDirection);
  const tableRef = useRef(null);
  const strategyRef = useRef(new TableLayoutStrategy());

  // Component logging context
  const componentContext = useMemo(() => ({
    component: 'ResponsiveTable',
    breakpoint,
    deviceType,
    dataType,
    medicalContext,
    recordCount: data.length,
    columnCount: columns.length
  }), [breakpoint, deviceType, dataType, medicalContext, data.length, columns.length]);

  // Log component mount and responsive changes
  useEffect(() => {
    logger.info('ResponsiveTable mounted', componentContext);
  }, []);

  useEffect(() => {
    logger.debug('ResponsiveTable breakpoint changed', {
      ...componentContext,
      previousBreakpoint: breakpoint
    });
  }, [breakpoint]);

  // Table layout strategy context
  const strategyContext = useMemo(() => ({
    dataType,
    rowCount: data.length,
    availableColumns: columns,
    totalColumns: columns.length,
    displayStrategy,
    customPriorities: columnPriorities,
    medical: true,
    healthcare: true,
    hasTableData: data.length > 0
  }), [dataType, data.length, columns, displayStrategy, columnPriorities]);

  // Get responsive table configuration
  const tableConfig = useMemo(() => {
    const strategy = strategyRef.current;
    const config = {
      displayStrategy: strategy.getDisplayStrategy(breakpoint, strategyContext),
      visibleColumns: strategy.getVisibleColumns(breakpoint, strategyContext),
      rowDensity: strategy.getRowDensity(breakpoint, strategyContext),
      container: strategy.getContainer(breakpoint, {
        ...strategyContext,
        maxHeight,
        fullWidth,
        enableVirtualization: virtualization === true || 
          (virtualization === 'auto' && strategy.shouldUseVirtualization(breakpoint, strategyContext))
      }),
      features: strategy.getTableFeatures(breakpoint, strategyContext),
      accessibility: strategy.getTableAccessibility(breakpoint, strategyContext),
      spacing: strategy.getSpacing(breakpoint, strategyContext)
    };

    logger.debug('Table configuration calculated', {
      ...componentContext,
      displayStrategy: config.displayStrategy,
      visibleColumnCount: config.visibleColumns.length,
      virtualized: config.container.virtualized
    });

    return config;
  }, [breakpoint, strategyContext, maxHeight, fullWidth, virtualization, componentContext]);

  // Process data for display
  const processedData = useMemo(() => {
    if (!data || !Array.isArray(data)) {
      logger.error('ResponsiveTable received invalid data', {
        ...componentContext,
        dataType: typeof data,
        isArray: Array.isArray(data)
      });
      return [];
    }

    let processed = [...data];

    // Apply sorting if enabled and data exists
    if (sortable && (internalSortBy || sortBy) && processed.length > 0) {
      const sortField = internalSortBy || sortBy;
      const direction = internalSortDirection || sortDirection;
      
      processed.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        
        let comparison = 0;
        if (aVal > bVal) comparison = 1;
        if (aVal < bVal) comparison = -1;
        
        return direction === 'desc' ? -comparison : comparison;
      });
    }

    return processed;
  }, [data, sortable, internalSortBy, sortBy, internalSortDirection, sortDirection, componentContext]);

  // Handle sort changes
  const handleSort = useCallback((columnKey) => {
    if (!sortable) return;

    const newDirection = internalSortBy === columnKey && internalSortDirection === 'asc' ? 'desc' : 'asc';
    
    setInternalSortBy(columnKey);
    setInternalSortDirection(newDirection);

    logger.info('Table sort changed', {
      ...componentContext,
      sortBy: columnKey,
      direction: newDirection,
      previousSort: internalSortBy
    });

    if (onSort) {
      onSort(columnKey, newDirection);
    }
  }, [sortable, internalSortBy, internalSortDirection, onSort, componentContext]);

  // Handle row selection
  const handleRowClick = useCallback((row, index, event) => {
    logger.debug('Table row clicked', {
      ...componentContext,
      rowIndex: index,
      hasRowData: !!row
    });

    if (onRowClick) {
      onRowClick(row, index, event);
    }

    if (selectable && onRowSelect) {
      onRowSelect(row, !selectedRows.includes(row.id || index));
    }
  }, [onRowClick, selectable, onRowSelect, selectedRows, componentContext]);

  // Handle pagination
  const handlePageChange = useCallback((newPage) => {
    logger.info('Table page changed', {
      ...componentContext,
      newPage,
      previousPage: page,
      pageSize
    });

    if (onPageChange) {
      onPageChange(newPage);
    }
  }, [onPageChange, page, pageSize, componentContext]);

  // Render table headers
  const renderTableHeader = useCallback(() => {
    const visibleColumns = tableConfig.visibleColumns;
    
    return (
      <MantineTable.Thead>
        <MantineTable.Tr>
          {visibleColumns.map((column) => {
            const columnKey = column.key || column.dataIndex || column.name;
            const isSorted = internalSortBy === columnKey;
            
            return (
              <MantineTable.Th 
                key={columnKey}
                onClick={sortable ? () => handleSort(columnKey) : undefined}
                style={{ 
                  cursor: sortable ? 'pointer' : 'default',
                  userSelect: 'none'
                }}
                aria-sort={
                  isSorted ? (internalSortDirection === 'asc' ? 'ascending' : 'descending') : 'none'
                }
              >
                <Group gap="xs" wrap="nowrap">
                  <Text fw={500} size={size}>
                    {column.title || column.label || columnKey}
                  </Text>
                  {sortable && (
                    <ActionIcon 
                      variant="transparent"
                      size="xs"
                      c={isSorted ? 'blue' : 'gray'}
                    >
                      {isSorted ? (
                        internalSortDirection === 'asc' ? 
                          <IconSortAscending size={rem(12)} /> : 
                          <IconSortDescending size={rem(12)} />
                      ) : (
                        <IconSort size={rem(12)} />
                      )}
                    </ActionIcon>
                  )}
                </Group>
              </MantineTable.Th>
            );
          })}
        </MantineTable.Tr>
      </MantineTable.Thead>
    );
  }, [tableConfig.visibleColumns, internalSortBy, internalSortDirection, sortable, handleSort, size]);

  // Render table rows
  const renderTableRows = useCallback(() => {
    const visibleColumns = tableConfig.visibleColumns;
    
    return (
      <MantineTable.Tbody>
        {processedData.map((row, index) => {
          const rowKey = row.id || row.key || index;
          const isSelected = selectedRows.includes(rowKey);
          
          return (
            <MantineTable.Tr
              key={rowKey}
              onClick={(event) => handleRowClick(row, index, event)}
              onDoubleClick={onRowDoubleClick ? (event) => onRowDoubleClick(row, index, event) : undefined}
              style={{
                cursor: onRowClick || selectable ? 'pointer' : 'default',
                backgroundColor: isSelected ? 'var(--mantine-color-blue-0)' : undefined
              }}
              data-selected={isSelected}
            >
              {visibleColumns.map((column) => {
                const columnKey = column.key || column.dataIndex || column.name;
                const cellValue = row[columnKey];
                
                return (
                  <MantineTable.Td key={columnKey}>
                    {column.render ? column.render(cellValue, row, index) : cellValue}
                  </MantineTable.Td>
                );
              })}
            </MantineTable.Tr>
          );
        })}
      </MantineTable.Tbody>
    );
  }, [processedData, tableConfig.visibleColumns, selectedRows, handleRowClick, onRowDoubleClick]);

  // Render card layout for mobile
  const renderCards = useCallback(() => {
    const cardConfig = strategyRef.current.getCardFieldConfig(breakpoint, strategyContext);
    const { displayFields, compactMode } = cardConfig;
    
    return (
      <Stack gap={tableConfig.spacing}>
        {processedData.map((row, index) => {
          const rowKey = row.id || row.key || index;
          const isSelected = selectedRows.includes(rowKey);
          
          return (
            <Card
              key={rowKey}
              withBorder={withBorder}
              shadow="xs"
              p={compactMode ? "xs" : "sm"}
              onClick={(event) => handleRowClick(row, index, event)}
              style={{ 
                cursor: onRowClick || selectable ? 'pointer' : 'default',
                borderColor: isSelected ? 'var(--mantine-color-blue-6)' : undefined
              }}
              data-selected={isSelected}
            >
              <Stack gap={compactMode ? "xs" : "sm"}>
                {displayFields.map((field, fieldIndex) => {
                  const fieldKey = field.key || field.dataIndex || field.name;
                  const fieldValue = row[fieldKey];
                  const isImportant = fieldIndex < 2; // First two fields are most important
                  
                  return (
                    <Group key={fieldKey} justify="space-between" wrap="nowrap">
                      <Text 
                        size={compactMode ? "xs" : "sm"} 
                        c="dimmed"
                        fw={isImportant ? 600 : 500}
                      >
                        {field.title || field.label || fieldKey}
                      </Text>
                      <Text 
                        size={compactMode ? "sm" : "md"} 
                        fw={isImportant ? 600 : 400}
                        ta="right"
                      >
                        {field.render ? field.render(fieldValue, row, index) : fieldValue}
                      </Text>
                    </Group>
                  );
                })}
                
                {showSecondaryInfo && !compactMode && displayFields.length < columns.length && (
                  <Text size="xs" c="dimmed">
                    +{columns.length - displayFields.length} more field{columns.length - displayFields.length !== 1 ? 's' : ''}
                  </Text>
                )}
              </Stack>
            </Card>
          );
        })}
      </Stack>
    );
  }, [processedData, breakpoint, strategyContext, tableConfig.spacing, selectedRows, handleRowClick, 
      withBorder, onRowClick, selectable, showSecondaryInfo, columns.length]);

  // Render loading state
  const renderLoading = useCallback(() => {
    if (tableConfig.displayStrategy === 'cards') {
      return (
        <Stack gap={tableConfig.spacing}>
          {Array.from({ length: 5 }).map((_, index) => (
            <Card key={index} withBorder p="sm">
              <Stack gap="sm">
                <Skeleton height={20} width="40%" />
                <Skeleton height={16} />
                <Skeleton height={16} width="60%" />
              </Stack>
            </Card>
          ))}
        </Stack>
      );
    }

    return (
      <MantineTable>
        <MantineTable.Thead>
          <MantineTable.Tr>
            {tableConfig.visibleColumns.map((column, index) => (
              <MantineTable.Th key={index}>
                <Skeleton height={20} width="80%" />
              </MantineTable.Th>
            ))}
          </MantineTable.Tr>
        </MantineTable.Thead>
        <MantineTable.Tbody>
          {Array.from({ length: 5 }).map((_, rowIndex) => (
            <MantineTable.Tr key={rowIndex}>
              {tableConfig.visibleColumns.map((_, colIndex) => (
                <MantineTable.Td key={colIndex}>
                  <Skeleton height={16} />
                </MantineTable.Td>
              ))}
            </MantineTable.Tr>
          ))}
        </MantineTable.Tbody>
      </MantineTable>
    );
  }, [tableConfig.displayStrategy, tableConfig.spacing, tableConfig.visibleColumns]);

  // Render empty state
  const renderEmpty = useCallback(() => {
    return (
      <Center p="xl">
        <Text c="dimmed" ta="center">
          {emptyText}
        </Text>
      </Center>
    );
  }, [emptyText]);

  // Render error state
  const renderError = useCallback(() => {
    return (
      <Center p="xl">
        <Text c="red" ta="center">
          {error?.message || errorText}
        </Text>
      </Center>
    );
  }, [error, errorText]);

  // Render pagination if enabled
  const renderPagination = useCallback(() => {
    if (!pagination || !totalRecords || totalRecords <= pageSize) {
      return null;
    }

    const paginationType = tableConfig.features.pagination;
    const totalPages = Math.ceil(totalRecords / pageSize);

    return (
      <Group justify="center" mt="md">
        <Pagination
          total={totalPages}
          value={page}
          onChange={handlePageChange}
          size={paginationType === 'simple' ? 'sm' : 'md'}
          withControls={paginationType === 'full'}
          withEdges={paginationType === 'full'}
          siblings={paginationType === 'simple' ? 0 : 1}
        />
      </Group>
    );
  }, [pagination, totalRecords, pageSize, tableConfig.features.pagination, page, handlePageChange]);

  // Enhanced accessibility props
  const accessibilityProps = useMemo(() => ({
    'aria-label': ariaLabel || tableConfig.accessibility.tableLabel || `${medicalContext} data table`,
    'aria-labelledby': ariaLabelledBy,
    'aria-rowcount': processedData.length,
    'aria-colcount': tableConfig.visibleColumns.length,
    role: 'table'
  }), [ariaLabel, tableConfig.accessibility.tableLabel, medicalContext, ariaLabelledBy, 
      processedData.length, tableConfig.visibleColumns.length]);

  // Error handling for malformed data
  if (error) {
    logger.error('ResponsiveTable error state', {
      ...componentContext,
      error: error.message || error
    });
    return renderError();
  }

  if (loading) {
    return renderLoading();
  }

  if (!processedData.length) {
    return renderEmpty();
  }

  // Render based on display strategy
  const tableContent = tableConfig.displayStrategy === 'cards' ? 
    renderCards() : (
      <MantineTable
        size={size}
        variant={variant}
        striped={striped}
        highlightOnHover={highlightOnHover}
        withTableBorder={withBorder}
        withColumnBorders={tableConfig.features.resizable}
        stickyHeader={tableConfig.features.stickyHeader}
        {...accessibilityProps}
        {...props}
      >
        {renderTableHeader()}
        {renderTableRows()}
      </MantineTable>
    );

  // Wrap with ScrollArea if needed
  const wrappedContent = tableConfig.container.scrollable ? (
    <ScrollArea
      h={tableConfig.container.maxHeight}
      scrollbarSize={8}
      {...tableConfig.container.scrollAreaProps}
    >
      {tableContent}
    </ScrollArea>
  ) : (
    <Box 
      ref={tableRef} 
      mah={tableConfig.container.maxHeight}
      style={{ overflow: 'auto' }}
    >
      {tableContent}
    </Box>
  );

  return (
    <Box className={className}>
      {wrappedContent}
      {renderPagination()}
    </Box>
  );
});

ResponsiveTable.displayName = 'ResponsiveTable';

export default ResponsiveTable;