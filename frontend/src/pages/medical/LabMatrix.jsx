import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Container,
  Title,
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
  Select,
  MultiSelect,
  ActionIcon,
  Button,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { labTestComponentApi } from '../../services/api/labTestComponentApi';
import { withResponsive } from '../../hoc/withResponsive';
import { PageHeader } from '../../components';
import logger from '../../services/logger';

// Status color mapping
const STATUS_COLORS = {
  normal: { bg: 'transparent', text: 'inherit', badge: 'green' },
  high: { bg: 'var(--mantine-color-red-0)', text: 'var(--mantine-color-red-8)', badge: 'red' },
  low: { bg: 'var(--mantine-color-blue-0)', text: 'var(--mantine-color-blue-8)', badge: 'blue' },
  critical: { bg: 'var(--mantine-color-red-1)', text: 'var(--mantine-color-red-9)', badge: 'red' },
  abnormal: { bg: 'var(--mantine-color-orange-0)', text: 'var(--mantine-color-orange-8)', badge: 'orange' },
  borderline: { bg: 'var(--mantine-color-yellow-0)', text: 'var(--mantine-color-yellow-9)', badge: 'yellow' },
};

// Category display names and order
const CATEGORY_ORDER = [
  'hematology',
  'chemistry',
  'endocrinology',
  'lipids',
  'hepatology',
  'immunology',
  'microbiology',
  'cardiology',
  'toxicology',
  'genetics',
  'molecular',
  'pathology',
  'hearing',
  'stomatology',
  'other',
];

const CATEGORY_LABELS = {
  hematology: 'Hematology',
  chemistry: 'Chemistry',
  endocrinology: 'Endocrinology',
  lipids: 'Lipids',
  hepatology: 'Hepatology',
  immunology: 'Immunology',
  microbiology: 'Microbiology',
  cardiology: 'Cardiology',
  toxicology: 'Toxicology',
  genetics: 'Genetics',
  molecular: 'Molecular',
  pathology: 'Pathology',
  hearing: 'Hearing',
  stomatology: 'Stomatology',
  other: 'Other',
};

const CATEGORY_COLORS = {
  hematology: 'red',
  chemistry: 'blue',
  endocrinology: 'grape',
  lipids: 'orange',
  hepatology: 'teal',
  immunology: 'cyan',
  microbiology: 'lime',
  cardiology: 'pink',
  other: 'gray',
};

function LabMatrix() {
  const { t } = useTranslation('medical');
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [labResults, setLabResults] = useState([]);
  const [componentsMap, setComponentsMap] = useState({});
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'abnormal'
  const [selectedCategories, setSelectedCategories] = useState([]);

  // Fetch all lab results and their components
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all lab results
      const results = await apiService.getLabResults();
      const sortedResults = (results || [])
        .filter(r => r.completed_date)
        .sort((a, b) => new Date(a.completed_date) - new Date(b.completed_date));

      setLabResults(sortedResults);

      // Fetch components for each lab result in parallel
      const componentPromises = sortedResults.map(async (lr) => {
        try {
          const response = await labTestComponentApi.getByLabResult(lr.id);
          return { labResultId: lr.id, components: response.data || [] };
        } catch (err) {
          logger.warn('lab_matrix_component_fetch_error', {
            labResultId: lr.id,
            error: err.message,
          });
          return { labResultId: lr.id, components: [] };
        }
      });

      const allComponents = await Promise.all(componentPromises);
      const map = {};
      allComponents.forEach(({ labResultId, components }) => {
        map[labResultId] = components;
      });
      setComponentsMap(map);
    } catch (err) {
      logger.error('lab_matrix_fetch_error', { error: err.message });
      setError(err.message || 'Failed to load lab data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build the matrix data
  const matrixData = useMemo(() => {
    if (!labResults.length) return null;

    // Collect all unique test names with their metadata
    const testMap = new Map(); // test_name -> { category, unit, display_order, occurrences }

    labResults.forEach((lr) => {
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
            occurrences: 0,
          });
        }
        const existing = testMap.get(key);
        existing.occurrences += 1;
        // Update unit/category if newer
        if (comp.unit) existing.unit = comp.unit;
        if (comp.category) existing.category = comp.category;
      });
    });

    // Sort tests: by category order, then display_order, then name
    const tests = Array.from(testMap.values()).sort((a, b) => {
      const catA = CATEGORY_ORDER.indexOf(a.category);
      const catB = CATEGORY_ORDER.indexOf(b.category);
      if (catA !== catB) return (catA === -1 ? 99 : catA) - (catB === -1 ? 99 : catB);
      if (a.display_order !== b.display_order) return a.display_order - b.display_order;
      return a.test_name.localeCompare(b.test_name);
    });

    // Build value lookup: test_name -> labResultId -> component
    const valueLookup = {};
    labResults.forEach((lr) => {
      const components = componentsMap[lr.id] || [];
      components.forEach((comp) => {
        if (!valueLookup[comp.test_name]) valueLookup[comp.test_name] = {};
        valueLookup[comp.test_name][lr.id] = comp;
      });
    });

    // Get available categories
    const categories = [...new Set(tests.map(t => t.category))];

    return { tests, valueLookup, categories };
  }, [labResults, componentsMap]);

  // Apply filters
  const filteredTests = useMemo(() => {
    if (!matrixData) return [];
    let tests = matrixData.tests;

    if (selectedCategories.length > 0) {
      tests = tests.filter(t => selectedCategories.includes(t.category));
    }

    if (filterMode === 'abnormal') {
      tests = tests.filter(t => {
        return labResults.some(lr => {
          const comp = matrixData.valueLookup[t.test_name]?.[lr.id];
          return comp && comp.status && comp.status !== 'normal';
        });
      });
    }

    return tests;
  }, [matrixData, filterMode, selectedCategories, labResults]);

  // Group tests by category for display
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

  // Format date for column headers
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  // Format cell value
  const formatValue = (comp) => {
    if (!comp) return null;
    if (comp.result_type === 'qualitative') {
      return comp.qualitative_value || '—';
    }
    if (comp.value != null) {
      // Format number: remove trailing zeros
      const val = Number(comp.value);
      if (Number.isInteger(val)) return val.toString();
      return val.toLocaleString('de-AT', { maximumFractionDigits: 2 });
    }
    return '—';
  };

  // Get reference range text for tooltip
  const getRefText = (comp) => {
    if (!comp) return '';
    const parts = [];
    if (comp.ref_range_min != null && comp.ref_range_max != null) {
      parts.push(`Ref: ${comp.ref_range_min}–${comp.ref_range_max}`);
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
      <Container size="xl" py="xl">
        <Center h={400}>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text c="dimmed">Loading lab matrix...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl" py="xl">
        <Alert color="red" title="Error">
          {error}
        </Alert>
      </Container>
    );
  }

  if (!labResults.length || !matrixData) {
    return (
      <Container size="xl" py="xl">
        <PageHeader
          title="Lab Comparison Matrix"
          icon="📊"
          backButtonText="← Back to Lab Results"
          backButtonPath="/lab-results"
          variant="dashboard"
        />
        <Alert color="blue" title="No Data">
          No lab results with test components found. Import your lab results first.
        </Alert>
      </Container>
    );
  }

  const categoryOptions = (matrixData.categories || []).map(c => ({
    value: c,
    label: CATEGORY_LABELS[c] || c,
  }));

  return (
    <Container size="100%" px="md" py="xl">
      <PageHeader
        title="Lab Comparison Matrix"
        icon="📊"
        backButtonText="← Back to Lab Results"
        backButtonPath="/lab-results"
        variant="dashboard"
      />

      {/* Filters */}
      <Paper shadow="xs" p="md" mb="md" withBorder>
        <Group gap="md" wrap="wrap">
          <SegmentedControl
            value={filterMode}
            onChange={setFilterMode}
            data={[
              { label: `All (${matrixData.tests.length})`, value: 'all' },
              { label: 'Abnormal Only', value: 'abnormal' },
            ]}
            size="sm"
          />
          <MultiSelect
            placeholder="Filter by category..."
            data={categoryOptions}
            value={selectedCategories}
            onChange={setSelectedCategories}
            clearable
            searchable
            maxDropdownHeight={300}
            style={{ minWidth: 250 }}
            size="sm"
          />
          <Text size="sm" c="dimmed">
            {labResults.length} lab results &middot; {filteredTests.length} parameters &middot;{' '}
            {formatDate(labResults[0]?.completed_date)} – {formatDate(labResults[labResults.length - 1]?.completed_date)}
          </Text>
        </Group>
      </Paper>

      {/* Matrix Table */}
      <Paper shadow="xs" withBorder>
        <ScrollArea type="auto" offsetScrollbars>
          <table style={{
            borderCollapse: 'collapse',
            width: '100%',
            fontSize: '0.8rem',
            fontFamily: 'var(--mantine-font-family-monospace, monospace)',
          }}>
            <thead>
              <tr style={{
                position: 'sticky',
                top: 0,
                zIndex: 20,
                background: 'var(--mantine-color-body)',
              }}>
                {/* Sticky first column: test name */}
                <th style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 30,
                  background: 'var(--mantine-color-body)',
                  padding: '8px 12px',
                  borderBottom: '2px solid var(--mantine-color-gray-4)',
                  borderRight: '2px solid var(--mantine-color-gray-4)',
                  textAlign: 'left',
                  minWidth: 220,
                  maxWidth: 280,
                }}>
                  Parameter
                </th>
                <th style={{
                  padding: '8px 6px',
                  borderBottom: '2px solid var(--mantine-color-gray-4)',
                  textAlign: 'center',
                  minWidth: 55,
                  whiteSpace: 'nowrap',
                  color: 'var(--mantine-color-dimmed)',
                  fontSize: '0.7rem',
                }}>
                  Unit
                </th>
                {labResults.map((lr) => (
                  <th key={lr.id} style={{
                    padding: '6px 8px',
                    borderBottom: '2px solid var(--mantine-color-gray-4)',
                    textAlign: 'center',
                    minWidth: 72,
                    whiteSpace: 'nowrap',
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
              {groupedTests.map((row, idx) => {
                if (row.type === 'header') {
                  return (
                    <tr key={`cat-${row.category}`}>
                      <td
                        colSpan={labResults.length + 2}
                        style={{
                          padding: '10px 12px 6px',
                          fontWeight: 700,
                          fontSize: '0.8rem',
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
                  <tr
                    key={row.test_name}
                    style={{
                      borderBottom: '1px solid var(--mantine-color-gray-2)',
                    }}
                  >
                    {/* Test name - sticky */}
                    <td style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 10,
                      background: 'var(--mantine-color-body)',
                      padding: '5px 12px',
                      borderRight: '2px solid var(--mantine-color-gray-3)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 280,
                      fontWeight: 500,
                    }}>
                      <Tooltip label={row.test_name} withArrow openDelay={500}>
                        <span>{row.test_name}</span>
                      </Tooltip>
                    </td>
                    {/* Unit */}
                    <td style={{
                      padding: '5px 6px',
                      textAlign: 'center',
                      color: 'var(--mantine-color-dimmed)',
                      fontSize: '0.7rem',
                      whiteSpace: 'nowrap',
                    }}>
                      {row.unit || ''}
                    </td>
                    {/* Values */}
                    {labResults.map((lr) => {
                      const comp = matrixData.valueLookup[row.test_name]?.[lr.id];
                      const value = formatValue(comp);
                      const status = comp?.status || null;
                      const colors = STATUS_COLORS[status] || STATUS_COLORS.normal;
                      const refText = getRefText(comp);

                      return (
                        <td key={lr.id} style={{
                          padding: '5px 8px',
                          textAlign: 'center',
                          background: value ? colors.bg : 'transparent',
                          color: value ? colors.text : 'var(--mantine-color-dimmed)',
                          fontWeight: status && status !== 'normal' ? 700 : 400,
                          whiteSpace: 'nowrap',
                        }}>
                          {value ? (
                            <Tooltip
                              label={refText || `${row.test_name}: ${value}`}
                              withArrow
                              openDelay={300}
                            >
                              <span style={{ cursor: 'default' }}>{value}</span>
                            </Tooltip>
                          ) : (
                            <span style={{ opacity: 0.3 }}>—</span>
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
      <Paper shadow="xs" p="sm" mt="md" withBorder>
        <Group gap="lg">
          <Text size="xs" fw={600}>Legend:</Text>
          <Group gap="sm">
            <Badge size="xs" color="green" variant="light">Normal</Badge>
            <Badge size="xs" color="red" variant="light">High</Badge>
            <Badge size="xs" color="blue" variant="light">Low</Badge>
            <Badge size="xs" color="red" variant="filled">Critical</Badge>
            <Badge size="xs" color="orange" variant="light">Abnormal</Badge>
            <Badge size="xs" color="yellow" variant="light">Borderline</Badge>
          </Group>
        </Group>
      </Paper>
    </Container>
  );
}

export default withResponsive(LabMatrix);
