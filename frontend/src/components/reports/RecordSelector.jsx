import React from 'react';
import {
  Stack,
  Paper,
  Group,
  Text,
  Badge,
  Button,
  Switch,
  Alert,
} from '@mantine/core';
import { useDateFormat } from '../../hooks/useDateFormat';

/**
 * RecordSelector Component
 * 
 * Displays and manages selection of records within a category
 * Follows existing patterns from medical components
 */
const RecordSelector = ({
  category,
  categoryData,
  selectedRecords = {},
  onToggleRecord,
  onToggleCategory,
  categoryDisplayName,
}) => {
  const { formatDate } = useDateFormat();

  if (!categoryData || !categoryData.records) {
    return (
      <Paper p="md" withBorder radius="md">
        <Text c="dimmed" ta="center">No records available</Text>
      </Paper>
    );
  }

  const allSelected = categoryData.records.every(record => selectedRecords[record.id]);
  const selectedCount = categoryData.records.filter(record => selectedRecords[record.id]).length;

  return (
    <Stack gap="sm">
      {/* Category header with select all */}
      <Paper p="md" withBorder radius="md" bg="gray.0">
        <Group justify="space-between">
          <Group>
            <Text fw={500} size="lg">{categoryDisplayName}</Text>
            <Badge color="blue" variant="light">
              {categoryData.count} total
            </Badge>
            {selectedCount > 0 && (
              <Badge color="green" variant="light">
                {selectedCount} selected
              </Badge>
            )}
          </Group>
          <Button
            size="sm"
            variant={allSelected ? "filled" : "outline"}
            color={allSelected ? "red" : "blue"}
            onClick={() => onToggleCategory(category, categoryData.records)}
          >
            {allSelected ? 'Deselect Tab' : 'Select Tab'}
          </Button>
        </Group>
      </Paper>

      {/* Records list */}
      <Stack gap="xs">
        {categoryData.records.map((record) => (
          <RecordItem
            key={record.id}
            record={record}
            selected={!!selectedRecords[record.id]}
            onToggle={() => onToggleRecord(category, record.id, record)}
          />
        ))}
      </Stack>

      {/* Has more indicator */}
      {categoryData.has_more && (
        <Alert color="blue" variant="light">
          <Text size="sm">
            Showing first {categoryData.records.length} records. 
            More records are available but not displayed for performance.
          </Text>
        </Alert>
      )}
    </Stack>
  );
};

/**
 * Individual record item component
 */
const RecordItem = ({ record, selected, onToggle }) => {
  return (
    <Paper 
      p="md" 
      withBorder 
      radius="sm"
      style={{ 
        cursor: 'pointer',
        borderColor: selected ? 'var(--mantine-color-blue-5)' : undefined,
        backgroundColor: selected ? 'var(--mantine-color-blue-0)' : undefined,
      }}
      onClick={onToggle}
    >
      <Group justify="space-between" align="flex-start">
        <Stack gap={4} style={{ flex: 1 }}>
          <Text fw={500} size="sm">{record.title}</Text>
          <Text size="xs" c="dimmed" lineClamp={2}>
            {record.key_info}
          </Text>
          
          {/* Record metadata */}
          <Group gap="xs" wrap="wrap">
            {record.date && (
              <Text size="xs" c="dimmed">
                📅 {formatDate(record.date)}
              </Text>
            )}
            {record.practitioner && (
              <Text size="xs" c="dimmed">
                👨‍⚕️ {record.practitioner}
              </Text>
            )}
            {record.status && (
              <Badge 
                size="xs" 
                color={getStatusColor(record.status)}
                variant="dot"
              >
                {record.status}
              </Badge>
            )}
          </Group>
        </Stack>
        
        <Switch
          checked={selected}
          onChange={onToggle}
          color="blue"
          size="md"
          onClick={(e) => e.stopPropagation()} // Prevent double toggle
        />
      </Group>
    </Paper>
  );
};

/**
 * Get color for status badge
 */
const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'active':
    case 'current':
      return 'green';
    case 'inactive':
    case 'discontinued':
      return 'red';
    case 'resolved':
    case 'completed':
      return 'blue';
    case 'pending':
      return 'orange';
    default:
      return 'gray';
  }
};

export default RecordSelector;