/**
 * VitalStatCard component
 * Clickable summary card for a single vital in the Vitals page Health Summary
 */

import type { Icon } from '@tabler/icons-react';
import { ActionIcon, Badge, Box, Card, Flex, Group, Text } from '@mantine/core';
import { IconChartLine } from '@tabler/icons-react';

export type VitalCategoryLevel = 'low' | 'high' | 'normal';

// level drives the badge color; label is the already-translated display text
export interface VitalCategory {
  level: VitalCategoryLevel;
  label: string;
}

interface VitalStatCardProps {
  title: string;
  description: string;
  icon: Icon;
  color: string;
  value: string | number;
  unit?: string;
  category?: VitalCategory | null;
  isSelected: boolean;
  onSelect: () => void;
}

const CATEGORY_COLORS: Record<VitalCategoryLevel, string> = {
  low: 'orange',
  high: 'red',
  normal: 'green',
};

// Height of a Badge with size="sm"; reserved so cards without a category
// badge keep the same height as cards that have one
const CATEGORY_SLOT_HEIGHT = 18;

const VitalStatCard = ({
  title,
  description,
  icon: IconComponent,
  color,
  value,
  unit,
  category,
  isSelected,
  onSelect,
}: VitalStatCardProps) => (
  <Card
    shadow="sm"
    padding="lg"
    radius="md"
    withBorder
    tabIndex={0}
    role="button"
    aria-label={`${title}. ${description}`}
    aria-pressed={isSelected}
    style={{
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      border: isSelected
        ? `2px solid var(--mantine-color-${color}-6)`
        : undefined,
      backgroundColor: isSelected
        ? `var(--mantine-color-${color}-0)`
        : undefined,
    }}
    onMouseEnter={e => {
      if (!isSelected) {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--mantine-shadow-md)';
      }
    }}
    onMouseLeave={e => {
      if (!isSelected) {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--mantine-shadow-sm)';
      }
    }}
    onKeyDown={e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect();
      }
    }}
    onClick={onSelect}
    title={description}
  >
    <Flex align="center" gap="md">
      <ActionIcon
        size="xl"
        variant={isSelected ? 'filled' : 'light'}
        color={color}
        radius="md"
      >
        <IconComponent size={24} />
      </ActionIcon>
      <Box flex={1}>
        <Group justify="space-between" align="flex-start">
          <Text size="sm" c="dimmed" fw={500}>
            {title}
          </Text>
          <IconChartLine
            size={14}
            color="var(--mantine-color-gray-5)"
            aria-hidden="true"
          />
        </Group>
        <Group gap="xs" align="baseline">
          <Text size="xl" fw={700}>
            {value}
          </Text>
          {unit && (
            <Text size="sm" c="dimmed">
              {unit}
            </Text>
          )}
        </Group>
        <Box
          mt={4}
          h={CATEGORY_SLOT_HEIGHT}
          data-testid="vital-stat-category-slot"
        >
          {category && (
            <Badge
              size="sm"
              variant="light"
              color={CATEGORY_COLORS[category.level]}
            >
              {category.label}
            </Badge>
          )}
        </Box>
      </Box>
    </Flex>
  </Card>
);

export default VitalStatCard;
