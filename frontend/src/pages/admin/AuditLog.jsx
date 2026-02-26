import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ActionIcon,
  Card,
  Paper,
  Group,
  Stack,
  Text,
  Title,
  Badge,
  ThemeIcon,
  TextInput,
  Select,
  Table,
  ScrollArea,
  Pagination,
  Button,
  Alert,
  Loader,
  Center,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconSearch,
  IconDownload,
  IconFileText,
  IconAlertCircle,
  IconFilterOff,
  IconRefresh,
  IconExternalLink,
} from '@tabler/icons-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminApiService } from '../../services/api/adminApi';
import { useDateFormat } from '../../hooks/useDateFormat';
import logger from '../../services/logger';

const DEBOUNCE_MS = 300;

const ACTION_COLORS = {
  created: 'green',
  updated: 'blue',
  deleted: 'red',
  viewed: 'gray',
  uploaded: 'cyan',
  downloaded: 'cyan',
  login: 'teal',
  logout: 'orange',
  activated: 'green',
  deactivated: 'red',
  completed: 'green',
  cancelled: 'orange',
  backup_created: 'indigo',
  maintenance_started: 'yellow',
  maintenance_completed: 'green',
};

// Entity types that have admin model views (matches MODEL_REGISTRY keys)
const LINKABLE_ENTITY_TYPES = new Set([
  'user', 'patient', 'practitioner', 'pharmacy', 'medication',
  'lab_result', 'lab_result_file', 'lab_test_component', 'vitals', 'condition', 'allergy',
  'immunization', 'procedure', 'treatment', 'encounter', 'emergency_contact',
  'insurance', 'family_member', 'family_condition', 'entity_file',
  'injury', 'injury_type', 'symptom', 'symptom_occurrence', 'medical_equipment',
  'patient_share', 'invitation', 'family_history_share',
]);

function getEntityLink(entry) {
  if (
    !entry.entity_id ||
    !LINKABLE_ENTITY_TYPES.has(entry.entity_type) ||
    entry.action === 'deleted'
  ) {
    return null;
  }
  return `/admin/models/${entry.entity_type}/${entry.entity_id}`;
}

const AuditLog = () => {
  const navigate = useNavigate();
  const { formatDateTime } = useDateFormat();

  // Pagination
  const [page, setPage] = useState(1);
  const [perPage] = useState(50);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateRange, setDateRange] = useState([null, null]);
  const [actionFilter, setActionFilter] = useState(null);
  const [entityTypeFilter, setEntityTypeFilter] = useState(null);
  const [userFilter, setUserFilter] = useState(null);

  // Data
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(null);
  const [exporting, setExporting] = useState(false);

  const searchTimerRef = useRef(null);

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, DEBOUNCE_MS);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, actionFilter, entityTypeFilter, userFilter, dateRange]);

  // Fetch filters on mount
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const response = await adminApiService.getActivityLogFilters();
        setFilters(response);
      } catch (err) {
        logger.error('audit_log_filters_error', 'Failed to load filters', {
          component: 'AuditLog',
          error: err.message,
        });
      }
    };
    fetchFilters();
  }, []);

  const buildFilterParams = useCallback(() => {
    const params = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (actionFilter) params.action = actionFilter;
    if (entityTypeFilter) params.entity_type = entityTypeFilter;
    if (userFilter) params.user_id = userFilter;
    if (dateRange[0]) params.start_date = dateRange[0].toISOString();
    if (dateRange[1]) params.end_date = dateRange[1].toISOString();
    return params;
  }, [debouncedSearch, actionFilter, entityTypeFilter, userFilter, dateRange]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = { page, per_page: perPage, ...buildFilterParams() };
      const response = await adminApiService.getActivityLog(params);
      setData(response);
    } catch (err) {
      setError(err.message || 'Failed to load activity log');
      logger.error('audit_log_fetch_error', 'Failed to fetch activity log', {
        component: 'AuditLog',
        error: err.message,
      });
    } finally {
      setLoading(false);
    }
  }, [page, perPage, buildFilterParams]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await adminApiService.exportActivityLog(buildFilterParams());
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audit_log_export.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      logger.error('audit_log_export_error', 'Failed to export activity log', {
        component: 'AuditLog',
        error: err.message,
      });
    } finally {
      setExporting(false);
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setActionFilter(null);
    setEntityTypeFilter(null);
    setUserFilter(null);
    setDateRange([null, null]);
    setPage(1);
  };

  const hasActiveFilters =
    debouncedSearch || actionFilter || entityTypeFilter || userFilter || dateRange[0] || dateRange[1];

  const actionOptions = filters?.actions || [];
  const entityTypeOptions = filters?.entity_types || [];
  const userOptions = filters?.users?.map((u) => ({
    value: String(u.value),
    label: u.label,
  })) || [];

  return (
    <AdminLayout>
      <Stack gap="lg">
        {/* Header */}
        <Card shadow="sm" p="xl" withBorder>
          <Group justify="space-between" align="flex-start">
            <div>
              <Group align="center" mb="xs">
                <ThemeIcon size="xl" variant="light" color="blue">
                  <IconFileText size={24} />
                </ThemeIcon>
                <Title order={2}>Audit Log</Title>
              </Group>
              <Text c="dimmed" size="md">
                Complete activity trail for compliance and auditing
              </Text>
            </div>
            <Group>
              <Button
                leftSection={<IconRefresh size={16} />}
                variant="light"
                onClick={fetchData}
                loading={loading}
              >
                Refresh
              </Button>
              <Button
                leftSection={<IconDownload size={16} />}
                onClick={handleExport}
                loading={exporting}
              >
                Export CSV
              </Button>
            </Group>
          </Group>
        </Card>

        {/* Filters */}
        <Paper shadow="xs" p="md" withBorder>
          <Stack gap="sm">
            <Group grow align="flex-end">
              <TextInput
                placeholder="Search descriptions..."
                leftSection={<IconSearch size={16} />}
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                aria-label="Search activity log"
              />
              <DatePickerInput
                type="range"
                placeholder="Date range"
                value={dateRange}
                onChange={setDateRange}
                clearable
                aria-label="Filter by date range"
              />
            </Group>
            <Group grow align="flex-end">
              <Select
                placeholder="Action"
                data={actionOptions}
                value={actionFilter}
                onChange={setActionFilter}
                clearable
                searchable
                aria-label="Filter by action"
              />
              <Select
                placeholder="Entity Type"
                data={entityTypeOptions}
                value={entityTypeFilter}
                onChange={setEntityTypeFilter}
                clearable
                searchable
                aria-label="Filter by entity type"
              />
              <Select
                placeholder="User"
                data={userOptions}
                value={userFilter}
                onChange={setUserFilter}
                clearable
                searchable
                aria-label="Filter by user"
              />
              {hasActiveFilters && (
                <Button
                  variant="subtle"
                  color="gray"
                  leftSection={<IconFilterOff size={16} />}
                  onClick={handleClearFilters}
                >
                  Clear Filters
                </Button>
              )}
            </Group>
          </Stack>
        </Paper>

        {/* Results Info */}
        {data && !loading && (
          <Text size="sm" c="dimmed">
            Showing {data.items?.length || 0} of {data.total || 0} results
            {data.total_pages > 1 && ` (page ${data.page} of ${data.total_pages})`}
          </Text>
        )}

        {/* Error State */}
        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Error loading audit log"
            color="red"
          >
            {error}
            <Button variant="subtle" size="xs" mt="xs" onClick={fetchData}>
              Retry
            </Button>
          </Alert>
        )}

        {/* Loading State */}
        {loading && !data && (
          <Center py="xl">
            <Stack align="center">
              <Loader size="lg" />
              <Text c="dimmed">Loading audit log...</Text>
            </Stack>
          </Center>
        )}

        {/* Data Table */}
        {data && (
          <Paper shadow="xs" withBorder style={{ position: 'relative' }}>
            {loading && data && (
              <Center
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(255,255,255,0.7)',
                  zIndex: 10,
                }}
              >
                <Loader size="sm" />
              </Center>
            )}
            <ScrollArea>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Timestamp</Table.Th>
                    <Table.Th>User</Table.Th>
                    <Table.Th>Action</Table.Th>
                    <Table.Th>Entity Type</Table.Th>
                    <Table.Th>Description</Table.Th>
                    <Table.Th>Record ID</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.items?.length > 0 ? (
                    data.items.map((entry) => {
                      const link = getEntityLink(entry);
                      return (
                        <Table.Tr
                          key={entry.id}
                          style={link ? { cursor: 'pointer' } : undefined}
                          onClick={link ? () => navigate(link) : undefined}
                        >
                          <Table.Td style={{ whiteSpace: 'nowrap' }}>
                            <Text size="sm">
                              {entry.timestamp ? formatDateTime(entry.timestamp) : '-'}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{entry.username || 'System'}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              variant="light"
                              color={ACTION_COLORS[entry.action] || 'gray'}
                              size="sm"
                            >
                              {entry.action}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{entry.entity_type_display}</Text>
                          </Table.Td>
                          <Table.Td style={{ maxWidth: 300 }}>
                            <Tooltip
                              label={entry.description}
                              disabled={entry.description.length <= 60}
                              multiline
                              w={300}
                            >
                              <Text size="sm" lineClamp={1}>
                                {entry.description}
                              </Text>
                            </Tooltip>
                          </Table.Td>
                          <Table.Td>
                            {link ? (
                              <Tooltip label={`View ${entry.entity_type_display} record`}>
                                <ActionIcon
                                  variant="subtle"
                                  size="sm"
                                  color="blue"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(link);
                                  }}
                                  aria-label={`View ${entry.entity_type_display} #${entry.entity_id}`}
                                >
                                  <IconExternalLink size={14} />
                                </ActionIcon>
                              </Tooltip>
                            ) : (
                              <Text size="sm" c="dimmed">
                                {entry.entity_id || '-'}
                              </Text>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      );
                    }))
                  : (
                    <Table.Tr>
                      <Table.Td colSpan={6}>
                        <Center py="xl">
                          <Stack align="center">
                            <ThemeIcon size="xl" variant="light" color="gray">
                              <IconFileText size={24} />
                            </ThemeIcon>
                            <Text c="dimmed" size="sm">
                              No activity logs found
                            </Text>
                          </Stack>
                        </Center>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Paper>
        )}

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <Center>
            <Pagination
              value={page}
              onChange={setPage}
              total={data.total_pages}
              siblings={1}
              boundaries={1}
            />
          </Center>
        )}
      </Stack>
    </AdminLayout>
  );
};

export default AuditLog;
