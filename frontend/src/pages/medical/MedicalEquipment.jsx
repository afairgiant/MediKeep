import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { useEntityFileCounts } from '../../hooks/useEntityFileCounts';
import { useFormSubmissionWithUploads } from '../../hooks/useFormSubmissionWithUploads';
import { useViewModalNavigation } from '../../hooks/useViewModalNavigation';
import { apiService } from '../../services/api';
import { usePatientWithStaticData } from '../../hooks/useGlobalData';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import { useDateFormat } from '../../hooks/useDateFormat';
import { useResponsive } from '../../hooks/useResponsive';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { getEntityFormatters } from '../../utils/tableFormatters';
import { PageHeader } from '../../components';
import { withResponsive } from '../../hoc/withResponsive';
import { usePagination } from '../../hooks/usePagination';
import PaginationControls from '../../components/shared/PaginationControls';
import logger from '../../services/logger';
import MedicalPageFilters from '../../components/shared/MedicalPageFilters';
import { ResponsiveTable } from '../../components/adapters';
import MedicalPageActions from '../../components/shared/MedicalPageActions';
import EmptyState from '../../components/shared/EmptyState';
import MedicalPageLoading from '../../components/shared/MedicalPageLoading';
import AnimatedCardGrid from '../../components/shared/AnimatedCardGrid';
import MedicalPageAlerts from '../../components/shared/MedicalPageAlerts';
import EquipmentCard from '../../components/medical/equipment/EquipmentCard';
import EquipmentViewModal from '../../components/medical/equipment/EquipmentViewModal';
import EquipmentFormWrapper from '../../components/medical/equipment/EquipmentFormWrapper';
import { usePatientPermissions } from '../../hooks/usePatientPermissions';
import { Button, Stack, Container, Paper } from '@mantine/core';
import {
  INITIAL_EQUIPMENT_FORM_DATA,
  buildEquipmentPayload,
  validateEquipmentForm,
} from '../../utils/equipmentFormUtils';

const EMPTY_FORM_DATA = INITIAL_EQUIPMENT_FORM_DATA;

const MedicalEquipment = () => {
  const { t } = useTranslation(['common', 'shared']);
  const { formatDate } = useDateFormat();
  const responsive = useResponsive();
  const { isViewOnly, viewOnlyTooltip } = usePatientPermissions();
  const [viewMode, setViewMode] = usePersistedViewMode('medical-equipment');
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

  // Get practitioners data
  const { practitioners: practitionersObject } = usePatientWithStaticData();
  const practitioners = practitionersObject?.practitioners || [];

  // Medical data management
  const {
    items: equipment,
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
    entityName: 'equipment',
    entityLabel: t('medical:entityNames.equipment'),
    apiMethodsConfig: {
      getAll: signal => apiService.getMedicalEquipment(signal),
      getByPatient: (patientId, signal) =>
        apiService.getMedicalEquipment(signal), // Equipment is patient-scoped by backend
      create: (data, signal) => apiService.createMedicalEquipment(data, signal),
      update: (id, data, signal) =>
        apiService.updateMedicalEquipment(id, data, signal),
      delete: (id, signal) => apiService.deleteMedicalEquipment(id, signal),
    },
    requiresPatient: true,
  });

  // Standardized filtering and sorting, shared by the filter bar and table headers
  const config = getMedicalPageConfig('equipment');
  const dataManagement = useDataManagement(equipment, config);

  const formatters = getEntityFormatters(
    'equipment',
    [],
    null,
    null,
    formatDate
  );

  // File count management for cards
  const { fileCounts, fileCountsLoading, cleanupFileCount, refreshFileCount } =
    useEntityFileCounts('medical-equipment', equipment);

  // View modal navigation
  const {
    isOpen: showViewModal,
    viewingItem: viewingEquipment,
    openModal: handleViewEquipment,
    closeModal: handleCloseViewModal,
  } = useViewModalNavigation({
    items: equipment,
    loading,
  });

  // Form state
  const [showModal, setShowModal] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM_DATA);

  // Document management state
  const [documentManagerMethods, setDocumentManagerMethods] = useState(null);

  // Refresh only once pending files are uploaded: refreshing shows the page
  // loader, which would unmount the form and its document manager
  const needsRefreshAfterSubmissionRef = useRef(false);

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
    entityType: 'medical-equipment',
    onSuccess: () => {
      setShowModal(false);
      setEditingEquipment(null);

      if (needsRefreshAfterSubmissionRef.current) {
        needsRefreshAfterSubmissionRef.current = false;
        refreshData();
      }
    },
    onError: error => {
      logger.error('equipment_form_error', {
        message: 'Form submission error in medical equipment',
        error,
        component: 'MedicalEquipment',
      });
    },
    component: 'MedicalEquipment',
  });

  // Closing after a save whose upload failed still shows the saved record
  const handleCloseForm = () => {
    if (isBlocking) return;
    // Files added in the Edit form are attached straight away, so refresh
    // the card's count even when the form closes without saving
    if (editingEquipment) refreshFileCount(editingEquipment.id);
    setShowModal(false);
    if (needsRefreshAfterSubmissionRef.current) {
      needsRefreshAfterSubmissionRef.current = false;
      refreshData();
    }
  };

  const handleAddEquipment = () => {
    resetSubmission();
    setDocumentManagerMethods(null);
    setEditingEquipment(null);
    setFormData(EMPTY_FORM_DATA);
    setShowModal(true);
  };

  const handleEditEquipment = equip => {
    resetSubmission();
    setEditingEquipment(equip);
    setFormData({
      equipment_name: equip.equipment_name || '',
      equipment_type: equip.equipment_type || '',
      manufacturer: equip.manufacturer || '',
      model_number: equip.model_number || '',
      serial_number: equip.serial_number || '',
      prescribed_date: equip.prescribed_date || '',
      last_service_date: equip.last_service_date || '',
      next_service_date: equip.next_service_date || '',
      usage_instructions: equip.usage_instructions || '',
      status: equip.status || 'active',
      supplier: equip.supplier || '',
      notes: equip.notes || '',
      practitioner_id: equip.practitioner_id
        ? String(equip.practitioner_id)
        : '',
      tags: equip.tags || [],
    });
    setShowModal(true);
  };

  const handleDeleteEquipment = async equipmentId => {
    const success = await deleteItem(equipmentId);
    if (success) {
      cleanupFileCount(equipmentId);
      await refreshData();
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();

    const validationError = validateEquipmentForm(formData, currentPatient?.id);
    if (validationError) {
      setError(validationError);
      return;
    }

    // A save or upload is still running
    if (!canSubmit) {
      return;
    }

    startSubmission();

    const equipmentData = buildEquipmentPayload(formData, currentPatient.id);

    try {
      let success;
      let resultId;

      if (editingEquipment) {
        success = await updateItem(editingEquipment.id, equipmentData);
        resultId = editingEquipment.id;
      } else {
        const result = await createItem(equipmentData);
        success = !!result;
        resultId = result?.id;
      }
      if (success) {
        needsRefreshAfterSubmissionRef.current = true;
      }

      completeFormSubmission(success, resultId);

      if (success && resultId) {
        const hasPendingFiles = documentManagerMethods?.hasPendingFiles?.();

        if (hasPendingFiles) {
          const pendingCount = documentManagerMethods.getPendingFilesCount();

          logger.info('equipment_starting_file_upload', {
            message: 'Starting file upload process',
            equipmentId: resultId,
            pendingFilesCount: pendingCount,
            component: 'MedicalEquipment',
          });

          startFileUpload();

          try {
            await documentManagerMethods.uploadPendingFiles(resultId);
            completeFileUpload(true, pendingCount, 0);
          } catch (uploadError) {
            logger.error('equipment_file_upload_error', {
              message: 'File upload failed',
              equipmentId: resultId,
              error: uploadError.message,
              component: 'MedicalEquipment',
            });
            completeFileUpload(false, 0, pendingCount);
          }
          refreshFileCount(resultId);
        } else {
          completeFileUpload(true, 0, 0);
        }
      } else {
        handleSubmissionFailure(new Error('Form submission failed'), 'form');
      }
    } catch (error) {
      logger.error('equipment_submission_error', {
        message: 'Form submission failed',
        error: error.message,
        component: 'MedicalEquipment',
      });
      handleSubmissionFailure(error, 'form');
    }
  };

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const filteredEquipment = dataManagement.data;
  const paginatedEquipment = paginateData(filteredEquipment);

  useEffect(() => {
    resetPage();
  }, [dataManagement.hasActiveFilters, resetPage]);
  useEffect(() => {
    clampPage(filteredEquipment.length);
  }, [filteredEquipment.length, clampPage]);

  if (loading) {
    return (
      <MedicalPageLoading
        message={t('equipment.loading', 'Loading equipment...')}
        hint={t(
          'shared:labels.ifThisTakesTooLongPleaseRefreshThePage',
          'If this takes too long, please refresh the page'
        )}
      />
    );
  }

  return (
    <>
      <Container size="xl" py="sm">
        <PageHeader
          title={t('shared:categories.medical_equipment', 'Medical Equipment')}
          icon="🩺"
        />

        <Stack gap="sm" mt="md">
          <MedicalPageAlerts
            error={error}
            successMessage={successMessage}
            onClearError={clearError}
          />

          <MedicalPageActions
            primaryAction={{
              label: t('equipment.addEquipment', '+ Add Equipment'),
              onClick: handleAddEquipment,
              size: 'sm',
              disabled: isViewOnly,
              tooltip: viewOnlyTooltip,
            }}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            viewToggleSize="sm"
            mb={0}
          />

          {/* Search and Filter */}
          <MedicalPageFilters dataManagement={dataManagement} config={config} />

          {filteredEquipment.length === 0 ? (
            <EmptyState
              emoji="🩺"
              title={t('equipment.noEquipmentFound', 'No Equipment Found')}
              hasActiveFilters={dataManagement.hasActiveFilters}
              filteredMessage={t(
                'shared:emptyStates.adjustSearch',
                'Try adjusting your search or filter criteria.'
              )}
              noDataMessage={t(
                'equipment.startAdding',
                'Start by adding your first piece of medical equipment.'
              )}
              actionButton={
                <Button variant="filled" onClick={handleAddEquipment}>
                  {t('equipment.addFirstEquipment', 'Add Your First Equipment')}
                </Button>
              }
            />
          ) : viewMode === 'cards' ? (
            <AnimatedCardGrid
              items={paginatedEquipment}
              columns={{ base: 12, sm: 6, lg: 4 }}
              renderCard={equip => (
                <EquipmentCard
                  equipment={equip}
                  onEdit={handleEditEquipment}
                  onDelete={handleDeleteEquipment}
                  onView={handleViewEquipment}
                  fileCount={fileCounts[equip.id] || 0}
                  fileCountLoading={fileCountsLoading[equip.id] || false}
                  disableActions={isViewOnly}
                  disableActionsTooltip={viewOnlyTooltip}
                  onError={error => {
                    logger.error('EquipmentCard error', {
                      equipmentId: equip.id,
                      error: error.message,
                      page: 'MedicalEquipment',
                    });
                  }}
                />
              )}
            />
          ) : (
            <Paper shadow="sm" radius="md" withBorder>
              <ResponsiveTable
                data={paginatedEquipment}
                pagination={false}
                sortBy={dataManagement.sortBy}
                sortDirection={dataManagement.sortOrder}
                onSort={dataManagement.handleSortChange}
                disableEdit={isViewOnly}
                disableDelete={isViewOnly}
                disableActionsTooltip={viewOnlyTooltip}
                columns={[
                  {
                    header: t('shared:labels.equipmentName', 'Equipment Name'),
                    accessor: 'equipment_name',
                    priority: 'high',
                    width: 200,
                  },
                  {
                    header: t('equipment.form.type', 'Equipment Type'),
                    accessor: 'equipment_type',
                    priority: 'high',
                    width: 160,
                    // The mobile card layout ignores `formatters`, so it needs
                    // its own render to show the label instead of the raw value
                    render: formatters.equipment_type,
                  },
                  {
                    header: t('shared:fields.status', 'Status'),
                    accessor: 'status',
                    priority: 'high',
                    width: 100,
                  },
                  {
                    header: t('shared:fields.manufacturer', 'Manufacturer'),
                    accessor: 'manufacturer',
                    priority: 'medium',
                    width: 150,
                  },
                  {
                    header: t('equipment.fields.prescribedDate', 'Prescribed'),
                    accessor: 'prescribed_date',
                    priority: 'medium',
                    width: 120,
                  },
                  {
                    header: t('equipment.fields.nextService', 'Next Service'),
                    accessor: 'next_service_date',
                    priority: 'medium',
                    width: 120,
                  },
                  {
                    header: t('equipment.fields.modelNumber', 'Model'),
                    accessor: 'model_number',
                    priority: 'low',
                    width: 130,
                  },
                  {
                    header: t('equipment.fields.serialNumber', 'Serial #'),
                    accessor: 'serial_number',
                    priority: 'low',
                    width: 130,
                  },
                  {
                    header: t('shared:labels.supplier', 'Supplier'),
                    accessor: 'supplier',
                    priority: 'low',
                    width: 150,
                  },
                ]}
                patientData={currentPatient}
                tableName={t(
                  'shared:categories.medical_equipment',
                  'Medical Equipment'
                )}
                onView={handleViewEquipment}
                onEdit={handleEditEquipment}
                onDelete={handleDeleteEquipment}
                formatters={formatters}
                dataType="medical"
                responsive={responsive}
              />
            </Paper>
          )}
          {filteredEquipment.length > 0 && (
            <PaginationControls
              page={page}
              totalPages={totalPages(filteredEquipment.length)}
              pageSize={pageSize}
              totalRecords={filteredEquipment.length}
              onPageChange={setPage}
              onPageSizeChange={handlePageSizeChange}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          )}
        </Stack>
      </Container>

      <EquipmentFormWrapper
        isOpen={showModal}
        onClose={handleCloseForm}
        title={
          editingEquipment
            ? t('equipment.editEquipment', 'Edit Equipment')
            : t('equipment.addEquipment', 'Add Equipment')
        }
        editingEquipment={editingEquipment}
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        practitionersOptions={practitioners}
        practitionersLoading={false}
        isLoading={isBlocking}
        statusMessage={statusMessage}
        onDocumentManagerRef={setDocumentManagerMethods}
        onFileUploadComplete={success => {
          if (success && editingEquipment?.id) {
            refreshFileCount(editingEquipment.id);
          }
        }}
      />

      <EquipmentViewModal
        isOpen={showViewModal}
        onClose={handleCloseViewModal}
        equipment={viewingEquipment}
        onEdit={handleEditEquipment}
        practitioners={practitioners}
        disableEdit={isViewOnly}
        disableEditTooltip={viewOnlyTooltip}
      />
    </>
  );
};

export default withResponsive(MedicalEquipment, {
  injectResponsive: true,
  displayName: 'ResponsiveMedicalEquipment',
});
