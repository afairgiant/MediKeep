/**
 * VitalTrendTable component
 * Displays historical vital sign data in a sortable table format
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Table,
  Text,
  Paper,
  Group,
  UnstyledButton,
  Center,
  ScrollArea,
  Stack,
  Pagination,
  Select,
} from '@mantine/core';
import { IconChevronUp, IconChevronDown, IconSelector } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { VitalTrendResponse, VitalDataPoint } from './types';
import { useDateFormat } from '../../../hooks/useDateFormat';

interface VitalTrendTableProps {
  trendData: VitalTrendResponse;
}

type SortField = 'date' | 'value';
type SortDirection = 'asc' | 'desc';

interface ThProps {
  children: React.ReactNode;
  sorted: boolean;
  reversed: boolean;
  onSort: () => void;
}

// Pagination constants
const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10' },
  { value: '20', label: '20' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
];
const DEFAULT_PAGE_SIZE = 20;
const VALID_PAGE_SIZES = [10, 20, 25, 50];

function Th({ children, sorted, reversed, onSort }: ThProps) {
  const Icon = sorted ? (reversed ? IconChevronUp : IconChevronDown) : IconSelector;

  return (
    <Table.Th style={{ width: 'auto' }}>
      <UnstyledButton onClick={onSort} style={{ width: '100%' }}>
        <Group justify="space-between" gap="xs">
          <Text fw={500} size="sm">
            {children}
          </Text>
          <Center>
            <Icon size={14} stroke={1.5} />
          </Center>
        </Group>
      </UnstyledButton>
    </Table.Th>
  );
}

const VitalTrendTable: React.FC<VitalTrendTableProps> = ({ trendData }) => {
  const { t } = useTranslation('common');
  const { formatLongDate } = useDateFormat();
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedData = useMemo(() => {
    const data = [...trendData.data_points];

    data.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'date':
          comparison = new Date(a.recorded_date).getTime() - new Date(b.recorded_date).getTime();
          break;
        case 'value':
          comparison = a.value - b.value;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return data;
  }, [trendData.data_points, sortField, sortDirection]);

  // Calculate pagination values
  const totalRecords = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalRecords);

  // Paginated data
  const paginatedData = useMemo(() => {
    return sortedData.slice(startIndex, endIndex);
  }, [sortedData, startIndex, endIndex]);

  // Reset to page 1 when sort or data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sortField, sortDirection, trendData.data_points]);

  // Ensure currentPage stays valid when data changes
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handlePageSizeChange = (value: string | null) => {
    if (value === null) return;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || !VALID_PAGE_SIZES.includes(numericValue)) return;
    setPageSize(numericValue);
    setCurrentPage(1);
  };

  if (trendData.data_points.length === 0) {
    return (
      <Paper withBorder p="xl" radius="md" bg="gray.0">
        <Text size="sm" c="dimmed" ta="center">
          {t('vitals.trends.noDataPoints', 'No data points to display')}
        </Text>
      </Paper>
    );
  }

  return (
    <Paper withBorder radius="md">
      <ScrollArea>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Th
                sorted={sortField === 'date'}
                reversed={sortDirection === 'asc'}
                onSort={() => handleSort('date')}
              >
                {t('labels.date', 'Date')}
              </Th>
              <Th
                sorted={sortField === 'value'}
                reversed={sortDirection === 'asc'}
                onSort={() => handleSort('value')}
              >
                {t('labels.value', 'Value')}
              </Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {paginatedData.map((point: VitalDataPoint) => (
              <Table.Tr key={point.id}>
                <Table.Td>
                  <Text size="sm">{formatLongDate(point.recorded_date)}</Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Text size="sm" fw={500}>
                      {point.value}
                      {point.secondary_value !== undefined && point.secondary_value !== null && (
                        <Text span c="dimmed">/{point.secondary_value}</Text>
                      )}
                    </Text>
                    <Text size="xs" c="dimmed">{trendData.unit}</Text>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      {/* Pagination Controls */}
      {totalRecords > 0 && (
        <Group justify={totalPages > 1 ? 'space-between' : 'flex-end'} align="center" mt="md" px="md" pb="md">
          {/* Left: Record count (only show when multiple pages) */}
          {totalPages > 1 && (
            <Text size="sm" c="dimmed">
              {t('pagination.showingRange', 'Showing {{start}} to {{end}} of {{total}} results', {
                start: startIndex + 1,
                end: endIndex,
                total: totalRecords,
              })}
            </Text>
          )}

          {/* Center: Page navigation */}
          {totalPages > 1 && (
            <Pagination
              total={totalPages}
              value={currentPage}
              onChange={setCurrentPage}
              size="sm"
              withEdges
              siblings={1}
              boundaries={1}
            />
          )}

          {/* Right: Page size selector */}
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              {t('pagination.itemsPerPage', 'Items per page')}:
            </Text>
            <Select
              value={String(pageSize)}
              onChange={handlePageSizeChange}
              data={PAGE_SIZE_OPTIONS}
              size="xs"
              w={70}
              allowDeselect={false}
              aria-label={t('pagination.itemsPerPage', 'Items per page')}
              comboboxProps={{ withinPortal: true, zIndex: 3000 }}
            />
          </Group>
        </Group>
      )}
    </Paper>
  );
};

export default VitalTrendTable;
