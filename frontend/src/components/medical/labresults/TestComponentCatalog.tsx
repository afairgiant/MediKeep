/**
 * TestComponentCatalog - Main catalog view showing one card per unique test name
 * across all lab results for a patient. Includes search, filters, category grouping,
 * sort toggle, and trend panel.
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Stack,
  Group,
  TextInput,
  Select,
  Text,
  Skeleton,
  Alert,
  SimpleGrid,
  SegmentedControl,
  Collapse,
  UnstyledButton,
  Badge,
} from '@mantine/core';
import { IconSearch, IconAlertCircle, IconSortAscending, IconAlertTriangle, IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import {
  labTestComponentApi,
  ComponentCatalogEntry,
} from '../../../services/api/labTestComponentApi';
import { CATEGORY_SELECT_OPTIONS, getCategoryDisplayName, getCategoryColor } from '../../../constants/labCategories';
import AnimatedCardGrid from '../../shared/AnimatedCardGrid';
import EmptyState from '../../shared/EmptyState';
import TestComponentCatalogCard from './TestComponentCatalogCard';
import TestComponentTrendsPanel from './TestComponentTrendsPanel';
import logger from '../../../services/logger';

interface TestComponentCatalogProps {
  patientId: number;
}

function getStatusOptions(t: (key: string, fallback: string) => string) {
  return [
    { value: 'critical', label: t('medical:componentCatalog.status.critical', 'Critical') },
    { value: 'abnormal', label: t('medical:componentCatalog.status.abnormal', 'Abnormal') },
    { value: 'high', label: t('medical:componentCatalog.status.high', 'High') },
    { value: 'low', label: t('medical:componentCatalog.status.low', 'Low') },
    { value: 'borderline', label: t('medical:componentCatalog.status.borderline', 'Borderline') },
    { value: 'normal', label: t('medical:componentCatalog.status.normal', 'Normal') },
  ];
}

type SortMode = 'priority' | 'alphabetical';

const TestComponentCatalog: React.FC<TestComponentCatalogProps> = ({ patientId }) => {
  const { t } = useTranslation(['medical', 'common', 'shared']);
  const [items, setItems] = useState<ComponentCatalogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('priority');

  // Collapsed category groups (all expanded by default)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Trend panel
  const [trendTestName, setTrendTestName] = useState<string | null>(null);
  const [trendOpen, setTrendOpen] = useState(false);

  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchCatalog = useCallback(
    async (searchVal: string, categoryVal: string | null, statusVal: string | null) => {
      // Cancel previous request
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const response = await labTestComponentApi.getComponentCatalog(
          patientId,
          {
            search: searchVal || undefined,
            category: categoryVal || undefined,
            status: statusVal || undefined,
            limit: 500,
          },
          controller.signal,
        );
        setItems(response.items);
        setTotal(response.total);
      } catch (err: any) {
        if (err.name === 'AbortError' || err.name === 'CanceledError') return;
        const message = err?.message || t('medical:componentCatalog.fetchError', 'Failed to load test catalog');
        setError(message);
        logger.error('component_catalog_load_error', {
          patientId,
          error: message,
          component: 'TestComponentCatalog',
        });
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [patientId, t],
  );

  // Initial fetch and refetch on filter changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      fetchCatalog(search, category, status);
    }, search ? 300 : 0);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, category, status, fetchCatalog]);

  // Cleanup abort on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const handleCardClick = useCallback((testName: string) => {
    setTrendTestName(testName);
    setTrendOpen(true);
  }, []);

  const handleCloseTrend = useCallback(() => {
    setTrendOpen(false);
    setTrendTestName(null);
  }, []);

  const toggleGroup = useCallback((cat: string) => {
    setCollapsedGroups(prev => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  // Sort items and group by category
  const sortedItems = useMemo(() => {
    if (sortMode === 'alphabetical') {
      return [...items].sort((a, b) => a.test_name.localeCompare(b.test_name));
    }
    // Default: priority sort (from backend - abnormal first)
    return items;
  }, [items, sortMode]);

  // Group items by category for display
  const groupedByCategory = useMemo(() => {
    const groups: Record<string, ComponentCatalogEntry[]> = {};
    for (const item of sortedItems) {
      const cat = item.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    // Sort category keys: put categories with abnormal items first, then alphabetical
    const keys = Object.keys(groups).sort((a, b) => {
      const aHasAbnormal = groups[a].some(i => i.status && i.status !== 'normal');
      const bHasAbnormal = groups[b].some(i => i.status && i.status !== 'normal');
      if (aHasAbnormal !== bHasAbnormal) return aHasAbnormal ? -1 : 1;
      return getCategoryDisplayName(a).localeCompare(getCategoryDisplayName(b));
    });
    return keys.map(key => ({ category: key, items: groups[key] }));
  }, [sortedItems]);

  const hasActiveFilters = !!(search || category || status);

  return (
    <>
      <Stack gap="md">
        {/* Filter bar */}
        <Group gap="sm" grow preventGrowOverflow>
          <TextInput
            placeholder={t('medical:componentCatalog.searchPlaceholder', 'Search tests...')}
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 2, minWidth: 200 }}
          />
          <Select
            placeholder={t('shared:labels.category', 'Category')}
            data={CATEGORY_SELECT_OPTIONS}
            value={category}
            onChange={setCategory}
            clearable
            style={{ flex: 1, minWidth: 160 }}
          />
          <Select
            placeholder={t('shared:fields.status', 'Status')}
            data={getStatusOptions(t)}
            value={status}
            onChange={setStatus}
            clearable
            style={{ flex: 1, minWidth: 140 }}
          />
        </Group>

        {/* Sort toggle + count */}
        {!loading && !error && items.length > 0 && (
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {t('shared:labels.showingCountUniqueTests', 'Showing {{count}} unique tests', { count: total })}
            </Text>
            <SegmentedControl
              size="xs"
              value={sortMode}
              onChange={(val) => setSortMode(val as SortMode)}
              data={[
                {
                  value: 'priority',
                  label: (
                    <Group gap={4}>
                      <IconAlertTriangle size={14} />
                      <span>{t('shared:labels.priority', 'Priority')}</span>
                    </Group>
                  ),
                },
                {
                  value: 'alphabetical',
                  label: (
                    <Group gap={4}>
                      <IconSortAscending size={14} />
                      <span>{t('medical:componentCatalog.sort.alphabetical', 'A-Z')}</span>
                    </Group>
                  ),
                },
              ]}
            />
          </Group>
        )}

        {/* Loading state */}
        {loading && (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={180} radius="md" />
            ))}
          </SimpleGrid>
        )}

        {/* Error state */}
        {!loading && error && (
          <Alert icon={<IconAlertCircle size={16} />} title={t('common:errors.loadFailed', 'Load Failed')} color="red">
            {error}
          </Alert>
        )}

        {/* Empty state */}
        {!loading && !error && items.length === 0 && (
          <EmptyState
            emoji="\uD83E\uDDEA"
            title={t('medical:componentCatalog.noResults', 'No Test Components Found')}
            hasActiveFilters={hasActiveFilters}
            filteredMessage={t('shared:emptyStates.adjustSearch', 'Try adjusting your search or filter criteria.')}
            noDataMessage={t('medical:componentCatalog.noData', 'Add lab results with test components to see them here.')}
          />
        )}

        {/* Card grid grouped by category (collapsible) */}
        {!loading && !error && items.length > 0 && groupedByCategory.map(({ category: cat, items: catItems }) => {
          const isCollapsed = !!collapsedGroups[cat];
          return (
            <Stack key={cat} gap="xs">
              <UnstyledButton onClick={() => toggleGroup(cat)} style={{ width: '100%' }}>
                <Group gap="xs" py={4}>
                  {isCollapsed
                    ? <IconChevronRight size={16} color="var(--mantine-color-dimmed)" />
                    : <IconChevronDown size={16} color="var(--mantine-color-dimmed)" />
                  }
                  <Text size="sm" fw={600} c={getCategoryColor(cat)}>
                    {getCategoryDisplayName(cat)}
                  </Text>
                  <Badge variant="light" color={getCategoryColor(cat)} size="sm">
                    {catItems.length}
                  </Badge>
                </Group>
              </UnstyledButton>
              <Collapse in={!isCollapsed}>
                <AnimatedCardGrid
                  items={catItems}
                  columns={{ base: 12, md: 6, lg: 4 }}
                  keyExtractor={(entry: ComponentCatalogEntry) => entry.trend_test_name}
                  renderCard={(entry: ComponentCatalogEntry) => (
                    <TestComponentCatalogCard
                      entry={entry}
                      onClick={handleCardClick}
                    />
                  )}
                />
              </Collapse>
            </Stack>
          );
        })}
      </Stack>

      {/* Trend panel drawer */}
      <TestComponentTrendsPanel
        opened={trendOpen}
        onClose={handleCloseTrend}
        testName={trendTestName}
        patientId={patientId}
      />
    </>
  );
};

export default TestComponentCatalog;
