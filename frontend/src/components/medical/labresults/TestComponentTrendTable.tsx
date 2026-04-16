/**
 * TestComponentTrendTable component
 * Displays historical trend data as a sortable table
 */

import React, { useMemo, useState } from 'react';
import {
  Table,
  Paper,
  Stack,
  Text,
  Badge,
  Group,
  ScrollArea,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowUp,
  IconArrowDown,
  IconArrowsSort,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import {
  TrendResponse,
  TrendDataPoint,
} from '../../../services/api/labTestComponentApi';
import {
  getQualitativeDisplayName,
  getQualitativeColor,
} from '../../../constants/labCategories';
import { useDateFormat } from '../../../hooks/useDateFormat';

interface TestComponentTrendTableProps {
  trendData: TrendResponse;
}

type SortField = 'date' | 'value' | 'status';
type SortOrder = 'asc' | 'desc';

const TestComponentTrendTable: React.FC<TestComponentTrendTableProps> = ({
  trendData,
}) => {
  const { t } = useTranslation(['labresults', 'shared']);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc'); // Most recent first by default
  const { formatDate: formatPreferredDate } = useDateFormat();

  const getStatusColor = (status: string | null | undefined): string => {
    if (!status) return 'gray';

    switch (status.toLowerCase()) {
      case 'normal':
        return 'green';
      case 'high':
      case 'low':
        return 'orange';
      case 'critical':
        return 'red';
      case 'abnormal':
      case 'borderline':
        return 'yellow';
      default:
        return 'gray';
    }
  };

  const formatDate = (point: TrendDataPoint): string => {
    const dateStr = point.recorded_date || point.created_at.split('T')[0];
    return formatPreferredDate(dateStr);
  };

  const formatReferenceRange = (point: TrendDataPoint): string => {
    const { ref_range_min, ref_range_max, ref_range_text } = point;

    if (ref_range_text) {
      return ref_range_text;
    }

    if (ref_range_min !== null && ref_range_max !== null) {
      return `${ref_range_min} - ${ref_range_max}`;
    }

    if (ref_range_min !== null) {
      return `≥ ${ref_range_min}`;
    }

    if (ref_range_max !== null) {
      return `≤ ${ref_range_max}`;
    }

    return 'Not specified';
  };

  const sortedData = useMemo(() => {
    const data = [...trendData.data_points];

    data.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'date': {
          const dateA = a.recorded_date || a.created_at;
          const dateB = b.recorded_date || b.created_at;
          comparison = dateA.localeCompare(dateB);
          break;
        }
        case 'value':
          // Handle qualitative: sort alphabetically by qualitative_value
          if (
            a.result_type === 'qualitative' ||
            b.result_type === 'qualitative'
          ) {
            const valA = a.qualitative_value || '';
            const valB = b.qualitative_value || '';
            comparison = valA.localeCompare(valB);
          } else {
            comparison = (a.value ?? 0) - (b.value ?? 0);
          }
          break;
        case 'status': {
          const statusA = a.status || '';
          const statusB = b.status || '';
          comparison = statusA.localeCompare(statusB);
          break;
        }
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return data;
  }, [trendData.data_points, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle order if same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to descending
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) {
      return <IconArrowsSort size={14} style={{ opacity: 0.5 }} />;
    }

    return sortOrder === 'asc' ? (
      <IconArrowUp size={14} />
    ) : (
      <IconArrowDown size={14} />
    );
  };

  if (trendData.data_points.length === 0) {
    return (
      <Paper withBorder p="xl" radius="md" bg="var(--color-bg-secondary)">
        <Text size="sm" c="dimmed" ta="center">
          {t('trendTable.noDataPoints')}
        </Text>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text size="sm" fw={600}>
          {t('trendTable.historicalData', {
            count: trendData.data_points.length,
          })}
        </Text>
        <Text size="xs" c="dimmed">
          {t('trendTable.clickToSort')}
        </Text>
      </Group>

      <Paper withBorder radius="md">
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>
                  <Group
                    gap="xs"
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleSort('date')}
                  >
                    <Text size="xs" fw={600}>
                      {t('shared:labels.date')}
                    </Text>
                    <SortIcon field="date" />
                  </Group>
                </Table.Th>
                <Table.Th>
                  <Group
                    gap="xs"
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleSort('value')}
                  >
                    <Text size="xs" fw={600}>
                      {t('shared:labels.value')}
                    </Text>
                    <SortIcon field="value" />
                  </Group>
                </Table.Th>
                <Table.Th>
                  <Text size="xs" fw={600}>
                    {t('labresults:testComponents.editModal.fields.unit')}
                  </Text>
                </Table.Th>
                <Table.Th>
                  <Group
                    gap="xs"
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleSort('status')}
                  >
                    <Text size="xs" fw={600}>
                      {t('shared:fields.status')}
                    </Text>
                    <SortIcon field="status" />
                  </Group>
                </Table.Th>
                <Table.Th>
                  <Text size="xs" fw={600}>
                    {t(
                      'labresults:testComponents.editModal.fields.referenceRange'
                    )}
                  </Text>
                </Table.Th>
                <Table.Th>
                  <Text size="xs" fw={600}>
                    {t('trendTable.labResult')}
                  </Text>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sortedData.map(point => (
                <Table.Tr key={point.id}>
                  <Table.Td>
                    <Text size="sm">{formatDate(point)}</Text>
                  </Table.Td>
                  <Table.Td>
                    {point.result_type === 'qualitative' &&
                    point.qualitative_value ? (
                      <Badge
                        size="sm"
                        variant="filled"
                        color={getQualitativeColor(point.qualitative_value)}
                      >
                        {getQualitativeDisplayName(point.qualitative_value)}
                      </Badge>
                    ) : (
                      <Text size="sm" fw={600}>
                        {point.value}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {point.result_type === 'qualitative' ? '-' : point.unit}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {point.status ? (
                      <Badge
                        size="sm"
                        variant="light"
                        color={getStatusColor(point.status)}
                      >
                        {point.status}
                      </Badge>
                    ) : (
                      <Text size="xs" c="dimmed">
                        -
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {point.result_type === 'qualitative'
                        ? '-'
                        : formatReferenceRange(point)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label={`Lab Result ID: ${point.lab_result.id}`}>
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {point.lab_result.test_name}
                      </Text>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </Stack>
  );
};

export default TestComponentTrendTable;
