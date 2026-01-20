/**
 * Vitals Page Component - Enhanced Version with Mantine UI
 * Main page for managing patient vital signs with modern UX
 */
import logger from '../../services/logger';


import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Button,
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
  IconDroplet,
  IconChartLine,
} from '@tabler/icons-react';
import { PageHeader } from '../../components';
import MantineFilters from '../../components/mantine/MantineFilters';
import VitalsList from '../../components/medical/VitalsList';

// Modular components
import VitalViewModal from '../../components/medical/vital/VitalViewModal';
import VitalFormWrapper from '../../components/medical/vital/VitalFormWrapper';
import { VitalTrendsPanel } from '../../components/medical/vitals';

import { apiService } from '../../services/api';
import { useCurrentPatient, usePractitioners } from '../../hooks/useGlobalData';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { useNavigate, useLocation } from 'react-router-dom';
import { VITAL_FILTER_TYPES } from '../../constants/vitalFilters';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import { convertForDisplay, unitLabels } from '../../utils/unitConversion';

const Vitals = () => {
  const { t } = useTranslation('common');
  const { unitSystem } = useUserPreferences();

  // Quick stats card configurations with Mantine icons and filter mappings
  const STATS_CONFIGS = useMemo(() => ({
    blood_pressure: {
      title: t('vitals.stats.bloodPressure', 'Blood Pressure'),
      icon: IconHeart,
      getValue: stats =>
        stats.avg_systolic_bp && stats.avg_diastolic_bp
          ? `${Math.round(stats.avg_systolic_bp)}/${Math.round(stats.avg_diastolic_bp)}`
          : t('labels.notAvailable', 'N/A'),
      getUnit: () => t('vitals.units.mmHg', 'mmHg'),
      getCategory: () => null,
      color: 'red',
      filterType: VITAL_FILTER_TYPES.WITH_BLOOD_PRESSURE,
      vitalType: 'blood_pressure',
      description: t('vitals.stats.bloodPressureDesc', 'Click to view trend analysis')
    },
    heart_rate: {
      title: t('vitals.stats.heartRate', 'Heart Rate'),
      icon: IconActivity,
      getValue: stats =>
        stats.avg_heart_rate ? Math.round(stats.avg_heart_rate) : t('labels.notAvailable', 'N/A'),
      getUnit: () => t('vitals.units.bpm', 'BPM'),
      getCategory: stats => {
        if (!stats.avg_heart_rate) return null;
        const hr = stats.avg_heart_rate;
        if (hr < 60) return t('vitals.categories.low', 'Low');
        if (hr > 100) return t('vitals.categories.high', 'High');
        return t('vitals.categories.normal', 'Normal');
      },
      color: 'blue',
      filterType: VITAL_FILTER_TYPES.WITH_HEART_RATE,
      vitalType: 'heart_rate',
      description: t('vitals.stats.heartRateDesc', 'Click to view trend analysis')
    },
    temperature: {
      title: t('vitals.stats.temperature', 'Latest Temperature'),
      icon: IconTrendingUp,
      getValue: stats =>
        stats.current_temperature
          ? convertForDisplay(stats.current_temperature, 'temperature', unitSystem).toFixed(1)
          : t('labels.notAvailable', 'N/A'),
      getUnit: () => unitLabels[unitSystem].temperature,
      getCategory: stats => {
        if (!stats.current_temperature) return null;
        const temp = stats.current_temperature;
        if (temp < 97.0) return t('vitals.categories.low', 'Low');
        if (temp > 99.5) return t('vitals.categories.high', 'High');
        return t('vitals.categories.normal', 'Normal');
      },
      color: 'green',
      filterType: VITAL_FILTER_TYPES.WITH_TEMPERATURE,
      vitalType: 'temperature',
      description: t('vitals.stats.temperatureDesc', 'Click to view trend analysis')
    },
    weight: {
      title: t('vitals.stats.weight', 'Latest Weight'),
      icon: IconTrendingUp,
      getValue: stats =>
        stats.current_weight
          ? convertForDisplay(stats.current_weight, 'weight', unitSystem).toFixed(1)
          : t('labels.notAvailable', 'N/A'),
      getUnit: () => unitLabels[unitSystem].weight,
      getCategory: () => null,
      color: 'violet',
      filterType: VITAL_FILTER_TYPES.WITH_WEIGHT,
      vitalType: 'weight',
      description: t('vitals.stats.weightDesc', 'Click to view trend analysis')
    },
    bmi: {
      title: t('vitals.stats.bmi', 'BMI'),
      icon: IconChartBar,
      getValue: stats =>
        stats.current_bmi ? stats.current_bmi.toFixed(1) : t('labels.notAvailable', 'N/A'),
      getUnit: () => '',
      getCategory: () => null,
      color: 'yellow',
      filterType: VITAL_FILTER_TYPES.WITH_WEIGHT,
      vitalType: 'bmi',
      description: t('vitals.stats.bmiDesc', 'Click to view trend analysis')
    },
    blood_glucose: {
      title: t('vitals.modal.bloodGlucose', 'Blood Glucose'),
      icon: IconDroplet,
      getValue: stats =>
        stats.current_blood_glucose ? stats.current_blood_glucose.toFixed(0) : t('labels.notAvailable', 'N/A'),
      getUnit: () => t('vitals.units.mgdl', 'mg/dL'),
      getCategory: stats => {
        if (!stats.current_blood_glucose) return null;
        const glucose = stats.current_blood_glucose;
        if (glucose < 70) return t('vitals.categories.low', 'Low');
        if (glucose > 180) return t('vitals.categories.high', 'High');
        return t('vitals.categories.normal', 'Normal');
      },
      color: 'orange',
      filterType: VITAL_FILTER_TYPES.WITH_BLOOD_GLUCOSE,
      vitalType: 'blood_glucose',
      description: t('vitals.stats.bloodGlucoseDesc', 'Click to view trend analysis')
    },
    a1c: {
      title: t('vitals.modal.a1c', 'A1C'),
      icon: IconChartBar,
      getValue: stats =>
        stats.current_a1c ? stats.current_a1c.toFixed(1) : t('labels.notAvailable', 'N/A'),
      getUnit: () => '%',
      getCategory: () => null,
      color: 'pink',
      filterType: VITAL_FILTER_TYPES.WITH_A1C,
      vitalType: 'a1c',
      description: t('vitals.stats.a1cDesc', 'Click to view trend analysis')
    },
  }), [t, unitSystem]);
  const navigate = useNavigate();
  const location = useLocation();

  // Page configuration
  const pageConfig = getMedicalPageConfig('vitals');

  // State management
  const [showForm, setShowForm] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingVitals, setEditingVitals] = useState(null);
  const [viewingVital, setViewingVital] = useState(null);
  const [stats, setStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState(null);
  const [showTrendsPanel, setShowTrendsPanel] = useState(false);
  const [selectedVitalType, setSelectedVitalType] = useState(null);

  // Global data
  const { practitioners } = usePractitioners();

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
      logger.error('Error loading vitals stats:', error);
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

  // Handle URL parameters for direct linking to specific vitals
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const viewId = searchParams.get('view');

    if (viewId && filteredVitals && filteredVitals.length > 0 && !vitalsLoading) {
      const vital = filteredVitals.find(v => String(v.id) === String(viewId));
      if (vital && !showViewModal) {
        setViewingVital(vital);
        setShowViewModal(true);
      }
    }
  }, [location.search, filteredVitals, vitalsLoading, showViewModal]);

  // Handle stats card clicks to open trends panel
  const handleStatsCardClick = useCallback((vitalType) => {
    setSelectedVitalType(vitalType);
    setShowTrendsPanel(true);
  }, []);

  // Handle closing trends panel
  const handleCloseTrendsPanel = useCallback(() => {
    setShowTrendsPanel(false);
    setSelectedVitalType(null);
  }, []);

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

  const handleViewVital = useCallback(vital => {
    setViewingVital(vital);
    setShowViewModal(true);
    // Update URL with vital ID for sharing/bookmarking
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', vital.id);
    navigate(`${location.pathname}?${searchParams.toString()}`, {
      replace: true,
    });
  }, [location.search, navigate]);

  const handleCloseViewModal = useCallback(() => {
    setShowViewModal(false);
    setViewingVital(null);
    // Remove view parameter from URL
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete('view');
    const newSearch = searchParams.toString();
    navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, {
      replace: true,
    });
  }, [navigate, location.pathname]);

  const handleEdit = useCallback(vitals => {
    setEditingVitals(vitals);
    setShowForm(true);
    if (showViewModal) {
      setShowViewModal(false);
    }
  }, [showViewModal]);

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
        logger.error('Error saving vitals:', error);
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
    const isSelected = selectedVitalType === config.vitalType && showTrendsPanel;

    return (
      <Card
        key={key}
        shadow="sm"
        padding="lg"
        radius="md"
        withBorder
        tabIndex={0}
        role="button"
        aria-label={`${config.title}. ${config.description}`}
        aria-pressed={isSelected}
        style={{
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          border: isSelected ? `2px solid var(--mantine-color-${config.color}-6)` : undefined,
          backgroundColor: isSelected ? `var(--mantine-color-${config.color}-0)` : undefined,
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--mantine-shadow-md)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'var(--mantine-shadow-sm)';
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleStatsCardClick(config.vitalType);
          }
        }}
        onClick={() => handleStatsCardClick(config.vitalType)}
        title={config.description}
      >
        <Flex align="center" gap="md">
          <ActionIcon
            size="xl"
            variant={isSelected ? "filled" : "light"}
            color={config.color}
            radius="md"
          >
            <IconComponent size={24} />
          </ActionIcon>
          <Box flex={1}>
            <Group justify="space-between" align="flex-start">
              <Text size="sm" c="dimmed" fw={500}>
                {config.title}
              </Text>
              <IconChartLine size={14} color="var(--mantine-color-gray-5)" />
            </Group>
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
          <Text>{t('vitals.loading', 'Loading vital signs...')}</Text>
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
            <Title order={3}>{t('vitals.noPatientSelected', 'No Patient Selected')}</Title>
            <Text c="dimmed" ta="center">
              {t('vitals.selectPatientPrompt', 'Please select a patient to view and manage vital signs.')}
            </Text>
          </Stack>
        </Stack>
      </Center>
    );
  }

  return (
    <Container size="xl" py="md">
      <PageHeader title={t('vitals.title', 'Vital Signs')} icon="❤️" />

      <Stack gap="lg">
        {vitalsError && (
          <Alert
            variant="light"
            color="red"
            title={t('labels.error', 'Error')}
            icon={<IconAlertTriangle size={16} />}
            withCloseButton
            onClose={clearError}
            mb="md"
            style={{ whiteSpace: 'pre-line' }}
          >
            {vitalsError}
          </Alert>
        )}
        {successMessage && (
          <Alert
            variant="light"
            color="green"
            title={t('labels.success', 'Success')}
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
            {t('vitals.addNew', 'Add New Vital Signs')}
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
                <Title order={3}>{t('vitals.healthSummary', 'Health Summary')}</Title>
                <Text c="dimmed" size="sm">
                  {t('vitals.summaryDescription', 'Latest readings and averages - Click any card to view trend analysis')}
                </Text>
              </Box>
              <Button
                variant="filled"
                leftSection={<IconRefresh size={16} />}
                onClick={loadStats}
                loading={isLoadingStats}
                size="sm"
              >
                {t('buttons.refresh', 'Refresh')}
              </Button>
            </Group>

            {isLoadingStats ? (
              <Center py="xl">
                <Stack align="center" gap="md">
                  <Loader size="md" />
                  <Text size="sm" c="dimmed">
                    {t('vitals.loadingStats', 'Loading statistics...')}
                  </Text>
                </Stack>
              </Center>
            ) : statsError ? (
              <Alert
                variant="light"
                color="red"
                icon={<IconAlertTriangle size={16} />}
                title={t('vitals.statsLoadError', 'Failed to load statistics')}
                style={{ whiteSpace: 'pre-line' }}
              >
                <Group justify="space-between" align="center">
                  <Text size="sm">{statsError}</Text>
                  <Button variant="filled" size="xs" onClick={loadStats}>
                    {t('buttons.tryAgain', 'Try Again')}
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
                    <Title order={4}>{t('vitals.noDataAvailable', 'No Data Available')}</Title>
                    <Text c="dimmed" ta="center">
                      {t('vitals.recordVitalsPrompt', 'Record some vitals to see statistics here')}
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

        <VitalFormWrapper
          isOpen={showForm}
          onClose={handleFormCancel}
          title={editingVitals ? t('vitals.editTitle', 'Edit Vital Signs') : t('vitals.addTitle', 'Add New Vital Signs')}
          editingVital={editingVitals}
          patientId={currentPatient?.id}
          practitionerId={null}
          onSave={handleFormSave}
          error={vitalsError}
          clearError={clearError}
          isLoading={false}
          createItem={createItem}
          updateItem={updateItem}
        />

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
            onView={handleViewVital}
            vitalsData={filteredVitals}
            loading={vitalsLoading}
            error={vitalsError}
            showActions={true}
          />
        </motion.div>

        <VitalViewModal
          isOpen={showViewModal}
          onClose={handleCloseViewModal}
          vital={viewingVital}
          onEdit={handleEdit}
          practitioners={practitioners}
          navigate={navigate}
        />

        {/* Vital Trends Panel */}
        <VitalTrendsPanel
          opened={showTrendsPanel}
          onClose={handleCloseTrendsPanel}
          vitalType={selectedVitalType}
          patientId={currentPatient?.id}
          patientHeight={currentPatient?.height}
        />
      </Stack>
    </Container>
  );
};

export default Vitals;
