/**
 * TestComponentStats component for lab test component statistics and visualizations
 * Provides summary statistics, status distribution, and trend analysis
 */

import React, { useMemo, useCallback } from 'react';
import {
  Card,
  Stack,
  Group,
  Text,
  Badge,
  SimpleGrid,
  Title,
  Paper,
  RingProgress,
  Alert,
  Center,
  Progress,
  Table,
  Tooltip,
  Box,
  ThemeIcon
} from '@mantine/core';
import {
  IconChartBar,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconFlask,
  IconCategory
} from '@tabler/icons-react';
import { LabTestComponent } from '../../../services/api/labTestComponentApi';
import { getCategoryDisplayName, getCategoryColor } from '../../../constants/labCategories';
import logger from '../../../services/logger';

interface TestComponentStatsProps {
  components: LabTestComponent[];
  loading?: boolean;
  onError?: (error: Error) => void;
}

interface StatsData {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  outOfRange: number;
  withRanges: number;
  criticalCount: number;
  abnormalCount: number;
  normalCount: number;
}

interface CategoryStats {
  category: string;
  count: number;
  normalCount: number;
  abnormalCount: number;
  criticalCount: number;
  percentage: number;
}

const TestComponentStats: React.FC<TestComponentStatsProps> = ({
  components,
  loading = false,
  onError
}) => {
  const handleError = useCallback((error: Error, context: string) => {
    logger.error('test_component_stats_error', {
      message: `Error in TestComponentStats: ${context}`,
      error: error.message,
      component: 'TestComponentStats',
    });

    if (onError) {
      onError(error);
    }
  }, [onError]);

  const stats = useMemo<StatsData>(() => {
    try {
      const total = components.length;
      const byStatus: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      let outOfRange = 0;
      let withRanges = 0;
      let criticalCount = 0;
      let abnormalCount = 0;
      let normalCount = 0;

      components.forEach((component: LabTestComponent) => {
        // Count by status
        const status = component.status || 'unknown';
        byStatus[status] = (byStatus[status] || 0) + 1;

        // Count by category
        const category = component.category || 'other';
        byCategory[category] = (byCategory[category] || 0) + 1;

        // Count components with reference ranges
        if (component.ref_range_min != null || component.ref_range_max != null || component.ref_range_text) {
          withRanges++;

          // Check if out of range
          if (component.ref_range_min != null && component.ref_range_max != null && component.value != null) {
            if (component.value < component.ref_range_min || component.value > component.ref_range_max) {
              outOfRange++;
            }
          }
        }

        // Count by severity
        switch (status.toLowerCase()) {
          case 'critical':
            criticalCount++;
            break;
          case 'abnormal':
          case 'high':
          case 'low':
          case 'borderline':
            abnormalCount++;
            break;
          case 'normal':
            normalCount++;
            break;
        }
      });

      return {
        total,
        byStatus,
        byCategory,
        outOfRange,
        withRanges,
        criticalCount,
        abnormalCount,
        normalCount
      };
    } catch (error) {
      handleError(error as Error, 'calculate_stats');
      return {
        total: 0,
        byStatus: {},
        byCategory: {},
        outOfRange: 0,
        withRanges: 0,
        criticalCount: 0,
        abnormalCount: 0,
        normalCount: 0
      };
    }
  }, [components, handleError]);

  const categoryStats = useMemo<CategoryStats[]>(() => {
    try {
      return Object.entries(stats.byCategory).map(([category, count]) => {
        const categoryComponents = components.filter(c => (c.category || 'other') === category);
        const normalCount = categoryComponents.filter(c => c.status?.toLowerCase() === 'normal').length;
        const abnormalCount = categoryComponents.filter(c =>
          ['abnormal', 'high', 'low', 'borderline'].includes(c.status?.toLowerCase() || '')
        ).length;
        const criticalCount = categoryComponents.filter(c => c.status?.toLowerCase() === 'critical').length;

        return {
          category,
          count,
          normalCount,
          abnormalCount,
          criticalCount,
          percentage: stats.total > 0 ? (count / stats.total) * 100 : 0
        };
      }).sort((a, b) => b.count - a.count);
    } catch (error) {
      handleError(error as Error, 'calculate_category_stats');
      return [];
    }
  }, [components, stats, handleError]);

  const statusColors: Record<string, string> = {
    normal: 'green',
    high: 'orange',
    low: 'orange',
    critical: 'red',
    abnormal: 'yellow',
    borderline: 'yellow',
    unknown: 'gray'
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'critical':
        return <IconAlertTriangle size={16} color="red" />;
      case 'normal':
        return <IconCheck size={16} color="green" />;
      case 'high':
        return <IconTrendingUp size={16} color="orange" />;
      case 'low':
        return <IconTrendingDown size={16} color="orange" />;
      case 'abnormal':
      case 'borderline':
        return <IconX size={16} color="yellow" />;
      default:
        return <IconMinus size={16} color="gray" />;
    }
  };

  const overallHealthScore = useMemo(() => {
    // Only count quantitative components for the health score
    const quantitativeComponents = components.filter(c => c.result_type !== 'qualitative');
    const quantTotal = quantitativeComponents.length;
    if (quantTotal === 0) return 0;
    const quantNormal = quantitativeComponents.filter(c => c.status?.toLowerCase() === 'normal').length;
    return Math.round((quantNormal / quantTotal) * 100);
  }, [components]);

  const getHealthScoreColor = (score: number): string => {
    if (score >= 80) return 'green';
    if (score >= 60) return 'yellow';
    if (score >= 40) return 'orange';
    return 'red';
  };

  if (loading) {
    return (
      <Card withBorder p="md" radius="md">
        <Center h={200}>
          <Stack align="center" gap="md">
            <IconChartBar size={48} color="var(--mantine-color-gray-5)" />
            <Text size="lg" c="dimmed">Loading statistics...</Text>
          </Stack>
        </Center>
      </Card>
    );
  }

  if (stats.total === 0) {
    return (
      <Card withBorder p="md" radius="md">
        <Center h={200}>
          <Stack align="center" gap="md">
            <IconChartBar size={48} color="var(--mantine-color-gray-5)" />
            <Text size="lg" c="dimmed">No data for statistics</Text>
            <Text size="sm" c="dimmed" ta="center">
              Statistics will appear here once test components are added
            </Text>
          </Stack>
        </Center>
      </Card>
    );
  }

  return (
    <Stack gap="md">
      {/* Overall Summary Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        {/* Total Tests */}
        <Card withBorder p="md" radius="md">
          <Group justify="space-between">
            <div>
              <Text size="lg" fw={700}>{stats.total}</Text>
              <Text size="sm" c="dimmed">Total Tests</Text>
            </div>
            <ThemeIcon color="blue" variant="light" size="lg">
              <IconFlask size={20} />
            </ThemeIcon>
          </Group>
        </Card>

        {/* Critical Results */}
        <Card withBorder p="md" radius="md">
          <Group justify="space-between">
            <div>
              <Text size="lg" fw={700} c="red">{stats.criticalCount}</Text>
              <Text size="sm" c="dimmed">Critical</Text>
            </div>
            <ThemeIcon color="red" variant="light" size="lg">
              <IconAlertTriangle size={20} />
            </ThemeIcon>
          </Group>
        </Card>

        {/* Abnormal Results */}
        <Card withBorder p="md" radius="md">
          <Group justify="space-between">
            <div>
              <Text size="lg" fw={700} c="orange">{stats.abnormalCount}</Text>
              <Text size="sm" c="dimmed">Abnormal</Text>
            </div>
            <ThemeIcon color="orange" variant="light" size="lg">
              <IconTrendingUp size={20} />
            </ThemeIcon>
          </Group>
        </Card>

        {/* Normal Results */}
        <Card withBorder p="md" radius="md">
          <Group justify="space-between">
            <div>
              <Text size="lg" fw={700} c="green">{stats.normalCount}</Text>
              <Text size="sm" c="dimmed">Normal</Text>
            </div>
            <ThemeIcon color="green" variant="light" size="lg">
              <IconCheck size={20} />
            </ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {/* Overall Health Score */}
        <Card withBorder p="md" radius="md">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Title order={5}>Overall Health Score</Title>
              <Badge color={getHealthScoreColor(overallHealthScore)}>
                {overallHealthScore}%
              </Badge>
            </Group>

            <Center>
              <RingProgress
                size={120}
                thickness={12}
                sections={[
                  { value: overallHealthScore, color: getHealthScoreColor(overallHealthScore) }
                ]}
                label={
                  <Center>
                    <Text fw={700} size="lg">
                      {overallHealthScore}%
                    </Text>
                  </Center>
                }
              />
            </Center>

            <Text size="sm" c="dimmed" ta="center">
              Based on {stats.normalCount} normal results out of {stats.total} total tests
              {components.some(c => c.result_type === 'qualitative') && ' (quantitative only)'}
            </Text>

            {stats.criticalCount > 0 && (
              <Alert color="red" icon={<IconAlertTriangle size={16} />}>
                {stats.criticalCount} critical result{stats.criticalCount !== 1 ? 's' : ''} require immediate attention
              </Alert>
            )}
          </Stack>
        </Card>

        {/* Status Distribution */}
        <Card withBorder p="md" radius="md">
          <Stack gap="md">
            <Title order={5}>Status Distribution</Title>

            <Stack gap="sm">
              {Object.entries(stats.byStatus)
                .sort(([,a], [,b]) => b - a)
                .map(([status, count]) => {
                  const percentage = (count / stats.total) * 100;
                  return (
                    <Group key={status} justify="space-between">
                      <Group gap="xs">
                        {getStatusIcon(status)}
                        <Text size="sm" tt="capitalize">{status}</Text>
                      </Group>
                      <Group gap="xs">
                        <Text size="sm">{count}</Text>
                        <Box style={{ width: 100 }}>
                          <Progress
                            value={percentage}
                            color={statusColors[status] || 'gray'}
                            size="sm"
                          />
                        </Box>
                        <Text size="xs" c="dimmed" w={35}>
                          {percentage.toFixed(0)}%
                        </Text>
                      </Group>
                    </Group>
                  );
                })}
            </Stack>
          </Stack>
        </Card>
      </SimpleGrid>

      {/* Reference Range Analysis */}
      {stats.withRanges > 0 && (
        <Card withBorder p="md" radius="md">
          <Stack gap="md">
            <Title order={5}>Reference Range Analysis</Title>

            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              <Paper withBorder p="sm" radius="sm">
                <Stack gap={4} align="center">
                  <Text size="lg" fw={700}>{stats.withRanges}</Text>
                  <Text size="xs" c="dimmed" ta="center">Tests with ranges</Text>
                </Stack>
              </Paper>

              <Paper withBorder p="sm" radius="sm">
                <Stack gap={4} align="center">
                  <Text size="lg" fw={700} c="orange">{stats.outOfRange}</Text>
                  <Text size="xs" c="dimmed" ta="center">Out of range</Text>
                </Stack>
              </Paper>

              <Paper withBorder p="sm" radius="sm">
                <Stack gap={4} align="center">
                  <Text size="lg" fw={700} c="green">{stats.withRanges - stats.outOfRange}</Text>
                  <Text size="xs" c="dimmed" ta="center">Within range</Text>
                </Stack>
              </Paper>
            </SimpleGrid>

            {stats.outOfRange > 0 && (
              <>
                <Progress
                  value={(stats.outOfRange / stats.withRanges) * 100}
                  color="orange"
                  size="lg"
                />
                <Text size="sm" ta="center" mt="xs">
                  {stats.outOfRange} of {stats.withRanges} tests out of range
                </Text>
              </>
            )}
          </Stack>
        </Card>
      )}

      {/* Category Breakdown */}
      {categoryStats.length > 0 && (
        <Card withBorder p="md" radius="md">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Title order={5}>Test Categories</Title>
              <Badge variant="light" color="blue">
                {categoryStats.length} categor{categoryStats.length !== 1 ? 'ies' : 'y'}
              </Badge>
            </Group>

            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Category</Table.Th>
                  <Table.Th>Tests</Table.Th>
                  <Table.Th>Normal</Table.Th>
                  <Table.Th>Abnormal</Table.Th>
                  <Table.Th>Critical</Table.Th>
                  <Table.Th>Distribution</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {categoryStats.map(category => (
                  <Table.Tr key={category.category}>
                    <Table.Td>
                      <Group gap="xs">
                        <Badge
                          variant="light"
                          color={getCategoryColor(category.category)}
                          size="sm"
                        >
                          {getCategoryDisplayName(category.category)}
                        </Badge>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text fw={500}>{category.count}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text c="green">{category.normalCount}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text c="orange">{category.abnormalCount}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text c="red">{category.criticalCount}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Progress
                          value={category.percentage}
                          color={getCategoryColor(category.category)}
                          size="sm"
                          style={{ width: 60 }}
                        />
                        <Text size="xs" c="dimmed">
                          {category.percentage.toFixed(0)}%
                        </Text>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        </Card>
      )}

      {/* Additional Insights */}
      <Card withBorder p="md" radius="md" bg="gray.0">
        <Stack gap="md">
          <Group gap="xs">
            <IconCategory size={20} />
            <Title order={5}>Insights</Title>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Stack gap="xs">
              <Text size="sm" fw={500}>Test Coverage</Text>
              <Text size="xs" c="dimmed">
                {stats.withRanges} of {stats.total} tests ({((stats.withRanges / stats.total) * 100).toFixed(0)}%)
                have reference ranges for proper evaluation.
              </Text>
            </Stack>

            <Stack gap="xs">
              <Text size="sm" fw={500}>Results Quality</Text>
              <Text size="xs" c="dimmed">
                {stats.normalCount > stats.abnormalCount + stats.criticalCount
                  ? 'Majority of results are within normal ranges.'
                  : 'Several results require attention or follow-up.'}
              </Text>
            </Stack>
          </SimpleGrid>

          {stats.criticalCount > 0 && (
            <Alert color="red" variant="light">
              <Text size="sm">
                <strong>Action Required:</strong> {stats.criticalCount} critical result{stats.criticalCount !== 1 ? 's' : ''}
                detected. Please consult with healthcare provider immediately.
              </Text>
            </Alert>
          )}
        </Stack>
      </Card>
    </Stack>
  );
};

export default TestComponentStats;