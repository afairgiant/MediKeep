/**
 * TestComponentSummary component for displaying a compact summary of test components
 * Used in LabResultCard to show test component overview
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Group,
  Text,
  Badge,
  Stack,
  Tooltip,
  Skeleton,
  Box
} from '@mantine/core';
import {
  IconFlask,
  IconAlertTriangle,
  IconCheck,
  IconTrendingUp,
  IconTrendingDown
} from '@tabler/icons-react';
import {
  LabTestComponent,
  labTestComponentApi,
  LabTestComponentFilters
} from '../../../services/api/labTestComponentApi';
import { useCurrentPatient } from '../../../hooks/useGlobalData';
import logger from '../../../services/logger';

interface TestComponentSummaryProps {
  labResultId: number;
  compact?: boolean;
  onError?: (error: Error) => void;
}

interface SummaryStats {
  total: number;
  critical: number;
  abnormal: number;
  normal: number;
  categories: string[];
}

const TestComponentSummary: React.FC<TestComponentSummaryProps> = ({
  labResultId,
  compact = true,
  onError
}) => {
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { patient: currentPatient } = useCurrentPatient() as any;

  const handleError = useCallback((error: Error, context: string) => {
    logger.error('test_component_summary_error', {
      message: `Error in TestComponentSummary: ${context}`,
      labResultId,
      error: error.message,
      component: 'TestComponentSummary',
    });

    const errorMessage = error.message || 'Failed to load test component summary';
    setError(errorMessage);

    if (onError) {
      onError(error);
    }
  }, [labResultId, onError]);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get test components for this lab result
      const response = await labTestComponentApi.getByLabResult(
        labResultId,
        {} as LabTestComponentFilters,
        currentPatient?.id
      );

      const components = response.data || [];

      // Calculate summary statistics
      const summaryStats: SummaryStats = {
        total: components.length,
        critical: 0,
        abnormal: 0,
        normal: 0,
        categories: []
      };

      const categorySet = new Set<string>();

      components.forEach(component => {
        // Count by status
        const status = component.status?.toLowerCase();
        switch (status) {
          case 'critical':
            summaryStats.critical++;
            break;
          case 'abnormal':
          case 'high':
          case 'low':
          case 'borderline':
            summaryStats.abnormal++;
            break;
          case 'normal':
            summaryStats.normal++;
            break;
        }

        // Collect unique categories
        if (component.category) {
          categorySet.add(component.category);
        }
      });

      summaryStats.categories = Array.from(categorySet);

      setStats(summaryStats);
    } catch (error) {
      handleError(error as Error, 'load_summary');
    } finally {
      setLoading(false);
    }
  }, [labResultId, currentPatient?.id, handleError]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const getCategoryDisplayName = (category: string): string => {
    const categoryNames: Record<string, string> = {
      chemistry: 'Chemistry',
      hematology: 'Hematology',
      hepatology: 'Hepatology',
      immunology: 'Immunology',
      microbiology: 'Microbiology',
      endocrinology: 'Endocrinology',
      toxicology: 'Toxicology',
      genetics: 'Genetics',
      molecular: 'Molecular',
      pathology: 'Pathology',
      other: 'Other'
    };
    return categoryNames[category] || category.charAt(0).toUpperCase() + category.slice(1);
  };

  const getHealthScore = (): number => {
    if (!stats || stats.total === 0) return 0;
    return Math.round((stats.normal / stats.total) * 100);
  };

  const getHealthScoreColor = (score: number): string => {
    if (score >= 80) return 'green';
    if (score >= 60) return 'yellow';
    if (score >= 40) return 'orange';
    return 'red';
  };

  if (loading) {
    return (
      <Stack gap="xs">
        <Group gap="xs">
          <IconFlask size={14} />
          <Skeleton height={16} width={120} />
        </Group>
        <Group gap="xs">
          <Skeleton height={20} width={60} />
          <Skeleton height={20} width={60} />
        </Group>
      </Stack>
    );
  }

  if (error || !stats) {
    return (
      <Group gap="xs">
        <IconFlask size={14} color="var(--mantine-color-gray-5)" />
        <Text size="sm" c="dimmed">
          Test components unavailable
        </Text>
      </Group>
    );
  }

  if (stats.total === 0) {
    return (
      <Group gap="xs">
        <IconFlask size={14} color="var(--mantine-color-gray-5)" />
        <Text size="sm" c="dimmed">
          No test components
        </Text>
      </Group>
    );
  }

  const healthScore = getHealthScore();

  if (compact) {
    return (
      <Stack gap="xs">
        {/* Main Summary Line */}
        <Group gap="xs">
          <IconFlask size={14} />
          <Text size="sm" fw={500}>
            {stats.total} test component{stats.total !== 1 ? 's' : ''}
          </Text>
          {stats.categories.length > 0 && (
            <Text size="xs" c="dimmed">
              • {stats.categories.length} categor{stats.categories.length !== 1 ? 'ies' : 'y'}
            </Text>
          )}
        </Group>

        {/* Status Badges */}
        <Group gap="xs">
          {stats.critical > 0 && (
            <Tooltip label={`${stats.critical} critical result${stats.critical !== 1 ? 's' : ''}`}>
              <Badge
                size="sm"
                color="red"
                variant="light"
                leftSection={<IconAlertTriangle size={12} />}
              >
                {stats.critical}
              </Badge>
            </Tooltip>
          )}

          {stats.abnormal > 0 && (
            <Tooltip label={`${stats.abnormal} abnormal result${stats.abnormal !== 1 ? 's' : ''}`}>
              <Badge
                size="sm"
                color="orange"
                variant="light"
                leftSection={<IconTrendingUp size={12} />}
              >
                {stats.abnormal}
              </Badge>
            </Tooltip>
          )}

          {stats.normal > 0 && (
            <Tooltip label={`${stats.normal} normal result${stats.normal !== 1 ? 's' : ''}`}>
              <Badge
                size="sm"
                color="green"
                variant="light"
                leftSection={<IconCheck size={12} />}
              >
                {stats.normal}
              </Badge>
            </Tooltip>
          )}

          {/* Health Score Badge */}
          <Tooltip label={`Overall health score: ${healthScore}%`}>
            <Badge
              size="sm"
              color={getHealthScoreColor(healthScore)}
              variant="outline"
            >
              {healthScore}%
            </Badge>
          </Tooltip>
        </Group>

        {/* Categories Preview */}
        {stats.categories.length > 0 && (
          <Group gap={4}>
            {stats.categories.slice(0, 3).map(category => (
              <Badge
                key={category}
                size="xs"
                variant="light"
                color="gray"
              >
                {getCategoryDisplayName(category)}
              </Badge>
            ))}
            {stats.categories.length > 3 && (
              <Text size="xs" c="dimmed">
                +{stats.categories.length - 3} more
              </Text>
            )}
          </Group>
        )}
      </Stack>
    );
  }

  // Extended view (not compact)
  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap="xs">
          <IconFlask size={16} />
          <Text fw={600}>Test Components ({stats.total})</Text>
        </Group>
        <Badge color={getHealthScoreColor(healthScore)}>
          {healthScore}% Healthy
        </Badge>
      </Group>

      <Group gap="md">
        {stats.normal > 0 && (
          <Group gap="xs">
            <IconCheck size={16} color="green" />
            <Text size="sm">{stats.normal} Normal</Text>
          </Group>
        )}

        {stats.abnormal > 0 && (
          <Group gap="xs">
            <IconTrendingUp size={16} color="orange" />
            <Text size="sm">{stats.abnormal} Abnormal</Text>
          </Group>
        )}

        {stats.critical > 0 && (
          <Group gap="xs">
            <IconAlertTriangle size={16} color="red" />
            <Text size="sm">{stats.critical} Critical</Text>
          </Group>
        )}
      </Group>

      {stats.categories.length > 0 && (
        <Stack gap="xs">
          <Text size="sm" fw={500} c="dimmed">Categories:</Text>
          <Group gap="xs">
            {stats.categories.map(category => (
              <Badge
                key={category}
                size="sm"
                variant="light"
                color="blue"
              >
                {getCategoryDisplayName(category)}
              </Badge>
            ))}
          </Group>
        </Stack>
      )}
    </Stack>
  );
};

export default TestComponentSummary;