import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Container, Paper, Text, Stack } from '@mantine/core';
import { IconAlertTriangle, IconPlus } from '@tabler/icons-react';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { useEntityFileCounts } from '../../hooks/useEntityFileCounts';
import { useViewModalNavigation } from '../../hooks/useViewModalNavigation';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import { usePagination } from '../../hooks/usePagination';
import { apiService } from '../../services/api';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { getEntityFormatters } from '../../utils/tableFormatters';
import { useDateFormat } from '../../hooks/useDateFormat';
import { navigateToEntity } from '../../utils/linkNavigation';
import { PageHeader } from '../../components';
import { ResponsiveTable } from '../../components/adapters';
import MedicalPageFilters from '../../components/shared/MedicalPageFilters';
import MedicalPageActions from '../../components/shared/MedicalPageActions';
import EmptyState from '../../components/shared/EmptyState';
import MedicalPageAlerts from '../../components/shared/MedicalPageAlerts';
import MedicalPageLoading from '../../components/shared/MedicalPageLoading';
import AnimatedCardGrid from '../../components/shared/AnimatedCardGrid';
import PaginationControls from '../../components/shared/PaginationControls';
import {
  AllergyCard,
  AllergyViewModal,
  AllergyFormWrapper,
} from '../../components/medical/allergies';
import { withResponsive } from '../../hoc/withResponsive';
import { useResponsive } from '../../hooks/useResponsive';
import logger from '../../services/logger';
import { useFormSubmissionWithUploads } from '../../hooks/useFormSubmissionWithUploads';
import { usePatientPermissions } from '../../hooks/usePatientPermissions';

const Allergies = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(['medical', 'shared']);
  const { isViewOnly, viewOnlyTooltip } = usePatientPermissions();
  const { formatDate } = useDateFormat();
  const responsive = useResponsive();
  const [viewMode, setViewMode] = usePersistedViewMode('allergies');
  const {
    page,
    setPage,
    pageSize,
    handlePageSizeChange,
    paginateData,
    totalPages,
    resetPage,
    clampPage,
    PAGE_SIZE_OPTIONS,
  } = usePagination();

  // Standardized data management
  const {
    items: allergies,
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
    entityName: 'allergy',
    apiMethodsConfig: {
      getAll: signal => apiService.getAllergies(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientAllergies(patientId, signal),
      create: (data, signal) => apiService.createAllergy(data, signal),
      update: (id, data, signal) => apiService.updateAllergy(id, data, signal),
      delete: (id, signal) => apiService.deleteAllergy(id, signal),
    },
    requiresPatient: true,
  });

  // Get standardized configuration
  const config = getMedicalPageConfig('allergies');

  // Use standardized data management
  const dataManagement = useDataManagement(allergies, config);

  // Get patient medications for linking
  const [medications, setMedications] = useState([]);

  useEffect(() => {
    if (currentPatient?.id) {
      apiService
        .getPatientMedications(currentPatient.id)
        .then(response => {
          setMedications(response || []);
        })
        .catch(error => {
          logger.error('Failed to fetch medications:', error);
          setMedications([]);
        });
    }
  }, [currentPatient?.id]);

  // File count management for cards
  const { fileCounts, fileCountsLoading, cleanupFileCount, refreshFileCount } =
    useEntityFileCounts('allergy', allergies);

  // View modal navigation with URL deep linking
  const {
    isOpen: showViewModal,
    viewingItem: viewingAllergy,
    openModal: handleViewAllergy,
    closeModal: handleCloseViewModal,
  } = useViewModalNavigation({
    items: allergies,
    loading,
  });

  // Get standardized formatters for allergies with medication linking
  const formatters = {
    ...getEntityFormatters('allergies', [], navigate, null, formatDate),
    medication_name: (value, allergy) => {
      const medication = medications.find(
        med => med.id === allergy.medication_id
      );
      return medication?.medication_name || '';
    },
  };

  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAllergy, setEditingAllergy] = useState(null);
  const [formData, setFormData] = useState({
    allergen: '',
    severity: '',
    reaction: '',
    onset_date: '',
    status: 'active',
    notes: '',
    medication_id: '',
    tags: [],
  });

  // Document management state
  const [documentManagerMethods, setDocumentManagerMethods] = useState(null);

  // Track if we need to refresh after form submission
  const needsRefreshAfterSubmissionRef = useRef(false);

  // Form submission with uploads hook
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
    entityType: 'allergy',
    onSuccess: () => {
      resetForm();

      if (needsRefreshAfterSubmissionRef.current) {
        needsRefreshAfterSubmissionRef.current = false;
        refreshData();
      }
    },
    onError: error => {
      logger.error('allergies_form_error', {
        message: 'Form submission error in allergies',
        error,
        component: 'Allergies',
      });
    },
    component: 'Allergies',
  });

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      allergen: '',
      severity: '',
      reaction: '',
      onset_date: '',
      status: 'active',
      notes: '',
      medication_id: '',
      tags: [],
    });
    setEditingAllergy(null);
    setShowAddForm(false);
  };

  const handleAddAllergy = () => {
    resetSubmission();
    setDocumentManagerMethods(null);
    setEditingAllergy(null);
    setFormData({
      allergen: '',
      severity: '',
      reaction: '',
      onset_date: '',
      status: 'active',
      notes: '',
      medication_id: '',
      tags: [],
    });
    setShowAddForm(true);
  };

  const handleEditAllergy = allergy => {
    resetSubmission();
    setFormData({
      allergen: allergy.allergen || '',
      severity: allergy.severity || '',
      reaction: allergy.reaction || '',
      onset_date: allergy.onset_date || '',
      status: allergy.status || 'active',
      notes: allergy.notes || '',
      medication_id: allergy.medication_id
        ? allergy.medication_id.toString()
        : '',
      tags: allergy.tags || [],
    });
    setEditingAllergy(allergy);
    setShowAddForm(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!currentPatient?.id) {
      setError('Patient information not available');
      return;
    }

    startSubmission();

    if (!canSubmit) {
      return;
    }

    const allergyData = {
      ...formData,
      onset_date: formData.onset_date || null,
      notes: formData.notes || null,
      medication_id: formData.medication_id
        ? parseInt(formData.medication_id)
        : null,
      patient_id: currentPatient.id,
    };

    try {
      let success;
      let resultId;

      if (editingAllergy) {
        success = await updateItem(editingAllergy.id, allergyData);
        resultId = editingAllergy.id;
      } else {
        const result = await createItem(allergyData);
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
          logger.info('allergies_starting_file_upload', {
            message: 'Starting file upload process',
            allergyId: resultId,
            pendingFilesCount: documentManagerMethods.getPendingFilesCount(),
            component: 'Allergies',
          });

          const pendingCount = documentManagerMethods.getPendingFilesCount();

          startFileUpload();

          try {
            await documentManagerMethods.uploadPendingFiles(resultId);
            completeFileUpload(true, pendingCount, 0);
          } catch (uploadError) {
            logger.error('allergies_file_upload_error', {
              message: 'File upload failed',
              allergyId: resultId,
              error: uploadError.message,
              component: 'Allergies',
            });
            completeFileUpload(false, 0, pendingCount);
          }
        } else {
          completeFileUpload(true, 0, 0);
        }
      } else {
        handleSubmissionFailure(new Error('Form submission failed'), 'form');
      }
    } catch (error) {
      logger.error('allergies_submission_error', {
        message: 'Form submission failed',
        error: error.message,
        component: 'Allergies',
      });
      handleSubmissionFailure(error, 'form');
    }
  };

  const handleDeleteAllergy = async allergyId => {
    const success = await deleteItem(allergyId);
    if (success) {
      cleanupFileCount(allergyId);
      await refreshData();
    }
  };

  // Get processed data from data management
  const processedAllergies = dataManagement.data;
  const paginatedAllergies = paginateData(processedAllergies);

  // Reset page when filters change or data shrinks
  useEffect(() => {
    resetPage();
  }, [dataManagement.hasActiveFilters, resetPage]);

  useEffect(() => {
    clampPage(processedAllergies.length);
  }, [processedAllergies.length, clampPage]);

  if (loading) {
    return (
      <MedicalPageLoading
        message={t('allergies.messages.loading', 'Loading allergies...')}
      />
    );
  }

  return (
    <Container size="xl" py="sm">
      <PageHeader title={t('shared:categories.allergies')} icon="⚠️" />

      <Stack gap="sm" mt="md">
        <MedicalPageAlerts
          error={error}
          successMessage={successMessage}
          onClearError={clearError}
        />

        <MedicalPageActions
          primaryAction={{
            label: t('shared:labels.addNewAllergy', 'Add New Allergy'),
            onClick: handleAddAllergy,
            leftSection: <IconPlus size={16} />,
            size: 'sm',
            disabled: isViewOnly,
            tooltip: viewOnlyTooltip,
          }}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          viewToggleSize="sm"
          mb={0}
        />

        {/* Mantine Filter Controls */}
        <MedicalPageFilters dataManagement={dataManagement} config={config} />

        {/* Form Modal */}
        <AllergyFormWrapper
          isOpen={showAddForm}
          onClose={() => !isBlocking && resetForm()}
          title={
            editingAllergy
              ? t('allergies.editTitle', 'Edit Allergy')
              : t('shared:labels.addNewAllergy', 'Add New Allergy')
          }
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          editingAllergy={editingAllergy}
          medicationsOptions={medications}
          medicationsLoading={false}
          isLoading={isBlocking}
          statusMessage={statusMessage}
          onDocumentManagerRef={setDocumentManagerMethods}
          onFileUploadComplete={(success, completedCount, failedCount) => {
            if (success && editingAllergy?.id) {
              refreshFileCount(editingAllergy.id);
            }
          }}
        />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {processedAllergies.length === 0 ? (
            <EmptyState
              icon={IconAlertTriangle}
              title={t('allergies.emptyState.title', 'No allergies found')}
              hasActiveFilters={dataManagement.hasActiveFilters}
              filteredMessage={t(
                'shared:emptyStates.adjustSearch',
                'Try adjusting your search or filter criteria.'
              )}
              noDataMessage={t(
                'allergies.emptyState.noData',
                'Click "Add New Allergy" to get started.'
              )}
            />
          ) : viewMode === 'cards' ? (
            <AnimatedCardGrid
              items={paginatedAllergies}
              renderCard={allergy => (
                <AllergyCard
                  allergy={allergy}
                  onView={handleViewAllergy}
                  onEdit={handleEditAllergy}
                  onDelete={handleDeleteAllergy}
                  medications={medications}
                  navigate={navigate}
                  fileCount={fileCounts[allergy.id] || 0}
                  fileCountLoading={fileCountsLoading[allergy.id] || false}
                  onError={setError}
                  disableActions={isViewOnly}
                  disableActionsTooltip={viewOnlyTooltip}
                />
              )}
            />
          ) : (
            <Paper shadow="sm" radius="md" withBorder>
              <ResponsiveTable
                persistKey="allergies"
                data={paginatedAllergies}
                pagination={false}
                disableEdit={isViewOnly}
                disableDelete={isViewOnly}
                disableActionsTooltip={viewOnlyTooltip}
                columns={[
                  {
                    header: t('allergies.allergen.label'),
                    accessor: 'allergen',
                    priority: 'high',
                    width: 150,
                  },
                  {
                    header: t('allergies.reaction.label'),
                    accessor: 'reaction',
                    priority: 'high',
                    width: 180,
                  },
                  {
                    header: t('shared:fields.severity'),
                    accessor: 'severity',
                    priority: 'high',
                    width: 100,
                  },
                  {
                    header: t('shared:fields.onsetDate'),
                    accessor: 'onset_date',
                    priority: 'medium',
                    width: 120,
                  },
                  {
                    header: t('allergies.relatedMedication.label'),
                    accessor: 'medication_name',
                    priority: 'low',
                    width: 150,
                  },
                  {
                    header: t('shared:fields.status'),
                    accessor: 'status',
                    priority: 'medium',
                    width: 100,
                  },
                  {
                    header: t('shared:tabs.notes'),
                    accessor: 'notes',
                    priority: 'low',
                    width: 200,
                  },
                ]}
                patientData={currentPatient}
                tableName={t('shared:categories.allergies')}
                onView={handleViewAllergy}
                onEdit={handleEditAllergy}
                onDelete={handleDeleteAllergy}
                formatters={formatters}
                dataType="medical"
                responsive={responsive}
              />
            </Paper>
          )}
          {processedAllergies.length > 0 && (
            <PaginationControls
              page={page}
              totalPages={totalPages(processedAllergies.length)}
              pageSize={pageSize}
              totalRecords={processedAllergies.length}
              onPageChange={setPage}
              onPageSizeChange={handlePageSizeChange}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          )}
        </motion.div>

        {/* Allergy View Modal */}
        <AllergyViewModal
          isOpen={showViewModal}
          onClose={handleCloseViewModal}
          allergy={viewingAllergy}
          onEdit={handleEditAllergy}
          medications={medications}
          navigate={navigate}
          onError={setError}
          disableEdit={isViewOnly}
          disableEditTooltip={viewOnlyTooltip}
        />
      </Stack>
    </Container>
  );
};

// Wrap with responsive HOC for enhanced responsive capabilities
export default withResponsive(Allergies, {
  injectResponsive: true,
  displayName: 'ResponsiveAllergies',
});
