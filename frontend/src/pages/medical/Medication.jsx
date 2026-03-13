import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Button,
  Stack,
  Text,
  Container,
  Paper,
  Title,
  Badge,
  Group,
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
import { useDateFormat } from '../../hooks/useDateFormat';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { usePatientWithStaticData } from '../../hooks/useGlobalData';
import { getEntityFormatters } from '../../utils/tableFormatters';
import { navigateToEntity } from '../../utils/linkNavigation';
import { PageHeader } from '../../components';
import { ResponsiveTable } from '../../components/adapters';
import MedicalPageFilters from '../../components/shared/MedicalPageFilters';
import MedicalPageActions from '../../components/shared/MedicalPageActions';
import MedicalPageLoading from '../../components/shared/MedicalPageLoading';
import AnimatedCardGrid from '../../components/shared/AnimatedCardGrid';
import PaginationControls from '../../components/shared/PaginationControls';
import {
  MedicationCard,
  MedicationViewModal,
  MedicationFormWrapper,
} from '../../components/medical/medications';
import { withResponsive } from '../../hoc/withResponsive';
import { useResponsive } from '../../hooks/useResponsive';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import { usePagination } from '../../hooks/usePagination';
import {
  MEDICATION_TYPES,
  MEDICATION_TYPE_LABELS,
} from '../../constants/medicationTypes';
import { useFormSubmissionWithUploads } from '../../hooks/useFormSubmissionWithUploads';
import FormLoadingOverlay from '../../components/shared/FormLoadingOverlay';
import logger from '../../services/logger';

const Medication = () => {
  const { t } = useTranslation('common');
  const { formatDate } = useDateFormat();
  const navigate = useNavigate();
  const responsive = useResponsive();
  const [viewMode, setViewMode] = usePersistedViewMode('medications');
  const { page, setPage, pageSize, handlePageSizeChange, paginateData, totalPages, resetPage, clampPage, PAGE_SIZE_OPTIONS } = usePagination();

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

  // Fetch conditions for the condition-linking dropdown in the form and view modal.
  // Depends on currentPatient so it refreshes when the active patient changes.
  // Fetches all conditions (including inactive) so they can be linked to medications.
  const [conditions, setConditions] = useState([]);
  useEffect(() => {
    if (!currentPatient?.id) return;
    apiService.getConditionsDropdown(false).then(data => {
      setConditions(data || []);
    }).catch(err => {
      logger.warn('Failed to fetch conditions dropdown:', err);
    });
  }, [currentPatient?.id]);

  // Get standardized configuration
  const config = getMedicalPageConfig('medications');

  // Use standardized data management
  const dataManagement = useDataManagement(medications, config);

  // File count management for cards
  const { fileCounts, fileCountsLoading, cleanupFileCount, refreshFileCount } = useEntityFileCounts('medication', medications);

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
    ...getEntityFormatters('medications', practitioners, navigate, null, formatDate),
    // Override indication formatter to use smart display (text version for tables)
    indication: (value, medication) => getMedicationPurpose(medication, true),
  };

  // Document management state
  const [documentManagerMethods, setDocumentManagerMethods] = useState(null);

  // Track if we need to refresh after form submission
  const needsRefreshAfterSubmissionRef = useRef(false);

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
    notes: '',
    side_effects: '',
  });

  const {
    startSubmission,
    completeFormSubmission,
    startFileUpload,
    completeFileUpload,
    handleSubmissionFailure,
    resetSubmission,
    isBlocking,
    canSubmit,
    statusMessage,
  } = useFormSubmissionWithUploads({
    entityType: 'medication',
    onSuccess: () => {
      resetForm();

      if (needsRefreshAfterSubmissionRef.current) {
        needsRefreshAfterSubmissionRef.current = false;
        refreshData();
      }
    },
    onError: (error) => {
      logger.error('medications_form_error', {
        message: 'Form submission error in medications',
        error,
        component: 'Medication',
      });
    },
    component: 'Medication',
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
      notes: '',
      side_effects: '',
      tags: [],
    });
    setEditingMedication(null);
    setShowAddForm(false);
  }, []);

  const handleAddMedication = () => {
    resetSubmission();
    setDocumentManagerMethods(null);
    resetForm();
    setShowAddForm(true);
  };

  const handleCloseForm = useCallback(() => {
    if (isBlocking) return;
    setShowAddForm(false);
    setEditingMedication(null);
  }, [isBlocking]);

  const handleEditMedication = useCallback(medication => {
    resetSubmission();
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
      notes: medication.notes || '',
      side_effects: medication.side_effects || '',
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

      const medicationName = formData.medication_name?.trim() || '';
      if (!medicationName) {
        setError('Medication name is required');
        return;
      }

      if (medicationName.length < 2) {
        setError('Medication name must be at least 2 characters long');
        return;
      }

      startSubmission();

      if (!canSubmit) {
        return;
      }

      const medicationData = {
        medication_name: medicationName,
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
        notes: formData.notes?.trim() || null,
        side_effects: formData.side_effects?.trim() || null,
        tags: formData.tags || [],
      };

      if (formData.effective_period_start) {
        medicationData.effective_period_start = formData.effective_period_start;
      }
      if (formData.effective_period_end) {
        medicationData.effective_period_end = formData.effective_period_end;
      }

      try {
        let success;
        let resultId;

        if (editingMedication) {
          success = await updateItem(editingMedication.id, medicationData);
          resultId = editingMedication.id;
        } else {
          const result = await createItem(medicationData);
          success = !!result;
          resultId = result?.id;
          if (success) {
            needsRefreshAfterSubmissionRef.current = true;
          }
        }

        completeFormSubmission(success, resultId);

        if (success && resultId) {
          const hasPendingFiles = documentManagerMethods?.hasPendingFiles?.();

          if (hasPendingFiles) {
            logger.info('medications_starting_file_upload', {
              message: 'Starting file upload process',
              medicationId: resultId,
              pendingFilesCount: documentManagerMethods.getPendingFilesCount(),
              component: 'Medication',
            });

            startFileUpload();

            try {
              await documentManagerMethods.uploadPendingFiles(resultId);
              completeFileUpload(true, documentManagerMethods.getPendingFilesCount(), 0);
            } catch (uploadError) {
              logger.error('medications_file_upload_error', {
                message: 'File upload failed',
                medicationId: resultId,
                error: uploadError.message,
                component: 'Medication',
              });
              completeFileUpload(false, 0, documentManagerMethods.getPendingFilesCount());
            }
          } else {
            completeFileUpload(true, 0, 0);
          }
        } else {
          handleSubmissionFailure(new Error('Form submission failed'), 'form');
        }
      } catch (error) {
        logger.error('medications_submission_error', {
          message: 'Form submission failed',
          error: error.message,
          component: 'Medication',
        });
        handleSubmissionFailure(error, 'form');
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
      startSubmission,
      canSubmit,
      completeFormSubmission,
      startFileUpload,
      completeFileUpload,
      handleSubmissionFailure,
      documentManagerMethods,
      needsRefreshAfterSubmissionRef,
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

  const paginatedMedications = paginateData(processedMedications);

  useEffect(() => { resetPage(); }, [dataManagement.hasActiveFilters, resetPage]);
  useEffect(() => { clampPage(processedMedications.length); }, [processedMedications.length, clampPage]);

  if (loading) {
    return <MedicalPageLoading message={t('medications.loading', 'Loading medications...')} />;
  }

  return (
    <Container size="xl" py="sm">
      <PageHeader title={t('medications.title', 'Medications')} icon="💊" />

      <Stack gap="sm" mt="md">
        <MedicalPageAlerts
          error={error}
          successMessage={successMessage}
          onClearError={clearError}
        />

        <MedicalPageActions
          primaryAction={{
            label: t('medications.addNew', 'Add New Medication'),
            onClick: handleAddMedication,
            leftSection: <IconPlus size={16} />,
            size: 'sm',
          }}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          viewToggleSize="sm"
          mb={0}
        />

        {/* Quick Type Filters */}
        <Paper p="xs" radius="md" withBorder>
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
              <Badge size="xs" ml={4} variant="filled" color="dark">
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
              <Badge size="xs" ml={4} variant="filled" color="dark">
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
              <Badge size="xs" ml={4} variant="filled" color="dark">
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
              <Badge size="xs" ml={4} variant="filled" color="dark">
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
              <Badge size="xs" ml={4} variant="filled" color="dark">
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
        <MedicalPageFilters dataManagement={dataManagement} config={config} />

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
          conditions={conditions}
          navigate={navigate}
          isLoading={isBlocking}
          statusMessage={statusMessage}
          onDocumentManagerRef={setDocumentManagerMethods}
          onFileUploadComplete={(success, completedCount, failedCount) => {
            if (success && editingMedication?.id) {
              refreshFileCount(editingMedication.id);
            }
          }}
        />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
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
            <AnimatedCardGrid
              items={paginatedMedications}
              staggerDelay={0.05}
              renderCard={(medication) => (
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
              )}
            />
          ) : (
            <Paper shadow="sm" radius="md" withBorder>
              <ResponsiveTable
                persistKey="medications"
                data={paginatedMedications}
                pagination={false}
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
          {processedMedications.length > 0 && (
            <PaginationControls page={page} totalPages={totalPages(processedMedications.length)} pageSize={pageSize} totalRecords={processedMedications.length} onPageChange={setPage} onPageSizeChange={handlePageSizeChange} pageSizeOptions={PAGE_SIZE_OPTIONS} />
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
          conditions={conditions}
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
