/**
 * TestComponentsTab main container component
 * Brings together all test component functionality in a tabbed interface
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Stack,
  Group,
  Text,
  Button,
  Tabs,
  Alert,
  Paper,
  Badge,
  ActionIcon,
  Modal,
  Title,
  Center,
  Box,
  LoadingOverlay,
  Menu,
  Tooltip
} from '@mantine/core';
import {
  IconFlask,
  IconPlus,
  IconUpload,
  IconTemplate,
  IconChartBar,
  IconRefresh,
  IconSettings,
  IconAlertCircle,
  IconEye,
  IconEdit,
  IconChevronDown
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import TestComponentDisplay from './TestComponentDisplay';
import TestComponentTemplates from './TestComponentTemplates';
import TestComponentBulkEntry from './TestComponentBulkEntry';
import TestComponentStats from './TestComponentStats';
import TestComponentEditModal from './TestComponentEditModal';
import TestComponentTrendsPanel from './TestComponentTrendsPanel';
import {
  LabTestComponent,
  labTestComponentApi,
  LabTestComponentFilters
} from '../../../services/api/labTestComponentApi';
import { useCurrentPatient } from '../../../hooks/useGlobalData';
import logger from '../../../services/logger';

interface TestComponentsTabProps {
  labResultId: number;
  isViewMode?: boolean;
  onError?: (error: Error) => void;
}

const TestComponentsTab: React.FC<TestComponentsTabProps> = ({
  labResultId,
  isViewMode = false,
  onError
}) => {
  const [activeTab, setActiveTab] = useState<string>('display');
  const [components, setComponents] = useState<LabTestComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<LabTestComponentFilters>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalTab, setAddModalTab] = useState<string>('templates');

  const { patient: currentPatient } = useCurrentPatient() as any;
  const loadingRef = useRef(false);

  const handleError = useCallback((error: Error, context: string) => {
    logger.error('test_components_tab_error', {
      message: `Error in TestComponentsTab: ${context}`,
      labResultId,
      error: error.message,
      component: 'TestComponentsTab',
    });

    const errorMessage = error.message || 'An unexpected error occurred';
    setError(errorMessage);

    if (onError) {
      onError(error);
    }

    notifications.show({
      title: 'Error',
      message: errorMessage,
      color: 'red'
    });
  }, [labResultId, onError]);

  const loadComponents = useCallback(async (showLoading = true) => {
    // Skip if already loading to prevent duplicate fetches
    if (loadingRef.current) return;

    loadingRef.current = true;

    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError(null);

    try {
      const response = await labTestComponentApi.getByLabResult(
        labResultId,
        filters,
        currentPatient?.id
      );

      setComponents(response.data || []);
    } catch (error) {
      handleError(error as Error, 'load_components');
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadingRef.current = false;
    }
  }, [labResultId, filters, currentPatient?.id, handleError]);

  const handleComponentsAdded = useCallback((newComponents: LabTestComponent[]) => {
    setComponents(prev => [...prev, ...newComponents]);

    // Close the add modal and switch to display tab to show the new components
    setShowAddModal(false);
    setActiveTab('display');

    logger.info('test_components_added', {
      message: 'Test components added successfully',
      labResultId,
      count: newComponents.length,
      component: 'TestComponentsTab',
    });
  }, [labResultId]);

  const [editingComponent, setEditingComponent] = useState<LabTestComponent | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [trendPanelOpen, setTrendPanelOpen] = useState(false);
  const [selectedTestName, setSelectedTestName] = useState<string | null>(null);

  const handleComponentEdit = useCallback((component: LabTestComponent) => {
    logger.info('test_component_edit_requested', {
      message: 'Test component edit requested',
      componentId: component.id,
      testName: component.test_name,
      component: 'TestComponentsTab',
    });

    setEditingComponent(component);
    setIsEditModalOpen(true);
  }, []);

  const handleEditSubmit = useCallback(async (updatedData: Partial<LabTestComponent>) => {
    if (!editingComponent?.id) return;

    try {
      const updated = await labTestComponentApi.update(
        editingComponent.id,
        updatedData,
        currentPatient?.id
      );

      setComponents(prev => prev.map(c => c.id === updated.id ? updated : c));

      notifications.show({
        title: 'Component Updated',
        message: `${updated.test_name} has been updated successfully`,
        color: 'green',
        autoClose: 3000
      });

      setIsEditModalOpen(false);
      setEditingComponent(null);

      logger.info('test_component_updated', {
        message: 'Test component updated successfully',
        componentId: updated.id,
        testName: updated.test_name,
        component: 'TestComponentsTab',
      });
    } catch (error) {
      handleError(error as Error, 'update_component');
      notifications.show({
        title: 'Update Failed',
        message: 'Failed to update test component. Please try again.',
        color: 'red',
        autoClose: 5000
      });
    }
  }, [editingComponent, currentPatient?.id, handleError]);

  const handleComponentDelete = useCallback(async (component: LabTestComponent) => {
    try {
      await labTestComponentApi.delete(component.id!, currentPatient?.id);

      setComponents(prev => prev.filter(c => c.id !== component.id));

      notifications.show({
        title: 'Component Deleted',
        message: `${component.test_name} has been deleted`,
        color: 'green'
      });

      logger.info('test_component_deleted', {
        message: 'Test component deleted successfully',
        componentId: component.id,
        testName: component.test_name,
        component: 'TestComponentsTab',
      });
    } catch (error) {
      handleError(error as Error, 'delete_component');
    }
  }, [currentPatient?.id, handleError]);

  const handleRefresh = useCallback(() => {
    loadComponents(false);
  }, [loadComponents]);

  const handleTrendClick = useCallback((testName: string) => {
    logger.info('test_component_trend_requested', {
      message: 'Test component trend view requested',
      testName,
      component: 'TestComponentsTab',
    });

    setSelectedTestName(testName);
    setTrendPanelOpen(true);
  }, []);

  // Load components on mount and when labResultId changes
  useEffect(() => {
    loadComponents();
  }, [loadComponents]);

  // Note: Removed auto-refresh on tab switch to prevent unnecessary API calls
  // Users can manually refresh using the refresh button if needed

  const getTabIcon = (tabValue: string) => {
    switch (tabValue) {
      case 'display': return <IconEye size={16} />;
      case 'templates': return <IconTemplate size={16} />;
      case 'bulk': return <IconUpload size={16} />;
      case 'stats': return <IconChartBar size={16} />;
      default: return null;
    }
  };

  const getTabBadge = (tabValue: string) => {
    switch (tabValue) {
      case 'display':
        return components.length > 0 ? (
          <Badge size="sm" color="blue" style={{ marginLeft: 8 }}>
            {components.length}
          </Badge>
        ) : null;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Paper withBorder p="md" radius="md" style={{ position: 'relative', minHeight: 200 }}>
        <LoadingOverlay visible={loading} overlayProps={{ radius: 'sm', blur: 2 }} />
        <Center h={200}>
          <Stack align="center" gap="md">
            <IconFlask size={48} color="var(--mantine-color-gray-5)" />
            <Text size="lg" c="dimmed">Loading test components...</Text>
          </Stack>
        </Center>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      {/* Header with stats and actions */}
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconFlask size={20} />
          <Title order={4}>Test Components</Title>
          {components.length > 0 && (
            <Badge variant="light" color="blue">
              {components.length} test{components.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </Group>

        <Group gap="xs">
          {!isViewMode && (
            <Button
              leftSection={<IconPlus size={16} />}
              variant="filled"
              onClick={() => setShowAddModal(true)}
            >
              Add Tests
            </Button>
          )}
          <ActionIcon
            variant="subtle"
            onClick={handleRefresh}
            loading={refreshing}
            title="Refresh components"
          >
            <IconRefresh size={16} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Error Alert */}
      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Error loading test components"
          color="red"
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* Main Tabs Interface */}
      <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'display')}>
        <Tabs.List>
          <Tabs.Tab
            value="display"
            leftSection={getTabIcon('display')}
            rightSection={getTabBadge('display')}
          >
            Test Results
          </Tabs.Tab>

          <Tabs.Tab
            value="stats"
            leftSection={getTabIcon('stats')}
          >
            Statistics
          </Tabs.Tab>
        </Tabs.List>

        {/* Display Tab */}
        <Tabs.Panel value="display">
          <Box mt="md">
            <TestComponentDisplay
              components={components}
              loading={false}
              error={error}
              groupByCategory={true}
              showActions={!isViewMode}
              onEdit={handleComponentEdit}
              onDelete={handleComponentDelete}
              onTrendClick={handleTrendClick}
              onError={(error: Error) => handleError(error, 'component')}
            />
          </Box>
        </Tabs.Panel>

        {/* Statistics Tab */}
        <Tabs.Panel value="stats">
          <Box mt="md">
            <TestComponentStats
              components={components}
              loading={refreshing}
              onError={(error: Error) => handleError(error, 'component')}
            />
          </Box>
        </Tabs.Panel>
      </Tabs>

      {/* Quick Actions for Empty State */}
      {!isViewMode && components.length === 0 && !loading && !error && (
        <Paper withBorder p="xl" radius="md" bg="gray.0">
          <Stack align="center" gap="lg">
            <IconFlask size={48} color="var(--mantine-color-gray-5)" />
            <Stack align="center" gap="md">
              <Title order={3} c="dimmed">No test components yet</Title>
              <Text size="sm" c="dimmed" ta="center" maw={400}>
                Add individual test results using templates or bulk import from lab reports.
                Test components provide detailed breakdowns of lab results.
              </Text>
            </Stack>

            <Group gap="md">
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => {
                  setAddModalTab('templates');
                  setShowAddModal(true);
                }}
                variant="filled"
              >
                Add Test Components
              </Button>
            </Group>

            <Text size="xs" c="dimmed" ta="center" maw={500}>
              Templates provide common lab panels (CBC, CMP, etc.) where you can enter values and ranges.
              Bulk import allows you to copy/paste results from lab reports for automatic parsing.
            </Text>
          </Stack>
        </Paper>
      )}

      {/* View Mode Info */}
      {isViewMode && components.length === 0 && !loading && (
        <Paper withBorder p="xl" radius="md" bg="gray.0">
          <Stack align="center" gap="md">
            <IconFlask size={48} color="var(--mantine-color-gray-5)" />
            <Title order={3} c="dimmed">No test components</Title>
            <Text size="sm" c="dimmed" ta="center">
              This lab result doesn't have any individual test components added yet.
            </Text>
          </Stack>
        </Paper>
      )}

      {/* Edit Modal */}
      <TestComponentEditModal
        component={editingComponent}
        opened={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingComponent(null);
        }}
        onSubmit={handleEditSubmit}
      />

      {/* Add Tests Modal */}
      <Modal
        opened={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={
          <Group gap="xs">
            <IconPlus size={20} />
            <Text fw={600}>Add Test Components</Text>
          </Group>
        }
        size="calc(100vw - 40px)"
        centered
        zIndex={3001}
      >
        <Tabs value={addModalTab} onChange={(value) => setAddModalTab(value || 'templates')}>
          <Tabs.List>
            <Tabs.Tab value="templates" leftSection={<IconTemplate size={16} />}>
              Templates
            </Tabs.Tab>
            <Tooltip label="Bulk import is currently locked for further development">
              <Tabs.Tab
                value="bulk"
                leftSection={<IconUpload size={16} />}
                disabled
                style={{ cursor: 'not-allowed', opacity: 0.5 }}
              >
                Bulk Import (Locked)
              </Tabs.Tab>
            </Tooltip>
          </Tabs.List>

          <Tabs.Panel value="templates" pt="md">
            <TestComponentTemplates
              labResultId={labResultId}
              onComponentsAdded={handleComponentsAdded}
              onError={(error: Error) => handleError(error, 'templates')}
            />
          </Tabs.Panel>

          <Tabs.Panel value="bulk" pt="md">
            <TestComponentBulkEntry
              labResultId={labResultId}
              onComponentsAdded={handleComponentsAdded}
              onError={(error: Error) => handleError(error, 'bulk')}
            />
          </Tabs.Panel>
        </Tabs>
      </Modal>

      {/* Trend Analysis Panel */}
      {currentPatient?.id && (
        <TestComponentTrendsPanel
          opened={trendPanelOpen}
          onClose={() => {
            setTrendPanelOpen(false);
            setSelectedTestName(null);
          }}
          testName={selectedTestName}
          patientId={currentPatient.id}
        />
      )}
    </Stack>
  );
};

export default TestComponentsTab;