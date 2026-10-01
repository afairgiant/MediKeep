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
import { useTranslation } from 'react-i18next';

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
  onClearCategory,
  categoryDisplayName,
}) => {
  const { t } = useTranslation('reports');
  const { formatDate } = useDateFormat();

  if (!categoryData || !categoryData.records) {
    return (
      <Paper p="md" withBorder radius="md">
        <Text c="dimmed" ta="center">
          {t('categories.noRecords')}
        </Text>
      </Paper>
    );
  }

  const allSelected = categoryData.records.every(
    record => selectedRecords[record.id]
  );
  const selectedCount = categoryData.records.filter(
    record => selectedRecords[record.id]
  ).length;

  return (
    <Stack gap="sm">
      {/* Category header with select all */}
      <Paper p="md" withBorder radius="md" bg="var(--color-bg-secondary)">
        <Group justify="space-between">
          <Group>
            <Text fw={500} size="lg">
              {categoryDisplayName}
            </Text>
            <Badge color="blue" variant="light">
              {t('categories.totalCount', { count: categoryData.count })}
            </Badge>
            {selectedCount > 0 && (
              <Badge color="green" variant="light">
                {t('categories.selected', { count: selectedCount })}
              </Badge>
            )}
          </Group>
          <Group gap="xs">
            <Button
              size="xs"
              variant="subtle"
              onClick={() => onToggleCategory(category, categoryData.records)}
              disabled={allSelected || categoryData.records.length === 0}
            >
              {t('categories.selectAll')}
            </Button>
            <Button
              size="xs"
              variant="subtle"
              color="red"
              onClick={() => onClearCategory(category)}
              disabled={selectedCount === 0}
            >
              {t('categories.clearSelection')}
            </Button>
          </Group>
        </Group>
      </Paper>

      {/* Records list */}
      <Stack gap="xs">
        {categoryData.records.map(record => (
          <RecordItem
            key={record.id}
            record={record}
            selected={!!selectedRecords[record.id]}
            onToggle={() => onToggleRecord(category, record.id, record)}
            formatDate={formatDate}
          />
        ))}
      </Stack>

      {/* Has more indicator */}
      {categoryData.has_more && (
        <Alert color="blue" variant="light">
          <Text size="sm">
            {t('categories.showingFirst', {
              count: categoryData.records.length,
            })}
          </Text>
        </Alert>
      )}
    </Stack>
  );
};

/**
 * Individual record item component
 */
const RecordItem = ({ record, selected, onToggle, formatDate }) => {
  return (
    <Paper
      p="md"
      withBorder
      radius="sm"
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${record.title}${record.key_info ? ` - ${record.key_info}` : ''}`}
      style={{
        cursor: 'pointer',
        borderColor: selected ? 'var(--mantine-color-blue-5)' : undefined,
        backgroundColor: selected
          ? 'var(--mantine-color-blue-light)'
          : undefined,
      }}
      onClick={onToggle}
      onKeyDown={e => {
        if (
          (e.key === 'Enter' || e.key === ' ') &&
          e.target === e.currentTarget
        ) {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <Group justify="space-between" align="flex-start">
        <Stack gap={4} style={{ flex: 1 }}>
          <Text fw={500} size="sm">
            {record.title}
          </Text>
          <Text size="xs" c="dimmed" lineClamp={2}>
            {record.key_info}
          </Text>

          {/* Record metadata */}
          <Group gap="xs" wrap="wrap">
            {record.date && (
              <Text size="xs" c="dimmed">
                <span aria-hidden="true">📅 </span>
                {formatDate(record.date)}
              </Text>
            )}
            {record.practitioner && (
              <Text size="xs" c="dimmed">
                {/* eslint-disable-next-line i18next/no-literal-string -- decorative emoji */}
                <span aria-hidden="true">
                  {'\uD83D\uDC68\u200D\u2695\uFE0F '}
                </span>
                {record.practitioner}
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

        {/* The wrapper stops both the label click and the synthesized input
            click from reaching the Paper, which would toggle a second time. */}
        <div onClick={e => e.stopPropagation()}>
          <Switch
            checked={selected}
            onChange={onToggle}
            color="blue"
            size="md"
            aria-label={`Select ${record.title}`}
            styles={{
              track: selected
                ? undefined
                : {
                    backgroundColor:
                      'light-dark(var(--mantine-color-gray-5), var(--mantine-color-dark-4))',
                    borderColor:
                      'light-dark(var(--mantine-color-gray-7), var(--mantine-color-dark-2))',
                  },
            }}
          />
        </div>
      </Group>
    </Paper>
  );
};

/**
 * Get color for status badge
 */
const getStatusColor = status => {
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
