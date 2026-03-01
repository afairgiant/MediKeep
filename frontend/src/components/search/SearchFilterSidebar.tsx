/**
 * SearchFilterSidebar
 * Collapsible filter sidebar for the search results page.
 * Handles record type checkboxes, sort order, tag selection with AND/OR toggle,
 * popular tag chips, and a date range picker with quick presets.
 */

import React, { useCallback } from 'react';
import {
  Paper,
  Stack,
  Group,
  Text,
  Button,
  Badge,
  Select,
  MultiSelect,
  Checkbox,
  Divider,
  ActionIcon,
  ThemeIcon,
  SegmentedControl,
  Skeleton,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconFilter,
  IconTag,
  IconAlertTriangle,
  IconStethoscope,
  IconPill,
  IconVaccine,
  IconMedicalCross,
  IconHeartbeat,
  IconCalendarEvent,
  IconFlask,
  IconChevronLeft,
  IconChevronRight,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { usePersistedToggle } from '../../hooks/usePersistedToggle.js';
import { ClickableTagBadge } from '../common/ClickableTagBadge';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const RECORD_TYPES = [
  { value: 'medications', label: 'Medications', icon: IconPill, color: 'green' },
  { value: 'conditions', label: 'Conditions', icon: IconStethoscope, color: 'blue' },
  { value: 'lab_results', label: 'Lab Results', icon: IconFlask, color: 'indigo' },
  { value: 'procedures', label: 'Procedures', icon: IconMedicalCross, color: 'violet' },
  { value: 'immunizations', label: 'Immunizations', icon: IconVaccine, color: 'orange' },
  { value: 'treatments', label: 'Treatments', icon: IconHeartbeat, color: 'pink' },
  { value: 'encounters', label: 'Visits', icon: IconCalendarEvent, color: 'teal' },
  { value: 'allergies', label: 'Allergies', icon: IconAlertTriangle, color: 'red' },
  { value: 'vitals', label: 'Vitals', icon: IconHeartbeat, color: 'cyan' },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PopularTag {
  tag: string;
  color?: string | null;
  usage_count: number;
}

export interface SearchFilterSidebarProps {
  selectedTypes: string[];
  onTypeToggle: (type: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  selectedTags: string[];
  onTagChange: (tags: string[]) => void;
  matchMode: string;
  onMatchModeChange: (mode: string) => void;
  popularTags: PopularTag[];
  isLoadingTags: boolean;
  onTagClick: (tag: string) => void;
  hasActiveFilters: boolean;
  query: string;
  onClearFilters: () => void;
  getTagColor: (tag: string) => string | null;
  dateRange: [Date | null, Date | null];
  onDateRangeChange: (range: [Date | null, Date | null]) => void;
}

// ---------------------------------------------------------------------------
// Date preset helpers
// ---------------------------------------------------------------------------

function buildPresetRange(days: number): [Date, Date] {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return [start, end];
}

function buildMonthPresetRange(months: number): [Date, Date] {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  start.setHours(0, 0, 0, 0);
  return [start, end];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchFilterSidebar({
  selectedTypes,
  onTypeToggle,
  sortBy,
  onSortChange,
  selectedTags,
  onTagChange,
  matchMode,
  onMatchModeChange,
  popularTags,
  isLoadingTags,
  onTagClick,
  hasActiveFilters,
  query,
  onClearFilters,
  getTagColor,
  dateRange,
  onDateRangeChange,
}: SearchFilterSidebarProps) {
  const { t } = useTranslation('common');
  const [collapsed, setCollapsed] = usePersistedToggle('search_sidebar_collapsed', false);

  const activeFilterCount =
    selectedTypes.length +
    selectedTags.length +
    (dateRange[0] !== null || dateRange[1] !== null ? 1 : 0);

  const handlePreset = useCallback(
    (preset: 'last7' | 'last30' | 'last6m' | 'lastYear' | 'allTime') => {
      if (preset === 'allTime') {
        onDateRangeChange([null, null]);
        return;
      }
      if (preset === 'last7') {
        onDateRangeChange(buildPresetRange(7));
        return;
      }
      if (preset === 'last30') {
        onDateRangeChange(buildPresetRange(30));
        return;
      }
      if (preset === 'last6m') {
        onDateRangeChange(buildMonthPresetRange(6));
        return;
      }
      if (preset === 'lastYear') {
        onDateRangeChange(buildMonthPresetRange(12));
        return;
      }
    },
    [onDateRangeChange]
  );

  const isPresetActive = useCallback(
    (preset: 'last7' | 'last30' | 'last6m' | 'lastYear' | 'allTime'): boolean => {
      if (preset === 'allTime') {
        return dateRange[0] === null && dateRange[1] === null;
      }
      return false;
    },
    [dateRange]
  );

  const sortOptions = [
    ...(query ? [{ value: 'relevance', label: t('search.sortRelevance') }] : []),
    { value: 'date_desc', label: t('search.sortDateNewest') },
    { value: 'date_asc', label: t('search.sortDateOldest') },
    { value: 'title', label: t('search.sortTitle') },
  ];

  // ----- Collapsed strip -----
  if (collapsed) {
    return (
      <Paper
        withBorder
        style={{
          width: 48,
          minWidth: 48,
          transition: 'width 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '8px 0',
          gap: 8,
        }}
      >
        <Tooltip
          label={t('search.expandFilters')}
          position="right"
          withArrow
        >
          <ActionIcon
            variant="subtle"
            onClick={() => setCollapsed(false)}
            aria-label={t('search.expandFilters')}
            size="lg"
          >
            <IconFilter size="1rem" />
          </ActionIcon>
        </Tooltip>

        {activeFilterCount > 0 && (
          <Badge
            size="xs"
            circle
            color="blue"
            aria-label={`${activeFilterCount} active filters`}
          >
            {activeFilterCount}
          </Badge>
        )}

        <Tooltip
          label={t('search.expandFilters')}
          position="right"
          withArrow
        >
          <ActionIcon
            variant="subtle"
            size="xs"
            onClick={() => setCollapsed(false)}
            aria-label={t('search.expandFilters')}
          >
            <IconChevronRight size="0.75rem" />
          </ActionIcon>
        </Tooltip>
      </Paper>
    );
  }

  // ----- Expanded sidebar -----
  return (
    <Paper
      withBorder
      p="md"
      style={{
        transition: 'width 0.3s ease',
      }}
    >
      {/* Header row */}
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <IconFilter size="1rem" />
          <Text fw={500}>{t('search.filters')}</Text>
        </Group>
        <Tooltip label={t('search.collapseFilters')} position="right" withArrow>
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={() => setCollapsed(true)}
            aria-label={t('search.collapseFilters')}
          >
            <IconChevronLeft size="0.85rem" />
          </ActionIcon>
        </Tooltip>
      </Group>

      {/* Record type checkboxes */}
      <Stack gap="xs">
        <Text size="sm" fw={500} c="dimmed">
          {t('search.recordTypes')}
        </Text>
        {RECORD_TYPES.map((recordType) => {
          const IconComponent = recordType.icon;
          return (
            <Checkbox
              key={recordType.value}
              label={
                <Group gap="xs" wrap="nowrap">
                  <ThemeIcon size="sm" color={recordType.color} variant="light">
                    <IconComponent size="0.8rem" />
                  </ThemeIcon>
                  <Text size="sm">{recordType.label}</Text>
                </Group>
              }
              checked={selectedTypes.includes(recordType.value)}
              onChange={() => onTypeToggle(recordType.value)}
            />
          );
        })}
      </Stack>

      <Divider my="md" />

      {/* Sort options */}
      <Stack gap="xs">
        <Text size="sm" fw={500} c="dimmed">
          {t('search.sortBy')}
        </Text>
        <Select
          value={sortBy}
          onChange={(val) => {
            if (val) onSortChange(val);
          }}
          data={sortOptions}
          size="sm"
          aria-label={t('search.sortBy')}
        />
      </Stack>

      <Divider my="md" />

      {/* Tag filters */}
      <Stack gap="xs">
        <Group gap="xs">
          <IconTag size="0.9rem" />
          <Text size="sm" fw={500} c="dimmed">
            {t('search.tags')}
          </Text>
        </Group>

        <MultiSelect
          data={popularTags.map((pt) => ({
            value: pt.tag,
            label: `${pt.tag} (${pt.usage_count})`,
          }))}
          value={selectedTags}
          onChange={onTagChange}
          placeholder={
            isLoadingTags ? t('search.loadingTags') : t('search.selectTags')
          }
          searchable
          clearable
          size="xs"
          disabled={isLoadingTags}
          aria-label={t('search.tags')}
        />

        {selectedTags.length >= 2 && (
          <SegmentedControl
            size="xs"
            value={matchMode}
            onChange={onMatchModeChange}
            data={[
              { value: 'any', label: t('search.anyTag') },
              { value: 'all', label: t('search.allTags') },
            ]}
            fullWidth
          />
        )}

        {isLoadingTags && (
          <Stack gap={4}>
            {[1, 2, 3].map((n) => (
              <Skeleton key={n} height={20} radius="md" />
            ))}
          </Stack>
        )}

        {!isLoadingTags && popularTags.length > 0 && (
          <>
            <Text size="xs" c="dimmed" fw={500}>
              {selectedTags.length > 0
                ? t('search.addMoreTags')
                : t('search.popularTags')}
            </Text>
            <Group gap={4} wrap="wrap">
              {popularTags.slice(0, 8).map(({ tag, color }) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <ClickableTagBadge
                    key={tag}
                    tag={tag}
                    color={color ?? getTagColor(tag)}
                    size="xs"
                    compact
                    highlighted={isSelected}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      if (!isSelected) {
                        onTagClick(tag);
                      }
                    }}
                  />
                );
              })}
            </Group>
          </>
        )}
      </Stack>

      <Divider my="md" />

      {/* Date range picker */}
      <Stack gap="xs">
        <Text size="sm" fw={500} c="dimmed">
          {t('search.dateRange')}
        </Text>

        <DatePickerInput
          type="range"
          value={dateRange}
          onChange={onDateRangeChange}
          placeholder={t('search.dateRangePlaceholder')}
          size="xs"
          clearable
          aria-label={t('search.dateRange')}
        />

        <Text size="xs" c="dimmed" fw={500}>
          {t('search.datePresets')}
        </Text>

        <Group gap={4} wrap="wrap">
          {(
            [
              { key: 'last7', label: t('search.last7Days') },
              { key: 'last30', label: t('search.last30Days') },
              { key: 'last6m', label: t('search.last6Months') },
              { key: 'lastYear', label: t('search.lastYear') },
              { key: 'allTime', label: t('search.allTime') },
            ] as const
          ).map(({ key, label }) => (
            <Badge
              key={key}
              size="xs"
              variant={isPresetActive(key) ? 'filled' : 'outline'}
              color="blue"
              style={{ cursor: 'pointer' }}
              role="button"
              tabIndex={0}
              aria-pressed={isPresetActive(key)}
              onClick={() => handlePreset(key)}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handlePreset(key);
                }
              }}
            >
              {label}
            </Badge>
          ))}
        </Group>
      </Stack>

      <Divider my="md" />

      {/* Clear all filters */}
      <Button
        variant="subtle"
        size="sm"
        fullWidth
        disabled={!hasActiveFilters && !query}
        onClick={onClearFilters}
      >
        {t('search.clearFilters')}
      </Button>
    </Paper>
  );
}
