/**
 * TestComponentCatalogCard - Displays a single unique test component summary card
 * in the catalog view. Shows latest reading, status, trend, and reading count.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Group, Stack, Text, Badge } from '@mantine/core';
import {
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconArrowBigUpFilled,
  IconArrowBigDownFilled,
} from '@tabler/icons-react';
import { ComponentCatalogEntry } from '../../../services/api/labTestComponentApi';
import {
  getCategoryColor,
  getCategoryDisplayName,
} from '../../../constants/labCategories';
import { useDateFormat } from '../../../hooks/useDateFormat';

// useDateFormat is a JS hook without TS declarations
interface DateFormatHook {
  formatDate: (_dateValue: string | null | undefined) => string;
}

interface TestComponentCatalogCardProps {
  entry: ComponentCatalogEntry;
  onClick: (_testName: string, _unit: string | null) => void;
}

function getStatusColor(status: string | null | undefined): string {
  if (!status) return 'gray';
  switch (status.toLowerCase()) {
    case 'normal':
      return 'green';
    case 'high':
      return 'orange';
    case 'low':
      return 'orange';
    case 'critical':
      return 'red';
    case 'abnormal':
      return 'yellow';
    case 'borderline':
      return 'yellow';
    default:
      return 'gray';
  }
}

function getStatusLabel(
  status: string | null | undefined,
  t: (_key: string, _fallback: string) => string
): string {
  if (!status) return t('shared:labels.unknown', 'Unknown');
  const key = status.toLowerCase();
  const fallbacks: Record<string, string> = {
    normal: 'Normal',
    high: 'High',
    low: 'Low',
    critical: 'Critical',
    abnormal: 'Abnormal',
    borderline: 'Borderline',
  };
  if (key in fallbacks) {
    return t(`medical:componentCatalog.status.${key}`, fallbacks[key]);
  }
  return status;
}

function TrendIcon({ direction }: { direction: string }) {
  switch (direction) {
    case 'increasing':
      return <IconTrendingUp size={16} color="var(--mantine-color-orange-6)" />;
    case 'decreasing':
      return <IconTrendingDown size={16} color="var(--mantine-color-blue-6)" />;
    case 'worsening':
      return (
        <IconArrowBigUpFilled size={16} color="var(--mantine-color-red-6)" />
      );
    case 'improving':
      return (
        <IconArrowBigDownFilled
          size={16}
          color="var(--mantine-color-green-6)"
        />
      );
    default:
      return <IconMinus size={16} color="var(--mantine-color-gray-5)" />;
  }
}

function getTrendLabel(
  direction: string,
  t: (_key: string, _fallback: string) => string
): string {
  switch (direction) {
    case 'increasing':
      return t('medical:componentCatalog.trend.increasing', 'Increasing');
    case 'decreasing':
      return t('medical:componentCatalog.trend.decreasing', 'Decreasing');
    case 'worsening':
      return t('medical:componentCatalog.trend.worsening', 'Worsening');
    case 'improving':
      return t('medical:componentCatalog.trend.improving', 'Improving');
    default:
      return t('medical:componentCatalog.trend.stable', 'Stable');
  }
}

const TestComponentCatalogCard: React.FC<TestComponentCatalogCardProps> = ({
  entry,
  onClick,
}) => {
  const { t } = useTranslation(['medical', 'common', 'shared']);
  const { formatDate } = useDateFormat() as DateFormatHook;

  const isQuantitative =
    (entry.result_type || 'quantitative') === 'quantitative';

  const formattedRefRange = (() => {
    if (entry.ref_range_text) return entry.ref_range_text;
    if (entry.ref_range_min != null && entry.ref_range_max != null) {
      return `${entry.ref_range_min} - ${entry.ref_range_max}`;
    }
    if (entry.ref_range_max != null) return `< ${entry.ref_range_max}`;
    if (entry.ref_range_min != null) return `> ${entry.ref_range_min}`;
    return null;
  })();

  return (
    <Card
      withBorder
      shadow="sm"
      radius="md"
      padding="md"
      style={{ cursor: 'pointer' }}
      onClick={() => onClick(entry.trend_test_name, entry.unit ?? null)}
      data-testid="catalog-card"
    >
      <Stack gap="xs">
        {/* Header: test name + abbreviation */}
        <Group justify="space-between" wrap="nowrap">
          <Text fw={600} size="sm" lineClamp={1} style={{ flex: 1 }}>
            {entry.test_name}
          </Text>
          {entry.abbreviation && (
            <Badge variant="light" color="gray" size="sm">
              {entry.abbreviation}
            </Badge>
          )}
        </Group>

        {/* Value display */}
        <Group gap="xs" align="baseline">
          {isQuantitative ? (
            <>
              <Text size="xl" fw={700} c={getStatusColor(entry.status)}>
                {entry.latest_value != null ? entry.latest_value : '--'}
              </Text>
              {entry.unit && (
                <Text size="xs" c="dimmed">
                  {entry.unit}
                </Text>
              )}
            </>
          ) : (
            <Text
              size="lg"
              fw={700}
              c={getStatusColor(entry.status)}
              tt="capitalize"
            >
              {entry.latest_qualitative_value || '--'}
            </Text>
          )}
        </Group>

        {/* Status + Trend row */}
        <Group justify="space-between" gap="xs">
          {entry.status && (
            <Badge
              variant="light"
              color={getStatusColor(entry.status)}
              size="sm"
            >
              {getStatusLabel(entry.status, t)}
            </Badge>
          )}
          <Group gap={4}>
            <TrendIcon direction={entry.trend_direction} />
            <Text size="xs" c="dimmed">
              {getTrendLabel(entry.trend_direction, t)}
            </Text>
          </Group>
        </Group>

        {/* Category badge */}
        {entry.category && (
          <Badge
            variant="dot"
            color={getCategoryColor(entry.category)}
            size="xs"
          >
            {getCategoryDisplayName(entry.category)}
          </Badge>
        )}

        {/* Footer: reading count + date */}
        <Group justify="space-between" mt={4}>
          <Text size="xs" c="dimmed">
            {t('shared:labels.countReadings', '{{count}} readings', {
              count: entry.reading_count,
            })}
          </Text>
          {entry.latest_date && (
            <Text size="xs" c="dimmed">
              {formatDate(entry.latest_date)}
            </Text>
          )}
        </Group>

        {/* Reference range (subtle) */}
        {formattedRefRange && (
          <Text size="xs" c="dimmed" fs="italic">
            {t('medical:componentCatalog.refRange', 'Ref')}: {formattedRefRange}
          </Text>
        )}
      </Stack>
    </Card>
  );
};

export default React.memo(TestComponentCatalogCard);
