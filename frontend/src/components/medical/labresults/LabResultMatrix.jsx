import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import logger from '../../../services/logger';

// Status color mapping
const STATUS_COLORS = {
  normal: { bg: 'transparent', text: 'inherit' },
  high: { bg: 'var(--mantine-color-red-0)', text: 'var(--mantine-color-red-8)' },
  low: { bg: 'var(--mantine-color-blue-0)', text: 'var(--mantine-color-blue-8)' },
  critical: { bg: 'var(--mantine-color-red-1)', text: 'var(--mantine-color-red-9)' },
  abnormal: { bg: 'var(--mantine-color-orange-0)', text: 'var(--mantine-color-orange-8)' },
  borderline: { bg: 'var(--mantine-color-yellow-0)', text: 'var(--mantine-color-yellow-9)' },
};

const CATEGORY_ORDER = [
  'hematology', 'chemistry', 'endocrinology', 'lipids', 'hepatology',
  'immunology', 'microbiology', 'cardiology', 'toxicology', 'genetics',
  'molecular', 'pathology', 'hearing', 'stomatology', 'other',
];

const CATEGORY_LABELS = {
  hematology: 'Hematology', chemistry: 'Chemistry', endocrinology: 'Endocrinology',
  lipids: 'Lipids', hepatology: 'Hepatology', immunology: 'Immunology',
  microbiology: 'Microbiology', cardiology: 'Cardiology', toxicology: 'Toxicology',
  genetics: 'Genetics', molecular: 'Molecular', pathology: 'Pathology',
  hearing: 'Hearing', stomatology: 'Stomatology', other: 'Other',
};

const CATEGORY_COLORS = {
  hematology: 'red', chemistry: 'blue', endocrinology: 'grape', lipids: 'orange',
  hepatology: 'teal', immunology: 'cyan', microbiology: 'lime', cardiology: 'pink',
  other: 'gray',
};

const LabResultMatrix = React.memo(({ labResults }) => {
  const { t } = useTranslation('medical');

  const [loading, setLoading] = useState(true);
  const [componentsMap, setComponentsMap] = useState({});
  const [filterMode, setFilterMode] = useState('all');
  const [selectedCategories, setSelectedCategories] = useState([]);

  // Sort lab results by date ascending
  const sortedResults = useMemo(() => {
    return (labResults || [])
      .filter(r => r.completed_date)
      .sort((a, b) => new Date(a.completed_date) - new Date(b.completed_date));
  }, [labResults]);

  // Fetch components for all lab results
  const fetchComponents = useCallback(async () => {
    if (!sortedResults.length) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const promises = sortedResults.map(async (lr) => {
        try {
          const response = await labTestComponentApi.getByLabResult(lr.id);
          return { labResultId: lr.id, components: response.data || [] };
        } catch (err) {
          logger.warn('lab_matrix_component_fetch_error', {
            labResultId: lr.id, error: err.message,
          });
          return { labResultId: lr.id, components: [] };
        }
      });

      const allComponents = await Promise.all(promises);
      const map = {};
      allComponents.forEach(({ labResultId, components }) => {
        map[labResultId] = components;
      });
      setComponentsMap(map);
    } catch (err) {
      logger.error('lab_matrix_fetch_error', { error: err.message });
    } finally {
      setLoading(false);
    }
  }, [sortedResults]);

  useEffect(() => {
    fetchComponents();
  }, [fetchComponents]);

  // Build matrix data
  const matrixData = useMemo(() => {
    if (!sortedResults.length) return null;

    const testMap = new Map();
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
        const existing = testMap.get(key);
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

    const valueLookup = {};
    sortedResults.forEach((lr) => {
      const components = componentsMap[lr.id] || [];
      components.forEach((comp) => {
        if (!valueLookup[comp.test_name]) valueLookup[comp.test_name] = {};
        valueLookup[comp.test_name][lr.id] = comp;
      });
    });

    const categories = [...new Set(tests.map(t => t.category))];
    return { tests, valueLookup, categories };
  }, [sortedResults, componentsMap]);

  // Filters
  const filteredTests = useMemo(() => {
    if (!matrixData) return [];
    let tests = matrixData.tests;

    if (selectedCategories.length > 0) {
      tests = tests.filter(t => selectedCategories.includes(t.category));
    }

    if (filterMode === 'abnormal') {
      tests = tests.filter(t =>
        sortedResults.some(lr => {
          const comp = matrixData.valueLookup[t.test_name]?.[lr.id];
          return comp && comp.status && comp.status !== 'normal';
        })
      );
    }
    return tests;
  }, [matrixData, filterMode, selectedCategories, sortedResults]);

  // Grouped by category
  const groupedTests = useMemo(() => {
    const groups = [];
    let currentCategory = null;
    filteredTests.forEach((test) => {
      if (test.category !== currentCategory) {
        currentCategory = test.category;
        groups.push({ type: 'header', category: currentCategory });
      }
      groups.push({ type: 'test', ...test });
    });
    return groups;
  }, [filteredTests]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const formatValue = (comp) => {
    if (!comp) return null;
    if (comp.result_type === 'qualitative') return comp.qualitative_value || null;
    if (comp.value != null) {
      const val = Number(comp.value);
      if (Number.isInteger(val)) return val.toString();
      return val.toLocaleString('de-AT', { maximumFractionDigits: 2 });
    }
    return null;
  };

  const getRefText = (comp) => {
    if (!comp) return '';
    const parts = [];
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

  if (loading) {
    return (
      <Center py="xl">
        <Stack align="center" gap="xs">
          <Loader size="md" />
          <Text size="sm" c="dimmed">Loading matrix data...</Text>
        </Stack>
      </Center>
    );
  }

  if (!sortedResults.length || !matrixData || !matrixData.tests.length) {
    return (
      <Alert color="blue" variant="light">
        No test components found. Open a lab result and add test components, or use Quick PDF Import.
      </Alert>
    );
  }

  const categoryOptions = (matrixData.categories || []).map(c => ({
    value: c, label: CATEGORY_LABELS[c] || c,
  }));

  const cellStyle = {
    padding: '4px 8px',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    fontSize: '0.78rem',
  };

  return (
    <Stack gap="sm">
      {/* Filters */}
      <Paper shadow="xs" p="sm" withBorder>
        <Group gap="md" wrap="wrap">
          <SegmentedControl
            value={filterMode}
            onChange={setFilterMode}
            data={[
              { label: `All (${matrixData.tests.length})`, value: 'all' },
              { label: 'Abnormal Only', value: 'abnormal' },
            ]}
            size="xs"
          />
          <MultiSelect
            placeholder="Filter by category..."
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
            {sortedResults.length} results &middot; {filteredTests.length} parameters &middot;{' '}
            {formatDate(sortedResults[0]?.completed_date)} &ndash; {formatDate(sortedResults[sortedResults.length - 1]?.completed_date)}
          </Text>
        </Group>
      </Paper>

      {/* Matrix */}
      <Paper shadow="xs" withBorder style={{ overflow: 'hidden' }}>
        <ScrollArea type="auto" offsetScrollbars>
          <table style={{
            borderCollapse: 'collapse',
            width: 'max-content',
            minWidth: '100%',
            fontFamily: 'var(--mantine-font-family-monospace, monospace)',
            fontSize: '0.78rem',
          }}>
            <thead>
              <tr style={{
                position: 'sticky',
                top: 0,
                zIndex: 20,
                background: 'var(--mantine-color-body)',
              }}>
                <th style={{
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
                }}>
                  Parameter
                </th>
                <th style={{
                  ...cellStyle,
                  borderBottom: '2px solid var(--mantine-color-gray-4)',
                  color: 'var(--mantine-color-dimmed)',
                  fontSize: '0.7rem',
                  minWidth: 50,
                }}>
                  Unit
                </th>
                {sortedResults.map((lr) => (
                  <th key={lr.id} style={{
                    ...cellStyle,
                    borderBottom: '2px solid var(--mantine-color-gray-4)',
                    minWidth: 70,
                    fontWeight: 600,
                  }}>
                    <Tooltip label={lr.test_name} withArrow>
                      <Text size="xs" fw={600} style={{ cursor: 'default' }}>
                        {formatDate(lr.completed_date)}
                      </Text>
                    </Tooltip>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedTests.map((row) => {
                if (row.type === 'header') {
                  return (
                    <tr key={`cat-${row.category}`}>
                      <td
                        colSpan={sortedResults.length + 2}
                        style={{
                          padding: '8px 12px 4px',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: `var(--mantine-color-${CATEGORY_COLORS[row.category] || 'gray'}-7)`,
                          borderBottom: `1px solid var(--mantine-color-${CATEGORY_COLORS[row.category] || 'gray'}-3)`,
                          position: 'sticky',
                          left: 0,
                          background: 'var(--mantine-color-body)',
                        }}
                      >
                        {CATEGORY_LABELS[row.category] || row.category}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={row.test_name} style={{
                    borderBottom: '1px solid var(--mantine-color-gray-2)',
                  }}>
                    <td style={{
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
                    }}>
                      <Tooltip label={row.test_name} withArrow openDelay={500}>
                        <span>{row.test_name}</span>
                      </Tooltip>
                    </td>
                    <td style={{
                      ...cellStyle,
                      color: 'var(--mantine-color-dimmed)',
                      fontSize: '0.7rem',
                    }}>
                      {row.unit || ''}
                    </td>
                    {sortedResults.map((lr) => {
                      const comp = matrixData.valueLookup[row.test_name]?.[lr.id];
                      const value = formatValue(comp);
                      const status = comp?.status || null;
                      const colors = STATUS_COLORS[status] || STATUS_COLORS.normal;
                      const refText = getRefText(comp);

                      return (
                        <td key={lr.id} style={{
                          ...cellStyle,
                          background: value ? colors.bg : 'transparent',
                          color: value ? colors.text : 'var(--mantine-color-dimmed)',
                          fontWeight: status && status !== 'normal' ? 700 : 400,
                        }}>
                          {value ? (
                            <Tooltip label={refText || `${row.test_name}: ${value}`} withArrow openDelay={300}>
                              <span style={{ cursor: 'default' }}>{value}</span>
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
        <Text size="xs" c="dimmed" fw={600}>Legend:</Text>
        <Badge size="xs" color="green" variant="light">Normal</Badge>
        <Badge size="xs" color="red" variant="light">High</Badge>
        <Badge size="xs" color="blue" variant="light">Low</Badge>
        <Badge size="xs" color="red" variant="filled">Critical</Badge>
        <Badge size="xs" color="orange" variant="light">Abnormal</Badge>
      </Group>
    </Stack>
  );
});

LabResultMatrix.displayName = 'LabResultMatrix';

export default LabResultMatrix;
