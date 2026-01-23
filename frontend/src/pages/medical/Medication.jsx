import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Button,
  Group,
  Stack,
  Text,
  Grid,
  Container,
  Paper,
  Title,
  Badge,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconPlus,
  IconPill,
  IconFilter,
} from '@tabler/icons-react';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { useEntityFileCounts } from '../../hooks/useEntityFileCounts';
import { useViewModalNavigation } from '../../hooks/useViewModalNavigation';
import EmptyState from '../../components/shared/EmptyState';
import MedicalPageAlerts from '../../components/shared/MedicalPageAlerts';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { usePatientWithStaticData } from '../../hooks/useGlobalData';
import { getEntityFormatters } from '../../utils/tableFormatters';
import { navigateToEntity } from '../../utils/linkNavigation';
import { PageHeader } from '../../components';
import { ResponsiveTable } from '../../components/adapters';
import MantineFilters from '../../components/mantine/MantineFilters';
import ViewToggle from '../../components/shared/ViewToggle';
import MedicalPageLoading from '../../components/shared/MedicalPageLoading';
import {
  MedicationCard,
  MedicationViewModal,
  MedicationFormWrapper,
} from '../../components/medical/medications';
import { withResponsive } from '../../hoc/withResponsive';
import { useResponsive } from '../../hooks/useResponsive';
import {
  MEDICATION_TYPES,
  MEDICATION_TYPE_LABELS,
} from '../../constants/medicationTypes';
import logger from '../../services/logger';

const Medication = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const responsive = useResponsive();
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'

  // Form state - moved up to be available for refs logic
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMedication, setEditingMedication] = useState(null);

  // Get practitioners and pharmacies data
  const { practitioners: practitionersObject, pharmacies: pharmaciesObject } =
    usePatientWithStaticData();

  // Memoize practitioners and pharmacies to prevent unnecessary re-renders
  // Only recalculate when the actual data changes (not reference)
  const practitioners = useMemo(() => {
    const data = practitionersObject?.practitioners || [];
    logger.debug('Practitioners data updated', {
      component: 'Medication',
      practitionersCount: data.length,
    });
    return data;
  }, [practitionersObject?.practitioners]);

  const pharmacies = useMemo(() => {
    const data = pharmaciesObject?.pharmacies || [];
    logger.debug('Pharmacies data updated', {
      component: 'Medication',
      pharmaciesCount: data.length,
    });
    return data;
  }, [pharmaciesObject?.pharmacies]);

  // Modern data management with useMedicalData
  const {
    items: medications,
    currentPatient,
    loading,
    error,
    successMessage,
    createItem,
    updateItem,
    deleteItem,
    refreshData,
    clearError,
    setError,
  } = useMedicalData({
    entityName: 'medication',
    apiMethodsConfig: {
      getAll: signal => apiService.getMedications(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientMedications(patientId, signal),
      create: (data, signal) => apiService.createMedication(data, signal),
      update: (id, data, signal) =>
        apiService.updateMedication(id, data, signal),
      delete: (id, signal) => apiService.deleteMedication(id, signal),
    },
    requiresPatient: true,
  });

  // Get standardized configuration
  const config = getMedicalPageConfig('medications');

  // Use standardized data management
  const dataManagement = useDataManagement(medications, config);

  // File count management for cards
  const { fileCounts, fileCountsLoading, cleanupFileCount } = useEntityFileCounts('medication', medications);

  // View modal navigation with URL deep linking
  const {
    isOpen: showViewModal,
    viewingItem: viewingMedication,
    openModal: handleViewMedication,
    closeModal: handleCloseViewModal,
  } = useViewModalNavigation({
    items: medications,
    loading,
  });

  // Display medication purpose (indication only, since conditions are now linked via many-to-many)
  const getMedicationPurpose = (medication, asText = false) => {
    const indication = medication.indication?.trim();
    return indication || '-';
  };

  // Get standardized formatters for medications with linking support
  const formatters = {
    ...getEntityFormatters('medications', practitioners, navigate),
    // Override indication formatter to use smart display (text version for tables)
    indication: (value, medication) => getMedicationPurpose(medication, true),
  };

  // Form data state
  const [formData, setFormData] = useState({
    medication_name: '',
    medication_type: 'prescription',
    dosage: '',
    frequency: '',
    route: '',
    indication: '',
    effective_period_start: '',
    effective_period_end: '',
    status: 'active',
    practitioner_id: null,
    pharmacy_id: null,
  });

  const handleInputChange = useCallback(e => {
    const { name, value } = e.target;
    let processedValue = value;

    // Handle ID fields - convert empty string to null, otherwise keep as string for Mantine
    if (name === 'practitioner_id' || name === 'pharmacy_id') {
      if (value === '') {
        processedValue = null;
      } else {
        processedValue = value; // Keep as string for Mantine compatibility
      }
    }

    setFormData(prev => ({
      ...prev,
      [name]: processedValue,
    }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      medication_name: '',
      medication_type: 'prescription',
      dosage: '',
      frequency: '',
      route: '',
      indication: '',
      effective_period_start: '',
      effective_period_end: '',
      status: 'active',
      practitioner_id: null,
      pharmacy_id: null,
      tags: [],
    });
    setEditingMedication(null);
    setShowAddForm(false);
  }, []);

  const handleAddMedication = () => {
    resetForm();
    setShowAddForm(true);
  };

  const handleCloseForm = useCallback(() => {
    setShowAddForm(false);
    setEditingMedication(null); // Clear editing state when closing
  }, []);

  const handleEditMedication = useCallback(medication => {
    setFormData({
      medication_name: medication.medication_name || '',
      medication_type: medication.medication_type || 'prescription',
      dosage: medication.dosage || '',
      frequency: medication.frequency || '',
      route: medication.route || '',
      indication: medication.indication || '',
      effective_period_start: medication.effective_period_start || '',
      effective_period_end: medication.effective_period_end || '',
      status: medication.status || 'active',
      practitioner_id: medication.practitioner_id
        ? String(medication.practitioner_id)
        : null,
      pharmacy_id: medication.pharmacy_id
        ? String(medication.pharmacy_id)
        : null,
      tags: medication.tags || [],
    });
    setEditingMedication(medication);
    setShowAddForm(true);
  }, []);

  const handleDeleteMedication = async medicationId => {
    const success = await deleteItem(medicationId);
    if (success) {
      cleanupFileCount(medicationId);
      await refreshData();
    }
  };

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();

      if (!currentPatient?.id) {
        setError('Patient information not available');
        return;
      }

      // Validate medication name
      const medicationName = formData.medication_name?.trim() || '';
      if (!medicationName) {
        setError('Medication name is required');
        return;
      }

      if (medicationName.length < 2) {
        setError('Medication name must be at least 2 characters long');
        return;
      }

      // Prepare medication data - ensure empty strings become null for optional fields
      const medicationData = {
        medication_name: medicationName, // Required field, already trimmed
        medication_type: formData.medication_type || 'prescription',
        dosage: formData.dosage?.trim() || null,
        frequency: formData.frequency?.trim() || null,
        route: formData.route?.trim() || null,
        indication: formData.indication?.trim() || null,
        status: formData.status || 'active',
        patient_id: currentPatient.id,
        practitioner_id: formData.practitioner_id
          ? parseInt(formData.practitioner_id)
          : null,
        pharmacy_id: formData.pharmacy_id
          ? parseInt(formData.pharmacy_id)
          : null,
        tags: formData.tags || [], // Include tags from form data
      };

      // Add dates if provided
      if (formData.effective_period_start) {
        medicationData.effective_period_start = formData.effective_period_start;
      }
      if (formData.effective_period_end) {
        medicationData.effective_period_end = formData.effective_period_end;
      }

      // Log the data being sent for debugging
      logger.debug('Submitting medication data', {
        component: 'Medication',
        medicationData,
        formData,
      });

      try {
        let success;
        if (editingMedication) {
          success = await updateItem(editingMedication.id, medicationData);
        } else {
          success = await createItem(medicationData);
        }

        if (success) {
          resetForm();
          await refreshData();
        }
      } catch (error) {
        logger.error('Error during save operation:', error);
      }
    },
    [
      formData,
      currentPatient,
      editingMedication,
      setError,
      updateItem,
      createItem,
      resetForm,
      refreshData,
    ]
  );

  // Get processed data from data management and add practitioner/pharmacy names for sorting
  const processedMedications = useMemo(() => {
    return dataManagement.data.map(medication => ({
      ...medication,
      // Add practitioner name for sorting
      practitioner_name: medication.practitioner_id
        ? practitioners.find(p => p.id === medication.practitioner_id)?.name ||
          ''
        : '',
      // Add pharmacy name for sorting
      pharmacy_name: medication.pharmacy_id
        ? pharmacies.find(p => p.id === medication.pharmacy_id)?.name || ''
        : '',
    }));
  }, [dataManagement.data, practitioners, pharmacies]);

  if (loading) {
    return <MedicalPageLoading message={t('medications.loading', 'Loading medications...')} />;
  }

  return (
    <Container size="xl" py="md">
      <PageHeader title={t('medications.title', 'Medications')} icon="💊" />

      <Stack gap="lg">
        <MedicalPageAlerts
          error={error}
          successMessage={successMessage}
          onClearError={clearError}
        />

        <Group justify="space-between" mb="lg">
          <Button
            variant="filled"
            leftSection={<IconPlus size={16} />}
            onClick={handleAddMedication}
            size="md"
          >
            {t('medications.addNew', 'Add New Medication')}
          </Button>

          <ViewToggle
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            showPrint={true}
          />
        </Group>

        {/* Quick Type Filters */}
        <Paper p="md" mb="md" withBorder>
          <Group gap="xs" wrap="wrap">
            <Text size="sm" fw={500} c="dimmed">
              <IconFilter
                size={16}
                style={{ verticalAlign: 'middle', marginRight: 4 }}
              />
              {t('medications.quickFilter', 'Quick Filter')}:
            </Text>
            <Button
              variant={
                dataManagement.filters.medicationType === 'all'
                  ? 'filled'
                  : 'light'
              }
              size="xs"
              onClick={() =>
                dataManagement.updateFilter('medicationType', 'all')
              }
            >
              {t('medications.allTypes', 'All Types')}
              <Badge size="xs" ml={6} variant="filled" color="dark">
                {medications.length}
              </Badge>
            </Button>
            <Button
              variant={
                dataManagement.filters.medicationType ===
                MEDICATION_TYPES.PRESCRIPTION
                  ? 'filled'
                  : 'light'
              }
              size="xs"
              leftSection={<IconPill size={14} />}
              onClick={() =>
                dataManagement.updateFilter(
                  'medicationType',
                  MEDICATION_TYPES.PRESCRIPTION
                )
              }
            >
              {t('medications.types.prescription')}
              <Badge size="xs" ml={6} variant="filled" color="dark">
                {
                  medications.filter(
                    m => m.medication_type === MEDICATION_TYPES.PRESCRIPTION
                  ).length
                }
              </Badge>
            </Button>
            <Button
              variant={
                dataManagement.filters.medicationType ===
                MEDICATION_TYPES.SUPPLEMENT
                  ? 'filled'
                  : 'light'
              }
              size="xs"
              onClick={() =>
                dataManagement.updateFilter(
                  'medicationType',
                  MEDICATION_TYPES.SUPPLEMENT
                )
              }
            >
              {t('medications.types.supplement')}
              <Badge size="xs" ml={6} variant="filled" color="dark">
                {
                  medications.filter(
                    m => m.medication_type === MEDICATION_TYPES.SUPPLEMENT
                  ).length
                }
              </Badge>
            </Button>
            <Button
              variant={
                dataManagement.filters.medicationType === MEDICATION_TYPES.OTC
                  ? 'filled'
                  : 'light'
              }
              size="xs"
              onClick={() =>
                dataManagement.updateFilter(
                  'medicationType',
                  MEDICATION_TYPES.OTC
                )
              }
            >
              {t('medications.types.otc')}
              <Badge size="xs" ml={6} variant="filled" color="dark">
                {
                  medications.filter(
                    m => m.medication_type === MEDICATION_TYPES.OTC
                  ).length
                }
              </Badge>
            </Button>
            <Button
              variant={
                dataManagement.filters.medicationType ===
                MEDICATION_TYPES.HERBAL
                  ? 'filled'
                  : 'light'
              }
              size="xs"
              onClick={() =>
                dataManagement.updateFilter(
                  'medicationType',
                  MEDICATION_TYPES.HERBAL
                )
              }
            >
              {t('medications.types.herbal')}
              <Badge size="xs" ml={6} variant="filled" color="dark">
                {
                  medications.filter(
                    m => m.medication_type === MEDICATION_TYPES.HERBAL
                  ).length
                }
              </Badge>
            </Button>
          </Group>
        </Paper>

        {/* Mantine Filter Controls */}
        <MantineFilters
          filters={dataManagement.filters}
          updateFilter={dataManagement.updateFilter}
          clearFilters={dataManagement.clearFilters}
          hasActiveFilters={dataManagement.hasActiveFilters}
          statusOptions={dataManagement.statusOptions}
          categoryOptions={dataManagement.categoryOptions}
          medicationTypeOptions={dataManagement.medicationTypeOptions}
          dateRangeOptions={dataManagement.dateRangeOptions}
          sortOptions={dataManagement.sortOptions}
          sortBy={dataManagement.sortBy}
          sortOrder={dataManagement.sortOrder}
          handleSortChange={dataManagement.handleSortChange}
          totalCount={dataManagement.totalCount}
          filteredCount={dataManagement.filteredCount}
          config={config.filterControls}
        />

        {/* Form Modal */}
        <MedicationFormWrapper
          isOpen={showAddForm}
          onClose={handleCloseForm}
          title={editingMedication ? 'Edit Medication' : 'Add New Medication'}
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          practitioners={practitioners}
          pharmacies={pharmacies}
          editingMedication={editingMedication}
        />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {processedMedications.length === 0 ? (
            <EmptyState
              icon={IconAlertTriangle}
              title={t('medications.noMedications', 'No medications or supplements found')}
              hasActiveFilters={dataManagement.hasActiveFilters}
              filteredMessage={t('medications.tryAdjustingFilters', 'Try adjusting your search or filter criteria.')}
              noDataMessage={t('medications.clickToStart', 'Click "Add New Medication" to get started.')}
            />
          ) : viewMode === 'cards' ? (
            <Grid>
              <AnimatePresence>
                {processedMedications.map((medication, index) => (
                  <Grid.Col
                    key={medication.id}
                    span={
                      responsive.isMobile ? 12 : responsive.isTablet ? 6 : 4
                    }
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <MedicationCard
                        medication={medication}
                        onView={handleViewMedication}
                        onEdit={handleEditMedication}
                        onDelete={handleDeleteMedication}
                        navigate={navigate}
                        fileCount={fileCounts[medication.id] || 0}
                        fileCountLoading={fileCountsLoading[medication.id] || false}
                        onError={setError}
                      />
                    </motion.div>
                  </Grid.Col>
                ))}
              </AnimatePresence>
            </Grid>
          ) : (
            <Paper shadow="sm" radius="md" withBorder>
              <ResponsiveTable
                data={processedMedications}
                columns={[
                  {
                    header: 'Medication Name',
                    accessor: 'medication_name',
                    priority: 'high',
                    width: 200,
                  },
                  {
                    header: 'Type',
                    accessor: 'medication_type',
                    priority: 'medium',
                    width: 150,
                  },
                  {
                    header: 'Dosage',
                    accessor: 'dosage',
                    priority: 'high',
                    width: 120,
                  },
                  {
                    header: 'Frequency',
                    accessor: 'frequency',
                    priority: 'medium',
                    width: 120,
                  },
                  {
                    header: 'Route',
                    accessor: 'route',
                    priority: 'low',
                    width: 100,
                  },
                  {
                    header: 'Purpose',
                    accessor: 'indication',
                    priority: 'medium',
                    width: 180,
                  },
                  {
                    header: 'Prescriber',
                    accessor: 'practitioner_name',
                    priority: 'low',
                    width: 150,
                  },
                  {
                    header: 'Pharmacy',
                    accessor: 'pharmacy_name',
                    priority: 'low',
                    width: 150,
                  },
                  {
                    header: 'Start Date',
                    accessor: 'effective_period_start',
                    priority: 'low',
                    width: 120,
                  },
                  {
                    header: 'End Date',
                    accessor: 'effective_period_end',
                    priority: 'low',
                    width: 120,
                  },
                  {
                    header: 'Status',
                    accessor: 'status',
                    priority: 'high',
                    width: 100,
                  },
                ]}
                patientData={currentPatient}
                tableName="Medications"
                onView={handleViewMedication}
                onEdit={handleEditMedication}
                onDelete={handleDeleteMedication}
                formatters={formatters}
                dataType="medical"
                medicalContext="medications"
                responsive={responsive}
              />
            </Paper>
          )}
        </motion.div>

        {/* Medication View Modal */}
        <MedicationViewModal
          isOpen={showViewModal}
          onClose={handleCloseViewModal}
          medication={viewingMedication}
          onEdit={handleEditMedication}
          navigate={navigate}
          onError={setError}
          practitioners={practitioners}
        />
      </Stack>
    </Container>
  );
};

// Wrap with responsive HOC for enhanced responsive capabilities
export default withResponsive(Medication, {
  injectResponsive: true,
  displayName: 'ResponsiveMedication',
});
