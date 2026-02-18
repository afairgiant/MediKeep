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
import { IconSearch, IconArrowsSort, IconSortAscending, IconSortDescending, IconEye, IconEdit, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useResponsive } from '../../hooks/useResponsive';
import { TableLayoutStrategy } from '../../strategies/TableLayoutStrategy';
import logger from '../../services/logger';
import { getColumnKey, getColumnDisplayName } from '../../utils/columnHelpers';

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
  onView,
  onEdit,
  onDelete,
  
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
  
  // Data formatting
  formatters = {},
  
  // Container props
  maxHeight,
  fullWidth = false,
  
  // Loading states
  loadingText = 'Loading data...',
  emptyText = 'No data available',
  errorText = 'Error loading data',
  
  // Sort persistence
  persistKey,

  // Accessibility
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,

  ...props
}) => {
  const { breakpoint, deviceType, isMobile, isTablet, isDesktop } = useResponsive();
  const { t } = useTranslation('common');
  const hasActions = Boolean(onView || onEdit || onDelete);

  // Restore persisted sort state from localStorage when persistKey is provided
  const persistedSort = useMemo(() => {
    if (!persistKey) return null;
    try {
      const stored = localStorage.getItem(`medikeep_sort_${persistKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.sortBy === 'string' &&
            (parsed.sortDirection === 'asc' || parsed.sortDirection === 'desc')) {
          return parsed;
        }
      }
    } catch {
      // Corrupted data - fall through to default
    }
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only read on mount
  const [internalSortBy, setInternalSortBy] = useState(persistedSort?.sortBy ?? sortBy);
  const [internalSortDirection, setInternalSortDirection] = useState(persistedSort?.sortDirection ?? sortDirection);

  const tableRef = useRef(null);
  const strategyRef = useRef(new TableLayoutStrategy());

  // Persist sort state to localStorage when it changes
  useEffect(() => {
    if (persistKey) {
      try {
        if (internalSortBy) {
          localStorage.setItem(
            `medikeep_sort_${persistKey}`,
            JSON.stringify({ sortBy: internalSortBy, sortDirection: internalSortDirection })
          );
        } else {
          localStorage.removeItem(`medikeep_sort_${persistKey}`);
        }
      } catch {
        // Storage full or unavailable - silently ignore
      }
    }
  }, [persistKey, internalSortBy, internalSortDirection]);

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

  // Log component mount only (reduced logging for performance)
  useEffect(() => {
    logger.debug('ResponsiveTable mounted', componentContext);
  }, []);

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

    // Removed frequent configuration logging for performance

    return config;
  }, [breakpoint, strategyContext, maxHeight, fullWidth, virtualization, componentContext]);

  // Get print-specific table configuration (always use desktop/xl settings)
  const printTableConfig = useMemo(() => {
    const strategy = strategyRef.current;
    const printBreakpoint = 'xl'; // Force desktop layout for print
    const config = {
      displayStrategy: 'full_table', // Force full table for print
      visibleColumns: columns, // Show all columns for print
      rowDensity: strategy.getRowDensity(printBreakpoint, strategyContext),
      container: strategy.getContainer(printBreakpoint, {
        ...strategyContext,
        maxHeight: undefined, // Remove height restrictions for print
        fullWidth: true,
        enableVirtualization: false // Disable virtualization for print
      }),
      features: strategy.getTableFeatures(printBreakpoint, strategyContext),
      accessibility: strategy.getTableAccessibility(printBreakpoint, strategyContext),
      spacing: strategy.getSpacing(printBreakpoint, strategyContext)
    };

    return config;
  }, [strategyContext, columns]);

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

    // Removed frequent sort logging for performance

    if (onSort) {
      onSort(columnKey, newDirection);
    }
  }, [sortable, internalSortBy, internalSortDirection, onSort, componentContext]);

  // Handle row selection
  const handleRowClick = useCallback((row, index, event) => {
    // Removed frequent row click logging for performance

    if (onRowClick) {
      onRowClick(row, index, event);
    }

    if (selectable && onRowSelect) {
      onRowSelect(row, !selectedRows.includes(row.id || index));
    }
  }, [onRowClick, selectable, onRowSelect, selectedRows, componentContext]);

  // Handle pagination
  const handlePageChange = useCallback((newPage) => {
    // Removed frequent page change logging for performance

    if (onPageChange) {
      onPageChange(newPage);
    }
  }, [onPageChange, page, pageSize, componentContext]);

  // Render action buttons for a row
  const renderActionButtons = useCallback((row, compact = false) => {
    if (!hasActions) return null;
    const iconSize = isMobile ? 14 : 16;
    const buttonSize = compact ? 'sm' : 'md';

    return (
      <Group
        gap={compact ? 4 : 6}
        wrap="nowrap"
        justify="center"
        onClick={(e) => e.stopPropagation()}
      >
        {onView && (
          <ActionIcon
            variant="subtle"
            color="blue"
            size={buttonSize}
            onClick={() => onView(row)}
            aria-label={t('buttons.view')}
          >
            <IconEye size={iconSize} />
          </ActionIcon>
        )}
        {onEdit && (
          <ActionIcon
            variant="subtle"
            color="yellow"
            size={buttonSize}
            onClick={() => onEdit(row)}
            aria-label={t('buttons.edit')}
          >
            <IconEdit size={iconSize} />
          </ActionIcon>
        )}
        {onDelete && row.id != null && (
          <ActionIcon
            variant="subtle"
            color="red"
            size={buttonSize}
            onClick={() => onDelete(row.id)}
            aria-label={t('buttons.delete')}
          >
            <IconTrash size={iconSize} />
          </ActionIcon>
        )}
      </Group>
    );
  }, [hasActions, isMobile, onView, onEdit, onDelete, t]);

  // Render table headers
  const renderTableHeader = useCallback(() => {
    const visibleColumns = tableConfig.visibleColumns;
    
    return (
      <MantineTable.Thead>
        <MantineTable.Tr>
          {visibleColumns.map((column) => {
            const columnKey = column.key || column.dataIndex || column.name || column.accessor;
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
                    {column.title || column.label || column.header || columnKey}
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
                        <IconArrowsSort size={rem(12)} />
                      )}
                    </ActionIcon>
                  )}
                </Group>
              </MantineTable.Th>
            );
          })}
          {hasActions && (
            <MantineTable.Th className="no-print" style={{ width: 120, textAlign: 'center' }}>
              <Text fw={500} size={size}>
                {t('labels.actions', 'Actions')}
              </Text>
            </MantineTable.Th>
          )}
        </MantineTable.Tr>
      </MantineTable.Thead>
    );
  }, [tableConfig.visibleColumns, internalSortBy, internalSortDirection, sortable, handleSort, size, hasActions, t]);

  // Render table rows
  const renderTableRows = useCallback(() => {
    const visibleColumns = tableConfig.visibleColumns;
    
    return (
      <MantineTable.Tbody>
        {processedData.map((row, index) => {
          const rowKey = row.id || row.key || index;
          const isSelected = selectedRows.includes(rowKey);
          
          // Check if row is inactive/stopped/finished/completed/on-hold (for medical context)
          const isInactive = medicalContext !== 'general' &&
            ['inactive', 'stopped', 'completed', 'cancelled', 'on-hold'].includes(row.status?.toLowerCase());

          return (
            <MantineTable.Tr
              key={rowKey}
              onClick={(event) => handleRowClick(row, index, event)}
              onDoubleClick={onRowDoubleClick ? (event) => onRowDoubleClick(row, index, event) : undefined}
              style={{
                cursor: onRowClick || selectable ? 'pointer' : 'default',
                backgroundColor: isSelected ? 'var(--mantine-color-blue-0)' : undefined,
                borderLeft: isInactive
                  ? '4px solid var(--mantine-color-red-6)'
                  : '4px solid var(--mantine-color-green-6)'
              }}
              data-selected={isSelected}
              data-inactive={isInactive}
            >
              {visibleColumns.map((column) => {
                const columnKey = column.key || column.dataIndex || column.name || column.accessor;
                const cellValue = row[columnKey];
                
                // Use formatters first, fallback to column.render, then raw value
                let formattedValue = cellValue;
                if (formatters?.[columnKey]) {
                  formattedValue = formatters[columnKey](cellValue, row);
                } else if (column.render) {
                  formattedValue = column.render(cellValue, row, index);
                }
                
                return (
                  <MantineTable.Td key={columnKey}>
                    {typeof formattedValue === 'string' || typeof formattedValue === 'number' ? (
                      <Text size="xs">{formattedValue}</Text>
                    ) : (
                      formattedValue
                    )}
                  </MantineTable.Td>
                );
              })}
              {hasActions && (
                <MantineTable.Td className="no-print">
                  {renderActionButtons(row)}
                </MantineTable.Td>
              )}
            </MantineTable.Tr>
          );
        })}
      </MantineTable.Tbody>
    );
  }, [processedData, tableConfig.visibleColumns, selectedRows, handleRowClick, onRowDoubleClick, hasActions, renderActionButtons]);

  // Render card layout for mobile
  const renderCards = useCallback(() => {
    const cardConfig = strategyRef.current.getCardFieldConfig(breakpoint, strategyContext);
    const { displayFields, compactMode } = cardConfig;
    
    return (
      <Stack gap={tableConfig.spacing}>
        {processedData.map((row, index) => {
          const rowKey = row.id || row.key || index;
          const isSelected = selectedRows.includes(rowKey);

          // Check if row is inactive/stopped/finished/completed/on-hold (for medical context)
          const isInactive = medicalContext !== 'general' &&
            ['inactive', 'stopped', 'completed', 'cancelled', 'on-hold'].includes(row.status?.toLowerCase());

          return (
            <Card
              key={rowKey}
              withBorder={withBorder}
              shadow="xs"
              p={compactMode ? "xs" : "sm"}
              onClick={(event) => handleRowClick(row, index, event)}
              style={{
                cursor: onRowClick || selectable ? 'pointer' : 'default',
                borderColor: isSelected ? 'var(--mantine-color-blue-6)' : undefined,
                borderLeft: isInactive
                  ? '4px solid var(--mantine-color-red-6)'
                  : '4px solid var(--mantine-color-green-6)'
              }}
              data-selected={isSelected}
              data-inactive={isInactive}
            >
              <Stack gap={compactMode ? "xs" : "sm"}>
                {displayFields.map((field, fieldIndex) => {
                  const fieldKey = field.key || field.dataIndex || field.name || field.accessor;
                  const fieldValue = row[fieldKey];
                  const isImportant = fieldIndex < 2; // First two fields are most important
                  
                  return (
                    <Group key={fieldKey} justify="space-between" wrap="nowrap">
                      <Text 
                        size={compactMode ? "xs" : "sm"} 
                        c="dimmed"
                        fw={isImportant ? 600 : 500}
                      >
                        {field.title || field.label || field.header || fieldKey}
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
                {hasActions && (
                  <Group justify="flex-end" mt={4}>
                    {renderActionButtons(row, true)}
                  </Group>
                )}
              </Stack>
            </Card>
          );
        })}
      </Stack>
    );
  }, [processedData, breakpoint, strategyContext, tableConfig.spacing, selectedRows, handleRowClick,
      withBorder, onRowClick, selectable, showSecondaryInfo, columns.length, hasActions, renderActionButtons]);

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
            {hasActions && (
              <MantineTable.Th>
                <Skeleton height={20} width="60%" />
              </MantineTable.Th>
            )}
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
              {hasActions && (
                <MantineTable.Td>
                  <Skeleton height={16} width="60%" />
                </MantineTable.Td>
              )}
            </MantineTable.Tr>
          ))}
        </MantineTable.Tbody>
      </MantineTable>
    );
  }, [tableConfig.displayStrategy, tableConfig.spacing, tableConfig.visibleColumns, hasActions]);

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
    'aria-colcount': tableConfig.visibleColumns.length + (hasActions ? 1 : 0),
    role: 'table'
  }), [ariaLabel, tableConfig.accessibility.tableLabel, medicalContext, ariaLabelledBy,
      processedData.length, tableConfig.visibleColumns.length, hasActions]);

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

  // Screen table view - uses regular responsive config
  const screenTableView = tableConfig.displayStrategy !== 'cards' ? (
    <MantineTable
      className="medical-responsive-table screen-and-print"
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
  ) : null;

  // Print table view - always uses desktop/full table config with all columns
  const printTableView = (
    <MantineTable
      className="medical-responsive-table print-only"
      size={size}
      variant={variant}
      striped={striped}
      highlightOnHover={false} // Disable hover for print
      withTableBorder={withBorder}
      withColumnBorders={false} // Simplify borders for print
      stickyHeader={false} // Disable sticky header for print
      style={{ display: 'none' }} // Hidden on screen, shown via CSS in print
      {...accessibilityProps}
      {...props}
    >
      {/* Render header with print config (all columns) */}
      <MantineTable.Thead>
        <MantineTable.Tr>
          {printTableConfig.visibleColumns.map((column, index) => {
            const columnKey = getColumnKey(column);
            const displayName = getColumnDisplayName(column);
            return (
              <MantineTable.Th key={columnKey || index}>
                <Text size="xs" fw={600}>
                  {displayName}
                </Text>
              </MantineTable.Th>
            );
          })}
        </MantineTable.Tr>
      </MantineTable.Thead>
      {/* Render rows with print config (all columns) */}
      <MantineTable.Tbody>
        {processedData.map((row, rowIndex) => {
          // Check if row is inactive/stopped/finished/completed/on-hold (for medical context)
          const isInactive = medicalContext !== 'general' &&
            ['inactive', 'stopped', 'completed', 'cancelled', 'on-hold'].includes(row.status?.toLowerCase());

          return (
            <MantineTable.Tr
              key={row.id || rowIndex}
              style={{
                borderLeft: isInactive
                  ? '4px solid var(--mantine-color-red-6)'
                  : '4px solid var(--mantine-color-green-6)'
              }}
              data-inactive={isInactive}
            >
              {printTableConfig.visibleColumns.map((column, colIndex) => {
              const columnKey = getColumnKey(column);
              const cellValue = row[columnKey];
              const formatter = formatters?.[columnKey];
              const formattedValue = formatter ? formatter(cellValue, row) : (cellValue?.toString() || '');

                return (
                  <MantineTable.Td key={columnKey || colIndex}>
                    <Text size="xs">
                      {typeof formattedValue === 'string' || typeof formattedValue === 'number' ? (
                        formattedValue
                      ) : (
                        formattedValue
                      )}
                    </Text>
                  </MantineTable.Td>
                );
              })}
            </MantineTable.Tr>
          );
        })}
      </MantineTable.Tbody>
    </MantineTable>
  );

  // Cards view for mobile/tablet
  const cardsView = tableConfig.displayStrategy === 'cards' ? (
    <Box className="medical-responsive-cards screen-only">
      {renderCards()}
    </Box>
  ) : null;

  // Render all views - cards for mobile screen, screen table for desktop screen, print table for print
  const content = (
    <>
      {cardsView}
      {screenTableView}
      {printTableView}
    </>
  );

  // Wrap with ScrollArea if needed for table view only
  const wrappedContent = tableConfig.container.scrollable ? (
    <ScrollArea
      h={tableConfig.container.maxHeight}
      scrollbarSize={8}
      {...tableConfig.container.scrollAreaProps}
    >
      {content}
    </ScrollArea>
  ) : (
    <Box 
      ref={tableRef} 
      mah={tableConfig.container.maxHeight}
      style={{ overflow: 'auto' }}
    >
      {content}
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