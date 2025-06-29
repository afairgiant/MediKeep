/**
 * Vitals Page Component - Enhanced Version
 * Main page for managing patient vital signs with modern UX
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Activity,
  TrendingUp,
  BarChart3,
  Heart,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Maximize2,
  Filter,
  Download,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '../../components';
import MantineFilters from '../../components/mantine/MantineFilters';
import VitalsForm from '../../components/medical/VitalsForm';
import VitalsList from '../../components/medical/VitalsList';
import VitalsChart from '../../components/medical/VitalsChart';
import { vitalsService } from '../../services/medical/vitalsService';
import { useCurrentPatient } from '../../hooks/useGlobalData';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import '../../styles/shared/MedicalPageShared.css';
import './Vitals.css';

// Quick stats card configurations
const STATS_CONFIGS = {
  blood_pressure: {
    title: 'Blood Pressure',
    icon: Heart,
    getValue: stats =>
      stats.avg_systolic_bp && stats.avg_diastolic_bp
        ? `${Math.round(stats.avg_systolic_bp)}/${Math.round(stats.avg_diastolic_bp)}`
        : 'N/A',
    getUnit: () => 'mmHg',
    getCategory: () => null,
    color: '#e53e3e',
  },
  heart_rate: {
    title: 'Heart Rate',
    icon: Activity,
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
    color: '#4299e1',
  },
  temperature: {
    title: 'Temperature',
    icon: TrendingUp,
    getValue: stats =>
      stats.avg_temperature ? stats.avg_temperature.toFixed(1) : 'N/A',
    getUnit: () => '°F',
    getCategory: stats => {
      if (!stats.avg_temperature) return null;
      const temp = stats.avg_temperature;
      if (temp < 97.0) return 'Low';
      if (temp > 99.5) return 'High';
      return 'Normal';
    },
    color: '#38a169',
  },
  weight: {
    title: 'Latest Weight',
    icon: TrendingUp,
    getValue: stats =>
      stats.current_weight ? stats.current_weight.toFixed(1) : 'N/A',
    getUnit: () => 'lbs',
    getCategory: () => null,
    color: '#805ad5',
  },
  bmi: {
    title: 'BMI',
    icon: BarChart3,
    getValue: stats =>
      stats.current_bmi ? stats.current_bmi.toFixed(1) : 'N/A',
    getUnit: () => '',
    getCategory: () => null,
    color: '#d69e2e',
  },
};

const Vitals = () => {
  // Page configuration
  const pageConfig = getMedicalPageConfig('vitals');

  // State management
  const [showForm, setShowForm] = useState(false);
  const [editingVitals, setEditingVitals] = useState(null);
  const [refreshList, setRefreshList] = useState(0);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('list');
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState(null);

  // Use global state for patient data
  const { patient: currentPatient, loading: globalDataLoading } =
    useCurrentPatient();

  // Medical data management with filtering and sorting
  const {
    items: vitalsData,
    loading: vitalsLoading,
    error: vitalsError,
    createItem,
    updateItem,
    deleteItem,
    refreshData,
    clearError,
  } = useMedicalData({
    entityName: 'vitals',
    apiMethodsConfig: {
      getAll: signal => vitalsService.getVitals({}, signal),
      getByPatient: (patientId, signal) =>
        vitalsService.getPatientVitals(patientId, {}, signal),
      create: (data, signal) => vitalsService.createVitals(data, signal),
      update: (id, data, signal) =>
        vitalsService.updateVitals(id, data, signal),
      delete: (id, signal) => vitalsService.deleteVitals(id, signal),
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

      const statsResponse = await vitalsService.getPatientVitalsStats(
        currentPatient.id
      );
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
    if (currentPatient && vitalsData) {
      loadStats();
    }
  }, [loadStats, currentPatient, vitalsData]);

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

  const handleFormSave = useCallback(async () => {
    setShowForm(false);
    setEditingVitals(null);
    await refreshData(); // Refresh vitals data
    loadStats(); // Refresh stats after saving
  }, [refreshData, loadStats]);

  const handleFormCancel = useCallback(() => {
    setShowForm(false);
    setEditingVitals(null);
  }, []);

  // Tab handlers
  const handleTabChange = useCallback(tab => {
    setActiveTab(tab);
  }, []);

  // Render stats card
  const renderStatsCard = (key, config) => {
    const value = config.getValue(stats || {});
    const unit = config.getUnit();
    const category = config.getCategory(stats || {});
    const Icon = config.icon;

    const getCategoryColor = cat => {
      if (!cat) return '';
      if (cat.toLowerCase().includes('normal')) return 'normal';
      if (
        cat.toLowerCase().includes('high') ||
        cat.toLowerCase().includes('hypertension') ||
        cat.toLowerCase().includes('crisis')
      )
        return 'high';
      if (
        cat.toLowerCase().includes('low') ||
        cat.toLowerCase().includes('underweight')
      )
        return 'low';
      if (
        cat.toLowerCase().includes('elevated') ||
        cat.toLowerCase().includes('overweight')
      )
        return 'elevated';
      return 'other';
    };

    return (
      <motion.div
        key={key}
        className="stat-card"
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 0.3,
          delay: Object.keys(STATS_CONFIGS).indexOf(key) * 0.05,
        }}
        whileHover={{ y: -2, boxShadow: '0 8px 25px rgba(0,0,0,0.15)' }}
      >
        <div className="stat-icon" style={{ color: config.color }}>
          <Icon size={24} />
        </div>
        <div className="stat-content">
          <div className="stat-label">{config.title}</div>
          <div className="stat-value">
            {value} {unit && <span className="stat-unit">{unit}</span>}
          </div>
          {category && (
            <div className={`stat-category ${getCategoryColor(category)}`}>
              {category === 'Normal' && <CheckCircle size={12} />}
              {category !== 'Normal' && <AlertTriangle size={12} />}
              <span>{category}</span>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  // Loading state
  if (globalDataLoading) {
    return (
      <div className="vitals-page loading">
        <div className="loading-content">
          <Activity className="loading-spinner" size={32} />
          <p>Loading patient information...</p>
        </div>
      </div>
    );
  }

  // No patient selected
  if (!currentPatient) {
    return (
      <div className="vitals-page no-patient">
        <div className="no-patient-content">
          <Heart size={64} className="no-patient-icon" />
          <h2>No Patient Selected</h2>
          <p>Please select a patient to view and manage vital signs.</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="vitals-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <PageHeader title="Vital Signs" icon="🩺" />

      <div className="medical-page-content">
        {vitalsError && (
          <div className="error-message">
            {vitalsError}
            <button onClick={clearError} className="error-close">
              ×
            </button>
          </div>
        )}

        <div className="medical-page-controls">
          <div className="controls-left">
            <button className="add-button" onClick={handleAddNew}>
              + Add New Vital Signs
            </button>
          </div>
        </div>

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

        {/* Stats Overview */}
        <motion.div
          className="stats-overview"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="stats-header">
            <div className="stats-title">
              <h3>Health Summary</h3>
              <p>Latest readings and averages</p>
            </div>
            <div className="stats-actions">
              <motion.button
                onClick={loadStats}
                className="refresh-btn"
                disabled={isLoadingStats}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <RefreshCw
                  size={16}
                  className={isLoadingStats ? 'spinning' : ''}
                />
                Refresh
              </motion.button>
            </div>
          </div>

          {isLoadingStats ? (
            <div className="stats-loading">
              <div className="loading-spinner">
                <Activity size={20} />
              </div>
              <span>Loading statistics...</span>
            </div>
          ) : statsError ? (
            <motion.div
              className="stats-error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <AlertTriangle size={20} />
              <span>{statsError}</span>
              <button onClick={loadStats} className="retry-btn">
                Try Again
              </button>
            </motion.div>
          ) : stats ? (
            <div className="stats-grid">
              {Object.entries(STATS_CONFIGS).map(([key, config]) =>
                renderStatsCard(key, config)
              )}
            </div>
          ) : (
            <motion.div
              className="stats-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <BarChart3 size={32} />
              <h4>No Data Available</h4>
              <p>Record some vitals to see statistics here</p>
            </motion.div>
          )}
        </motion.div>

        {/* Form Modal */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              className="form-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={e => {
                if (e.target === e.currentTarget) {
                  handleFormCancel();
                }
              }}
            >
              <motion.div
                className="form-container"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{
                  duration: 0.3,
                  type: 'spring',
                  damping: 25,
                  stiffness: 300,
                }}
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
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Tabs */}
        <motion.div
          className="content-tabs"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="tab-buttons">
            <motion.button
              className={`tab-button ${activeTab === 'list' ? 'active' : ''}`}
              onClick={() => handleTabChange('list')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <BarChart3 size={18} />
              <span>Records</span>
            </motion.button>
            <motion.button
              className={`tab-button ${activeTab === 'chart' ? 'active' : ''}`}
              onClick={() => handleTabChange('chart')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <TrendingUp size={18} />
              <span>Trends</span>
            </motion.button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              className="tab-content"
              initial={{ opacity: 0, x: activeTab === 'chart' ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: activeTab === 'chart' ? -20 : 20 }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === 'list' && (
                <VitalsList
                  patientId={currentPatient?.id}
                  onEdit={handleEdit}
                  vitalsData={filteredVitals}
                  loading={vitalsLoading}
                  error={vitalsError}
                  showActions={true}
                />
              )}

              {activeTab === 'chart' && (
                <VitalsChart
                  patientId={currentPatient?.id}
                  height={500}
                  showControls={true}
                  defaultMetrics={[
                    'weight',
                    'systolic_bp',
                    'diastolic_bp',
                    'heart_rate',
                  ]}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Vitals;
