/**
 * TestComponentDisplay component for displaying lab test components
 * Provides beautiful card-based display grouped by category with status indicators
 */

import React from 'react';
import {
  Card,
  Stack,
  Group,
  Text,
  Badge,
  SimpleGrid,
  Title,
  Divider,
  Paper,
  Box,
  Tooltip,
  ActionIcon,
  Center,
  Alert,
  Skeleton
} from '@mantine/core';
import { IconInfoCircle, IconEdit, IconTrash, IconChartLine } from '@tabler/icons-react';
import StatusBadge from '../StatusBadge';
import { LabTestComponent } from '../../../services/api/labTestComponentApi';
import logger from '../../../services/logger';

interface TestComponentDisplayProps {
  components: LabTestComponent[];
  loading?: boolean;
  error?: string | null;
  groupByCategory?: boolean;
  showActions?: boolean;
  onEdit?: (component: LabTestComponent) => void;
  onDelete?: (component: LabTestComponent) => void;
  onTrendClick?: (testName: string) => void;
  onError?: (error: Error) => void;
}

const TestComponentDisplay: React.FC<TestComponentDisplayProps> = ({
  components,
  loading = false,
  error = null,
  groupByCategory = true,
  showActions = false,
  onEdit,
  onDelete,
  onTrendClick,
  onError
}) => {
  const handleError = (error: Error, context: string) => {
    logger.error('test_component_display_error', {
      message: `Error in TestComponentDisplay: ${context}`,
      error: error.message,
      component: 'TestComponentDisplay',
    });

    if (onError) {
      onError(error);
    }
  };

  const getStatusColor = (status: string | null | undefined, value: number, refMin?: number | null, refMax?: number | null): string => {
    if (status) {
      switch (status.toLowerCase()) {
        case 'normal': return 'green';
        case 'high': return 'orange';
        case 'low': return 'orange';
        case 'critical': return 'red';
        case 'abnormal': return 'yellow';
        case 'borderline': return 'yellow';
        default: return 'gray';
      }
    }

    // Auto-calculate status if not provided but ranges are available
    if (refMin !== null && refMin !== undefined && refMax !== null && refMax !== undefined) {
      if (value < refMin) return 'orange';
      if (value > refMax) return 'orange';
      return 'green';
    }

    return 'gray';
  };

  const formatReferenceRange = (component: LabTestComponent): string => {
    const { ref_range_min, ref_range_max, ref_range_text } = component;

    if (ref_range_text) {
      return ref_range_text;
    }

    if (ref_range_min !== null && ref_range_min !== undefined &&
        ref_range_max !== null && ref_range_max !== undefined) {
      return `${ref_range_min} - ${ref_range_max}`;
    }

    if (ref_range_min !== null && ref_range_min !== undefined) {
      return `≥ ${ref_range_min}`;
    }

    if (ref_range_max !== null && ref_range_max !== undefined) {
      return `≤ ${ref_range_max}`;
    }

    return 'Not specified';
  };

  const TestComponentCard: React.FC<{ component: LabTestComponent }> = ({ component }) => {
    const statusColor = getStatusColor(component.status, component.value, component.ref_range_min, component.ref_range_max);
    const referenceRange = formatReferenceRange(component);

    const handleCardClick = (e: React.MouseEvent) => {
      // Don't trigger if clicking on action buttons
      const target = e.target as HTMLElement;
      if (target.closest('button')) {
        return;
      }
      onTrendClick?.(component.test_name);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      // Support Enter and Space keys for accessibility
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onTrendClick?.(component.test_name);
      }
    };

    return (
      <Card
        withBorder
        shadow="sm"
        radius="md"
        p="md"
        style={{ cursor: 'pointer' }}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`View trends for ${component.test_name}`}
      >
        <Stack gap="sm">
          {/* Header */}
          <Group justify="space-between" align="flex-start">
            <Stack gap={4} style={{ flex: 1 }}>
              <Group gap="xs" align="center">
                <Text fw={600} size="sm">{component.test_name}</Text>
                {component.abbreviation && (
                  <Badge variant="light" color="gray" size="xs">
                    {component.abbreviation}
                  </Badge>
                )}
                {/* Trend indicator badge */}
                <Tooltip label="Click card to view historical trends">
                  <Badge variant="light" color="blue" size="xs" leftSection={<IconChartLine size={10} />}>
                    Trends
                  </Badge>
                </Tooltip>
              </Group>
              {component.test_code && (
                <Text size="xs" c="dimmed">{component.test_code}</Text>
              )}
            </Stack>

            {/* Edit/Delete - only show when actions enabled */}
            {showActions && (
              <Group gap={4}>
                <Tooltip label="Edit test component">
                  <ActionIcon
                    variant="subtle"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit?.(component);
                    }}
                    aria-label={`Edit ${component.test_name}`}
                  >
                    <IconEdit size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Delete test component">
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.(component);
                    }}
                    aria-label={`Delete ${component.test_name}`}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )}
          </Group>

          {/* Value and Status */}
          <Group justify="space-between" align="center">
            <div>
              <Group gap="xs" align="baseline">
                <Text fw={700} size="lg" c={statusColor}>
                  {component.value}
                </Text>
                <Text size="sm" c="dimmed">
                  {component.unit}
                </Text>
              </Group>
            </div>

            {component.status && (
              <StatusBadge status={component.status} size="sm" color={getStatusColor(component.status, component.value, component.ref_range_min, component.ref_range_max)} />
            )}
          </Group>

          {/* Reference Range */}
          <Group gap="xs" align="center">
            <Text size="xs" c="dimmed" fw={500}>Reference:</Text>
            <Text size="xs">{referenceRange}</Text>
            {component.unit && referenceRange !== 'Not specified' && (
              <Text size="xs" c="dimmed">{component.unit}</Text>
            )}
          </Group>

          {/* Notes */}
          {component.notes && (
            <Box>
              <Divider size="xs" />
              <Group gap="xs" align="flex-start" mt="xs">
                <IconInfoCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                <Text size="xs" c="dimmed" style={{ lineHeight: 1.4 }}>
                  {component.notes}
                </Text>
              </Group>
            </Box>
          )}
        </Stack>
      </Card>
    );
  };

  const LoadingSkeleton: React.FC = () => (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
      {[...Array(6)].map((_, index) => (
        <Card key={index} withBorder p="md">
          <Stack gap="sm">
            <Skeleton height={20} width="70%" />
            <Group justify="space-between">
              <Skeleton height={28} width={80} />
              <Skeleton height={24} width={60} />
            </Group>
            <Skeleton height={16} width="100%" />
          </Stack>
        </Card>
      ))}
    </SimpleGrid>
  );

  const EmptyState: React.FC = () => (
    <Center p="xl">
      <Stack align="center" gap="md">
        <Text size="lg" c="dimmed">No test components found</Text>
        <Text size="sm" c="dimmed" ta="center">
          Test components will appear here once they are added to this lab result.
        </Text>
      </Stack>
    </Center>
  );

  try {
    if (loading) {
      return <LoadingSkeleton />;
    }

    if (error) {
      return (
        <Alert color="red" title="Error loading test components">
          {error}
        </Alert>
      );
    }

    if (!components || components.length === 0) {
      return <EmptyState />;
    }

    if (!groupByCategory) {
      return (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {components.map((component) => (
            <TestComponentCard key={component.id} component={component} />
          ))}
        </SimpleGrid>
      );
    }

    // Group components by category
    const groupedComponents = components.reduce((groups, component) => {
      const category = component.category || 'other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(component);
      return groups;
    }, {} as Record<string, LabTestComponent[]>);

    // Sort categories and components within each category (create new sorted structure)
    const sortedCategories = Object.keys(groupedComponents).sort();

    // Create new sorted structure to avoid mutation
    const sortedGroupedComponents = sortedCategories.reduce((acc, category) => {
      acc[category] = [...groupedComponents[category]].sort((a, b) => {
        // Sort by display_order first, then by test_name
        if (a.display_order !== null && a.display_order !== undefined &&
            b.display_order !== null && b.display_order !== undefined) {
          return a.display_order - b.display_order;
        }
        if (a.display_order !== null) return -1;
        if (b.display_order !== null) return 1;
        return a.test_name.localeCompare(b.test_name);
      });
      return acc;
    }, {} as Record<string, LabTestComponent[]>);

    const getCategoryDisplayName = (category: string): string => {
      const categoryNames: Record<string, string> = {
        chemistry: 'Chemistry',
        hematology: 'Hematology',
        immunology: 'Immunology',
        microbiology: 'Microbiology',
        endocrinology: 'Endocrinology',
        toxicology: 'Toxicology',
        genetics: 'Genetics',
        molecular: 'Molecular',
        pathology: 'Pathology',
        other: 'Other Tests'
      };
      return categoryNames[category] || category.charAt(0).toUpperCase() + category.slice(1);
    };

    const getCategoryColor = (category: string): string => {
      const categoryColors: Record<string, string> = {
        chemistry: 'blue',
        hematology: 'red',
        immunology: 'green',
        microbiology: 'yellow',
        endocrinology: 'purple',
        toxicology: 'orange',
        genetics: 'teal',
        molecular: 'cyan',
        pathology: 'pink',
        other: 'gray'
      };
      return categoryColors[category] || 'gray';
    };

    return (
      <Stack gap="xl">
        {sortedCategories.map((category) => (
          <Paper key={category} withBorder p="md" radius="md">
            <Stack gap="md">
              {/* Category Header */}
              <Group gap="xs" align="center">
                <Badge
                  variant="light"
                  color={getCategoryColor(category)}
                  size="lg"
                  leftSection={
                    <Text fw={600} size="sm">
                      {getCategoryDisplayName(category)}
                    </Text>
                  }
                />
                <Text size="sm" c="dimmed">
                  {sortedGroupedComponents[category].length} test{sortedGroupedComponents[category].length !== 1 ? 's' : ''}
                </Text>
              </Group>

              {/* Components Grid */}
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
                {sortedGroupedComponents[category].map((component) => (
                  <TestComponentCard key={component.id} component={component} />
                ))}
              </SimpleGrid>
            </Stack>
          </Paper>
        ))}
      </Stack>
    );
  } catch (error) {
    handleError(error as Error, 'render');

    return (
      <Alert color="red" title="Error displaying test components">
        Unable to display test components. Please try refreshing the page.
      </Alert>
    );
  }
};

export default TestComponentDisplay;