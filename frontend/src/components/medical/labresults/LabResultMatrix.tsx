import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Text,
  Paper,
  Group,
  Stack,
  Loader,
  Center,
  Alert,
  Badge,
  SegmentedControl,
  Tooltip,
  ScrollArea,
  MultiSelect,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';

import { labTestComponentApi } from '../../../services/api/labTestComponentApi';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { getCategoryColor, getCategoryDisplayName, CATEGORY_SELECT_OPTIONS } from '../../../constants/labCategories';
import type { ComponentStatus } from '../../../constants/labCategories';
import logger from '../../../services/logger';

// --- Types ---

interface LabResult {
  id: number | string;
  test_name?: string;
  completed_date?: string;
  [key: string]: unknown;
}

interface TestComponent {
  test_name: string;
  category?: string;
  unit?: string;
  display_order?: number;
  result_type?: string;
  value?: number | string | null;
  qualitative_value?: string | null;
  status?: ComponentStatus | string;
  ref_range_min?: number | null;
  ref_range_max?: number | null;
  ref_range_text?: string | null;
}

interface LabResultMatrixProps {
  labResults: LabResult[];
}

interface TestMeta {
  test_name: string;
  category: string;
  unit?: string;
  display_order: number;
  result_type: string;
}

interface MatrixData {
  tests: TestMeta[];
  valueLookup: Record<string, Record<string | number, TestComponent>>;
  categories: string[];
}

type GroupedRow =
  | { type: 'header'; category: string }
  | ({ type: 'test' } & TestMeta);

// --- Status styling ---

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  normal: { bg: 'transparent', text: 'inherit' },
  high: { bg: 'var(--mantine-color-red-0)', text: 'var(--mantine-color-red-8)' },
  low: { bg: 'var(--mantine-color-blue-0)', text: 'var(--mantine-color-blue-8)' },
  critical: { bg: 'var(--mantine-color-red-1)', text: 'var(--mantine-color-red-9)' },
  abnormal: { bg: 'var(--mantine-color-orange-0)', text: 'var(--mantine-color-orange-8)' },
  borderline: { bg: 'var(--mantine-color-yellow-0)', text: 'var(--mantine-color-yellow-9)' },
};

const STATUS_INDICATORS: Record<string, string> = {
  high: '\u2191',     // up arrow
  low: '\u2193',      // down arrow
  critical: '\u2191\u2191', // double up arrow
  abnormal: '\u26A0', // warning sign
  borderline: '\u2248', // approximately equal
};

const CATEGORY_ORDER = CATEGORY_SELECT_OPTIONS.map(o => o.value);

// --- Component ---

const LabResultMatrix: React.FC<LabResultMatrixProps> = React.memo(({ labResults }) => {
  const { t } = useTranslation('medical');
  const { formatDate: formatDateHook, locale } = useDateFormat();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [componentsMap, setComponentsMap] = useState<Record<string | number, TestComponent[]>>({});
  const [filterMode, setFilterMode] = useState('all');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Sort lab results by date ascending
  const sortedResults = useMemo(() => {
    return (labResults || [])
      .filter((r) => r.completed_date)
      .sort((a, b) => new Date(a.completed_date!).getTime() - new Date(b.completed_date!).getTime());
  }, [labResults]);

  // Fetch components for all lab results with AbortController
  const fetchComponents = useCallback(async () => {
    if (!sortedResults.length) {
      setLoading(false);
      return;
    }

    // Cancel previous requests
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);

      const promises = sortedResults.map(async (lr) => {
        try {
          const response = await labTestComponentApi.getByLabResult(lr.id, undefined, undefined, controller.signal);
          return { labResultId: lr.id, components: (response.data || []) as TestComponent[], failed: false };
        } catch (err: any) {
          if (err.name === 'AbortError' || err.name === 'CanceledError') throw err;
          logger.warn('lab_matrix_component_fetch_error', {
            labResultId: lr.id,
            error: err.message,
          });
          return { labResultId: lr.id, components: [] as TestComponent[], failed: true, errorMsg: err.message };
        }
      });

      const allResults = await Promise.all(promises);
      const failedCount = allResults.filter((r) => r.failed).length;

      if (failedCount === allResults.length && failedCount > 0) {
        const firstError = allResults.find((r) => r.failed)?.errorMsg;
        setError(firstError || t('labMatrix.errorTitle', 'Error loading matrix'));
        return;
      }

      const map: Record<string | number, TestComponent[]> = {};
      allResults.forEach(({ labResultId, components }) => {
        map[labResultId] = components;
      });
      setComponentsMap(map);
    } catch (err: any) {
      if (err.name === 'AbortError' || err.name === 'CanceledError') return;
      logger.error('lab_matrix_fetch_error', { error: err.message });
      setError(err.message || t('labMatrix.errorTitle', 'Error loading matrix'));
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [sortedResults, t]);

  useEffect(() => {
    fetchComponents();
  }, [fetchComponents]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Build matrix data
  const matrixData = useMemo((): MatrixData | null => {
    if (!sortedResults.length) return null;

    const testMap = new Map<string, TestMeta>();
    sortedResults.forEach((lr) => {
      const components = componentsMap[lr.id] || [];
      components.forEach((comp) => {
        const key = comp.test_name;
        if (!testMap.has(key)) {
          testMap.set(key, {
            test_name: comp.test_name,
            category: comp.category || 'other',
            unit: comp.unit,
            display_order: comp.display_order || 999,
            result_type: comp.result_type || 'quantitative',
          });
        }
        const existing = testMap.get(key)!;
        if (comp.unit) existing.unit = comp.unit;
        if (comp.category) existing.category = comp.category;
      });
    });

    const tests = Array.from(testMap.values()).sort((a, b) => {
      const catA = CATEGORY_ORDER.indexOf(a.category);
      const catB = CATEGORY_ORDER.indexOf(b.category);
      if (catA !== catB) return (catA === -1 ? 99 : catA) - (catB === -1 ? 99 : catB);
      if (a.display_order !== b.display_order) return a.display_order - b.display_order;
      return a.test_name.localeCompare(b.test_name);
    });

    const valueLookup: Record<string, Record<string | number, TestComponent>> = {};
    sortedResults.forEach((lr) => {
      const components = componentsMap[lr.id] || [];
      components.forEach((comp) => {
        if (!valueLookup[comp.test_name]) valueLookup[comp.test_name] = {};
        valueLookup[comp.test_name][lr.id] = comp;
      });
    });

    const categories = [...new Set(tests.map((t) => t.category))];
    return { tests, valueLookup, categories };
  }, [sortedResults, componentsMap]);

  // Filters
  const filteredTests = useMemo(() => {
    if (!matrixData) return [];
    let tests = matrixData.tests;

    if (selectedCategories.length > 0) {
      tests = tests.filter((t) => selectedCategories.includes(t.category));
    }

    if (filterMode === 'abnormal') {
      tests = tests.filter((t) =>
        sortedResults.some((lr) => {
          const comp = matrixData.valueLookup[t.test_name]?.[lr.id];
          return comp && comp.status && comp.status !== 'normal';
        }),
      );
    }
    return tests;
  }, [matrixData, filterMode, selectedCategories, sortedResults]);

  // Grouped by category
  const groupedTests = useMemo((): GroupedRow[] => {
    const groups: GroupedRow[] = [];
    let currentCategory: string | null = null;
    filteredTests.forEach((test) => {
      if (test.category !== currentCategory) {
        currentCategory = test.category;
        groups.push({ type: 'header', category: currentCategory });
      }
      groups.push({ type: 'test', ...test });
    });
    return groups;
  }, [filteredTests]);

  const formatColumnDate = useCallback(
    (dateStr: string | undefined) => {
      if (!dateStr) return '';
      return formatDateHook(dateStr);
    },
    [formatDateHook],
  );

  const formatValue = useCallback(
    (comp: TestComponent | undefined) => {
      if (!comp) return null;
      if (comp.result_type === 'qualitative') return comp.qualitative_value || null;
      if (comp.value != null) {
        const val = Number(comp.value);
        if (Number.isInteger(val)) return val.toString();
        return val.toLocaleString(locale, { maximumFractionDigits: 2 });
      }
      return null;
    },
    [locale],
  );

  const getRefText = (comp: TestComponent | undefined): string => {
    if (!comp) return '';
    const parts: string[] = [];
    if (comp.ref_range_min != null && comp.ref_range_max != null) {
      parts.push(`Ref: ${comp.ref_range_min}\u2013${comp.ref_range_max}`);
    } else if (comp.ref_range_max != null) {
      parts.push(`Ref: < ${comp.ref_range_max}`);
    } else if (comp.ref_range_min != null) {
      parts.push(`Ref: > ${comp.ref_range_min}`);
    } else if (comp.ref_range_text) {
      parts.push(`Ref: ${comp.ref_range_text}`);
    }
    if (comp.unit) parts.push(comp.unit);
    return parts.join(' ');
  };

  // --- Render ---

  if (loading) {
    return (
      <Center py="xl">
        <Stack align="center" gap="xs">
          <Loader size="md" />
          <Text size="sm" c="dimmed">
            {t('labMatrix.loading', 'Loading matrix data...')}
          </Text>
        </Stack>
      </Center>
    );
  }

  if (error) {
    return (
      <Alert color="red" variant="light" title={t('labMatrix.errorTitle', 'Error loading matrix')}>
        {error}
      </Alert>
    );
  }

  if (!sortedResults.length || !matrixData || !matrixData.tests.length) {
    return (
      <Alert color="blue" variant="light">
        {t(
          'labMatrix.noData',
          'No test components found. Open a lab result and add test components, or use Quick PDF Import.',
        )}
      </Alert>
    );
  }

  const categoryOptions = (matrixData.categories || []).map((c) => ({
    value: c,
    label: getCategoryDisplayName(c),
  }));

  return (
    <Stack gap="sm">
      {/* Filters */}
      <Paper shadow="xs" p="sm" withBorder>
        <Group gap="md" wrap="wrap">
          <SegmentedControl
            value={filterMode}
            onChange={setFilterMode}
            aria-label={t('labMatrix.filterAbnormalOnly', 'Abnormal Only')}
            data={[
              {
                label: t('labMatrix.filterAll', 'All ({{count}})', {
                  count: matrixData.tests.length,
                }),
                value: 'all',
              },
              { label: t('labMatrix.filterAbnormalOnly', 'Abnormal Only'), value: 'abnormal' },
            ]}
            size="xs"
          />
          <MultiSelect
            placeholder={t('labMatrix.filterByCategory', 'Filter by category...')}
            aria-label={t('labMatrix.filterByCategory', 'Filter by category...')}
            data={categoryOptions}
            value={selectedCategories}
            onChange={setSelectedCategories}
            clearable
            searchable
            maxDropdownHeight={300}
            style={{ minWidth: 220 }}
            size="xs"
          />
          <Text size="xs" c="dimmed">
            {t('labMatrix.resultsCount', '{{results}} results', {
              results: sortedResults.length,
            })}{' '}
            &middot;{' '}
            {t('labMatrix.parametersCount', '{{parameters}} parameters', {
              parameters: filteredTests.length,
            })}{' '}
            &middot; {formatColumnDate(sortedResults[0]?.completed_date)} &ndash;{' '}
            {formatColumnDate(sortedResults[sortedResults.length - 1]?.completed_date)}
          </Text>
        </Group>
      </Paper>

      {/* Matrix */}
      <Paper shadow="xs" withBorder style={{ overflow: 'hidden' }}>
        <ScrollArea type="auto" offsetScrollbars>
          <table
            aria-label={t('labMatrix.columnParameter', 'Parameter')}
            style={{
              borderCollapse: 'collapse',
              width: 'max-content',
              minWidth: '100%',
              fontSize: 'var(--mantine-font-size-sm)',
            }}
          >
            <caption
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                padding: 0,
                margin: -1,
                overflow: 'hidden',
                clip: 'rect(0, 0, 0, 0)',
                whiteSpace: 'nowrap',
                borderWidth: 0,
              }}
            >
              {t('labMatrix.columnParameter', 'Parameter')}
            </caption>
            <thead>
              <tr
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 20,
                  background: 'var(--mantine-color-body)',
                }}
              >
                <th
                  scope="col"
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 30,
                    background: 'var(--mantine-color-body)',
                    padding: '8px 12px',
                    borderBottom: '2px solid var(--mantine-color-gray-4)',
                    borderRight: '2px solid var(--mantine-color-gray-4)',
                    textAlign: 'left',
                    minWidth: 200,
                    maxWidth: 260,
                  }}
                >
                  {t('labMatrix.columnParameter', 'Parameter')}
                </th>
                <th
                  scope="col"
                  style={{
                    padding: '4px 8px',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    borderBottom: '2px solid var(--mantine-color-gray-4)',
                    color: 'var(--mantine-color-dimmed)',
                    minWidth: 50,
                  }}
                >
                  {t('labMatrix.columnUnit', 'Unit')}
                </th>
                {sortedResults.map((lr) => (
                  <th
                    key={lr.id}
                    scope="col"
                    style={{
                      padding: '4px 8px',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      borderBottom: '2px solid var(--mantine-color-gray-4)',
                      minWidth: 70,
                      fontWeight: 600,
                    }}
                  >
                    <Tooltip label={lr.test_name} withArrow>
                      <Text size="sm" fw={600} style={{ cursor: 'default' }}>
                        {formatColumnDate(lr.completed_date)}
                      </Text>
                    </Tooltip>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedTests.map((row) => {
                if (row.type === 'header') {
                  const catColor = getCategoryColor(row.category);
                  return (
                    <tr key={`cat-${row.category}`}>
                      <td
                        colSpan={sortedResults.length + 2}
                        style={{
                          padding: '8px 12px 4px',
                          fontWeight: 700,
                          fontSize: 'var(--mantine-font-size-xs)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: `var(--mantine-color-${catColor}-7)`,
                          borderBottom: `1px solid var(--mantine-color-${catColor}-3)`,
                          position: 'sticky',
                          left: 0,
                          background: 'var(--mantine-color-body)',
                        }}
                      >
                        {getCategoryDisplayName(row.category)}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={row.test_name}
                    style={{
                      borderBottom: '1px solid var(--mantine-color-gray-2)',
                    }}
                  >
                    <th
                      scope="row"
                      style={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 10,
                        background: 'var(--mantine-color-body)',
                        padding: '4px 12px',
                        borderRight: '2px solid var(--mantine-color-gray-3)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 260,
                        fontWeight: 500,
                        textAlign: 'left',
                      }}
                    >
                      <Tooltip label={row.test_name} withArrow openDelay={500}>
                        <span>{row.test_name}</span>
                      </Tooltip>
                    </th>
                    <td
                      style={{
                        padding: '4px 8px',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        color: 'var(--mantine-color-dimmed)',
                      }}
                    >
                      {row.unit || ''}
                    </td>
                    {sortedResults.map((lr) => {
                      const comp = matrixData.valueLookup[row.test_name]?.[lr.id];
                      const value = formatValue(comp);
                      const status = comp?.status || null;
                      const colors = STATUS_COLORS[status || ''] || STATUS_COLORS.normal;
                      const indicator = status ? STATUS_INDICATORS[status] : undefined;
                      const refText = getRefText(comp);

                      return (
                        <td
                          key={lr.id}
                          style={{
                            padding: '4px 8px',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            background: value ? colors.bg : 'transparent',
                            color: value ? colors.text : 'var(--mantine-color-dimmed)',
                            fontWeight: status && status !== 'normal' ? 700 : 400,
                          }}
                        >
                          {value ? (
                            <Tooltip
                              label={refText || `${row.test_name}: ${value}`}
                              withArrow
                              openDelay={300}
                            >
                              <span style={{ cursor: 'default' }}>
                                {value}
                                {indicator && (
                                  <span
                                    aria-label={status || undefined}
                                    style={{ marginLeft: 2, fontSize: '0.8em' }}
                                  >
                                    {indicator}
                                  </span>
                                )}
                              </span>
                            </Tooltip>
                          ) : (
                            <span style={{ opacity: 0.2 }}>&mdash;</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollArea>
      </Paper>

      {/* Legend */}
      <Group gap="sm" px="xs">
        <Text size="xs" c="dimmed" fw={600}>
          {t('labMatrix.legend', 'Legend')}:
        </Text>
        <Badge size="xs" color="green" variant="light">
          {t('labMatrix.statusNormal', 'Normal')}
        </Badge>
        <Badge size="xs" color="red" variant="light">
          {t('labMatrix.statusHigh', 'High')} {STATUS_INDICATORS.high}
        </Badge>
        <Badge size="xs" color="blue" variant="light">
          {t('labMatrix.statusLow', 'Low')} {STATUS_INDICATORS.low}
        </Badge>
        <Badge size="xs" color="red" variant="filled">
          {t('labMatrix.statusCritical', 'Critical')} {STATUS_INDICATORS.critical}
        </Badge>
        <Badge size="xs" color="orange" variant="light">
          {t('labMatrix.statusAbnormal', 'Abnormal')} {STATUS_INDICATORS.abnormal}
        </Badge>
        <Badge size="xs" color="yellow" variant="light">
          {t('labMatrix.statusBorderline', 'Borderline')} {STATUS_INDICATORS.borderline}
        </Badge>
      </Group>
    </Stack>
  );
});

LabResultMatrix.displayName = 'LabResultMatrix';

export default LabResultMatrix;
