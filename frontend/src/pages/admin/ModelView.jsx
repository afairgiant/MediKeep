import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Group,
  Stack,
  Text,
  Title,
  Badge,
  Paper,
  SimpleGrid,
  Alert,
  Center,
  Loader,
  Modal,
  Code,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconEdit,
  IconTrash,
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

const ModelView = () => {
  const { modelName, recordId } = useParams();
  const navigate = useNavigate();
  const { formatDateTime } = useDateFormat();

  const [record, setRecord] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [metadataResult, recordResult] = await Promise.all([
          adminApiService.getModelMetadata(modelName),
          adminApiService.getModelRecord(modelName, recordId),
        ]);

        setMetadata(metadataResult);
        setRecord(recordResult);
      } catch (err) {
        logger.error('record_view_load_error', 'Error loading record', {
          component: 'ModelView',
          modelName,
          recordId,
          error: err.message,
        });
        setError(err.message || 'Failed to load record');
      } finally {
        setLoading(false);
      }
    };

    if (modelName && recordId) {
      loadData();
    }
  }, [modelName, recordId]);

  const formatFieldValue = (value, fieldType) => {
    if (value === null || value === undefined) return 'N/A';
    if (fieldType === 'datetime' || fieldType === 'date') {
      try {
        return formatDateTime(value);
      } catch {
        return value;
      }
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const handleEdit = () => {
    navigate(`/admin/models/${modelName}/${recordId}/edit`);
  };

  const handleConfirmDelete = async () => {
    try {
      setDeleting(true);
      await adminApiService.deleteModelRecord(modelName, recordId);
      notifications.show({
        title: 'Record deleted',
        message: `Successfully deleted ${modelName} record #${recordId}`,
        color: 'green',
      });
      navigate(`/admin/models/${modelName}`);
    } catch (err) {
      notifications.show({
        title: 'Delete failed',
        message: err.message || 'Failed to delete record',
        color: 'red',
      });
    } finally {
      setDeleting(false);
      closeDeleteModal();
    }
  };

  const handleBack = () => {
    navigate(`/admin/models/${modelName}`);
  };

  if (loading) {
    return (
      <AdminLayout>
        <Center style={{ minHeight: 'calc(100vh - 140px)' }}>
          <Loader size="lg" />
        </Center>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <Center style={{ minHeight: 'calc(100vh - 140px)' }}>
          <Stack align="center" gap="md">
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" title="Error">
              {error}
            </Alert>
            <Button variant="default" leftSection={<IconArrowLeft size={16} />} onClick={handleBack}>
              Back to {modelName}
            </Button>
          </Stack>
        </Center>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Stack gap="lg" maw={1200} mx="auto" p="md">
        {/* Header */}
        <Stack gap="sm">
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={handleBack}
            style={{ alignSelf: 'flex-start' }}
            size="sm"
          >
            Back
          </Button>
          <Group justify="space-between" align="flex-end">
            <div>
              <Title order={2}>View {metadata?.display_name || modelName}</Title>
              <Text c="dimmed" size="sm">Record ID: {recordId}</Text>
            </div>
            <Group gap="sm">
              <Button
                variant="light"
                leftSection={<IconEdit size={16} />}
                onClick={handleEdit}
              >
                Edit
              </Button>
              <Button
                color="red"
                variant="light"
                leftSection={<IconTrash size={16} />}
                onClick={openDeleteModal}
              >
                Delete
              </Button>
            </Group>
          </Group>
        </Stack>

        {/* Record Details */}
        <Paper withBorder p={0} radius="md">
          <SimpleGrid cols={1} spacing={0}>
            {metadata?.fields.map(field => (
              <div
                key={field.name}
                style={{
                  padding: 'var(--mantine-spacing-md)',
                  borderBottom: '1px solid var(--mantine-color-default-border)',
                }}
              >
                <Group gap="xs" mb={4}>
                  <Text size="sm" fw={600}>{field.name}</Text>
                  {field.primary_key && <Badge size="xs" color="yellow" variant="light">PK</Badge>}
                  {field.foreign_key && <Badge size="xs" color="violet" variant="light">FK</Badge>}
                  {!field.nullable && <Text size="xs" c="red" fw={700}>*</Text>}
                </Group>
                <Paper
                  p="sm"
                  radius="sm"
                  style={{
                    backgroundColor: 'var(--mantine-color-default-hover)',
                    fontFamily: 'var(--mantine-font-family-monospace)',
                    fontSize: 'var(--mantine-font-size-sm)',
                    wordBreak: 'break-word',
                  }}
                >
                  {formatFieldValue(record[field.name], field.type)}
                </Paper>
                <Text size="xs" c="dimmed" mt={4} fs="italic">
                  Type: {field.type}
                  {field.max_length && ` | Max Length: ${field.max_length}`}
                  {field.foreign_key && ` | References: ${field.foreign_key}`}
                </Text>
              </div>
            ))}
          </SimpleGrid>
        </Paper>

        {/* Raw JSON */}
        <Paper withBorder p="md" radius="md">
          <details>
            <summary style={{ cursor: 'pointer', fontWeight: 500, marginBottom: 8 }}>
              Raw Data (JSON)
            </summary>
            <Code block>{JSON.stringify(record, null, 2)}</Code>
          </details>
        </Paper>

        {/* Delete Confirmation Modal */}
        <Modal
          opened={deleteModalOpened}
          onClose={closeDeleteModal}
          title={
            <Group gap="xs">
              <IconAlertTriangle size={20} color="var(--mantine-color-red-6)" />
              <Text fw={600}>Confirm Deletion</Text>
            </Group>
          }
          centered
        >
          <Stack gap="md">
            {requiresEnhancedDeletionWarning(modelName) ? (
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
                {record && getDeletionConfirmationMessage(modelName, record)}
              </Text>
            )}
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={closeDeleteModal}>Cancel</Button>
              <Button color="red" onClick={handleConfirmDelete} loading={deleting}>
                Delete
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </AdminLayout>
  );
};

export default ModelView;
