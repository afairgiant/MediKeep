import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { useEntityFileCounts } from '../../hooks/useEntityFileCounts';
import { useViewModalNavigation } from '../../hooks/useViewModalNavigation';
import { apiService } from '../../services/api';
import { useDateFormat } from '../../hooks/useDateFormat';
import { usePractitioners } from '../../hooks/useGlobalData';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { getEntityFormatters } from '../../utils/tableFormatters';
import { PageHeader } from '../../components';
import { withResponsive } from '../../hoc/withResponsive';
import { useResponsive } from '../../hooks/useResponsive';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import { usePagination } from '../../hooks/usePagination';
import logger from '../../services/logger';
import {
  ERROR_MESSAGES,
} from '../../constants/errorMessages';
import { ResponsiveTable } from '../../components/adapters';
import MedicalPageActions from '../../components/shared/MedicalPageActions';
import MedicalPageFilters from '../../components/shared/MedicalPageFilters';
import FileCountBadge from '../../components/shared/FileCountBadge';
import FormLoadingOverlay from '../../components/shared/FormLoadingOverlay';
import EmptyState from '../../components/shared/EmptyState';
import MedicalPageAlerts from '../../components/shared/MedicalPageAlerts';
import MedicalPageLoading from '../../components/shared/MedicalPageLoading';
import AnimatedCardGrid from '../../components/shared/AnimatedCardGrid';
import PaginationControls from '../../components/shared/PaginationControls';
import LabResultCard from '../../components/medical/labresults/LabResultCard';
import LabResultViewModal from '../../components/medical/labresults/LabResultViewModal';
import LabResultFormWrapper from '../../components/medical/labresults/LabResultFormWrapper';
import LabResultQuickImportModal from '../../components/medical/labresults/LabResultQuickImportModal';
import TestComponentCatalog from '../../components/medical/labresults/TestComponentCatalog';
import { notifications } from '@mantine/notifications';
import { labTestComponentApi } from '../../services/api/labTestComponentApi';
import { sanitizeComponentForApi } from '../../utils/labTestComponentUtils';
import { useFormSubmissionWithUploads } from '../../hooks/useFormSubmissionWithUploads';
import { Button, Container, Stack, Paper } from '@mantine/core';
import { IconFileUpload } from '@tabler/icons-react';
import { usePatientPermissions } from '../../hooks/usePatientPermissions';

const LabResults = () => {
  const { t } = useTranslation(['common', 'shared']);
  const { isViewOnly, viewOnlyTooltip } = usePatientPermissions();
  const { formatDate } = useDateFormat();
  const navigate = useNavigate();
  const location = useLocation();
  const responsive = useResponsive();
  const [viewMode, setViewMode] = usePersistedViewMode('lab-results');
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

  // Modern data management with useMedicalData
  const {
    items: labResults,
    currentPatient,
    loading: labResultsLoading,
    error,
    successMessage,
    createItem,
    updateItem,
    deleteItem,
    refreshData,
    clearError,
    setError,
  } = useMedicalData({
    entityName: 'lab-result',
    apiMethodsConfig: {
      getAll: signal => apiService.getLabResults(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientLabResults(patientId, signal),
      create: (data, signal) => apiService.createLabResult(data, signal),
      update: (id, data, signal) =>
        apiService.updateLabResult(id, data, signal),
      delete: (id, signal) => apiService.deleteLabResult(id, signal),
    },
    requiresPatient: true,
  });

  // Get practitioners data
  const { practitioners, loading: practitionersLoading } = usePractitioners();

  // File count management for cards
  const { fileCounts, fileCountsLoading, cleanupFileCount, refreshFileCount } =
    useEntityFileCounts('lab-result', labResults);

  // Track if we need to refresh after form submission (but not after uploads)
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
    entityType: 'lab-result',
    onSuccess: () => {
      // Reset form and close modal on complete success
      setShowModal(false);
      setEditingLabResult(null);
      setFormData({
        test_name: '',
        test_code: '',
        test_category: '',
        test_type: '',
        facility: '',
        status: 'ordered',
        labs_result: '',
        ordered_date: '',
        completed_date: '',
        notes: '',
        practitioner_id: '',
      });

      // Only refresh if we created a new lab result during form submission
      // Don't refresh after uploads complete to prevent resource exhaustion
      if (needsRefreshAfterSubmissionRef.current) {
        needsRefreshAfterSubmissionRef.current = false;
        refreshData();
      }
    },
    onError: error => {
      logger.error('lab_results_form_error', {
        message: 'Form submission error in lab results',
        error,
        component: 'LabResults',
      });
    },
    component: 'LabResults',
  });

  // Get standardized configuration
  const config = getMedicalPageConfig('labresults');

  // Get standardized formatters for lab results
  const formatters = getEntityFormatters(
    'lab_results',
    practitioners,
    null,
    null,
    formatDate
  );

  // Use standardized data management
  const dataManagement = useDataManagement(labResults || [], config);

  // Get patient conditions for linking
  const [conditions, setConditions] = useState([]);
  const [labResultConditions, setLabResultConditions] = useState({});

  // Encounters for lab result-encounter linking
  const [patientEncounters, setPatientEncounters] = useState([]);
  const [labResultEncounters, setLabResultEncounters] = useState({});

  useEffect(() => {
    if (currentPatient?.id) {
      apiService
        .getPatientConditions(currentPatient.id)
        .then(response => {
          setConditions(response || []);
        })
        .catch(err => {
          logger.error('medical_conditions_fetch_error', {
            message: 'Failed to fetch conditions for lab results',
            patientId: currentPatient.id,
            error: err.message,
            component: 'LabResults',
          });
          setConditions([]);
        });

      apiService
        .getPatientEncounters(currentPatient.id)
        .then(response => {
          setPatientEncounters(response || []);
        })
        .catch(err => {
          logger.error('medical_encounters_fetch_error', {
            message: 'Failed to fetch encounters for lab results',
            patientId: currentPatient.id,
            error: err.message,
            component: 'LabResults',
          });
          setPatientEncounters([]);
        });
    }
  }, [currentPatient?.id]);

  // Helper function to fetch condition relationships for a lab result
  const fetchLabResultConditions = async labResultId => {
    try {
      const relationships =
        await apiService.getLabResultConditions(labResultId);
      setLabResultConditions(prev => ({
        ...prev,
        [labResultId]: relationships || [],
      }));
      return relationships || [];
    } catch (err) {
      logger.error('medical_conditions_fetch_error', {
        message: 'Failed to fetch lab result conditions',
        labResultId,
        error: err.message,
        component: 'LabResults',
      });
      return [];
    }
  };

  // Helper function to fetch encounter relationships for a lab result
  const fetchLabResultEncounters = async labResultId => {
    try {
      const relationships =
        await apiService.getLabResultEncounters(labResultId);
      setLabResultEncounters(prev => ({
        ...prev,
        [labResultId]: relationships || [],
      }));
      return relationships || [];
    } catch (err) {
      logger.error('medical_encounters_fetch_error', {
        message: 'Failed to fetch lab result encounters',
        labResultId,
        error: err.message,
        component: 'LabResults',
      });
      return [];
    }
  };

  // Get processed data from data management
  const filteredLabResults = dataManagement.data;
  const paginatedLabResults = paginateData(filteredLabResults);

  useEffect(() => {
    resetPage();
  }, [dataManagement.hasActiveFilters, resetPage]);
  useEffect(() => {
    clampPage(filteredLabResults.length);
  }, [filteredLabResults.length, clampPage]);

  // Combined loading state
  const loading = labResultsLoading || practitionersLoading;

  // Document management state
  const [documentManagerMethods, setDocumentManagerMethods] = useState(null);

  // Test component inline entry state (create mode only)
  const [testComponentMethods, setTestComponentMethods] = useState(null);

  // Pending relationships state (create mode only)
  const [pendingRelationshipsMethods, setPendingRelationshipsMethods] =
    useState(null);

  // View modal navigation with URL deep linking
  const {
    isOpen: showViewModal,
    viewingItem: viewingLabResult,
    openModal: handleViewLabResult,
    closeModal: handleCloseViewModal,
    setViewingItem: setViewingLabResult,
    setIsOpen: setShowViewModal,
  } = useViewModalNavigation({
    items: labResults,
    loading,
    onClose: labResult => {
      if (labResult) {
        refreshFileCount(labResult.id);
      }
    },
  });

  // Form and modal state
  const [showModal, setShowModal] = useState(false);
  const [showQuickImportModal, setShowQuickImportModal] = useState(false);
  const [initialViewTab, setInitialViewTab] = useState('overview');
  const [editingLabResult, setEditingLabResult] = useState(null);
  const [formData, setFormData] = useState({
    test_name: '',
    test_code: '',
    test_category: '',
    test_type: '',
    facility: '',
    status: 'ordered',
    labs_result: '',
    ordered_date: '',
    completed_date: '',
    notes: '',
    practitioner_id: '',
  });

  // Modern CRUD handlers using useMedicalData - memoized to prevent LabResultCard re-renders
  const handleAddLabResult = useCallback(() => {
    resetSubmission(); // Reset submission state
    setEditingLabResult(null);
    setDocumentManagerMethods(null); // Reset document manager methods
    setTestComponentMethods(null); // Reset test component methods
    setPendingRelationshipsMethods(null); // Reset pending relationships
    setFormData({
      test_name: '',
      test_code: '',
      test_category: '',
      test_type: '',
      facility: '',
      status: 'ordered',
      labs_result: '',
      ordered_date: '',
      completed_date: '',
      notes: '',
      practitioner_id: '',
      tags: [],
    });
    setShowModal(true);
  }, [resetSubmission]);

  const handleEditLabResult = useCallback(
    async labResult => {
      resetSubmission(); // Reset submission state to prevent modal flash
      setEditingLabResult(labResult);
      setFormData({
        test_name: labResult.test_name || '',
        test_code: labResult.test_code || '',
        test_category: labResult.test_category || '',
        test_type: labResult.test_type || '',
        facility: labResult.facility || '',
        status: labResult.status || 'ordered',
        labs_result: labResult.labs_result || '',
        ordered_date: labResult.ordered_date || '',
        completed_date: labResult.completed_date || '',
        notes: labResult.notes || '',
        practitioner_id: labResult.practitioner_id
          ? String(labResult.practitioner_id)
          : '',
        tags: labResult.tags || [],
      });

      setShowModal(true);
    },
    [resetSubmission]
  );

  const handleLabResultUpdated = useCallback(async () => {
    // If modal is open, fetch the updated lab result directly
    if (viewingLabResult) {
      try {
        const updatedLabResult = await apiService.getLabResult(
          viewingLabResult.id
        );
        if (updatedLabResult) {
          setViewingLabResult(updatedLabResult);
          logger.info('lab_result_updated_in_modal', {
            message: 'Lab result refreshed in view modal',
            labResultId: viewingLabResult.id,
            completedDate: updatedLabResult.completed_date,
            component: 'LabResults',
          });
        }
      } catch (error) {
        logger.error('lab_result_refresh_error', {
          message: 'Failed to refresh lab result in modal',
          labResultId: viewingLabResult.id,
          error: error.message,
          component: 'LabResults',
        });
      }
    }

    // Refresh the lab results list
    await refreshData();
  }, [viewingLabResult, refreshData, setViewingLabResult]);

  const handleQuickImportSuccess = useCallback(
    async labResultId => {
      setShowQuickImportModal(false);

      // Refresh lab results list
      await refreshData();

      // Fetch the specific lab result directly to avoid race condition with stale state
      try {
        const labResult = await apiService.getLabResult(labResultId);

        if (labResult) {
          // Open the view modal with Test Components tab active
          setViewingLabResult(labResult);
          setInitialViewTab('test-components');
          setShowViewModal(true);

          // Update URL with lab result ID
          const searchParams = new URLSearchParams(location.search);
          searchParams.set('view', labResult.id);
          navigate(`${location.pathname}?${searchParams.toString()}`, {
            replace: true,
          });

          logger.info('quick_import_completed', {
            message: 'Quick PDF import completed successfully',
            labResultId,
            component: 'LabResults',
          });
        }
      } catch (error) {
        logger.error('quick_import_fetch_failed', {
          message: 'Failed to fetch newly created lab result',
          labResultId,
          error: error.message,
          component: 'LabResults',
        });
      }
    },
    [
      refreshData,
      navigate,
      location.pathname,
      location.search,
      setViewingLabResult,
      setShowViewModal,
    ]
  );

  const handleDeleteLabResult = useCallback(
    async labResultId => {
      const success = await deleteItem(labResultId);
      if (success) {
        cleanupFileCount(labResultId);
      }
    },
    [deleteItem, cleanupFileCount]
  );

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();

      // Basic validation first
      if (!formData.test_name.trim()) {
        setError(ERROR_MESSAGES.REQUIRED_FIELD_MISSING);
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

      const labResultData = {
        ...formData,
        patient_id: currentPatient.id,
        practitioner_id: formData.practitioner_id
          ? parseInt(formData.practitioner_id)
          : null,
        ordered_date: formData.ordered_date || null,
        completed_date: formData.completed_date || null,
      };

      try {
        let success;
        let resultId;

        // Submit form data
        if (editingLabResult) {
          success = await updateItem(editingLabResult.id, labResultData);
          resultId = editingLabResult.id;
          // No refresh needed for updates - user stays on same page
        } else {
          const result = await createItem(labResultData);
          success = !!result;
          resultId = result?.id;
          // Set flag to refresh after new lab result creation (but only after form submission, not uploads)
          if (success) {
            needsRefreshAfterSubmissionRef.current = true;
          }
        }

        // Complete form submission
        completeFormSubmission(success, resultId);

        if (success && resultId) {
          // Submit inline test components (create mode only)
          if (
            !editingLabResult &&
            testComponentMethods?.hasPendingComponents?.()
          ) {
            try {
              const pendingComponents =
                testComponentMethods.getPendingComponents();
              const componentsToCreate = pendingComponents.map(c =>
                sanitizeComponentForApi(c, resultId)
              );
              await labTestComponentApi.createBulkForLabResult(
                resultId,
                componentsToCreate
              );
              logger.info('inline_test_components_created', {
                message: 'Inline test components created with lab result',
                labResultId: resultId,
                componentCount: componentsToCreate.length,
                component: 'LabResults',
              });
            } catch (componentError) {
              logger.error('inline_test_components_error', {
                message: 'Failed to create inline test components',
                labResultId: resultId,
                error: componentError?.message || String(componentError),
                stack: componentError?.stack,
                component: 'LabResults',
              });
              notifications.show({
                title: t('common:warning', 'Warning'),
                message: t(
                  'medical:labResults.form.componentCreationWarning',
                  'Lab result saved but test components could not be added. You can add them from the view page.'
                ),
                color: 'yellow',
                autoClose: 8000,
              });
            }
          }

          // Submit pending relationships (create mode only)
          if (
            !editingLabResult &&
            pendingRelationshipsMethods?.hasPendingRelationships?.()
          ) {
            try {
              const pending =
                pendingRelationshipsMethods.getPendingRelationships();

              const conditionPromises = pending.conditions.map(condRel =>
                apiService.createLabResultCondition(resultId, {
                  lab_result_id: resultId,
                  condition_id: condRel.condition_id,
                  relevance_note: condRel.relevance_note,
                })
              );

              const encounterPromises = pending.encounters.map(encRel =>
                apiService.createLabResultEncounter(resultId, {
                  encounter_id: encRel.encounter_id,
                  purpose: encRel.purpose,
                  relevance_note: encRel.relevance_note,
                })
              );

              await Promise.all([...conditionPromises, ...encounterPromises]);

              logger.info('pending_relationships_created', {
                message: 'Pending relationships created with lab result',
                labResultId: resultId,
                conditionCount: pending.conditions.length,
                encounterCount: pending.encounters.length,
                component: 'LabResults',
              });
            } catch (relError) {
              logger.error('pending_relationships_error', {
                message: 'Failed to create pending relationships',
                labResultId: resultId,
                error: relError?.message || String(relError),
                component: 'LabResults',
              });
              notifications.show({
                title: t('common:warning', 'Warning'),
                message: t(
                  'medical:labResults.form.relationshipCreationWarning',
                  'Lab result saved but some relationships could not be created. You can add them from the edit page.'
                ),
                color: 'yellow',
                autoClose: 8000,
              });
            }
          }

          // Check if we have files to upload
          const hasPendingFiles = documentManagerMethods?.hasPendingFiles?.();

          if (hasPendingFiles) {
            logger.info('lab_results_starting_file_upload', {
              message: 'Starting file upload process',
              labResultId: resultId,
              pendingFilesCount: documentManagerMethods.getPendingFilesCount(),
              component: 'LabResults',
            });

            // Start file upload process
            startFileUpload();

            try {
              // Upload files with progress tracking
              await documentManagerMethods.uploadPendingFiles(resultId);

              // File upload completed successfully
              completeFileUpload(
                true,
                documentManagerMethods.getPendingFilesCount(),
                0
              );

              // Refresh file count
              refreshFileCount(resultId);
            } catch (uploadError) {
              logger.error('lab_results_file_upload_error', {
                message: 'File upload failed',
                labResultId: resultId,
                error: uploadError.message,
                component: 'LabResults',
              });

              // File upload failed
              completeFileUpload(
                false,
                0,
                documentManagerMethods.getPendingFilesCount()
              );
            }
          } else {
            // No files to upload, complete immediately
            completeFileUpload(true, 0, 0);
          }
        }
      } catch (error) {
        handleSubmissionFailure(error, 'form');
      }
    },
    [
      formData,
      currentPatient,
      canSubmit,
      editingLabResult,
      updateItem,
      createItem,
      documentManagerMethods,
      testComponentMethods,
      pendingRelationshipsMethods,
      startSubmission,
      setError,
      completeFormSubmission,
      startFileUpload,
      completeFileUpload,
      handleSubmissionFailure,
      refreshFileCount,
      t,
    ]
  );

  const handleInputChange = useCallback(e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleCloseModal = useCallback(() => {
    // Prevent closing during upload
    if (isBlocking) {
      return;
    }

    resetSubmission(); // Reset submission state
    setShowModal(false);
    setEditingLabResult(null);
    setDocumentManagerMethods(null); // Reset document manager methods
    setTestComponentMethods(null); // Reset test component methods
    setPendingRelationshipsMethods(null); // Reset pending relationships
    setFormData({
      test_name: '',
      test_code: '',
      test_category: '',
      test_type: '',
      facility: '',
      status: 'ordered',
      labs_result: '',
      ordered_date: '',
      completed_date: '',
      notes: '',
      practitioner_id: '',
    });
  }, [isBlocking, resetSubmission]);

  const renderViewContent = () => {
    if (viewMode === 'components') {
      return currentPatient?.id ? (
        <TestComponentCatalog patientId={currentPatient.id} />
      ) : null;
    }

    if (filteredLabResults.length === 0) {
      return (
        <EmptyState
          emoji="🧪"
          title={t('labresults:noResults', 'No Lab Results Found')}
          hasActiveFilters={dataManagement.hasActiveFilters}
          filteredMessage={t(
            'shared:emptyStates.adjustSearch',
            'Try adjusting your search or filter criteria.'
          )}
          noDataMessage={t(
            'labresults:startAdding',
            'Start by adding your first lab result.'
          )}
          actionButton={
            <Button variant="filled" onClick={handleAddLabResult}>
              {t('labresults:addFirst', 'Add Your First Lab Result')}
            </Button>
          }
        />
      );
    }

    if (viewMode === 'cards') {
      return (
        <AnimatedCardGrid
          items={paginatedLabResults}
          columns={{ base: 12, sm: 6, lg: 4 }}
          renderCard={result => (
            <LabResultCard
              labResult={result}
              onEdit={handleEditLabResult}
              onDelete={() => handleDeleteLabResult(result.id)}
              onView={handleViewLabResult}
              practitioners={practitioners}
              fileCount={fileCounts[result.id] || 0}
              fileCountLoading={fileCountsLoading[result.id] || false}
              navigate={navigate}
              disableActions={isViewOnly}
              disableActionsTooltip={viewOnlyTooltip}
            />
          )}
        />
      );
    }

    return (
      <Paper shadow="sm" radius="md" withBorder>
        <ResponsiveTable
          persistKey="lab-results"
          data={paginatedLabResults}
          pagination={false}
          disableEdit={isViewOnly}
          disableDelete={isViewOnly}
          disableActionsTooltip={viewOnlyTooltip}
          columns={[
            {
              header: t('shared:fields.testName', 'Test Name'),
              accessor: 'test_name',
              priority: 'high',
              width: 200,
            },
            {
              header: t('shared:labels.category', 'Category'),
              accessor: 'test_category',
              priority: 'low',
              width: 150,
            },
            {
              header: t('shared:labels.type', 'Type'),
              accessor: 'test_type',
              priority: 'low',
              width: 120,
            },
            {
              header: t('shared:labels.facility', 'Facility'),
              accessor: 'facility',
              priority: 'low',
              width: 150,
            },
            {
              header: t('shared:fields.status', 'Status'),
              accessor: 'status',
              priority: 'high',
              width: 120,
            },
            {
              header: t(
                'shared:labels.orderingPractitioner',
                'Ordering Practitioner'
              ),
              accessor: 'practitioner_id',
              priority: 'low',
              width: 150,
            },
            {
              header: t('shared:labels.orderedDate', 'Ordered Date'),
              accessor: 'ordered_date',
              priority: 'low',
              width: 120,
            },
            {
              header: t('shared:labels.completedDate', 'Completed Date'),
              accessor: 'completed_date',
              priority: 'low',
              width: 120,
            },
            {
              header: t('shared:tabs.documents', 'Files'),
              accessor: 'files',
              priority: 'low',
              width: 150,
            },
          ]}
          patientData={currentPatient}
          tableName={t('labresults:title', 'Lab Results')}
          onView={handleViewLabResult}
          onEdit={handleEditLabResult}
          onDelete={handleDeleteLabResult}
          formatters={{
            ...formatters,
            practitioner_id: value => {
              if (!value) return '-';
              const practitioner = practitioners.find(p => p.id === value);
              return practitioner ? practitioner.name : `ID: ${value}`;
            },
            files: (value, item) => (
              <FileCountBadge
                count={fileCounts[item.id] || 0}
                entityType="lab-result"
                variant="text"
                size="sm"
                loading={fileCountsLoading[item.id] || false}
              />
            ),
          }}
          dataType="medical"
          responsive={responsive}
        />
      </Paper>
    );
  };

  if (loading) {
    return (
      <MedicalPageLoading
        message={t('labresults:loading', 'Loading lab results...')}
        hint={t(
          'labresults:loadingHint',
          'If this takes too long, please refresh the page'
        )}
      />
    );
  }

  return (
    <>
      <Container size="xl" py="sm">
        <PageHeader title={t('labresults:title', 'Lab Results')} icon="🧪" />

        <Stack gap="sm" mt="md">
          <MedicalPageAlerts
            error={error}
            successMessage={successMessage}
            onClearError={clearError}
          />

          <MedicalPageActions
            primaryAction={{
              label: t('labresults:addNew', '+ Add New Lab Result'),
              onClick: handleAddLabResult,
              size: 'sm',
              disabled: isViewOnly,
              tooltip: viewOnlyTooltip,
            }}
            secondaryActions={[
              {
                label: t('labresults:quickPdfImport', 'Quick PDF Import'),
                onClick: () => setShowQuickImportModal(true),
                leftSection: <IconFileUpload size={16} />,
                size: 'sm',
              },
            ]}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            viewModes={['cards', 'table', 'components']}
            viewToggleSize="sm"
            mb={0}
          />

          {/* Mantine Filter Controls - hidden in components view (it has its own) */}
          {viewMode !== 'components' && (
            <MedicalPageFilters
              dataManagement={dataManagement}
              config={config}
            />
          )}

          {renderViewContent()}
          {filteredLabResults.length > 0 && viewMode !== 'components' && (
            <PaginationControls
              page={page}
              totalPages={totalPages(filteredLabResults.length)}
              pageSize={pageSize}
              totalRecords={filteredLabResults.length}
              onPageChange={setPage}
              onPageSizeChange={handlePageSizeChange}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          )}
        </Stack>
      </Container>

      {/* Create/Edit Form Modal */}
      {showModal && (
        <LabResultFormWrapper
          isOpen={showModal}
          onClose={() => !isBlocking && handleCloseModal()}
          title={
            editingLabResult
              ? t('labresults:editTitle', 'Edit Lab Result')
              : t('labresults:addTitle', 'Add New Lab Result')
          }
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          practitioners={practitioners}
          editingItem={editingLabResult}
          conditions={conditions}
          labResultConditions={labResultConditions}
          fetchLabResultConditions={fetchLabResultConditions}
          encounters={patientEncounters}
          labResultEncounters={labResultEncounters}
          fetchLabResultEncounters={fetchLabResultEncounters}
          navigate={navigate}
          onDocumentManagerRef={setDocumentManagerMethods}
          onTestComponentRef={setTestComponentMethods}
          onPendingRelationshipsRef={setPendingRelationshipsMethods}
          onFileUploadComplete={success => {
            if (success && editingLabResult) {
              refreshFileCount(editingLabResult.id);
            }
          }}
        >
          {/* Form Loading Overlay */}
          <FormLoadingOverlay
            visible={isBlocking}
            message={statusMessage?.title || 'Processing...'}
            submessage={statusMessage?.message}
            type={statusMessage?.type || 'loading'}
          />
        </LabResultFormWrapper>
      )}

      {/* View Details Modal */}
      <LabResultViewModal
        isOpen={showViewModal}
        onClose={handleCloseViewModal}
        labResult={viewingLabResult}
        onEdit={handleEditLabResult}
        practitioners={practitioners}
        disableEdit={isViewOnly}
        disableEditTooltip={viewOnlyTooltip}
        conditions={conditions}
        labResultConditions={labResultConditions}
        fetchLabResultConditions={fetchLabResultConditions}
        navigate={navigate}
        isBlocking={isBlocking}
        initialTab={initialViewTab}
        onFileUploadComplete={success => {
          if (success && viewingLabResult) {
            refreshFileCount(viewingLabResult.id);
          }
        }}
        onLabResultUpdated={handleLabResultUpdated}
        encounters={patientEncounters}
        labResultEncounters={labResultEncounters}
        fetchLabResultEncounters={fetchLabResultEncounters}
      />

      {/* Quick PDF Import Modal */}
      {showQuickImportModal && (
        <LabResultQuickImportModal
          isOpen={showQuickImportModal}
          onClose={() => setShowQuickImportModal(false)}
          onSuccess={handleQuickImportSuccess}
          patientId={currentPatient?.id}
          practitioners={practitioners}
        />
      )}
    </>
  );
};

// Wrap with responsive HOC for enhanced responsive capabilities
export default withResponsive(LabResults, {
  injectResponsive: true,
  displayName: 'ResponsiveLabResults',
});
