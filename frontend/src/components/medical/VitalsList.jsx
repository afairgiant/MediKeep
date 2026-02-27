/**
 * VitalsList Component - Enhanced Version with Mantine UI
 * Displays a list of patient vital signs with options to edit/delete/view details
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { notifySuccess, notifyError } from '../../utils/notifyTranslated';
import {
  Table,
  Button,
  Group,
  Text,
  Stack,
  Alert,
  Loader,
  Center,
  ActionIcon,
  Paper,
  Box,
  UnstyledButton,
  rem,
  Modal,
  Title,
  Grid,
  Card,
  Select,
  Pagination,
  Badge,
} from '@mantine/core';
import {
  IconEdit,
  IconTrash,
  IconChevronUp,
  IconChevronDown,
  IconChevronRight,
  IconSelector,
  IconAlertTriangle,
  IconRefresh,
  IconActivity,
  IconEye,
  IconCalendar,
  IconHeart,
  IconThermometer,
  IconWeight,
  IconLungs,
  IconDroplet,
  IconNotes,
  IconMapPin,
  IconDevices,
  IconMoodSad,
  IconTrendingUp,
  IconUser,
} from '@tabler/icons-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { vitalsService } from '../../services/medical/vitalsService';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { useDateFormat } from '../../hooks/useDateFormat';
import {
  formatMeasurement,
  convertForDisplay,
  unitLabels,
} from '../../utils/unitConversion';
import logger from '../../services/logger';

const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10' },
  { value: '20', label: '20' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
];
const VALID_PAGE_SIZES = [10, 20, 25, 50];

function normalizePageSize(value) {
  if (VALID_PAGE_SIZES.includes(value)) return value;
  return VALID_PAGE_SIZES.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
}

const VitalsList = ({
  patientId,
  onEdit,
  onDelete,
  onView,
  onRefresh,
  vitalsData,
  loading,
  error,
  showActions = true,
  limit = 10,
}) => {
  const { t } = useTranslation('common');
  const { unitSystem } = useUserPreferences();
  const { formatDate, formatDateTime } = useDateFormat();
  // Use passed data if available, otherwise load internally
  const [internalVitals, setInternalVitals] = useState([]);
  const [internalLoading, setInternalLoading] = useState(true);
  const [internalError, setInternalError] = useState(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [sortConfig, setSortConfig] = useState({
    key: 'recorded_date',
    direction: 'desc',
  });
  const [selectedVital, setSelectedVital] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [pageSize, setPageSize] = useState(() => normalizePageSize(limit));
  const [currentPage, setCurrentPage] = useState(1);
  const prevLimitRef = React.useRef(limit);

  // Sync pageSize if parent changes limit prop (but preserve user overrides)
  useEffect(() => {
    if (prevLimitRef.current !== limit) {
      setPageSize(prevPageSize =>
        prevPageSize === normalizePageSize(prevLimitRef.current)
          ? normalizePageSize(limit)
          : prevPageSize
      );
      prevLimitRef.current = limit;
    }
  }, [limit]);

  // Server-side pagination: load data when page or pageSize changes
  const loadVitals = useCallback(async () => {
    // Only load internally if no data is passed via props
    if (vitalsData !== undefined) return;

    try {
      setInternalLoading(true);
      setInternalError(null);

      // Calculate skip for server-side pagination
      const skip = (currentPage - 1) * pageSize;

      // Use the new paginated endpoint for server-side pagination
      if (patientId) {
        const response = await vitalsService.getPatientVitalsPaginated(patientId, {
          skip,
          limit: pageSize,
        });

        // Extract data from paginated response (expects { items, total, skip, limit })
        // Handle both direct response and wrapped response formats
        const data = response?.data ?? response;
        const items = data?.items ?? [];
        const total = data?.total ?? items.length;

        setInternalVitals(items);
        setTotalRecords(total);
      } else {
        // Fallback to non-paginated endpoint if no patientId
        const response = await vitalsService.getVitals({ skip, limit: pageSize });
        const data = response?.data || response;
        setInternalVitals(Array.isArray(data) ? data : []);
        setTotalRecords(Array.isArray(data) ? data.length : 0);
      }
    } catch (err) {
      setInternalError(err.message || 'Failed to load vitals');
      setInternalVitals([]);
      setTotalRecords(0);
    } finally {
      setInternalLoading(false);
    }
  }, [patientId, vitalsData, currentPage, pageSize]);

  useEffect(() => {
    loadVitals();
  }, [loadVitals]);

  useEffect(() => {
    if (onRefresh && vitalsData === undefined) {
      loadVitals();
    }
  }, [onRefresh, loadVitals, vitalsData]);

  // Reset to page 1 when pageSize changes
  const handlePageSizeChange = (newSize) => {
    if (newSize === null || newSize === undefined) return;
    const numericValue = Number(newSize);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return;
    setPageSize(numericValue);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  // Use passed data or internal data
  const vitals = vitalsData !== undefined ? vitalsData : internalVitals;
  const isLoading = loading !== undefined ? loading : internalLoading;
  const currentError = error !== undefined ? error : internalError;
  // For external data, use array length; for internal, use tracked total
  const actualTotalRecords = vitalsData !== undefined ? vitalsData.length : totalRecords;

  const handleDelete = async (vitalsId, skipConfirm = false) => {
    if (
      !skipConfirm &&
      !window.confirm('Are you sure you want to delete this vitals record?')
    ) {
      return;
    }

    // If external delete handler is provided and we're using external data, use it
    if (onDelete && vitalsData !== undefined) {
      try {
        await onDelete(vitalsId);
      } catch (err) {
        // Error handling is done by the parent component
        logger.error('Delete failed:', err);
      }
      return;
    }

    // Otherwise, handle deletion internally
    try {
      await vitalsService.deleteVitals(vitalsId);
      notifySuccess('notifications:toasts.vitals.deleteSuccess');
      loadVitals(); // Refresh the list
    } catch (err) {
      logger.error('Delete vitals failed:', err.response?.data?.detail || err);
      notifyError('notifications:toasts.vitals.deleteFailed');
    }
  };

  const handleViewDetails = vital => {
    if (onView) {
      // Use external view handler if provided
      onView(vital);
    } else {
      // Fall back to internal modal
      setSelectedVital(vital);
      setShowDetailsModal(true);
    }
  };

  const getBPDisplay = (systolic, diastolic) => {
    if (!systolic || !diastolic) return 'N/A';
    return `${systolic}/${diastolic}`;
  };

  const getBMIDisplay = (weight, height) => {
    if (!weight || !height) return 'N/A';
    const bmi = vitalsService.calculateBMI(weight, height);
    return bmi ? bmi.toString() : 'N/A';
  };

  const handleSort = key => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedVitals = () => {
    if (!sortConfig.key || !vitals) return vitals || [];
    if (!Array.isArray(vitals)) return [];

    return [...vitals].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle special sorting cases
      if (
        sortConfig.key === 'recorded_date' ||
        sortConfig.key === 'created_at'
      ) {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      } else if (sortConfig.key === 'bp') {
        // Sort by systolic blood pressure
        aValue = a.systolic_bp || 0;
        bValue = b.systolic_bp || 0;
      } else if (sortConfig.key === 'bmi') {
        // Calculate BMI for sorting
        aValue =
          a.weight && a.height
            ? vitalsService.calculateBMI(a.weight, a.height)
            : 0;
        bValue =
          b.weight && b.height
            ? vitalsService.calculateBMI(b.weight, b.height)
            : 0;
      }

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1;
      if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1;

      // Compare values
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };

  const getSortIcon = columnKey => {
    if (sortConfig.key !== columnKey) {
      return <IconSelector size={14} />;
    }
    return sortConfig.direction === 'asc' ? (
      <IconChevronUp size={14} />
    ) : (
      <IconChevronDown size={14} />
    );
  };

  const ThComponent = ({ children, sorted, onSort }) => (
    <UnstyledButton
      onClick={onSort}
      style={{
        width: '100%',
        padding: rem(8),
        fontWeight: 500,
        fontSize: rem(14),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: 'var(--mantine-color-text)',
      }}
    >
      <Text fw={500} size="sm">
        {children}
      </Text>
      {getSortIcon(sorted)}
    </UnstyledButton>
  );

  // Detailed view modal content
  const renderVitalDetails = () => {
    if (!selectedVital) return null;

    const vitalSections = [
      {
        title: 'Basic Information',
        icon: IconCalendar,
        items: [
          {
            label: 'Recorded Date',
            value: formatDateTime(selectedVital.recorded_date),
            icon: IconCalendar,
          },
          {
            label: 'Location',
            value: selectedVital.location || 'Not specified',
            icon: IconMapPin,
          },
          {
            label: 'Device Used',
            value: selectedVital.device_used || 'Not specified',
            icon: IconDevices,
          },
        ],
      },
      {
        title: 'Vital Signs',
        icon: IconHeart,
        items: [
          {
            label: 'Blood Pressure',
            value: getBPDisplay(
              selectedVital.systolic_bp,
              selectedVital.diastolic_bp
            ),
            icon: IconHeart,
            unit: 'mmHg',
          },
          {
            label: 'Heart Rate',
            value: selectedVital.heart_rate || 'N/A',
            icon: IconActivity,
            unit: selectedVital.heart_rate ? 'BPM' : '',
          },
          {
            label: 'Temperature',
            value: selectedVital.temperature
              ? formatMeasurement(
                  convertForDisplay(selectedVital.temperature, 'temperature', unitSystem),
                  'temperature',
                  unitSystem,
                  false
                )
              : 'N/A',
            icon: IconThermometer,
            unit: selectedVital.temperature
              ? unitLabels[unitSystem].temperature
              : '',
          },
          {
            label: 'Respiratory Rate',
            value: selectedVital.respiratory_rate || 'N/A',
            icon: IconLungs,
            unit: selectedVital.respiratory_rate ? '/min' : '',
          },
          {
            label: 'Oxygen Saturation',
            value: selectedVital.oxygen_saturation || 'N/A',
            icon: IconDroplet,
            unit: selectedVital.oxygen_saturation ? '%' : '',
          },
        ],
      },
      {
        title: 'Physical Measurements',
        icon: IconWeight,
        items: [
          {
            label: 'Weight',
            value: selectedVital.weight
              ? formatMeasurement(
                  convertForDisplay(selectedVital.weight, 'weight', unitSystem),
                  'weight',
                  unitSystem,
                  false
                )
              : 'N/A',
            icon: IconWeight,
            unit: selectedVital.weight
              ? unitLabels[unitSystem].weight
              : '',
          },
          {
            label: 'Height',
            value: selectedVital.height || 'N/A',
            icon: IconTrendingUp,
            unit: selectedVital.height ? 'inches' : '',
          },
          {
            label: 'BMI',
            value: getBMIDisplay(selectedVital.weight, selectedVital.height),
            icon: IconTrendingUp,
          },
        ],
      },
      {
        title: 'Additional Measurements',
        icon: IconDroplet,
        items: [
          {
            label: 'Blood Glucose',
            value: selectedVital.blood_glucose || 'N/A',
            icon: IconDroplet,
            unit: selectedVital.blood_glucose ? 'mg/dL' : '',
          },
          {
            label: 'A1C',
            value: selectedVital.a1c || 'N/A',
            icon: IconDroplet,
            unit: selectedVital.a1c ? '%' : '',
          },
          {
            label: 'Pain Scale',
            value:
              selectedVital.pain_scale !== null
                ? `${selectedVital.pain_scale}/10`
                : 'N/A',
            icon: IconMoodSad,
          },
        ],
      },
    ];

    return (
      <Stack gap="lg">
        {vitalSections.map((section, index) => {
          const SectionIcon = section.icon;
          return (
            <Paper key={index} shadow="sm" p="md" radius="md">
              <Group gap="sm" mb="md">
                <ActionIcon variant="light" size="md" radius="md">
                  <SectionIcon size={18} />
                </ActionIcon>
                <Title order={4}>{section.title}</Title>
              </Group>

              <Grid>
                {section.items.map((item, itemIndex) => {
                  const ItemIcon = item.icon;
                  return (
                    <Grid.Col key={itemIndex} span={6}>
                      <Card shadow="xs" p="sm" radius="md" withBorder>
                        <Group gap="sm">
                          <ItemIcon
                            size={16}
                            color="var(--mantine-color-blue-6)"
                          />
                          <Box flex={1}>
                            <Text size="xs" c="dimmed" fw={500}>
                              {item.label}
                            </Text>
                            <Group gap="xs" align="baseline">
                              <Text size="sm" fw={600}>
                                {item.value}
                              </Text>
                              {item.unit && (
                                <Text size="xs" c="dimmed">
                                  {item.unit}
                                </Text>
                              )}
                            </Group>
                          </Box>
                        </Group>
                      </Card>
                    </Grid.Col>
                  );
                })}
              </Grid>
            </Paper>
          );
        })}

        {/* Notes Section */}
        {selectedVital.notes && (
          <Paper shadow="sm" p="md" radius="md">
            <Group gap="sm" mb="md">
              <ActionIcon variant="light" size="md" radius="md">
                <IconNotes size={18} />
              </ActionIcon>
              <Title order={4}>Notes</Title>
            </Group>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {selectedVital.notes}
            </Text>
          </Paper>
        )}

        {/* Practitioner Information */}
        {selectedVital.practitioner_id && (
          <Paper shadow="sm" p="md" radius="md">
            <Group gap="sm" mb="md">
              <ActionIcon variant="light" size="md" radius="md">
                <IconUser size={18} />
              </ActionIcon>
              <Title order={4}>Recorded By</Title>
            </Group>
            <Card shadow="xs" p="sm" radius="md" withBorder>
              {selectedVital.practitioner ? (
                <>
                  <Text size="sm" fw={600}>
                    {selectedVital.practitioner.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {selectedVital.practitioner.specialty}
                    {selectedVital.practitioner.practice ? ` • ${selectedVital.practitioner.practice}` : ''}
                  </Text>
                </>
              ) : (
                <Text size="sm" c="dimmed">
                  Practitioner ID: {selectedVital.practitioner_id}
                </Text>
              )}
            </Card>
          </Paper>
        )}
      </Stack>
    );
  };

  // Track which daily summary group is expanded (accordion - one at a time)
  const [expandedGroup, setExpandedGroup] = useState(null);
  // Sub-pagination for expanded group readings
  const [expandedPage, setExpandedPage] = useState(1);
  const EXPANDED_PAGE_SIZE = 20;

  const toggleGroup = (groupKey) => {
    setExpandedGroup(prev => {
      if (prev === groupKey) return null;
      setExpandedPage(1); // Reset sub-pagination when switching groups
      return groupKey;
    });
  };

  const sortedVitals = getSortedVitals();

  // Group imported vitals by day for collapsible daily summaries
  const groupedDisplayItems = useMemo(() => {
    if (!sortedVitals || sortedVitals.length === 0) return [];

    const manualRecords = [];
    // Map of "YYYY-MM-DD|import_source" -> array of records
    const importGroups = {};

    for (const vital of sortedVitals) {
      if (!vital.import_source) {
        manualRecords.push({ type: 'individual', record: vital });
      } else {
        const d = new Date(vital.recorded_date);
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const groupKey = `${dateKey}|${vital.import_source}`;
        if (!importGroups[groupKey]) {
          importGroups[groupKey] = [];
        }
        importGroups[groupKey].push(vital);
      }
    }

    // Build summary rows for import groups
    const summaryRows = Object.entries(importGroups).map(([groupKey, readings]) => {
      const glucoseValues = readings
        .map(r => r.blood_glucose)
        .filter(v => v != null);

      const stats = glucoseValues.length > 0
        ? {
            avg: Math.round(glucoseValues.reduce((a, b) => a + b, 0) / glucoseValues.length),
            min: Math.round(Math.min(...glucoseValues)),
            max: Math.round(Math.max(...glucoseValues)),
          }
        : null;

      return {
        type: 'summary',
        groupKey,
        date: readings[0].recorded_date,
        source: readings[0].import_source,
        deviceUsed: readings[0].device_used,
        readings,
        count: readings.length,
        stats,
      };
    });

    // Merge and sort by date
    const allItems = [...manualRecords, ...summaryRows];
    const getItemDate = (item) =>
      new Date(item.type === 'summary' ? item.date : item.record.recorded_date);

    allItems.sort((a, b) => {
      const diff = getItemDate(a) - getItemDate(b);
      return sortConfig.direction === 'asc' ? diff : -diff;
    });

    return allItems;
  }, [sortedVitals, sortConfig.direction]);

  // For server-side pagination: data is already paginated, just sort it
  // For client-side (when vitalsData is provided): slice after sorting
  const isServerSidePagination = vitalsData === undefined && patientId;

  // Determine if we have imported data that needs grouping
  const hasImportedData = vitalsData !== undefined &&
    sortedVitals.some(v => v.import_source);

  // When grouping is active, pagination counts grouped items (1 row per day),
  // not the raw record count
  const effectiveTotalRecords = hasImportedData
    ? groupedDisplayItems.length
    : actualTotalRecords;

  // Calculate pagination values
  const totalPages = Math.max(1, Math.ceil(effectiveTotalRecords / pageSize));

  // For server-side pagination, show all sorted items (already paginated by server)
  // For client-side pagination, slice the sorted data
  let paginatedVitals;
  let startIndex;
  let endIndex;

  if (isServerSidePagination) {
    // Server already returned the correct page of data
    paginatedVitals = sortedVitals;
    startIndex = (currentPage - 1) * pageSize;
    endIndex = Math.min(startIndex + sortedVitals.length, actualTotalRecords);
  } else {
    // Client-side pagination for externally provided data
    startIndex = (currentPage - 1) * pageSize;
    endIndex = Math.min(startIndex + pageSize, effectiveTotalRecords);
    paginatedVitals = sortedVitals.slice(startIndex, endIndex);
  }

  // Ensure currentPage stays valid when data changes (e.g., after deletion)
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (isLoading) {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>{t('vitals.loading', 'Loading vitals...')}</Text>
        </Stack>
      </Center>
    );
  }

  if (currentError) {
    return (
      <Alert
        variant="light"
        color="red"
        icon={<IconAlertTriangle size={16} />}
        title={t('vitals.table.errorLoading', 'Error Loading Vitals')}
      >
        <Group justify="space-between" align="center">
          <Text size="sm">{currentError}</Text>
          <Button
            variant="filled"
            size="xs"
            leftSection={<IconRefresh size={14} />}
            onClick={loadVitals}
          >
            {t('buttons.tryAgain', 'Try Again')}
          </Button>
        </Group>
      </Alert>
    );
  }

  if (vitals.length === 0) {
    return (
      <Center py="xl">
        <Stack align="center" gap="md">
          <IconActivity
            size={48}
            stroke={1}
            color="var(--mantine-color-gray-5)"
          />
          <Stack align="center" gap="xs">
            <Text fw={500}>{t('vitals.table.noRecords', 'No vitals records found')}</Text>
            <Text c="dimmed" ta="center" size="sm">
              {t('vitals.table.noRecordsDesc', 'Vital signs will appear here once recorded')}
            </Text>
          </Stack>
        </Stack>
      </Center>
    );
  }

  // Reusable N/A cell for summary rows where columns are not applicable
  const naCell = <Table.Td><Text size="sm" c="dimmed">N/A</Text></Table.Td>;

  // Render a single vital row (used for both individual records and expanded group readings)
  const renderVitalRow = (vital, isNested = false) => (
    <Table.Tr key={vital.id} style={isNested ? { backgroundColor: 'var(--mantine-color-gray-0)' } : undefined}>
      <Table.Td>
        <Text size="sm" fw={500} pl={isNested ? 'md' : undefined}>
          {isNested ? formatDateTime(vital.recorded_date) : formatDate(vital.recorded_date)}
        </Text>
      </Table.Td>
      <Table.Td>
        {vital.systolic_bp && vital.diastolic_bp ? (
          <Text size="sm" fw={500}>
            {getBPDisplay(vital.systolic_bp, vital.diastolic_bp)}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            N/A
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {vital.heart_rate ? (
          <Text size="sm" fw={500}>
            {vital.heart_rate} BPM
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            N/A
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {vital.temperature ? (
          <Text size="sm" fw={500}>
            {formatMeasurement(
              convertForDisplay(vital.temperature, 'temperature', unitSystem),
              'temperature',
              unitSystem
            )}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            N/A
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {vital.weight ? (
          <Text size="sm" fw={500}>
            {formatMeasurement(
              convertForDisplay(vital.weight, 'weight', unitSystem),
              'weight',
              unitSystem
            )}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            N/A
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {vital.weight && vital.height ? (
          <Text size="sm" fw={500}>
            {getBMIDisplay(vital.weight, vital.height)}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            N/A
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {vital.blood_glucose ? (
          <Text size="sm" fw={500}>
            {vital.blood_glucose} mg/dL
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            N/A
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {vital.a1c ? (
          <Text size="sm" fw={500}>
            {vital.a1c}%
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            N/A
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {vital.oxygen_saturation ? (
          <Text size="sm" fw={500}>
            {vital.oxygen_saturation}%
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            N/A
          </Text>
        )}
      </Table.Td>
      {showActions && (
        <Table.Td>
          {!isNested && (
            <Group gap="xs">
              <ActionIcon
                variant="filled"
                color="green"
                size="sm"
                onClick={e => {
                  e.stopPropagation();
                  handleViewDetails(vital);
                }}
                title="View details"
              >
                <IconEye size={14} />
              </ActionIcon>
              <ActionIcon
                variant="filled"
                color="blue"
                size="sm"
                onClick={e => {
                  e.stopPropagation();
                  onEdit(vital);
                }}
                title="Edit vitals"
              >
                <IconEdit size={14} />
              </ActionIcon>
              <ActionIcon
                variant="filled"
                color="red"
                size="sm"
                onClick={e => {
                  e.stopPropagation();
                  handleDelete(vital.id);
                }}
                title="Delete vitals"
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Group>
          )}
        </Table.Td>
      )}
    </Table.Tr>
  );

  // Handle deleting all imported readings for a day
  const handleDeleteDay = async (item) => {
    const d = new Date(item.date);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!window.confirm(
      t('vitals.summary.confirmDeleteDay', 'Delete all {{count}} imported readings for this day?', { count: item.count })
    )) {
      return;
    }

    try {
      await vitalsService.deleteImportedDay(patientId, item.source, dateStr);
      notifySuccess('notifications:toasts.vitals.deleteSuccess');
      setExpandedGroup(null);
      // Refresh data
      if (vitalsData === undefined) {
        loadVitals();
      } else if (onDelete) {
        // Signal parent to refresh
        onDelete();
      }
    } catch (err) {
      logger.error('bulk_delete_imported_day_failed', err);
      notifyError('notifications:toasts.vitals.deleteFailed');
    }
  };

  // Build chart data from a day's readings for mini glucose chart
  const buildDayChartData = (readings) => {
    return readings
      .filter(r => r.blood_glucose != null)
      .sort((a, b) => new Date(a.recorded_date) - new Date(b.recorded_date))
      .map(r => ({
        time: new Date(r.recorded_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        glucose: r.blood_glucose,
      }));
  };

  // Render the expanded daily view: mini chart + stats + sub-paginated table
  const renderExpandedDayView = (item) => {
    const chartData = buildDayChartData(item.readings);
    const totalSubPages = Math.max(1, Math.ceil(item.readings.length / EXPANDED_PAGE_SIZE));
    const subStart = (expandedPage - 1) * EXPANDED_PAGE_SIZE;
    const subEnd = Math.min(subStart + EXPANDED_PAGE_SIZE, item.readings.length);
    const pageReadings = [...item.readings]
      .sort((a, b) => new Date(b.recorded_date) - new Date(a.recorded_date))
      .slice(subStart, subEnd);

    // Glucose reference ranges
    const normalMin = 70;
    const normalMax = 180;

    const colCount = showActions ? 10 : 9;

    return (
      <Table.Tr key={`${item.groupKey}-expanded`}>
        <Table.Td colSpan={colCount} style={{ padding: 0 }}>
          <Paper p="md" style={{ backgroundColor: 'var(--mantine-color-gray-0)', borderRadius: 0 }}>
            <Stack gap="md">
              {/* Mini glucose chart */}
              {chartData.length > 1 && (
                <Box>
                  <Text size="xs" fw={500} c="dimmed" mb="xs">
                    {t('vitals.summary.glucoseTrend', 'Glucose Trend')}
                  </Text>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-gray-3)" />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                        stroke="var(--mantine-color-gray-5)"
                      />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        domain={['dataMin - 10', 'dataMax + 10']}
                        stroke="var(--mantine-color-gray-5)"
                      />
                      <Tooltip
                        contentStyle={{ fontSize: 12 }}
                        formatter={(value) => [`${value} mg/dL`, t('vitals.modal.bloodGlucose', 'Glucose')]}
                      />
                      <ReferenceLine y={normalMin} stroke="var(--mantine-color-green-4)" strokeDasharray="4 4" />
                      <ReferenceLine y={normalMax} stroke="var(--mantine-color-orange-4)" strokeDasharray="4 4" />
                      <Line
                        type="monotone"
                        dataKey="glucose"
                        stroke="var(--mantine-color-orange-6)"
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              )}

              {/* Stats bar */}
              {item.stats && (
                <Group grow>
                  <Paper p="xs" withBorder ta="center">
                    <Text size="xs" c="dimmed">{t('vitals.summary.avgGlucose', 'Avg')}</Text>
                    <Text size="sm" fw={600}>{item.stats.avg} mg/dL</Text>
                  </Paper>
                  <Paper p="xs" withBorder ta="center">
                    <Text size="xs" c="dimmed">{t('vitals.summary.minGlucose', 'Min')}</Text>
                    <Text size="sm" fw={600}>{item.stats.min} mg/dL</Text>
                  </Paper>
                  <Paper p="xs" withBorder ta="center">
                    <Text size="xs" c="dimmed">{t('vitals.summary.maxGlucose', 'Max')}</Text>
                    <Text size="sm" fw={600}>{item.stats.max} mg/dL</Text>
                  </Paper>
                  <Paper p="xs" withBorder ta="center">
                    <Text size="xs" c="dimmed">{t('vitals.summary.readings', 'Readings')}</Text>
                    <Text size="sm" fw={600}>{item.count}</Text>
                  </Paper>
                </Group>
              )}

              {/* Sub-paginated readings table */}
              <Box>
                <Table striped highlightOnHover size="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('vitals.summary.time', 'Time')}</Table.Th>
                      <Table.Th>{t('vitals.modal.bloodGlucose', 'Glucose')} (mg/dL)</Table.Th>
                      {showActions && <Table.Th />}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {pageReadings.map(vital => (
                      <Table.Tr key={vital.id}>
                        <Table.Td>
                          <Text size="xs">{formatDateTime(vital.recorded_date)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" fw={500}>{vital.blood_glucose ?? 'N/A'}</Text>
                        </Table.Td>
                        {showActions && (
                          <Table.Td>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              size="xs"
                              onClick={() => handleDelete(vital.id, true)}
                              title={t('buttons.delete', 'Delete')}
                            >
                              <IconTrash size={12} />
                            </ActionIcon>
                          </Table.Td>
                        )}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>

                {/* Sub-pagination */}
                {totalSubPages > 1 && (
                  <Group justify="space-between" mt="xs">
                    <Text size="xs" c="dimmed">
                      {t('pagination.showingRange', 'Showing {{start}} to {{end}} of {{total}} results', {
                        start: subStart + 1,
                        end: subEnd,
                        total: item.readings.length,
                      })}
                    </Text>
                    <Pagination
                      total={totalSubPages}
                      value={expandedPage}
                      onChange={setExpandedPage}
                      size="xs"
                      siblings={1}
                      boundaries={1}
                    />
                  </Group>
                )}
              </Box>

            </Stack>
          </Paper>
        </Table.Td>
      </Table.Tr>
    );
  };

  // Render a summary row that looks like a normal vitals row.
  // Shows date + count badge, avg glucose in the glucose column, and expands on click.
  const renderSummaryRow = (item) => {
    const isExpanded = expandedGroup === item.groupKey;

    return (
      <React.Fragment key={item.groupKey}>
        <Table.Tr
          style={{ cursor: 'pointer' }}
          onClick={() => toggleGroup(item.groupKey)}
        >
          <Table.Td>
            <Group gap="xs">
              {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
              <Text size="sm" fw={500}>
                {formatDate(item.date)}
              </Text>
              <Badge size="xs" variant="light" color="blue">
                {item.count}
              </Badge>
            </Group>
          </Table.Td>
          {/* BP, Heart Rate, Temperature, Weight, BMI - not applicable for grouped rows */}
          {naCell}{naCell}{naCell}{naCell}{naCell}
          {/* Glucose - show avg (min-max) */}
          <Table.Td>
            {item.stats ? (
              <Text size="sm" fw={500}>
                {item.stats.avg}{' '}
                <Text span size="xs" c="dimmed">
                  ({item.stats.min}-{item.stats.max})
                </Text>{' '}
                mg/dL
              </Text>
            ) : (
              <Text size="sm" c="dimmed">N/A</Text>
            )}
          </Table.Td>
          {/* A1C, O2 Sat - not applicable for grouped rows */}
          {naCell}{naCell}
          {showActions && (
            <Table.Td>
              <Group gap="xs">
                <ActionIcon
                  variant="filled"
                  color="green"
                  size="sm"
                  onClick={e => {
                    e.stopPropagation();
                    handleViewDetails(item.readings[0]);
                  }}
                  title="View details"
                >
                  <IconEye size={14} />
                </ActionIcon>
                <ActionIcon
                  variant="filled"
                  color="blue"
                  size="sm"
                  onClick={e => {
                    e.stopPropagation();
                    // Pass first reading with locked glucose flag when multiple readings exist
                    const record = { ...item.readings[0] };
                    if (item.count > 1) {
                      record._lockedFields = ['blood_glucose'];
                    }
                    onEdit(record);
                  }}
                  title="Edit vitals"
                >
                  <IconEdit size={14} />
                </ActionIcon>
                <ActionIcon
                  variant="filled"
                  color="red"
                  size="sm"
                  onClick={e => {
                    e.stopPropagation();
                    handleDeleteDay(item);
                  }}
                  title={t('vitals.summary.deleteDay', 'Delete Day')}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
            </Table.Td>
          )}
        </Table.Tr>
        {isExpanded && renderExpandedDayView(item)}
      </React.Fragment>
    );
  };

  // When imported data is present, render grouped display items (summary + individual rows).
  // Otherwise, render flat paginated vitals rows.
  const rows = hasImportedData
    ? groupedDisplayItems.slice(startIndex, endIndex).map(item =>
        item.type === 'summary' ? renderSummaryRow(item) : renderVitalRow(item.record)
      )
    : paginatedVitals.map(vital => renderVitalRow(vital));

  return (
    <>
      <Stack gap="md">
        <Paper shadow="sm" withBorder>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>
                  <ThComponent
                    sorted="recorded_date"
                    onSort={() => handleSort('recorded_date')}
                  >
                    {t('vitals.table.date', 'Date')}
                  </ThComponent>
                </Table.Th>
                <Table.Th>
                  <ThComponent sorted="bp" onSort={() => handleSort('bp')}>
                    {t('vitals.stats.bloodPressure', 'Blood Pressure')}
                  </ThComponent>
                </Table.Th>
                <Table.Th>
                  <ThComponent
                    sorted="heart_rate"
                    onSort={() => handleSort('heart_rate')}
                  >
                    {t('vitals.stats.heartRate', 'Heart Rate')}
                  </ThComponent>
                </Table.Th>
                <Table.Th>
                  <ThComponent
                    sorted="temperature"
                    onSort={() => handleSort('temperature')}
                  >
                    {t('vitals.stats.temperature', 'Temperature')}
                  </ThComponent>
                </Table.Th>
                <Table.Th>
                  <ThComponent
                    sorted="weight"
                    onSort={() => handleSort('weight')}
                  >
                    {t('vitals.stats.weight', 'Weight')}
                  </ThComponent>
                </Table.Th>
                <Table.Th>
                  <ThComponent sorted="bmi" onSort={() => handleSort('bmi')}>
                    {t('vitals.stats.bmi', 'BMI')}
                  </ThComponent>
                </Table.Th>
                <Table.Th>
                  <ThComponent
                    sorted="blood_glucose"
                    onSort={() => handleSort('blood_glucose')}
                  >
                    {t('vitals.modal.bloodGlucose', 'Glucose')}
                  </ThComponent>
                </Table.Th>
                <Table.Th>
                  <ThComponent
                    sorted="a1c"
                    onSort={() => handleSort('a1c')}
                  >
                    {t('vitals.modal.a1c', 'A1C')}
                  </ThComponent>
                </Table.Th>
                <Table.Th>
                  <ThComponent
                    sorted="oxygen_saturation"
                    onSort={() => handleSort('oxygen_saturation')}
                  >
                    {t('vitals.table.oxygenSat', 'O2 Sat')}
                  </ThComponent>
                </Table.Th>
                {showActions && (
                  <Table.Th>
                    <Text fw={500} size="sm">
                      {t('labels.actions', 'Actions')}
                    </Text>
                  </Table.Th>
                )}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        </Paper>

        {/* Pagination Controls */}
        {effectiveTotalRecords > 0 && (
          <Group justify={totalPages > 1 ? 'space-between' : 'flex-end'} align="center" mt="md">
            {/* Left: Record count (only show when multiple pages) */}
            {totalPages > 1 && (
              <Text size="sm" c="dimmed">
                {t('pagination.showingRange', 'Showing {{start}} to {{end}} of {{total}} results', {
                  start: startIndex + 1,
                  end: endIndex,
                  total: effectiveTotalRecords,
                })}
              </Text>
            )}

            {/* Center: Page navigation */}
            {totalPages > 1 && (
              <Pagination
                total={totalPages}
                value={currentPage}
                onChange={setCurrentPage}
                size="sm"
                withEdges
                siblings={1}
                boundaries={1}
              />
            )}

            {/* Right: Page size selector */}
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                {t('pagination.itemsPerPage', 'Items per page')}:
              </Text>
              <Select
                value={String(pageSize)}
                onChange={handlePageSizeChange}
                data={PAGE_SIZE_OPTIONS}
                size="xs"
                w={70}
                allowDeselect={false}
                aria-label={t('pagination.itemsPerPage', 'Items per page')}
              />
            </Group>
          </Group>
        )}
      </Stack>

      {/* Detailed View Modal */}
      <Modal
        opened={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        title={
          <Group gap="sm">
            <IconEye size={20} />
            <Title order={3}>Vital Signs Details</Title>
          </Group>
        }
        size="xl"
        centered
      >
        {renderVitalDetails()}
      </Modal>
    </>
  );
};

export default VitalsList;
