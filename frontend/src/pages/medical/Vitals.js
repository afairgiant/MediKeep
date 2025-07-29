/**
 * Vitals Page Component - Enhanced Version with Mantine UI
 * Main page for managing patient vital signs with modern UX
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Button,
  Modal,
  Paper,
  Group,
  Text,
  Title,
  Stack,
  Alert,
  Loader,
  Center,
  ActionIcon,
  Badge,
  Grid,
  Card,
  Flex,
  Box,
  Divider,
  Container,
} from '@mantine/core';
import {
  IconHeart,
  IconActivity,
  IconTrendingUp,
  IconChartBar,
  IconRefresh,
  IconPlus,
  IconAlertTriangle,
  IconCheck,
} from '@tabler/icons-react';
import { PageHeader } from '../../components';
import MantineFilters from '../../components/mantine/MantineFilters';
import VitalsForm from '../../components/medical/VitalsForm';
import VitalsList from '../../components/medical/VitalsList';

import { vitalsService } from '../../services/medical/vitalsService';
import { apiService } from '../../services/api';
import { useCurrentPatient } from '../../hooks/useGlobalData';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';

// Quick stats card configurations with Mantine icons
const STATS_CONFIGS = {
  blood_pressure: {
    title: 'Blood Pressure',
    icon: IconHeart,
    getValue: stats =>
      stats.avg_systolic_bp && stats.avg_diastolic_bp
        ? `${Math.round(stats.avg_systolic_bp)}/${Math.round(stats.avg_diastolic_bp)}`
        : 'N/A',
    getUnit: () => 'mmHg',
    getCategory: () => null,
    color: 'red',
  },
  heart_rate: {
    title: 'Heart Rate',
    icon: IconActivity,
    getValue: stats =>
      stats.avg_heart_rate ? Math.round(stats.avg_heart_rate) : 'N/A',
    getUnit: () => 'BPM',
    getCategory: stats => {
      if (!stats.avg_heart_rate) return null;
      const hr = stats.avg_heart_rate;
      if (hr < 60) return 'Low';
      if (hr > 100) return 'High';
      return 'Normal';
    },
    color: 'blue',
  },
  temperature: {
    title: 'Latest Temperature',
    icon: IconTrendingUp,
    getValue: stats =>
      stats.current_temperature ? stats.current_temperature.toFixed(1) : 'N/A',
    getUnit: () => '°F',
    getCategory: stats => {
      if (!stats.current_temperature) return null;
      const temp = stats.current_temperature;
      if (temp < 97.0) return 'Low';
      if (temp > 99.5) return 'High';
      return 'Normal';
    },
    color: 'green',
  },
  weight: {
    title: 'Latest Weight',
    icon: IconTrendingUp,
    getValue: stats =>
      stats.current_weight ? stats.current_weight.toFixed(1) : 'N/A',
    getUnit: () => 'lbs',
    getCategory: () => null,
    color: 'violet',
  },
  bmi: {
    title: 'BMI',
    icon: IconChartBar,
    getValue: stats =>
      stats.current_bmi ? stats.current_bmi.toFixed(1) : 'N/A',
    getUnit: () => '',
    getCategory: () => null,
    color: 'yellow',
  },
};

const Vitals = () => {
  // Page configuration
  const pageConfig = getMedicalPageConfig('vitals');

  // State management
  const [showForm, setShowForm] = useState(false);
  const [editingVitals, setEditingVitals] = useState(null);
  const [stats, setStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState(null);

  // Medical data management with filtering and sorting
  const {
    items: vitalsData,
    currentPatient,
    loading: vitalsLoading,
    error: vitalsError,
    successMessage,
    createItem,
    updateItem,
    deleteItem,
    refreshData,
    clearError,
  } = useMedicalData({
    entityName: 'vitals',
    apiMethodsConfig: {
      getAll: signal => apiService.getEntities('vitals', signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientEntities('vitals', patientId, signal),
      create: (data, signal) => apiService.createEntity('vitals', data, signal),
      update: (id, data, signal) =>
        apiService.updateEntity('vitals', id, data, signal),
      delete: (id, signal) => apiService.deleteEntity('vitals', id, signal),
    },
    requiresPatient: true,
  });

  // Data management with filtering and sorting
  const dataManagement = useDataManagement(vitalsData || [], pageConfig);
  const {
    filteredData: filteredVitals = [],
    filters,
    updateFilter,
    clearFilters,
    hasActiveFilters,
    sortBy,
    sortOrder,
    handleSortChange,
    totalCount,
    filteredCount,
  } = dataManagement || {};

  // Load stats with enhanced error handling
  const loadStats = useCallback(async () => {
    if (!currentPatient?.id) return;

    try {
      setIsLoadingStats(true);
      setStatsError(null);

      const statsResponse = await apiService.get(`/vitals/stats?patient_id=${currentPatient.id}`);
      const statsData = statsResponse?.data || statsResponse;
      setStats(statsData);
    } catch (error) {
      console.error('Error loading vitals stats:', error);
      setStatsError('Failed to load vitals statistics');
      setStats(null);
    } finally {
      setIsLoadingStats(false);
    }
  }, [currentPatient?.id]);

  // Load stats when patient changes or vitals data changes
  useEffect(() => {
    if (currentPatient?.id) {
      loadStats();
    }
  }, [loadStats, currentPatient?.id, vitalsData?.length]);

  // Generate filter options from vitalsData
  const statusOptions = useMemo(() => {
    return pageConfig.filtering?.statusOptions || [];
  }, [pageConfig.filtering?.statusOptions]);

  const categoryOptions = useMemo(() => {
    return pageConfig.filtering?.categoryOptions || [];
  }, [pageConfig.filtering?.categoryOptions]);

  const dateRangeOptions = useMemo(() => {
    return pageConfig.filtering.dateRangeOptions;
  }, [pageConfig.filtering.dateRangeOptions]);

  const sortOptions = useMemo(() => {
    return pageConfig.sorting.sortOptions;
  }, [pageConfig.sorting.sortOptions]);

  // Form handlers
  const handleAddNew = useCallback(() => {
    setEditingVitals(null);
    setShowForm(true);
  }, []);

  const handleEdit = useCallback(vitals => {
    setEditingVitals(vitals);
    setShowForm(true);
  }, []);

  const handleFormSave = useCallback(
    async formData => {
      try {
        let success;
        if (editingVitals) {
          success = await updateItem(editingVitals.id, formData);
        } else {
          success = await createItem(formData);
        }

        if (success) {
          setShowForm(false);
          setEditingVitals(null);
          // Refresh the vitals data list and stats
          await refreshData();
          await loadStats();
        }
      } catch (error) {
        console.error('Error saving vitals:', error);
        throw error; // Let the form handle the error display
      }
    },
    [editingVitals, updateItem, createItem, refreshData, loadStats]
  );

  const handleFormCancel = useCallback(() => {
    setShowForm(false);
    setEditingVitals(null);
    clearError();
  }, [clearError]);

  const handleDelete = useCallback(
    async vitalsId => {
      const success = await deleteItem(vitalsId);
      if (success) {
        // Refresh the vitals data list and stats
        await refreshData();
        await loadStats();
      }
    },
    [deleteItem, refreshData, loadStats]
  );

  // Render stats card with Mantine components
  const renderStatsCard = (key, config) => {
    const IconComponent = config.icon;
    const value = config.getValue(stats);
    const unit = config.getUnit(stats);
    const category = config.getCategory(stats);

    return (
      <Card key={key} shadow="sm" padding="lg" radius="md" withBorder>
        <Flex align="center" gap="md">
          <ActionIcon
            size="xl"
            variant="light"
            color={config.color}
            radius="md"
          >
            <IconComponent size={24} />
          </ActionIcon>
          <Box flex={1}>
            <Text size="sm" c="dimmed" fw={500}>
              {config.title}
            </Text>
            <Group gap="xs" align="baseline">
              <Text size="xl" fw={700}>
                {value}
              </Text>
              {unit && (
                <Text size="sm" c="dimmed">
                  {unit}
                </Text>
              )}
            </Group>
            {category && (
              <Badge
                size="sm"
                variant="light"
                color={
                  category === 'High'
                    ? 'red'
                    : category === 'Low'
                      ? 'orange'
                      : 'green'
                }
                mt={4}
              >
                {category}
              </Badge>
            )}
          </Box>
        </Flex>
      </Card>
    );
  };

  // Loading state
  if (vitalsLoading) {
    return (
      <Center h="50vh">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Loading vital signs...</Text>
        </Stack>
      </Center>
    );
  }

  // No patient selected
  if (!currentPatient) {
    return (
      <Center h="50vh">
        <Stack align="center" gap="lg">
          <IconHeart size={64} stroke={1} color="var(--mantine-color-gray-5)" />
          <Stack align="center" gap="xs">
            <Title order={3}>No Patient Selected</Title>
            <Text c="dimmed" ta="center">
              Please select a patient to view and manage vital signs.
            </Text>
          </Stack>
        </Stack>
      </Center>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <PageHeader title="Vital Signs" icon="🩺" />

      <Container size="xl" py="lg">
        {vitalsError && (
          <Alert
            variant="light"
            color="red"
            title="Error"
            icon={<IconAlertTriangle size={16} />}
            withCloseButton
            onClose={clearError}
            mb="md"
          >
            {vitalsError}
          </Alert>
        )}
        {successMessage && (
          <Alert
            variant="light"
            color="green"
            title="Success"
            icon={<IconCheck size={16} />}
            mb="md"
          >
            {successMessage}
          </Alert>
        )}

        <Group justify="space-between" mb="lg">
          <Button
            variant="filled"
            leftSection={<IconPlus size={16} />}
            onClick={handleAddNew}
            size="md"
          >
            Add New Vital Signs
          </Button>
        </Group>

        {/* Stats Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Paper shadow="sm" p="lg" radius="md" mb="lg">
            <Group justify="space-between" mb="md">
              <Box>
                <Title order={3}>Health Summary</Title>
                <Text c="dimmed" size="sm">
                  Latest readings and averages
                </Text>
              </Box>
              <Button
                variant="filled"
                leftSection={<IconRefresh size={16} />}
                onClick={loadStats}
                loading={isLoadingStats}
                size="sm"
              >
                Refresh
              </Button>
            </Group>

            {isLoadingStats ? (
              <Center py="xl">
                <Stack align="center" gap="md">
                  <Loader size="md" />
                  <Text size="sm" c="dimmed">
                    Loading statistics...
                  </Text>
                </Stack>
              </Center>
            ) : statsError ? (
              <Alert
                variant="light"
                color="red"
                icon={<IconAlertTriangle size={16} />}
                title="Failed to load statistics"
              >
                <Group justify="space-between" align="center">
                  <Text size="sm">{statsError}</Text>
                  <Button variant="filled" size="xs" onClick={loadStats}>
                    Try Again
                  </Button>
                </Group>
              </Alert>
            ) : stats ? (
              <Grid>
                {Object.entries(STATS_CONFIGS).map(([key, config]) => (
                  <Grid.Col
                    key={key}
                    span={{ base: 12, xs: 6, sm: 4, md: 2.4 }}
                  >
                    {renderStatsCard(key, config)}
                  </Grid.Col>
                ))}
              </Grid>
            ) : (
              <Center py="xl">
                <Stack align="center" gap="md">
                  <IconChartBar
                    size={48}
                    stroke={1}
                    color="var(--mantine-color-gray-5)"
                  />
                  <Stack align="center" gap="xs">
                    <Title order={4}>No Data Available</Title>
                    <Text c="dimmed" ta="center">
                      Record some vitals to see statistics here
                    </Text>
                  </Stack>
                </Stack>
              </Center>
            )}
          </Paper>
        </motion.div>

        {/* Mantine Filters */}
        {dataManagement && filters && (
          <MantineFilters
            filters={filters}
            updateFilter={updateFilter}
            clearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
            statusOptions={statusOptions}
            categoryOptions={categoryOptions}
            dateRangeOptions={dateRangeOptions}
            sortOptions={sortOptions}
            sortBy={sortBy}
            sortOrder={sortOrder}
            handleSortChange={handleSortChange}
            totalCount={totalCount}
            filteredCount={filteredCount}
            config={pageConfig.filterControls}
          />
        )}

        {/* Form Modal */}
        <Modal
          opened={showForm}
          onClose={handleFormCancel}
          title={editingVitals ? 'Edit Vital Signs' : 'Add New Vital Signs'}
          size="lg"
          centered
        >
          <VitalsForm
            vitals={editingVitals}
            patientId={currentPatient?.id}
            practitionerId={null}
            onSave={handleFormSave}
            onCancel={handleFormCancel}
            isEdit={!!editingVitals}
            createItem={createItem}
            updateItem={updateItem}
            error={vitalsError}
            clearError={clearError}
          />
        </Modal>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <VitalsList
            patientId={currentPatient?.id}
            onEdit={handleEdit}
            onDelete={handleDelete}
            vitalsData={filteredVitals}
            loading={vitalsLoading}
            error={vitalsError}
            showActions={true}
          />
        </motion.div>
      </Container>
    </motion.div>
  );
};

export default Vitals;
