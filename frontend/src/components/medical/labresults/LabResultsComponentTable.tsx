import React, { useState, useMemo, useCallback } from 'react';
import {
  Table,
  TextInput,
  Select,
  Group,
  Badge,
  ActionIcon,
  Button,
  Text,
  Paper,
  Stack,
  Center,
  Card,
  Collapse,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconSearch,
  IconX,
  IconEye,
  IconEdit,
  IconTrash,
  IconFilter,
  IconTrendingUp,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { DateInput } from '../../adapters/DateInput';
import StatusBadge from '../StatusBadge';
import { type LabTestComponentForStack } from '../../../services/api/labTestComponentApi';
import { CATEGORY_SELECT_OPTIONS, getCategoryDisplayName, getCategoryColor } from '../../../constants/labCategories';
import { useDateFormat } from '../../../hooks/useDateFormat';
import TestComponentTrendsPanel from './TestComponentTrendsPanel';

interface DateFormatHook {
  formatDate: (_dateValue: string | null | undefined) => string;
}

interface LabResultRef {
  id: number;
  test_name: string;
  practitioner_id: number | null;
}

interface PractitionerRef {
  id: number;
  name: string;
}

interface Props {
  components: LabTestComponentForStack[];
  labResults: LabResultRef[];
  practitioners: PractitionerRef[];
  patientId: number;
  onView?: (_component: LabTestComponentForStack) => void;
  onEdit?: (_component: LabTestComponentForStack) => void;
  onDelete?: (_componentId: number) => void;
  disableActions?: boolean;
}

interface Filters {
  search: string;
  category: string | null;
  practitionerId: number | null;
  facility: string | null;
  dateFrom: Date | null;
  dateTo: Date | null;
}

interface GroupedTest {
  key: string;
  displayName: string;
  latest: LabTestComponentForStack;
  all: LabTestComponentForStack[];
}

interface CategoryGroup {
  category: string;
  tests: GroupedTest[];
}

function getComponentDate(c: LabTestComponentForStack): string | null {
  return c.completed_date || c.ordered_date || null;
}

function toDateStr(d: Date | null): string | null {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function formatValue(c: LabTestComponentForStack): string {
  if (c.result_type === 'qualitative' && c.qualitative_value) {
    return c.qualitative_value.charAt(0).toUpperCase() + c.qualitative_value.slice(1);
  }
  if (c.result_type === 'textual') {
    return c.textual_value
      ? c.textual_value.length > 80
        ? c.textual_value.slice(0, 80) + '…'
        : c.textual_value
      : '—';
  }
  if (c.value != null) {
    return c.unit ? `${c.value} ${c.unit}` : String(c.value);
  }
  return '—';
}

function formatRefRange(c: LabTestComponentForStack): string {
  if (c.ref_range_text) return c.ref_range_text;
  const min = c.ref_range_min;
  const max = c.ref_range_max;
  if (min != null && max != null) return `${min}–${max}`;
  if (min != null) return `≥${min}`;
  if (max != null) return `≤${max}`;
  return '—';
}

const LabResultsComponentTable: React.FC<Props> = ({
  components,
  labResults,
  practitioners,
  patientId,
  onView,
  onEdit,
  onDelete,
  disableActions = false,
}) => {
  const { t } = useTranslation(['labresults', 'shared', 'common']);
  const { formatDate } = useDateFormat() as DateFormatHook;

  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>({
    search: '',
    category: null,
    practitionerId: null,
    facility: null,
    dateFrom: null,
    dateTo: null,
  });

  const [trendTestName, setTrendTestName] = useState<string | null>(null);
  const [trendUnit, setTrendUnit] = useState<string | null>(null);
  const [trendOpen, setTrendOpen] = useState(false);

  const labResultById = useMemo(() => {
    const map = new Map<number, LabResultRef>();
    for (const lr of labResults) {
      map.set(lr.id, lr);
    }
    return map;
  }, [labResults]);

  const facilityOptions = useMemo(() => {
    const facilities = new Set<string>();
    for (const c of components) {
      if (c.facility) facilities.add(c.facility);
    }
    return Array.from(facilities)
      .sort()
      .map(f => ({ value: f, label: f }));
  }, [components]);

  const practitionerOptions = useMemo(
    () => practitioners.map(p => ({ value: String(p.id), label: p.name })),
    [practitioners]
  );

  const groupedTests = useMemo<GroupedTest[]>(() => {
    const fromStr = toDateStr(filters.dateFrom);
    const toStr = toDateStr(filters.dateTo);
    const searchLower = filters.search.toLowerCase();

    const filtered = components.filter(c => {
      if (searchLower) {
        const name = (c.canonical_test_name || c.test_name || '').toLowerCase();
        const panelName = (labResultById.get(c.lab_result_id)?.test_name || '').toLowerCase();
        if (!name.includes(searchLower) && !panelName.includes(searchLower)) return false;
      }
      if (filters.category != null && c.category !== filters.category) return false;
      if (filters.practitionerId != null) {
        const pid = labResultById.get(c.lab_result_id)?.practitioner_id ?? null;
        if (pid !== filters.practitionerId) return false;
      }
      if (filters.facility != null) {
        if (c.facility !== filters.facility) return false;
      }
      const dateStr = getComponentDate(c);
      if (fromStr && dateStr && dateStr.slice(0, 10) < fromStr) return false;
      if (toStr && dateStr && dateStr.slice(0, 10) > toStr) return false;
      return true;
    });

    const groupMap = new Map<string, LabTestComponentForStack[]>();
    for (const c of filtered) {
      const key = (c.canonical_test_name || c.test_name || '').toLowerCase().trim();
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(c);
    }

    const groups: GroupedTest[] = [];
    for (const [key, comps] of groupMap) {
      const sorted = [...comps].sort((a, b) => {
        const da = getComponentDate(a) || '';
        const db = getComponentDate(b) || '';
        return db.localeCompare(da);
      });
      groups.push({
        key,
        displayName: sorted[0].canonical_test_name || sorted[0].test_name || key,
        latest: sorted[0],
        all: sorted,
      });
    }

    return groups.sort((a, b) => {
      const da = getComponentDate(a.latest) || '';
      const db = getComponentDate(b.latest) || '';
      if (da !== db) return db.localeCompare(da);
      return a.displayName.localeCompare(b.displayName);
    });
  }, [components, labResultById, filters]);

  const groupedByCategory = useMemo<CategoryGroup[]>(() => {
    const map = new Map<string, GroupedTest[]>();
    for (const group of groupedTests) {
      const cat = group.latest.category || 'other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(group);
    }
    const keys = [...map.keys()].sort((a, b) => {
      const aHasAbnormal = map.get(a)!.some(
        g => g.latest.status && g.latest.status !== 'normal'
      );
      const bHasAbnormal = map.get(b)!.some(
        g => g.latest.status && g.latest.status !== 'normal'
      );
      if (aHasAbnormal !== bHasAbnormal) return aHasAbnormal ? -1 : 1;
      return getCategoryDisplayName(a).localeCompare(getCategoryDisplayName(b));
    });
    return keys.map(k => ({ category: k, tests: map.get(k)! }));
  }, [groupedTests]);

  const handleToggleCategory = useCallback((cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const totalGroupCount = useMemo(() => {
    const keys = new Set(
      components.map(c => (c.canonical_test_name || c.test_name || '').toLowerCase().trim())
    );
    return keys.size;
  }, [components]);

  const hasActiveFilters =
    !!(filters.search || filters.category !== null || filters.practitionerId !== null || filters.facility !== null || filters.dateFrom !== null || filters.dateTo !== null);

  const activeNonSearchFilterCount = [
    filters.category !== null,
    filters.practitionerId !== null,
    filters.facility !== null,
    filters.dateFrom !== null,
    filters.dateTo !== null,
  ].filter(Boolean).length;

  const handleClearFilters = useCallback(() => {
    setFilters({ search: '', category: null, practitionerId: null, facility: null, dateFrom: null, dateTo: null });
  }, []);

  const handleOpenTrend = useCallback((group: GroupedTest) => {
    setTrendTestName(group.displayName);
    setTrendUnit(group.latest.unit ?? null);
    setTrendOpen(true);
  }, []);

  const handleCloseTrend = useCallback(() => {
    setTrendOpen(false);
    setTrendTestName(null);
    setTrendUnit(null);
  }, []);

  const anyExpanded = allExpanded || expandedTests.size > 0;

  const handleToggleAll = useCallback(() => {
    if (anyExpanded) {
      setAllExpanded(false);
      setExpandedTests(new Set());
    } else {
      setAllExpanded(true);
      setExpandedTests(new Set());
    }
  }, [anyExpanded]);

  const handleToggleTest = useCallback((key: string) => {
    const isExpanded = allExpanded || expandedTests.has(key);
    if (isExpanded) {
      if (allExpanded) {
        // Collapse this one: turn off allExpanded, keep all others expanded
        const others = new Set(groupedTests.map(g => g.key).filter(k => k !== key));
        setAllExpanded(false);
        setExpandedTests(others);
      } else {
        setExpandedTests(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    } else {
      setExpandedTests(prev => new Set(prev).add(key));
    }
  }, [allExpanded, expandedTests, groupedTests]);

  return (
    <Stack gap="sm">
      {/* Filters */}
      <Card withBorder shadow="sm" p="sm" radius="md">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 50%', minWidth: 0 }}>
            <ActionIcon
              variant={filtersExpanded ? 'filled' : 'light'}
              color={hasActiveFilters ? 'blue' : 'gray'}
              size="lg"
              onClick={() => setFiltersExpanded(prev => !prev)}
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
                  filtered: groupedTests.length,
                  total: totalGroupCount,
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
            >
              {filtersExpanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            </ActionIcon>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flex: '0 1 auto', minWidth: 0 }}>
            <TextInput
              placeholder={t('common:buttons.search', 'Search')}
              leftSection={<IconSearch size={14} />}
              value={filters.search}
              onChange={e => setFilters(prev => ({ ...prev, search: e.currentTarget.value }))}
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
              <Select
                placeholder={t('shared:labels.category', 'Category')}
                data={CATEGORY_SELECT_OPTIONS}
                value={filters.category}
                onChange={val => setFilters(prev => ({ ...prev, category: val }))}
                size="sm"
                clearable
                style={{ flex: '1 1 160px', minWidth: 140 }}
              />
              <DateInput
                placeholder={t('labresults:resultsTable.dateFrom', 'Date from')}
                value={filters.dateFrom}
                onChange={(val: Date | null) => setFilters(prev => ({ ...prev, dateFrom: val }))}
                size="sm"
                clearable
                style={{ flex: '1 1 140px', minWidth: 120 }}
              />
              <DateInput
                placeholder={t('labresults:resultsTable.dateTo', 'Date to')}
                value={filters.dateTo}
                onChange={(val: Date | null) => setFilters(prev => ({ ...prev, dateTo: val }))}
                size="sm"
                clearable
                style={{ flex: '1 1 140px', minWidth: 120 }}
              />
              {practitionerOptions.length > 0 && (
                <Select
                  placeholder={t('shared:fields.practitioner', 'Practitioner')}
                  data={practitionerOptions}
                  value={filters.practitionerId != null ? String(filters.practitionerId) : null}
                  onChange={val => setFilters(prev => ({ ...prev, practitionerId: val ? Number(val) : null }))}
                  size="sm"
                  clearable
                  style={{ flex: '1 1 160px', minWidth: 140 }}
                />
              )}
              {facilityOptions.length > 0 && (
                <Select
                  placeholder={t('shared:labels.facility', 'Facility')}
                  data={facilityOptions}
                  value={filters.facility}
                  onChange={val => setFilters(prev => ({ ...prev, facility: val }))}
                  size="sm"
                  clearable
                  style={{ flex: '1 1 160px', minWidth: 140 }}
                />
              )}
            </Group>
          </Card>
        </Collapse>
      </Card>

      {/* Table */}
      <Paper withBorder radius="md" style={{ overflow: 'auto' }}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 80 }}>
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={handleToggleAll}
                  disabled={groupedTests.length === 0}
                  data-testid="expand-all-btn"
                >
                  {anyExpanded
                    ? t('labresults:resultsTable.collapseAll', 'Collapse All')
                    : t('labresults:resultsTable.expandAll', 'Expand All')}
                </Button>
              </Table.Th>
              <Table.Th>{t('shared:fields.testName', 'Test Name')}</Table.Th>
              <Table.Th>{t('shared:labels.value', 'Value')}</Table.Th>
              <Table.Th>{t('shared:fields.status', 'Status')}</Table.Th>
              <Table.Th>{t('labresults:modal.labels.referenceRange', 'Reference Range')}</Table.Th>
              <Table.Th>{t('shared:labels.completedDate', 'Date')}</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {groupedTests.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Center py="xl">
                    <Text c="dimmed" size="sm">
                      {t('labresults:resultsTable.noResults', 'No test results match the current filters')}
                    </Text>
                  </Center>
                </Table.Td>
              </Table.Tr>
            ) : (
              groupedByCategory.map(({ category, tests }) => {
                const isCategoryCollapsed = collapsedCategories.has(category);
                const catColor = getCategoryColor(category);
                return (
                  <React.Fragment key={category}>
                    {/* Category header row */}
                    <Table.Tr
                      style={{ cursor: 'pointer', backgroundColor: `var(--mantine-color-${catColor}-0)` }}
                      onClick={() => handleToggleCategory(category)}
                      data-testid={`category-row-${category}`}
                    >
                      <Table.Td colSpan={7} py={6} px="sm">
                        <Group gap="xs">
                          {isCategoryCollapsed ? (
                            <IconChevronRight size={14} color={`var(--mantine-color-${catColor}-6)`} />
                          ) : (
                            <IconChevronDown size={14} color={`var(--mantine-color-${catColor}-6)`} />
                          )}
                          <Text size="sm" fw={600} c={catColor}>
                            {getCategoryDisplayName(category)}
                          </Text>
                          <Badge variant="light" color={catColor} size="xs">
                            {tests.length}
                          </Badge>
                        </Group>
                      </Table.Td>
                    </Table.Tr>

                    {/* Test rows for this category */}
                    {!isCategoryCollapsed && tests.map(group => {
                      const isExpanded = allExpanded || expandedTests.has(group.key);
                      return (
                        <React.Fragment key={group.key}>
                          <Table.Tr
                            data-testid={`summary-row-${group.key}`}
                            onClick={() => handleToggleTest(group.key)}
                            style={{ cursor: 'pointer' }}
                          >
                            <Table.Td>
                              <Group gap={4} wrap="nowrap">
                                <ActionIcon
                                  size="sm"
                                  variant="subtle"
                                  onClick={e => { e.stopPropagation(); handleToggleTest(group.key); }}
                                  aria-label={
                                    isExpanded
                                      ? t('labresults:resultsTable.collapseAll', 'Collapse All')
                                      : t('labresults:resultsTable.expandAll', 'Expand All')
                                  }
                                  data-testid={`expand-btn-${group.key}`}
                                >
                                  {isExpanded ? (
                                    <IconChevronDown size={14} />
                                  ) : (
                                    <IconChevronRight size={14} />
                                  )}
                                </ActionIcon>
                                <Badge size="xs" variant="light" color="blue" data-testid={`count-badge-${group.key}`}>
                                  {group.all.length}
                                </Badge>
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" fw={500}>{group.displayName}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{formatValue(group.latest)}</Text>
                            </Table.Td>
                            <Table.Td>
                              <StatusBadge status={group.latest.status ?? undefined} size="sm" />
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" c="dimmed">{formatRefRange(group.latest)}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" c="dimmed">
                                {formatDate(getComponentDate(group.latest))}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              {group.latest.result_type !== 'textual' && (
                                <ActionIcon
                                  size="sm"
                                  variant="subtle"
                                  color="teal"
                                  onClick={e => { e.stopPropagation(); handleOpenTrend(group); }}
                                  aria-label={t('labresults:resultsTable.viewTrends', 'View trends')}
                                  data-testid={`trend-btn-${group.key}`}
                                >
                                  <IconTrendingUp size={14} />
                                </ActionIcon>
                              )}
                            </Table.Td>
                          </Table.Tr>
                          {isExpanded &&
                            group.all.map(comp => (
                              <Table.Tr
                                key={comp.id}
                                data-testid={`history-row-${comp.id}`}
                                style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}
                              >
                                <Table.Td />
                                <Table.Td />
                                <Table.Td>
                                  <Text size="xs">{formatValue(comp)}</Text>
                                </Table.Td>
                                <Table.Td>
                                  <StatusBadge status={comp.status ?? undefined} size="xs" />
                                </Table.Td>
                                <Table.Td>
                                  <Text size="xs" c="dimmed">{formatRefRange(comp)}</Text>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="xs" c="dimmed">
                                    {formatDate(getComponentDate(comp))}
                                  </Text>
                                </Table.Td>
                                <Table.Td>
                                  <Group gap={4} wrap="nowrap">
                                    {onView && (
                                      <ActionIcon
                                        size="xs"
                                        variant="subtle"
                                        color="blue"
                                        disabled={disableActions}
                                        onClick={() => onView(comp)}
                                        aria-label={t('shared:buttons.view', 'View')}
                                      >
                                        <IconEye size={13} />
                                      </ActionIcon>
                                    )}
                                    {onEdit && (
                                      <ActionIcon
                                        size="xs"
                                        variant="subtle"
                                        disabled={disableActions}
                                        onClick={() => onEdit(comp)}
                                        aria-label={t('shared:buttons.edit', 'Edit')}
                                      >
                                        <IconEdit size={13} />
                                      </ActionIcon>
                                    )}
                                    {onDelete && (
                                      <ActionIcon
                                        size="xs"
                                        variant="subtle"
                                        color="red"
                                        disabled={disableActions}
                                        onClick={() => onDelete(comp.id)}
                                        aria-label={t('shared:buttons.delete', 'Delete')}
                                      >
                                        <IconTrash size={13} />
                                      </ActionIcon>
                                    )}
                                  </Group>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })
            )}
          </Table.Tbody>
        </Table>
      </Paper>

      {groupedTests.length > 0 && (
        <Text size="xs" c="dimmed" ta="right">
          {t('labresults:resultsTable.results', '{{count}} results', {
            count: groupedTests.length,
          })}
        </Text>
      )}

      <TestComponentTrendsPanel
        opened={trendOpen}
        onClose={handleCloseTrend}
        testName={trendTestName}
        unit={trendUnit}
        patientId={patientId}
      />
    </Stack>
  );
};

export default LabResultsComponentTable;
