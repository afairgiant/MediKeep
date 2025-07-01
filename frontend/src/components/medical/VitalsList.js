/**
 * VitalsList Component - Enhanced Version with Mantine UI
 * Displays a list of patient vital signs with options to edit/delete
 */

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  Table,
  Button,
  Group,
  Text,
  Stack,
  Alert,
  Loader,
  Center,
  ActionIcon,
  Badge,
  Paper,
  Box,
  Flex,
  UnstyledButton,
  rem,
} from '@mantine/core';
import {
  IconEdit,
  IconTrash,
  IconChevronUp,
  IconChevronDown,
  IconSelector,
  IconAlertTriangle,
  IconRefresh,
  IconActivity,
} from '@tabler/icons-react';
import { vitalsService } from '../../services/medical/vitalsService';
import {
  formatDate as formatDateHelper,
  formatDateTime,
} from '../../utils/helpers';

const VitalsList = ({
  patientId,
  onEdit,
  onDelete,
  onRefresh,
  vitalsData,
  loading,
  error,
  showActions = true,
  limit = 10,
}) => {
  // Use passed data if available, otherwise load internally
  const [internalVitals, setInternalVitals] = useState([]);
  const [internalLoading, setInternalLoading] = useState(true);
  const [internalError, setInternalError] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    key: 'recorded_date',
    direction: 'desc',
  });

  const loadVitals = useCallback(async () => {
    // Only load internally if no data is passed via props
    if (vitalsData !== undefined) return;

    try {
      setInternalLoading(true);
      setInternalError(null);
      let response;
      if (patientId) {
        response = await vitalsService.getPatientVitals(patientId, { limit });
      } else {
        response = await vitalsService.getVitals({ limit });
      }

      // Extract the data array from the response
      const data = response?.data || response;

      setInternalVitals(Array.isArray(data) ? data : []);
    } catch (err) {
      setInternalError(err.message || 'Failed to load vitals');
      setInternalVitals([]);
    } finally {
      setInternalLoading(false);
    }
  }, [patientId, limit, vitalsData]);

  useEffect(() => {
    loadVitals();
  }, [loadVitals]);

  useEffect(() => {
    if (onRefresh && vitalsData === undefined) {
      loadVitals();
    }
  }, [onRefresh, loadVitals, vitalsData]);

  // Use passed data or internal data
  const vitals = vitalsData !== undefined ? vitalsData : internalVitals;
  const isLoading = loading !== undefined ? loading : internalLoading;
  const currentError = error !== undefined ? error : internalError;

  const handleDelete = async vitalsId => {
    if (
      !window.confirm('Are you sure you want to delete this vitals record?')
    ) {
      return;
    }

    // If external delete handler is provided and we're using external data, use it
    if (onDelete && vitalsData !== undefined) {
      try {
        await onDelete(vitalsId);
      } catch (err) {
        // Error handling is done by the parent component
        console.error('Delete failed:', err);
      }
      return;
    }

    // Otherwise, handle deletion internally
    try {
      await vitalsService.deleteVitals(vitalsId);
      toast.success('Vitals record deleted successfully');
      loadVitals(); // Refresh the list
    } catch (err) {
      toast.error(
        err.response?.data?.detail || 'Failed to delete vitals record'
      );
    }
  };

  const formatDate = dateString => {
    return formatDateHelper(dateString);
  };

  const formatTime = dateString => {
    return formatDateTime(dateString);
  };

  const getBPDisplay = (systolic, diastolic) => {
    if (!systolic || !diastolic) return 'N/A';
    return `${systolic}/${diastolic}`;
  };

  const getBMIDisplay = (weight, height) => {
    if (!weight || !height) return 'N/A';
    const bmi = vitalsService.calculateBMI(weight, height);
    return bmi ? bmi.toString() : 'N/A';
  };

  const handleSort = key => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedVitals = () => {
    if (!sortConfig.key || !vitals) return vitals || [];
    if (!Array.isArray(vitals)) return [];

    return [...vitals].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle special sorting cases
      if (
        sortConfig.key === 'recorded_date' ||
        sortConfig.key === 'created_at'
      ) {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      } else if (sortConfig.key === 'bp') {
        // Sort by systolic blood pressure
        aValue = a.systolic_bp || 0;
        bValue = b.systolic_bp || 0;
      } else if (sortConfig.key === 'bmi') {
        // Calculate BMI for sorting
        aValue =
          a.weight && a.height
            ? vitalsService.calculateBMI(a.weight, a.height)
            : 0;
        bValue =
          b.weight && b.height
            ? vitalsService.calculateBMI(b.weight, b.height)
            : 0;
      }

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1;
      if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1;

      // Compare values
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const getSortIcon = columnKey => {
    if (sortConfig.key !== columnKey) {
      return <IconSelector size={14} />;
    }
    return sortConfig.direction === 'asc' ? (
      <IconChevronUp size={14} />
    ) : (
      <IconChevronDown size={14} />
    );
  };

  const ThComponent = ({ children, sorted, onSort }) => (
    <UnstyledButton
      onClick={onSort}
      style={{
        width: '100%',
        padding: rem(8),
        fontWeight: 500,
        fontSize: rem(14),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: 'var(--mantine-color-text)',
      }}
    >
      <Text fw={500} size="sm">
        {children}
      </Text>
      {getSortIcon(sorted)}
    </UnstyledButton>
  );

  const sortedVitals = getSortedVitals();

  if (isLoading) {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Loading vitals...</Text>
        </Stack>
      </Center>
    );
  }

  if (currentError) {
    return (
      <Alert
        variant="light"
        color="red"
        icon={<IconAlertTriangle size={16} />}
        title="Error Loading Vitals"
      >
        <Group justify="space-between" align="center">
          <Text size="sm">{currentError}</Text>
          <Button
            variant="light"
            size="xs"
            leftSection={<IconRefresh size={14} />}
            onClick={loadVitals}
          >
            Try Again
          </Button>
        </Group>
      </Alert>
    );
  }

  if (vitals.length === 0) {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <IconActivity
            size={48}
            stroke={1}
            color="var(--mantine-color-gray-5)"
          />
          <Stack align="center" gap="xs">
            <Text fw={500}>No vitals records found</Text>
            <Text c="dimmed" ta="center" size="sm">
              Vital signs will appear here once recorded
            </Text>
          </Stack>
        </Stack>
      </Center>
    );
  }

  const rows = sortedVitals.map(vital => (
    <Table.Tr key={vital.id}>
      <Table.Td>
        <Stack gap={2}>
          <Text size="sm" fw={500}>
            {formatDate(vital.recorded_date)}
          </Text>
          {vital.created_at && (
            <Text size="xs" c="dimmed">
              {formatTime(vital.created_at)}
            </Text>
          )}
        </Stack>
      </Table.Td>
      <Table.Td>
        <Text size="sm" fw={500}>
          {getBPDisplay(vital.systolic_bp, vital.diastolic_bp)}
        </Text>
      </Table.Td>
      <Table.Td>
        {vital.heart_rate ? (
          <Text size="sm" fw={500}>
            {vital.heart_rate} BPM
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            N/A
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {vital.temperature ? (
          <Text size="sm" fw={500}>
            {vital.temperature}°F
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            N/A
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {vital.weight ? (
          <Text size="sm" fw={500}>
            {vital.weight} lbs
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            N/A
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <Text size="sm" fw={500}>
          {getBMIDisplay(vital.weight, vital.height)}
        </Text>
      </Table.Td>
      <Table.Td>
        {vital.oxygen_saturation ? (
          <Text size="sm" fw={500}>
            {vital.oxygen_saturation}%
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            N/A
          </Text>
        )}
      </Table.Td>
      {showActions && (
        <Table.Td>
          <Group gap="xs">
            <ActionIcon
              variant="light"
              color="blue"
              size="sm"
              onClick={e => {
                e.stopPropagation();
                onEdit(vital);
              }}
              title="Edit vitals"
            >
              <IconEdit size={14} />
            </ActionIcon>
            <ActionIcon
              variant="light"
              color="red"
              size="sm"
              onClick={e => {
                e.stopPropagation();
                handleDelete(vital.id);
              }}
              title="Delete vitals"
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
        </Table.Td>
      )}
    </Table.Tr>
  ));

  return (
    <Stack gap="md">
      <Paper shadow="sm" withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>
                <ThComponent
                  sorted="recorded_date"
                  onSort={() => handleSort('recorded_date')}
                >
                  Date
                </ThComponent>
              </Table.Th>
              <Table.Th>
                <ThComponent sorted="bp" onSort={() => handleSort('bp')}>
                  Blood Pressure
                </ThComponent>
              </Table.Th>
              <Table.Th>
                <ThComponent
                  sorted="heart_rate"
                  onSort={() => handleSort('heart_rate')}
                >
                  Heart Rate
                </ThComponent>
              </Table.Th>
              <Table.Th>
                <ThComponent
                  sorted="temperature"
                  onSort={() => handleSort('temperature')}
                >
                  Temperature
                </ThComponent>
              </Table.Th>
              <Table.Th>
                <ThComponent
                  sorted="weight"
                  onSort={() => handleSort('weight')}
                >
                  Weight
                </ThComponent>
              </Table.Th>
              <Table.Th>
                <ThComponent sorted="bmi" onSort={() => handleSort('bmi')}>
                  BMI
                </ThComponent>
              </Table.Th>
              <Table.Th>
                <ThComponent
                  sorted="oxygen_saturation"
                  onSort={() => handleSort('oxygen_saturation')}
                >
                  O2 Sat
                </ThComponent>
              </Table.Th>
              {showActions && (
                <Table.Th>
                  <Text fw={500} size="sm">
                    Actions
                  </Text>
                </Table.Th>
              )}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows}</Table.Tbody>
        </Table>
      </Paper>

      {vitals.length >= limit && (
        <Center>
          <Button variant="light" onClick={loadVitals}>
            Load More
          </Button>
        </Center>
      )}
    </Stack>
  );
};

export default VitalsList;
