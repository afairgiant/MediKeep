import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Group,
  Stack,
  Text,
  Badge,
  Button,
  Alert,
  ThemeIcon,
  Center,
  Loader,
} from '@mantine/core';
import {
  IconTool,
  IconTestPipe,
  IconRefresh,
  IconCheck,
  IconX,
  IconInfoCircle,
} from '@tabler/icons-react';
import AdminLayout from '../../components/admin/AdminLayout';
import HealthItem from '../../components/admin/HealthItem';
import { adminApiService } from '../../services/api/adminApi';

const ToolsMaintenance = () => {
  // Test Library State
  const [testLibraryInfo, setTestLibraryInfo] = useState(null);
  const [testLibraryLoading, setTestLibraryLoading] = useState(false);
  const [testLibrarySyncing, setTestLibrarySyncing] = useState(false);
  const [testLibraryError, setTestLibraryError] = useState(null);
  const [syncResult, setSyncResult] = useState(null);

  const loadTestLibraryInfo = useCallback(async () => {
    setTestLibraryLoading(true);
    setTestLibraryError(null);
    try {
      const info = await adminApiService.getTestLibraryInfo();
      setTestLibraryInfo(info);
    } catch (err) {
      setTestLibraryError(err.message || 'Failed to load test library info');
    } finally {
      setTestLibraryLoading(false);
    }
  }, []);

  const handleReloadTestLibrary = async () => {
    setTestLibrarySyncing(true);
    setTestLibraryError(null);
    setSyncResult(null);
    try {
      const result = await adminApiService.reloadTestLibrary();
      setSyncResult({ type: 'reload', ...result });
      await loadTestLibraryInfo();
    } catch (err) {
      setTestLibraryError(err.message || 'Failed to reload test library');
    } finally {
      setTestLibrarySyncing(false);
    }
  };

  const handleSyncTestLibrary = async (forceAll = false) => {
    setTestLibrarySyncing(true);
    setTestLibraryError(null);
    setSyncResult(null);
    try {
      const result = await adminApiService.syncTestLibrary(forceAll);
      setSyncResult({ type: 'sync', ...result });
      await loadTestLibraryInfo();
    } catch (err) {
      setTestLibraryError(err.message || 'Failed to sync test library');
    } finally {
      setTestLibrarySyncing(false);
    }
  };

  useEffect(() => {
    loadTestLibraryInfo();
  }, [loadTestLibraryInfo]);

  return (
    <AdminLayout>
      <div className="tools-maintenance">
        {/* Header */}
        <Card shadow="sm" p="xl" mb="xl" withBorder>
          <Group align="center" mb="xs">
            <ThemeIcon size="xl" variant="light" color="blue">
              <IconTool size={24} />
            </ThemeIcon>
            <Text size="xl" fw={700}>
              Tools &amp; Maintenance
            </Text>
          </Group>
          <Text c="dimmed" size="md">
            Administrative tools for system maintenance and data management
          </Text>
        </Card>

        {/* Test Library Maintenance */}
        <Card shadow="sm" p="lg" mb="lg" withBorder>
          <Group mb="md">
            <ThemeIcon size="lg" variant="light" color="grape">
              <IconTestPipe size={20} />
            </ThemeIcon>
            <Text fw={600} size="lg">
              Test Library Maintenance
            </Text>
            <Badge
              variant="light"
              color={testLibraryError ? 'red' : 'green'}
            >
              {testLibraryError ? 'Error' : 'Operational'}
            </Badge>
          </Group>

          {testLibraryError && (
            <Alert color="red" variant="light" mb="md">
              {testLibraryError}
            </Alert>
          )}

          {testLibraryLoading ? (
            <Center py="lg">
              <Loader size="sm" />
            </Center>
          ) : (
            <>
              {testLibraryInfo && (
                <Stack gap={0} mb="md">
                  <HealthItem
                    label="Library Version"
                    value={testLibraryInfo.version}
                    status="info"
                  />
                  <HealthItem
                    label="Total Tests"
                    value={testLibraryInfo.test_count}
                    status="info"
                  />
                  <HealthItem
                    label="Categories"
                    value={
                      testLibraryInfo.categories
                        ? Object.entries(testLibraryInfo.categories)
                            .map(([cat, count]) => `${cat}: ${count}`)
                            .join(', ')
                        : ''
                    }
                  />
                </Stack>
              )}

              {syncResult && (
                <Alert
                  color={syncResult.success ? 'green' : 'red'}
                  variant="light"
                  icon={syncResult.success ? <IconCheck size={16} /> : <IconX size={16} />}
                  mb="md"
                  withCloseButton
                  onClose={() => setSyncResult(null)}
                  title={
                    syncResult.type === 'reload'
                      ? 'Library Reloaded'
                      : 'Sync Complete'
                  }
                >
                  {syncResult.type === 'sync' && (
                    <Group gap="lg" mb="xs">
                      <Text size="sm">
                        Processed: {syncResult.components_processed}
                      </Text>
                      <Text size="sm">
                        Names Updated: {syncResult.canonical_names_updated}
                      </Text>
                      <Text size="sm">
                        Categories Updated: {syncResult.categories_updated}
                      </Text>
                    </Group>
                  )}
                  {syncResult.message && (
                    <Text size="sm">{syncResult.message}</Text>
                  )}
                </Alert>
              )}

              <Group mt="md">
                <Button
                  variant="default"
                  leftSection={<IconRefresh size={16} />}
                  onClick={handleReloadTestLibrary}
                  loading={testLibrarySyncing}
                >
                  Reload Library
                </Button>
                <Button
                  variant="light"
                  onClick={() => handleSyncTestLibrary(false)}
                  loading={testLibrarySyncing}
                >
                  Sync Unmatched
                </Button>
                <Button
                  variant="light"
                  color="yellow"
                  onClick={() => handleSyncTestLibrary(true)}
                  loading={testLibrarySyncing}
                >
                  Force Sync All
                </Button>
              </Group>

              <Alert
                variant="light"
                color="gray"
                mt="md"
                icon={<IconInfoCircle size={16} />}
              >
                <Text size="sm" mb={4}>
                  <Text span fw={600}>Reload Library:</Text> Refreshes the test
                  library from disk (use after updating test_library.json)
                </Text>
                <Text size="sm" mb={4}>
                  <Text span fw={600}>Sync Unmatched:</Text> Updates components
                  that don&apos;t have a canonical name yet
                </Text>
                <Text size="sm">
                  <Text span fw={600}>Force Sync All:</Text> Re-matches all
                  components (categories and canonical names)
                </Text>
              </Alert>
            </>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
};

export default ToolsMaintenance;
