import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { useEntityFileCounts } from '../../hooks/useEntityFileCounts';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { usePractitioners } from '../../hooks/useGlobalData';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { getEntityFormatters } from '../../utils/tableFormatters';
import { navigateToEntity } from '../../utils/linkNavigation';
import { PageHeader } from '../../components';
import { withResponsive } from '../../hoc/withResponsive';
import { useResponsive } from '../../hooks/useResponsive';
import logger from '../../services/logger';
import { notifications } from '@mantine/notifications';
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  getUserFriendlyError
} from '../../constants/errorMessages';
import MantineFilters from '../../components/mantine/MantineFilters';
import { ResponsiveTable } from '../../components/adapters';
import ViewToggle from '../../components/shared/ViewToggle';
import FormLoadingOverlay from '../../components/shared/FormLoadingOverlay';
import ProcedureCard from '../../components/medical/procedures/ProcedureCard';
import ProcedureViewModal from '../../components/medical/procedures/ProcedureViewModal';
import ProcedureFormWrapper from '../../components/medical/procedures/ProcedureFormWrapper';
import { useFormSubmissionWithUploads } from '../../hooks/useFormSubmissionWithUploads';
import {
  Button,
  Group,
  Stack,
  Text,
  Grid,
  Container,
  Alert,
  Loader,
  Center,
  Card,
  Paper,
} from '@mantine/core';

const Procedures = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const location = useLocation();
  const responsive = useResponsive();
  const [viewMode, setViewMode] = useState('cards');

  // Get practitioners data
  const { practitioners } = usePractitioners();

  // Get standardized formatters for procedures with linking support
  const formatters = getEntityFormatters('procedures', practitioners, navigate);

  // Modern data management with useMedicalData
  const {
    items: procedures,
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
    entityName: 'procedure',
    apiMethodsConfig: {
      getAll: signal => apiService.getProcedures(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientProcedures(patientId, signal),
      create: (data, signal) => apiService.createProcedure(data, signal),
      update: (id, data, signal) =>
        apiService.updateProcedure(id, data, signal),
      delete: (id, signal) => apiService.deleteProcedure(id, signal),
    },
    requiresPatient: true,
  });

  // Get standardized configuration
  const config = getMedicalPageConfig('procedures');

  // Use standardized data management
  const dataManagement = useDataManagement(procedures, config);

  // File count management for cards
  const { fileCounts, fileCountsLoading, cleanupFileCount, refreshFileCount } = useEntityFileCounts('procedure', procedures);

  // Form state
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingProcedure, setViewingProcedure] = useState(null);
  const [editingProcedure, setEditingProcedure] = useState(null);
  const [formData, setFormData] = useState({
    procedure_name: '',
    procedure_type: '',
    procedure_code: '',
    description: '',
    procedure_date: '',
    status: 'scheduled',
    notes: '',
    facility: '',
    procedure_setting: '',
    procedure_complications: '',
    procedure_duration: '',
    practitioner_id: '',
    anesthesia_type: '',
    anesthesia_notes: '',
    tags: [],
  });

  // Document management state
  const [documentManagerMethods, setDocumentManagerMethods] = useState(null);
  const [viewDocumentManagerMethods, setViewDocumentManagerMethods] = useState(null);

  // Track if we need to refresh after form submission (but not after uploads)
  const needsRefreshAfterSubmissionRef = useRef(false);

  // Form submission with uploads hook
  const {
    submissionState,
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
    entityType: 'procedure',
    onSuccess: () => {
      // Reset form and close modal on complete success
      setShowModal(false);
      setEditingProcedure(null);
      setFormData({
        procedure_name: '',
        procedure_type: '',
        procedure_code: '',
        description: '',
        procedure_date: '',
        status: 'scheduled',
        notes: '',
        facility: '',
        procedure_setting: '',
        procedure_complications: '',
        procedure_duration: '',
        practitioner_id: '',
        anesthesia_type: '',
        anesthesia_notes: '',
        tags: [],
      });
      
      // Only refresh if we created a new procedure during form submission
      // Don't refresh after uploads complete to prevent resource exhaustion
      if (needsRefreshAfterSubmissionRef.current) {
        needsRefreshAfterSubmissionRef.current = false;
        refreshData();
      }
    },
    onError: (error) => {
      logger.error('procedures_form_error', {
        message: 'Form submission error in procedures',
        error,
        component: 'Procedures',
      });
    },
    component: 'Procedures',
  });

  const handleAddProcedure = () => {
    resetSubmission();
    setEditingProcedure(null);
    setFormData({
      procedure_name: '',
      procedure_type: '',
      procedure_code: '',
      description: '',
      procedure_date: '',
      status: 'scheduled',
      notes: '',
      facility: '',
      procedure_setting: '',
      procedure_complications: '',
      procedure_duration: '',
      practitioner_id: '',
      anesthesia_type: '',
      anesthesia_notes: '',
      tags: [],
    });
    setShowModal(true);
  };

  const handleViewProcedure = procedure => {
    setViewingProcedure(procedure);
    setShowViewModal(true);
    // Update URL with procedure ID for sharing/bookmarking
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', procedure.id);
    navigate(`${location.pathname}?${searchParams.toString()}`, {
      replace: true,
    });
  };

  const handleCloseViewModal = () => {
    // Refresh file count for the viewed procedure before closing
    if (viewingProcedure) {
      refreshFileCount(viewingProcedure.id);
    }
    
    setShowViewModal(false);
    setViewingProcedure(null);
    // Remove view parameter from URL
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete('view');
    const newSearch = searchParams.toString();
    navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, {
      replace: true,
    });
  };

  const handleEditProcedure = procedure => {
    resetSubmission();
    setEditingProcedure(procedure);
    setFormData({
      procedure_name: procedure.procedure_name || '',
      procedure_type: procedure.procedure_type || '',
      procedure_code: procedure.procedure_code || '',
      description: procedure.description || '',
      procedure_date: procedure.date || '',
      status: procedure.status || 'scheduled',
      notes: procedure.notes || '',
      facility: procedure.facility || '',
      procedure_setting: procedure.procedure_setting || '',
      procedure_complications: procedure.procedure_complications || '',
      procedure_duration: procedure.procedure_duration || '',
      practitioner_id: procedure.practitioner_id ? String(procedure.practitioner_id) : '',
      anesthesia_type: procedure.anesthesia_type || '',
      anesthesia_notes: procedure.anesthesia_notes || '',
      tags: procedure.tags || [],
    });
    setShowModal(true);
  };

  // Handle URL parameters for direct linking to specific procedures
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const viewId = searchParams.get('view');

    if (viewId && procedures.length > 0 && !loading) {
      const procedure = procedures.find(p => p.id.toString() === viewId);
      if (procedure && !showViewModal) {
        // Only auto-open if modal isn't already open
        setViewingProcedure(procedure);
        setShowViewModal(true);
      }
    }
  }, [location.search, procedures, loading, showViewModal]);


  const handleDeleteProcedure = async procedureId => {
    const success = await deleteItem(procedureId);
    if (success) {
      cleanupFileCount(procedureId);
    }
  };

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();

    // Basic validation
    if (!formData.procedure_name.trim()) {
      setError(ERROR_MESSAGES.REQUIRED_FIELD_MISSING);
      return;
    }

    if (!formData.procedure_date) {
      setError(ERROR_MESSAGES.INVALID_DATE);
      return;
    }

    if (!currentPatient?.id) {
      setError(ERROR_MESSAGES.PATIENT_NOT_SELECTED);
      return;
    }

    // Start submission process
    startSubmission();

    // Prevent double submission - check after startSubmission() to avoid race condition
    if (!canSubmit) {
      return;
    }

    const procedureData = {
      procedure_name: formData.procedure_name,
      procedure_type: formData.procedure_type || null,
      procedure_code: formData.procedure_code || null,
      description: formData.description,
      date: formData.procedure_date || null,
      status: formData.status,
      notes: formData.notes || null,
      facility: formData.facility || null,
      procedure_setting: formData.procedure_setting || null,
      procedure_complications: formData.procedure_complications || null,
      procedure_duration: formData.procedure_duration
        ? parseInt(formData.procedure_duration)
        : null,
      practitioner_id: formData.practitioner_id
        ? parseInt(formData.practitioner_id)
        : null,
      anesthesia_type: formData.anesthesia_type || null,
      anesthesia_notes: formData.anesthesia_notes || null,
      tags: formData.tags || [],
      patient_id: currentPatient.id,
    };

    try {
      let success;
      let resultId;

      // Submit form data
      if (editingProcedure) {
        success = await updateItem(editingProcedure.id, procedureData);
        resultId = editingProcedure.id;
        // No refresh needed for updates - user stays on same page
      } else {
        const result = await createItem(procedureData);
        success = !!result;
        resultId = result?.id;
        // Set flag to refresh after new procedure creation (but only after form submission, not uploads)
        if (success) {
          needsRefreshAfterSubmissionRef.current = true;
        }
      }

      // Complete form submission
      completeFormSubmission(success, resultId);

      if (success && resultId) {
        // Check if we have files to upload
        const hasPendingFiles = documentManagerMethods?.hasPendingFiles?.();
        
        if (hasPendingFiles) {
          logger.info('procedures_starting_file_upload', {
            message: 'Starting file upload process',
            procedureId: resultId,
            pendingFilesCount: documentManagerMethods.getPendingFilesCount(),
            component: 'Procedures',
          });

          // Start file upload process
          startFileUpload();

          try {
            // Upload files with progress tracking
            await documentManagerMethods.uploadPendingFiles(resultId);
            
            // File upload completed successfully
            completeFileUpload(true, documentManagerMethods.getPendingFilesCount(), 0);
            
            // Refresh file count
            refreshFileCount(resultId);
          } catch (uploadError) {
            logger.error('procedures_file_upload_error', {
              message: 'File upload failed',
              procedureId: resultId,
              error: uploadError.message,
              component: 'Procedures',
            });
            
            // File upload failed
            completeFileUpload(false, 0, documentManagerMethods.getPendingFilesCount());
          }
        } else {
          // No files to upload, complete immediately
          completeFileUpload(true, 0, 0);
        }
      } else {
        handleSubmissionFailure(new Error(ERROR_MESSAGES.FORM_SUBMISSION_FAILED), 'form');
      }
    } catch (error) {
      logger.error('procedures_submission_error', {
        message: 'Form submission failed',
        error: error.message,
        component: 'Procedures',
      });
      
      handleSubmissionFailure(error, 'form');
    }
  };

  // Get processed data from data management
  const filteredProcedures = dataManagement.data;

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Center h={200}>
          <Stack align="center">
            <Loader size="lg" />
            <Text>{t('procedures.loadingProcedures', 'Loading procedures...')}</Text>
            <Text size="sm" c="dimmed">
              {t('procedures.loadingRefresh', 'If this takes too long, please refresh the page')}
            </Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <>
      <Container size="xl" py="md">
        <PageHeader title={t('procedures.title', 'Procedures')} icon="🔬" />

        <Stack gap="lg">
          {error && (
            <Alert
              variant="light"
              color="red"
              title={t('procedures.error', 'Error')}
              withCloseButton
              onClose={clearError}
              style={{ whiteSpace: 'pre-line' }}
            >
              {error}
            </Alert>
          )}
          {successMessage && (
            <Alert variant="light" color="green" title={t('procedures.success', 'Success')}>
              {successMessage}
            </Alert>
          )}

          <Group justify="space-between" align="center">
            <Button variant="filled" onClick={handleAddProcedure}>
              {t('procedures.addProcedure', '+ Add Procedure')}
            </Button>

            <ViewToggle
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              showPrint={true}
            />
          </Group>

          {/* Mantine Filter Controls */}
          <MantineFilters
            filters={dataManagement.filters}
            updateFilter={dataManagement.updateFilter}
            clearFilters={dataManagement.clearFilters}
            hasActiveFilters={dataManagement.hasActiveFilters}
            statusOptions={dataManagement.statusOptions}
            dateRangeOptions={dataManagement.dateRangeOptions}
            sortOptions={dataManagement.sortOptions}
            sortBy={dataManagement.sortBy}
            sortOrder={dataManagement.sortOrder}
            handleSortChange={dataManagement.handleSortChange}
            totalCount={dataManagement.totalCount}
            filteredCount={dataManagement.filteredCount}
            config={config.filterControls}
          />

          {filteredProcedures.length === 0 ? (
            <Card withBorder p="xl">
              <Stack align="center" gap="md">
                <Text size="3rem">🔬</Text>
                <Text size="xl" fw={600}>
                  {t('procedures.noProceduresFound', 'No Procedures Found')}
                </Text>
                <Text ta="center" c="dimmed">
                  {dataManagement.hasActiveFilters
                    ? t('procedures.tryAdjustingFilters', 'Try adjusting your search or filter criteria.')
                    : t('procedures.startAdding', 'Start by adding your first procedure.')}
                </Text>
                {!dataManagement.hasActiveFilters && (
                  <Button variant="filled" onClick={handleAddProcedure}>
                    {t('procedures.addFirstProcedure', 'Add Your First Procedure')}
                  </Button>
                )}
              </Stack>
            </Card>
          ) : viewMode === 'cards' ? (
            <Grid>
              {filteredProcedures.map((procedure) => (
                <Grid.Col key={procedure.id} span={{ base: 12, sm: 6, lg: 4 }}>
                  <ProcedureCard
                    procedure={procedure}
                    onEdit={handleEditProcedure}
                    onDelete={() => handleDeleteProcedure(procedure.id)}
                    onView={handleViewProcedure}
                    practitioners={practitioners}
                    fileCount={fileCounts[procedure.id] || 0}
                    fileCountLoading={fileCountsLoading[procedure.id] || false}
                    navigate={navigate}
                  />
                </Grid.Col>
              ))}
            </Grid>
          ) : (
            <Paper shadow="sm" radius="md" withBorder>
              <ResponsiveTable
                data={filteredProcedures}
                columns={[
                  { header: t('procedures.table.procedureName'), accessor: 'procedure_name', priority: 'high', width: 200 },
                  { header: t('procedures.table.type'), accessor: 'procedure_type', priority: 'medium', width: 120 },
                  { header: t('procedures.table.code'), accessor: 'procedure_code', priority: 'low', width: 100 },
                  { header: t('procedures.table.date'), accessor: 'date', priority: 'high', width: 120 },
                  { header: t('procedures.table.status'), accessor: 'status', priority: 'high', width: 100 },
                  { header: t('procedures.table.setting'), accessor: 'procedure_setting', priority: 'low', width: 120 },
                  { header: t('procedures.table.facility'), accessor: 'facility', priority: 'medium', width: 150 },
                  { header: t('procedures.table.practitioner'), accessor: 'practitioner_name', priority: 'medium', width: 150 },
                  { header: t('procedures.table.description'), accessor: 'description', priority: 'low', width: 200 },
                ]}
                patientData={currentPatient}
                tableName="Procedures"
                onView={handleViewProcedure}
                onEdit={handleEditProcedure}
                onDelete={handleDeleteProcedure}
                formatters={formatters}
                dataType="medical"
                responsive={responsive}
              />
            </Paper>
          )}
        </Stack>
      </Container>

      <ProcedureFormWrapper
        isOpen={showModal}
        onClose={() => !isBlocking && setShowModal(false)}
        title={editingProcedure ? t('procedures.editProcedure', 'Edit Procedure') : t('procedures.addNewProcedure', 'Add New Procedure')}
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        editingItem={editingProcedure}
        practitioners={practitioners}
        isLoading={isBlocking}
        statusMessage={statusMessage}
        onDocumentManagerRef={setDocumentManagerMethods}
        onFileUploadComplete={(success, completedCount, failedCount) => {
          if (success && editingProcedure?.id) {
            refreshFileCount(editingProcedure.id);
          }
        }}
      >
        {/* Form Loading Overlay */}
        <FormLoadingOverlay
          visible={isBlocking}
          message={statusMessage?.title || t('procedures.processing', 'Processing...')}
          submessage={statusMessage?.message}
          type={statusMessage?.type || 'loading'}
        />
      </ProcedureFormWrapper>

      <ProcedureViewModal
        isOpen={showViewModal}
        onClose={handleCloseViewModal}
        procedure={viewingProcedure}
        onEdit={handleEditProcedure}
        practitioners={practitioners}
        navigate={navigate}
        onFileUploadComplete={(success) => {
          if (success && viewingProcedure) {
            refreshFileCount(viewingProcedure.id);
          }
        }}
      />
    </>
  );
};

// Wrap with responsive HOC for enhanced responsive capabilities
export default withResponsive(Procedures, {
  injectResponsive: true,
  displayName: 'ResponsiveProcedures'
});
