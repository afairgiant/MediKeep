/**
 * TestComponentCatalog - Main catalog view showing one card per unique test name
 * across all lab results for a patient. Includes search, filters, category grouping,
 * sort toggle, and trend panel.
 *
 * Filters and aggregates the same patientComponents data used by the Results Table,
 * so no separate API call is needed.
 */

import React, {
  useState,
  useCallback,
  useMemo,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Stack,
  Group,
  TextInput,
  Select,
  Text,
  Skeleton,
  SimpleGrid,
  SegmentedControl,
  Collapse,
  UnstyledButton,
  Badge,
  Card,
  ActionIcon,
} from '@mantine/core';
import {
  IconSearch,
  IconSortAscending,
  IconAlertTriangle,
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconFilter,
  IconX,
} from '@tabler/icons-react';
import {
  ComponentCatalogEntry,
  LabTestComponentForStack,
} from '../../../services/api/labTestComponentApi';
import {
  CATEGORY_SELECT_OPTIONS,
  getCategoryDisplayName,
  getCategoryColor,
} from '../../../constants/labCategories';
import { DateInput } from '../../adapters/DateInput';
import AnimatedCardGrid from '../../shared/AnimatedCardGrid';
import EmptyState from '../../shared/EmptyState';
import TestComponentCatalogCard from './TestComponentCatalogCard';
import TestComponentTrendsPanel from './TestComponentTrendsPanel';
import { labChartKey } from '../../../utils/labChartKey';

interface LabResultRef {
  id: number;
  test_name: string;
  practitioner_id: number | null;
}

interface PractitionerRef {
  id: number;
  name: string;
}

interface TestComponentCatalogProps {
  components: LabTestComponentForStack[];
  labResults: LabResultRef[];
  practitioners: PractitionerRef[];
  loading?: boolean;
  patientId: number;
}

function getStatusOptions(t: (_key: string, _fallback: string) => string) {
  return [
    {
      value: 'critical',
      label: t('medical:componentCatalog.status.critical', 'Critical'),
    },
    {
      value: 'abnormal',
      label: t('medical:componentCatalog.status.abnormal', 'Abnormal'),
    },
    { value: 'high', label: t('medical:componentCatalog.status.high', 'High') },
    { value: 'low', label: t('medical:componentCatalog.status.low', 'Low') },
    {
      value: 'borderline',
      label: t('medical:componentCatalog.status.borderline', 'Borderline'),
    },
    {
      value: 'normal',
      label: t('medical:componentCatalog.status.normal', 'Normal'),
    },
  ];
}

type SortMode = 'priority' | 'alphabetical';

const STATUS_PRIORITY = ['critical', 'abnormal', 'high', 'low', 'borderline', 'normal'];

function toDateStr(d: Date | null): string | null {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getComponentDate(c: LabTestComponentForStack): string | null {
  return c.completed_date || c.ordered_date || null;
}

function computeTrendDirection(
  sorted: LabTestComponentForStack[]
): ComponentCatalogEntry['trend_direction'] {
  if (sorted.length < 2) return 'stable';
  const latest = sorted[0];
  const prev = sorted[1];
  if (latest.value == null || prev.value == null) return 'stable';
  const latestVal = Number(latest.value);
  const prevVal = Number(prev.value);
  if (latestVal === prevVal) return 'stable';
  const increasing = latestVal > prevVal;
  const status = latest.status?.toLowerCase();
  if (status === 'high' || status === 'critical') {
    return increasing ? 'worsening' : 'improving';
  }
  if (status === 'low') {
    return increasing ? 'improving' : 'worsening';
  }
  return increasing ? 'increasing' : 'decreasing';
}

const TestComponentCatalog: React.FC<TestComponentCatalogProps> = ({
  components,
  labResults,
  practitioners,
  loading = false,
  patientId,
}) => {
  const { t } = useTranslation(['medical', 'common', 'shared', 'labresults']);

  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [practitionerId, setPractitionerId] = useState<number | null>(null);
  const [facility, setFacility] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('priority');

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const [trendTestName, setTrendTestName] = useState<string | null>(null);
  const [trendUnit, setTrendUnit] = useState<string | null>(null);
  const [trendOpen, setTrendOpen] = useState(false);

  const labResultById = useMemo(() => {
    const map = new Map<number, LabResultRef>();
    for (const lr of labResults) map.set(lr.id, lr);
    return map;
  }, [labResults]);

  const facilityOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    for (const c of components) {
      if (c.facility && !seen.has(c.facility)) {
        seen.add(c.facility);
        opts.push({ value: c.facility, label: c.facility });
      }
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [components]);

  const practitionerOptions = useMemo(
    () => practitioners.map(p => ({ value: String(p.id), label: p.name })),
    [practitioners]
  );

  const totalCatalogCount = useMemo(() => {
    const keys = new Set(
      components.map(c => labChartKey(c.canonical_test_name || c.test_name || '', c.unit ?? null))
    );
    return keys.size;
  }, [components]);

  const catalogItems = useMemo<ComponentCatalogEntry[]>(() => {
    const fromStr = toDateStr(dateFrom);
    const toStr = toDateStr(dateTo);
    const searchLower = search.toLowerCase();

    const filtered = components.filter(c => {
      if (searchLower) {
        const name = (c.canonical_test_name || c.test_name || '').toLowerCase();
        const panelName = (labResultById.get(c.lab_result_id)?.test_name || '').toLowerCase();
        if (!name.includes(searchLower) && !panelName.includes(searchLower)) return false;
      }
      if (category != null && c.category !== category) return false;
      if (status != null && c.status !== status) return false;
      if (practitionerId != null) {
        const pid = labResultById.get(c.lab_result_id)?.practitioner_id ?? null;
        if (pid !== practitionerId) return false;
      }
      if (facility != null && c.facility !== facility) return false;
      const dateStr = getComponentDate(c);
      if (fromStr && (!dateStr || dateStr.slice(0, 10) < fromStr)) return false;
      if (toStr && (!dateStr || dateStr.slice(0, 10) > toStr)) return false;
      return true;
    });

    const groupMap = new Map<string, LabTestComponentForStack[]>();
    for (const c of filtered) {
      const key = labChartKey(c.canonical_test_name || c.test_name || '', c.unit ?? null);
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(c);
    }

    const entries: ComponentCatalogEntry[] = [];
    for (const comps of groupMap.values()) {
      const sorted = [...comps].sort((a, b) => {
        const da = getComponentDate(a) || '';
        const db = getComponentDate(b) || '';
        return db.localeCompare(da);
      });
      const latest = sorted[0];
      const displayName = latest.canonical_test_name || latest.test_name || '';
      entries.push({
        test_name: displayName,
        trend_test_name: displayName,
        abbreviation: latest.abbreviation ?? null,
        latest_value: latest.value ?? null,
        latest_qualitative_value: latest.qualitative_value ?? null,
        unit: latest.unit ?? null,
        status: latest.status ?? null,
        category: latest.category ?? null,
        result_type: latest.result_type ?? null,
        reading_count: sorted.length,
        trend_direction: computeTrendDirection(sorted),
        latest_date: getComponentDate(latest),
        ref_range_min: latest.ref_range_min ?? null,
        ref_range_max: latest.ref_range_max ?? null,
        ref_range_text: latest.ref_range_text ?? null,
      });
    }

    if (sortMode === 'alphabetical') {
      entries.sort((a, b) => a.test_name.localeCompare(b.test_name));
    } else {
      entries.sort((a, b) => {
        const ai = STATUS_PRIORITY.indexOf(a.status || 'normal');
        const bi = STATUS_PRIORITY.indexOf(b.status || 'normal');
        if (ai !== bi) return ai - bi;
        return a.test_name.localeCompare(b.test_name);
      });
    }

    return entries;
  }, [components, labResultById, search, category, status, dateFrom, dateTo, practitionerId, facility, sortMode]);

  const groupedByCategory = useMemo(() => {
    const groups: Record<string, ComponentCatalogEntry[]> = {};
    for (const item of catalogItems) {
      const cat = item.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    const keys = Object.keys(groups).sort((a, b) => {
      const aHasAbnormal = groups[a].some(i => i.status && i.status !== 'normal');
      const bHasAbnormal = groups[b].some(i => i.status && i.status !== 'normal');
      if (aHasAbnormal !== bHasAbnormal) return aHasAbnormal ? -1 : 1;
      return getCategoryDisplayName(a).localeCompare(getCategoryDisplayName(b));
    });
    return keys.map(key => ({ category: key, items: groups[key] }));
  }, [catalogItems]);

  const hasActiveFilters = !!(
    search || category || status || dateFrom || dateTo || practitionerId != null || facility
  );

  const activeNonSearchFilterCount = [
    category != null,
    status != null,
    dateFrom != null,
    dateTo != null,
    practitionerId != null,
    facility != null,
  ].filter(Boolean).length;

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setCategory(null);
    setStatus(null);
    setDateFrom(null);
    setDateTo(null);
    setPractitionerId(null);
    setFacility(null);
  }, []);

  const handleCardClick = useCallback((testName: string, unit: string | null) => {
    setTrendTestName(testName);
    setTrendUnit(unit);
    setTrendOpen(true);
  }, []);

  const handleCloseTrend = useCallback(() => {
    setTrendOpen(false);
    setTrendTestName(null);
    setTrendUnit(null);
  }, []);

  const toggleGroup = useCallback((cat: string) => {
    setCollapsedGroups(prev => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  return (
    <>
      <Stack gap="md">
        {/* Collapsible filter bar */}
        <Card withBorder shadow="sm" p="sm" radius="md">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 50%', minWidth: 0 }}>
              <ActionIcon
                variant={filtersExpanded ? 'filled' : 'light'}
                color={hasActiveFilters ? 'blue' : 'gray'}
                size="lg"
                onClick={() => setFiltersExpanded(prev => !prev)}
                aria-label={t('common:filters.toggle', 'Toggle filters')}
              >
                <IconFilter size={18} />
              </ActionIcon>
              <div style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden' }}>
                <Group gap="xs" align="center" style={{ flexWrap: 'nowrap' }}>
                  <Text size="md" fw={500} style={{ whiteSpace: 'nowrap' }}>
                    {t('common:filters.title', 'Filters & Search')}
                  </Text>
                  {hasActiveFilters && (
                    <Badge color="blue" variant="light" size="sm">
                      {t('shared:labels.active', 'Active')}
                    </Badge>
                  )}
                </Group>
                <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t('common:filters.itemCount', '{{filtered}} of {{total}} items', {
                    filtered: catalogItems.length,
                    total: totalCatalogCount,
                  })}
                  {activeNonSearchFilterCount > 0
                    ? ` • ${t('shared:labels.countMoreFilters', '{{count}} more filters', { count: activeNonSearchFilterCount })}`
                    : ''}
                </Text>
              </div>
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={() => setFiltersExpanded(prev => !prev)}
                style={{ flexShrink: 0 }}
                aria-label={t('common:filters.toggle', 'Toggle filters')}
              >
                {filtersExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
              </ActionIcon>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flex: '0 1 auto', minWidth: 0 }}>
              <TextInput
                placeholder={t('common:buttons.search', 'Search')}
                leftSection={<IconSearch size={14} />}
                value={search}
                onChange={e => setSearch(e.currentTarget.value)}
                size="sm"
                style={{ width: '180px', minWidth: '100px', maxWidth: '180px' }}
              />
              {hasActiveFilters && (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={handleClearFilters}
                  aria-label={t('shared:labels.clearFilters', 'Clear filters')}
                >
                  <IconX size={14} />
                </ActionIcon>
              )}
            </div>
          </div>

          <Collapse in={filtersExpanded}>
            <Card withBorder p="sm" bg="gray.0" mt="sm" style={{ borderStyle: 'dashed' }}>
              <Group gap="sm" wrap="wrap" align="flex-end">
                <DateInput
                  placeholder={t('labresults:resultsTable.dateFrom', 'Date from')}
                  value={dateFrom}
                  onChange={(val: Date | null) => setDateFrom(val)}
                  size="sm"
                  clearable
                  style={{ flex: '1 1 140px', minWidth: 120 }}
                />
                <DateInput
                  placeholder={t('labresults:resultsTable.dateTo', 'Date to')}
                  value={dateTo}
                  onChange={(val: Date | null) => setDateTo(val)}
                  size="sm"
                  clearable
                  style={{ flex: '1 1 140px', minWidth: 120 }}
                />
                <Select
                  placeholder={t('shared:labels.category', 'Category')}
                  data={CATEGORY_SELECT_OPTIONS}
                  value={category}
                  onChange={setCategory}
                  size="sm"
                  clearable
                  style={{ flex: '1 1 160px', minWidth: 140 }}
                />
                <Select
                  placeholder={t('shared:fields.status', 'Status')}
                  data={getStatusOptions(t)}
                  value={status}
                  onChange={setStatus}
                  size="sm"
                  clearable
                  style={{ flex: '1 1 140px', minWidth: 120 }}
                />
                {practitionerOptions.length > 0 && (
                  <Select
                    placeholder={t('shared:fields.practitioner', 'Practitioner')}
                    data={practitionerOptions}
                    value={practitionerId != null ? String(practitionerId) : null}
                    onChange={val => setPractitionerId(val ? Number(val) : null)}
                    size="sm"
                    clearable
                    style={{ flex: '1 1 160px', minWidth: 140 }}
                  />
                )}
                {facilityOptions.length > 0 && (
                  <Select
                    placeholder={t('shared:labels.facility', 'Facility')}
                    data={facilityOptions}
                    value={facility}
                    onChange={setFacility}
                    size="sm"
                    clearable
                    style={{ flex: '1 1 160px', minWidth: 140 }}
                  />
                )}
              </Group>
            </Card>
          </Collapse>
        </Card>

        {/* Sort toggle + count */}
        {!loading && catalogItems.length > 0 && (
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {t(
                'shared:labels.showingCountUniqueTests',
                'Showing {{count}} unique tests',
                { count: catalogItems.length }
              )}
            </Text>
            <SegmentedControl
              size="xs"
              value={sortMode}
              onChange={val => setSortMode(val as SortMode)}
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
                      <span>
                        {t('medical:componentCatalog.sort.alphabetical', 'A-Z')}
                      </span>
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

        {/* Empty state */}
        {!loading && catalogItems.length === 0 && (
          <EmptyState
            emoji={"\uD83E\uDDEA"}
            title={t(
              'medical:componentCatalog.noResults',
              'No Test Results Found'
            )}
            hasActiveFilters={hasActiveFilters}
            filteredMessage={t(
              'shared:emptyStates.adjustSearch',
              'Try adjusting your search or filter criteria.'
            )}
            noDataMessage={t(
              'medical:componentCatalog.noData',
              'Add Lab Results to see them here.'
            )}
          />
        )}

        {/* Card grid grouped by category (collapsible) */}
        {!loading &&
          catalogItems.length > 0 &&
          groupedByCategory.map(({ category: cat, items: catItems }) => {
            const isCollapsed = !!collapsedGroups[cat];
            return (
              <Stack key={cat} gap="xs">
                <UnstyledButton
                  onClick={() => toggleGroup(cat)}
                  style={{ width: '100%' }}
                >
                  <Group gap="xs" py={4}>
                    {isCollapsed ? (
                      <IconChevronRight
                        size={16}
                        color="var(--mantine-color-dimmed)"
                      />
                    ) : (
                      <IconChevronDown
                        size={16}
                        color="var(--mantine-color-dimmed)"
                      />
                    )}
                    <Text size="sm" fw={600} c={getCategoryColor(cat)}>
                      {getCategoryDisplayName(cat)}
                    </Text>
                    <Badge
                      variant="light"
                      color={getCategoryColor(cat)}
                      size="sm"
                    >
                      {catItems.length}
                    </Badge>
                  </Group>
                </UnstyledButton>
                <Collapse in={!isCollapsed}>
                  <AnimatedCardGrid
                    items={catItems}
                    columns={{ base: 12, md: 6, lg: 4 }}
                    keyExtractor={(entry: ComponentCatalogEntry) =>
                      labChartKey(entry.trend_test_name, entry.unit ?? null)
                    }
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
        unit={trendUnit}
        patientId={patientId}
      />
    </>
  );
};

export default TestComponentCatalog;
