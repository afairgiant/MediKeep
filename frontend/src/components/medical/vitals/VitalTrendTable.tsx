/**
 * VitalTrendTable component
 * Displays historical vital sign data in a sortable table format
 */

import React, { useState, useMemo } from 'react';
import {
  Table,
  Text,
  Paper,
  Group,
  UnstyledButton,
  Center,
  ScrollArea
} from '@mantine/core';
import { IconChevronUp, IconChevronDown, IconSelector } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { VitalTrendResponse, VitalDataPoint } from './types';

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
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
            {sortedData.map((point: VitalDataPoint) => (
              <Table.Tr key={point.id}>
                <Table.Td>
                  <Text size="sm">{formatDate(point.recorded_date)}</Text>
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
    </Paper>
  );
};

export default VitalTrendTable;
