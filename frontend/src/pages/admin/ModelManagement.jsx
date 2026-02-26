import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Table,
  TextInput,
  Select,
  Checkbox,
  ActionIcon,
  Button,
  Group,
  Stack,
  Text,
  Title,
  Badge,
  Pagination,
  Paper,
  Alert,
  Center,
  Loader,
  Tooltip,
  Menu,
  Modal,
  ScrollArea,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconSearch,
  IconArrowLeft,
  IconPlus,
  IconEye,
  IconEdit,
  IconTrash,
  IconColumns,
  IconX,
  IconAlertTriangle,
  IconAlertCircle,
} from '@tabler/icons-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { adminApiService } from '../../services/api/adminApi';
import {
  getDeletionConfirmationMessage,
  requiresEnhancedDeletionWarning,
  getCascadeTypes,
} from '../../utils/adminDeletionConfig';
import { useDateFormat } from '../../hooks/useDateFormat';
import logger from '../../services/logger';
import { IMPORTANT_FIELDS } from '../../constants/modelConstants';
import './ModelManagement.css';

const PER_PAGE_OPTIONS = ['10', '25', '50', '100'];

const ModelManagement = () => {
  const { modelName } = useParams();
  const navigate = useNavigate();
  const { formatDate } = useDateFormat();

  const formatFieldValue = (value, fieldType) => {
    if (value === null || value === undefined) return '-';
    if (fieldType === 'datetime' || fieldType === 'date') return formatDate(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };

  const [records, setRecords] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [perPage, setPerPage] = useState('25');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimerRef = useRef(null);

  // Selection for bulk operations
  const [selectedRecords, setSelectedRecords] = useState(new Set());

  // Delete modals
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [bulkDeleteModalOpened, { open: openBulkDeleteModal, close: closeBulkDeleteModal }] = useDisclosure(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState(null);

  // Load column visibility from localStorage when model changes
  useEffect(() => {
    const storageKey = `admin_columns_${modelName}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
          setVisibleColumns(parsed);
        } else {
          localStorage.removeItem(storageKey);
          setVisibleColumns(null);
        }
      } catch {
        localStorage.removeItem(storageKey);
        setVisibleColumns(null);
      }
    } else {
      setVisibleColumns(null);
    }
  }, [modelName]);

  const loadModelData = useCallback(async (search = '', page = currentPage) => {
    try {
      setLoading(true);
      setError(null);

      const [metadataResult, recordsResult] = await Promise.all([
        adminApiService.getModelMetadata(modelName),
        adminApiService.getModelRecords(modelName, {
          page,
          per_page: Number(perPage),
          search: search || null,
        }),
      ]);

      setMetadata(metadataResult);
      setRecords(recordsResult.items);
      setTotalPages(recordsResult.total_pages);
      setTotalRecords(recordsResult.total);
    } catch (err) {
      logger.error('model_data_load_error', 'Error loading model data', {
        component: 'ModelManagement',
        modelName,
        error: err.message,
      });
      setError(err.message || 'Failed to load model data');
    } finally {
      setLoading(false);
    }
  }, [modelName, currentPage, perPage]);

  useEffect(() => {
    if (modelName) {
      loadModelData(searchQuery);
    }
  }, [modelName, loadModelData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setCurrentPage(1);
      setSelectedRecords(new Set());
      loadModelData(value, 1);
    }, 300);
  }, [loadModelData]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const handlePageChange = useCallback((newPage) => {
    setCurrentPage(newPage);
    setSelectedRecords(new Set());
  }, []);

  const handlePerPageChange = useCallback((newPerPage) => {
    setPerPage(newPerPage);
    setCurrentPage(1);
    setSelectedRecords(new Set());
  }, []);

  const handleSelectRecord = useCallback((recordId) => {
    setSelectedRecords(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(recordId)) {
        newSelected.delete(recordId);
      } else {
        newSelected.add(recordId);
      }
      return newSelected;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedRecords.size === records.length) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(records.map(record => record.id)));
    }
  }, [selectedRecords.size, records]);

  // Delete single record
  const handleDeleteClick = useCallback((record) => {
    setRecordToDelete(record);
    openDeleteModal();
  }, [openDeleteModal]);

  const handleConfirmDelete = useCallback(async () => {
    if (!recordToDelete) return;
    try {
      setDeleting(true);
      await adminApiService.deleteModelRecord(modelName, recordToDelete.id);
      notifications.show({
        title: 'Record deleted',
        message: `Successfully deleted ${modelName} record #${recordToDelete.id}`,
        color: 'green',
      });
      closeDeleteModal();
      setRecordToDelete(null);
      loadModelData(searchQuery);
    } catch (err) {
      notifications.show({
        title: 'Delete failed',
        message: err.message || 'Failed to delete record',
        color: 'red',
      });
    } finally {
      setDeleting(false);
    }
  }, [modelName, recordToDelete, loadModelData, closeDeleteModal, searchQuery]);

  // Bulk delete
  const handleBulkDeleteClick = useCallback(() => {
    setBulkDeleteConfirmText('');
    openBulkDeleteModal();
  }, [openBulkDeleteModal]);

  const handleConfirmBulkDelete = useCallback(async () => {
    try {
      setDeleting(true);
      await adminApiService.bulkDeleteRecords(modelName, Array.from(selectedRecords));
      notifications.show({
        title: 'Records deleted',
        message: `Successfully deleted ${selectedRecords.size} records`,
        color: 'green',
      });
      closeBulkDeleteModal();
      setSelectedRecords(new Set());
      setBulkDeleteConfirmText('');
      loadModelData(searchQuery);
    } catch (err) {
      notifications.show({
        title: 'Bulk delete failed',
        message: err.message || 'Failed to delete records',
        color: 'red',
      });
    } finally {
      setDeleting(false);
    }
  }, [modelName, selectedRecords, loadModelData, closeBulkDeleteModal, searchQuery]);

  // Column visibility
  const allFields = useMemo(() => {
    if (!metadata) return [];
    return metadata.fields.map(f => f.name);
  }, [metadata]);

  const defaultDisplayFieldNames = useMemo(() => {
    if (!metadata) return [];
    const fields = metadata.fields
      .filter(field => field.primary_key || IMPORTANT_FIELDS.includes(field.name))
      .slice(0, 5);
    if (!fields.find(f => f.name === 'id')) {
      const idField = metadata.fields.find(f => f.name === 'id');
      if (idField) fields.unshift(idField);
    }
    return fields.map(f => f.name);
  }, [metadata]);

  const activeColumnNames = visibleColumns || defaultDisplayFieldNames;

  const displayFields = useMemo(() => {
    if (!metadata) return [];
    return activeColumnNames
      .map(name => metadata.fields.find(f => f.name === name))
      .filter(Boolean);
  }, [metadata, activeColumnNames]);

  const handleColumnToggle = useCallback((columnNames) => {
    setVisibleColumns(columnNames);
    localStorage.setItem(`admin_columns_${modelName}`, JSON.stringify(columnNames));
  }, [modelName]);

  const handleNavigateToCreate = useCallback(() => {
    if (modelName === 'user') {
      navigate('/admin/create-user');
    } else {
      navigate(`/admin/models/${modelName}/create`);
    }
  }, [modelName, navigate]);

  if (loading && !metadata) {
    return (
      <AdminLayout>
        <Center style={{ minHeight: 'calc(100vh - 140px)' }}>
          <Loader size="lg" />
        </Center>
      </AdminLayout>
    );
  }

  if (error && !metadata) {
    return (
      <AdminLayout>
        <Center style={{ minHeight: 'calc(100vh - 140px)' }}>
          <Stack align="center" gap="md">
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" title="Error">
              {error}
            </Alert>
            <Button onClick={() => loadModelData(searchQuery)}>Retry</Button>
          </Stack>
        </Center>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="model-management">
        {/* Header */}
        <Stack gap="sm" mb="lg">
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/admin/data-models')}
            style={{ alignSelf: 'flex-start' }}
            size="sm"
          >
            Back to Data Models
          </Button>
          <Group justify="space-between" align="flex-end">
            <div>
              <Title order={2}>{metadata?.verbose_name_plural || modelName}</Title>
              <Text c="dimmed" size="sm">{totalRecords} total records</Text>
            </div>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={handleNavigateToCreate}
            >
              Add New
            </Button>
          </Group>
        </Stack>

        {/* Controls: search + per-page + column visibility */}
        <Paper withBorder p="md" mb="md">
          <Group justify="space-between" wrap="wrap" gap="sm">
            <TextInput
              placeholder={`Search ${metadata?.verbose_name_plural || modelName}...`}
              leftSection={<IconSearch size={16} />}
              rightSection={
                searchQuery ? (
                  <ActionIcon variant="subtle" size="sm" onClick={() => handleSearchChange('')} aria-label="Clear search">
                    <IconX size={14} />
                  </ActionIcon>
                ) : null
              }
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.currentTarget.value)}
              style={{ flex: 1, minWidth: 200, maxWidth: 400 }}
              aria-label="Search records"
            />
            <Group gap="sm">
              <Menu shadow="md" width={220} closeOnItemClick={false}>
                <Menu.Target>
                  <Tooltip label="Column visibility">
                    <ActionIcon variant="light" size="lg" aria-label="Toggle column visibility">
                      <IconColumns size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Visible columns</Menu.Label>
                  <ScrollArea.Autosize mah={300}>
                    {allFields.map((fieldName) => (
                      <Menu.Item
                        key={fieldName}
                        onClick={() => {
                          const current = activeColumnNames;
                          const next = current.includes(fieldName)
                            ? current.filter(c => c !== fieldName)
                            : [...current, fieldName];
                          if (next.length > 0) handleColumnToggle(next);
                        }}
                      >
                        <Checkbox
                          checked={activeColumnNames.includes(fieldName)}
                          label={fieldName}
                          readOnly
                          size="xs"
                        />
                      </Menu.Item>
                    ))}
                  </ScrollArea.Autosize>
                  <Menu.Divider />
                  <Menu.Item
                    onClick={() => {
                      setVisibleColumns(null);
                      localStorage.removeItem(`admin_columns_${modelName}`);
                    }}
                  >
                    <Text size="xs" c="dimmed">Reset to default</Text>
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
              <Select
                data={PER_PAGE_OPTIONS.map(v => ({ value: v, label: `${v} per page` }))}
                value={perPage}
                onChange={handlePerPageChange}
                w={140}
                aria-label="Records per page"
                allowDeselect={false}
              />
            </Group>
          </Group>
          {searchQuery && (
            <Text size="sm" c="dimmed" mt="xs">
              {totalRecords} result{totalRecords !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
            </Text>
          )}
        </Paper>

        {/* Bulk actions */}
        {selectedRecords.size > 0 && (
          <Alert color="yellow" variant="light" mb="md">
            <Group justify="space-between">
              <Text fw={500}>{selectedRecords.size} selected</Text>
              <Button
                color="red"
                size="xs"
                leftSection={<IconTrash size={14} />}
                onClick={handleBulkDeleteClick}
              >
                Delete Selected
              </Button>
            </Group>
          </Alert>
        )}

        {/* Table */}
        <Paper withBorder mb="md">
          <ScrollArea>
            <Table striped highlightOnHover aria-label={`${metadata?.verbose_name_plural || modelName} records`}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}>
                    <Checkbox
                      checked={selectedRecords.size === records.length && records.length > 0}
                      indeterminate={selectedRecords.size > 0 && selectedRecords.size < records.length}
                      onChange={handleSelectAll}
                      aria-label="Select all records"
                    />
                  </Table.Th>
                  {displayFields.map(field => (
                    <Table.Th key={field.name}>
                      <Group gap={4} wrap="nowrap">
                        {field.name}
                        {field.primary_key && (
                          <Badge size="xs" variant="light">PK</Badge>
                        )}
                      </Group>
                    </Table.Th>
                  ))}
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {loading ? (
                  <Table.Tr>
                    <Table.Td colSpan={displayFields.length + 2}>
                      <Center py="md"><Loader size="sm" /></Center>
                    </Table.Td>
                  </Table.Tr>
                ) : records.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={displayFields.length + 2}>
                      <Text ta="center" c="dimmed" py="md">No records found</Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  records.map(record => (
                    <Table.Tr key={record.id}>
                      <Table.Td>
                        <Checkbox
                          checked={selectedRecords.has(record.id)}
                          onChange={() => handleSelectRecord(record.id)}
                          aria-label={`Select record ${record.id}`}
                        />
                      </Table.Td>
                      {displayFields.map(field => (
                        <Table.Td key={field.name} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {formatFieldValue(record[field.name], field.type)}
                        </Table.Td>
                      ))}
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Tooltip label="View">
                            <ActionIcon
                              variant="subtle"
                              color="blue"
                              onClick={() => navigate(`/admin/models/${modelName}/${record.id}`)}
                              aria-label="View record"
                            >
                              <IconEye size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Edit">
                            <ActionIcon
                              variant="subtle"
                              color="yellow"
                              onClick={() => navigate(`/admin/models/${modelName}/${record.id}/edit`)}
                              aria-label="Edit record"
                            >
                              <IconEdit size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => handleDeleteClick(record)}
                              aria-label="Delete record"
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>

        {/* Pagination */}
        {totalPages > 1 && (
          <Center>
            <Pagination
              total={totalPages}
              value={currentPage}
              onChange={handlePageChange}
            />
          </Center>
        )}

        {/* Single Delete Confirmation Modal */}
        <Modal
          opened={deleteModalOpened}
          onClose={() => { closeDeleteModal(); setRecordToDelete(null); }}
          title={
            <Group gap="xs">
              <IconAlertTriangle size={20} color="var(--mantine-color-red-6)" aria-hidden="true" />
              <Text fw={600}>Confirm Deletion</Text>
            </Group>
          }
          centered
        >
          <Stack gap="md">
            {recordToDelete && requiresEnhancedDeletionWarning(modelName) ? (
              <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
                <Text size="sm" fw={500} mb="xs">
                  This will permanently delete this {modelName} record and all associated data:
                </Text>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {getCascadeTypes(modelName).map(type => (
                    <li key={type}><Text size="sm">{type}</Text></li>
                  ))}
                </ul>
              </Alert>
            ) : (
              <Text size="sm">
                {recordToDelete && getDeletionConfirmationMessage(modelName, recordToDelete)}
              </Text>
            )}
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={() => { closeDeleteModal(); setRecordToDelete(null); }}>
                Cancel
              </Button>
              <Button color="red" onClick={handleConfirmDelete} loading={deleting}>
                Delete
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Bulk Delete Confirmation Modal */}
        <Modal
          opened={bulkDeleteModalOpened}
          onClose={() => { closeBulkDeleteModal(); setBulkDeleteConfirmText(''); }}
          title={
            <Group gap="xs">
              <IconAlertTriangle size={20} color="var(--mantine-color-red-6)" aria-hidden="true" />
              <Text fw={600}>Confirm Bulk Deletion</Text>
            </Group>
          }
          centered
        >
          <Stack gap="md">
            <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
              <Text size="sm" fw={500}>
                You are about to permanently delete {selectedRecords.size} {modelName} record{selectedRecords.size !== 1 ? 's' : ''}.
              </Text>
              {requiresEnhancedDeletionWarning(modelName) && (
                <Text size="sm" mt="xs">
                  All associated data (including {getCascadeTypes(modelName).join(', ')}) will also be deleted.
                </Text>
              )}
            </Alert>
            <TextInput
              label={<Text size="sm">Type <strong>DELETE</strong> to confirm</Text>}
              placeholder="DELETE"
              value={bulkDeleteConfirmText}
              onChange={(e) => setBulkDeleteConfirmText(e.currentTarget.value)}
            />
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={() => { closeBulkDeleteModal(); setBulkDeleteConfirmText(''); }}>
                Cancel
              </Button>
              <Button
                color="red"
                onClick={handleConfirmBulkDelete}
                loading={deleting}
                disabled={bulkDeleteConfirmText !== 'DELETE'}
              >
                Delete {selectedRecords.size} Records
              </Button>
            </Group>
          </Stack>
        </Modal>
      </div>
    </AdminLayout>
  );
};

export default ModelManagement;
