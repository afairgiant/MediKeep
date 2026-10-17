import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
import { usePersistedToggle } from '../../hooks/usePersistedToggle';
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
import PrintButton from '../../components/shared/PrintButton';
import MedicalPageAlerts from '../../components/shared/MedicalPageAlerts';
import MedicalPageLoading from '../../components/shared/MedicalPageLoading';
import AnimatedCardGrid from '../../components/shared/AnimatedCardGrid';
import PaginationControls from '../../components/shared/PaginationControls';
import LabResultCard from '../../components/medical/labresults/LabResultCard';
import LabResultViewModal from '../../components/medical/labresults/LabResultViewModal';
import LabResultFormWrapper from '../../components/medical/labresults/LabResultFormWrapper';
import TestPanelCreateDialog from '../../components/medical/labresults/TestPanelCreateDialog';
import LabResultQuickImportModal from '../../components/medical/labresults/LabResultQuickImportModal';
import TestComponentCatalog from '../../components/medical/labresults/TestComponentCatalog';
import { notifications } from '@mantine/notifications';
import { labTestComponentApi } from '../../services/api/labTestComponentApi';
import { submitPendingTestComponents } from '../../utils/labTestComponentUtils';
import { useFormSubmissionWithUploads } from '../../hooks/useFormSubmissionWithUploads';
import { Button, Container, Stack, Paper } from '@mantine/core';
import { IconFileUpload, IconTable, IconLayoutGrid } from '@tabler/icons-react';
import LabResultsComponentTable from '../../components/medical/labresults/LabResultsComponentTable';
import TestComponentEditModal from '../../components/medical/labresults/TestComponentEditModal';
import { usePatientPermissions } from '../../hooks/usePatientPermissions';

const COMPONENT_STATUS_PRIORITY = ['critical', 'abnormal', 'high', 'low', 'borderline', 'normal'];

function labResultToFormData(labResult) {
  return {
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
    practitioner_id: labResult.practitioner_id ? String(labResult.practitioner_id) : '',
    tags: labResult.tags || [],
    value: labResult.value ?? null,
    unit: labResult.unit || null,
    ref_range_min: labResult.ref_range_min ?? null,
    ref_range_max: labResult.ref_range_max ?? null,
    ref_range_text: labResult.ref_range_text || null,
  };
}

const EMPTY_FORM_DATA = {
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
  value: null,
  unit: null,
  ref_range_min: null,
  ref_range_max: null,
  ref_range_text: null,
};

const LabResults = () => {
  const { t } = useTranslation(['common', 'shared']);
  const { isViewOnly, viewOnlyTooltip } = usePatientPermissions();
  const { formatDate } = useDateFormat();
  const navigate = useNavigate();
  const location = useLocation();
  const responsive = useResponsive();
  const [viewMode, setViewMode] = usePersistedViewMode('lab-results', 'panels');
  const [tableLayout, setTableLayout] = useState(() => viewMode === 'table');
  const [isPrintingAll, setIsPrintingAll] = useState(false);
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
    entityLabel: t('medical:entityNames.labResult'),
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
  // Holds the newly created lab result while transitioning to post-create edit mode
  const newlyCreatedResultRef = useRef(null);
  const [postCreateMode, setPostCreateMode] = useState(false);

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
      const newResult = newlyCreatedResultRef.current;
      newlyCreatedResultRef.current = null;

      if (newResult) {
        // A new lab result was just created — transition to post-create edit mode
        // so the user can add components and relationships before fully dismissing.
        resetSubmission();
        setEditingLabResult(newResult);
        setFormData(labResultToFormData(newResult));
        setPostCreateMode(true);
        // Sync fresh data in the background so the list is up to date
        refreshPatientComponents();
        if (needsRefreshAfterSubmissionRef.current) {
          needsRefreshAfterSubmissionRef.current = false;
          refreshData();
        }
        return;
      }

      // Normal path: close modal after a successful edit (or post-create save)
      setShowModal(false);
      setEditingLabResult(null);
      setPostCreateMode(false);
      setFormData(EMPTY_FORM_DATA);

      // Sync the components table — tests may have been added via TestComponentsTab
      refreshPatientComponents();

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

  // Saved links of each lab result, loaded when a lab result is opened
  const [labResultConditions, setLabResultConditions] = useState({});
  const [labResultMedications, setLabResultMedications] = useState({});
  const [labResultProcedures, setLabResultProcedures] = useState({});
  const [labResultTreatments, setLabResultTreatments] = useState({});

  // A list that could not be loaded is null, so its tab does not wait for it; a list
  // loaded earlier is kept
  const markLinksFailed = (setLinks, labResultId) =>
    setLinks(prev =>
      prev[labResultId] === undefined ? { ...prev, [labResultId]: null } : prev
    );

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
      markLinksFailed(setLabResultConditions, labResultId);
      return [];
    }
  };

  // Helper function to fetch medication relationships for a lab result
  const fetchLabResultMedications = async labResultId => {
    try {
      const relationships =
        await apiService.getLabResultMedications(labResultId);
      setLabResultMedications(prev => ({
        ...prev,
        [labResultId]: relationships || [],
      }));
      return relationships || [];
    } catch (err) {
      logger.error('medical_medications_fetch_error', {
        message: 'Failed to fetch lab result medications',
        labResultId,
        error: err.message,
        component: 'LabResults',
      });
      markLinksFailed(setLabResultMedications, labResultId);
      return [];
    }
  };

  // Helper function to fetch procedure relationships for a lab result
  const fetchLabResultProcedures = async labResultId => {
    try {
      const relationships =
        await apiService.getLabResultProcedures(labResultId);
      setLabResultProcedures(prev => ({
        ...prev,
        [labResultId]: relationships || [],
      }));
      return relationships || [];
    } catch (err) {
      logger.error('medical_procedures_fetch_error', {
        message: 'Failed to fetch lab result procedures',
        labResultId,
        error: err.message,
        component: 'LabResults',
      });
      markLinksFailed(setLabResultProcedures, labResultId);
      return [];
    }
  };

  // Helper function to fetch treatment relationships for a lab result
  const fetchLabResultTreatments = async labResultId => {
    try {
      const relationships =
        await apiService.getLabResultTreatments(labResultId);
      setLabResultTreatments(prev => ({
        ...prev,
        [labResultId]: relationships || [],
      }));
      return relationships || [];
    } catch (err) {
      logger.error('medical_treatments_fetch_error', {
        message: 'Failed to fetch lab result treatments',
        labResultId,
        error: err.message,
        component: 'LabResults',
      });
      markLinksFailed(setLabResultTreatments, labResultId);
      return [];
    }
  };

  // Get processed data from data management
  const filteredLabResults = dataManagement.data;
  const paginatedLabResults = paginateData(filteredLabResults);

  // All test components for the current patient
  const [patientComponents, setPatientComponents] = useState([]);
  const [patientComponentsLoading, setPatientComponentsLoading] = useState(false);

  const refreshPatientComponents = useCallback((signal) => {
    if (!currentPatient?.id) return;
    setPatientComponentsLoading(true);
    labTestComponentApi.getAllForPatient(currentPatient.id, signal)
      .then(components => { setPatientComponents(components); })
      .catch(err => { if (err?.name !== 'AbortError') setPatientComponents([]); })
      .finally(() => { setPatientComponentsLoading(false); });
  }, [currentPatient?.id]);

  useEffect(() => {
    if (!currentPatient?.id) return;
    const controller = new AbortController();
    refreshPatientComponents(controller.signal);
    return () => { controller.abort(); };
  }, [currentPatient?.id, refreshPatientComponents]);

  // IDs of lab results that are "PDF masters" (have at least one real test component).
  // Excludes synthesized `is_legacy` pseudo-components (#1014), whose lab_result_id
  // points back at the component-less LabResult they were synthesized from - counting
  // those would wrongly mark that result as a PDF master and hide it from the list.
  const parentIdsWithComponents = useMemo(
    () => new Set(
      patientComponents.filter(c => !c.is_legacy).map(c => c.lab_result_id)
    ),
    [patientComponents]
  );

  // Worst component status per panel, used to roll up individual test statuses on the panel card
  const worstStatusByPanelId = useMemo(() => {
    const map = new Map();
    for (const id of parentIdsWithComponents) {
      const statuses = patientComponents
        .filter(c => c.lab_result_id === id)
        .map(c => c.status)
        .filter(Boolean);
      map.set(id, COMPONENT_STATUS_PRIORITY.find(p => statuses.includes(p)) ?? null);
    }
    return map;
  }, [patientComponents, parentIdsWithComponents]);

  // Coerce legacy persisted 'table' or 'cards' viewMode to 'panels'
  useEffect(() => {
    if (viewMode === 'table' || viewMode === 'cards') setViewMode('panels');
  }, [viewMode, setViewMode]);

  useEffect(() => {
    resetPage();
  }, [dataManagement.hasActiveFilters, resetPage]);
  useEffect(() => {
    clampPage(filteredLabResults.length);
  }, [filteredLabResults.length, clampPage]);

  // Restore normal pagination after the browser print dialog closes (covers
  // both completed prints and cancellations).
  useEffect(() => {
    const handleAfterPrint = () => setIsPrintingAll(false);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const handlePrintTable = () => {
    setIsPrintingAll(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
  };

  // Combined loading state — include component fetch when in results-table view to avoid content flash.
  // For the components table specifically, only block on initial load (empty array); subsequent refreshes must not
  // unmount the table or the expanded-row state (local useState) is destroyed.
  const loading = labResultsLoading || practitionersLoading || (viewMode === 'components' && tableLayout && patientComponentsLoading && patientComponents.length === 0);

  // Document management state
  const [documentManagerMethods, setDocumentManagerMethods] = useState(null);

  // Pending relationships state (advanced create mode only)
  const [pendingRelationshipsMethods, setPendingRelationshipsMethods] =
    useState(null);

  // Pending test components state (advanced create mode only)
  const [pendingComponentsMethods, setPendingComponentsMethods] =
    useState(null);

  // Advanced create mode: bypasses the quick TestPanelCreateDialog and opens the
  // full tabbed form (relationships, notes, files) directly. Persisted per browser.
  const [advancedCreateMode, setAdvancedCreateMode] = usePersistedToggle(
    'medikeep_labresults_advanced_create',
    false
  );

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
      setInitialViewTab('overview');
    },
  });

  // Form and modal state
  const [showModal, setShowModal] = useState(false);
  const [showQuickImportModal, setShowQuickImportModal] = useState(false);

  const [showPanelCreateDialog, setShowPanelCreateDialog] = useState(false);
  const [initialViewTab, setInitialViewTab] = useState('overview');
  const [editingComponent, setEditingComponent] = useState(null);
  const [editComponentModalOpen, setEditComponentModalOpen] = useState(false);
  const [editingLabResult, setEditingLabResult] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM_DATA);

  const handlePanelCreateSuccess = useCallback(
    labResult => {
      setShowPanelCreateDialog(false);
      needsRefreshAfterSubmissionRef.current = true;
      refreshData();
      refreshPatientComponents();

      if (labResult) {
        resetSubmission();
        setEditingLabResult(labResult);
        setFormData(labResultToFormData(labResult));
        setPostCreateMode(true);
        setShowModal(true);
      }
    },
    [refreshData, refreshPatientComponents, resetSubmission]
  );

  // Opens the full tabbed form directly (relationships, notes, files) instead of
  // the quick panel-creation dialog. Shared by the "Add" button and the in-form toggle.
  const openAdvancedForm = useCallback(() => {
    resetSubmission();
    setEditingLabResult(null);
    setDocumentManagerMethods(null);
    setPendingRelationshipsMethods(null);
    setPendingComponentsMethods(null);
    setFormData(EMPTY_FORM_DATA);
    setShowModal(true);
  }, [resetSubmission]);

  // Modern CRUD handlers using useMedicalData - memoized to prevent LabResultCard re-renders
  const handleAddLabResult = useCallback(() => {
    if (advancedCreateMode) {
      openAdvancedForm();
      return;
    }
    setShowPanelCreateDialog(true);
  }, [advancedCreateMode, openAdvancedForm]);

  const handleEditLabResult = useCallback(
    async labResult => {
      resetSubmission(); // Reset submission state to prevent modal flash
      setEditingLabResult(labResult);
      setFormData(labResultToFormData(labResult));
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

  const handleEditComponentFromTable = useCallback(
    comp => {
      // Legacy (component-less) results have no component record to edit —
      // editing means editing the lab result's own value/unit/range fields (#1014).
      if (comp.is_legacy) {
        const lr = labResults.find(r => r.id === comp.lab_result_id);
        if (lr) {
          handleEditLabResult(lr);
        } else {
          logger.warn('legacy_component_edit_lab_result_missing', {
            component: 'LabResults',
            labResultId: comp.lab_result_id,
          });
          notifications.show({
            title: t('shared:labels.error', 'Error'),
            message: t(
              'labresults:testComponents.notifications.legacyResultNotFound',
              'Could not find the lab result to edit'
            ),
            color: 'red',
          });
        }
        return;
      }
      setEditingComponent(comp);
      setEditComponentModalOpen(true);
    },
    [labResults, handleEditLabResult]
  );

  const handleSaveComponent = useCallback(
    async updatedData => {
      if (!editingComponent) return;
      await labTestComponentApi.update(editingComponent.id, updatedData, currentPatient?.id);
      refreshPatientComponents();
      setEditComponentModalOpen(false);
      setEditingComponent(null);
    },
    [editingComponent, currentPatient?.id, refreshPatientComponents]
  );

  const handleDeleteComponentFromTable = useCallback(
    async comp => {
      if (
        !window.confirm(
          t(
            'labresults:testComponents.confirmDelete',
            'Are you sure you want to delete this test result? This action cannot be undone.'
          )
        )
      ) {
        return false;
      }
      try {
        // Legacy (component-less) results have no component record to delete —
        // deleting means deleting the whole lab result they represent (#1025,
        // mirrors handleEditComponentFromTable's is_legacy branch above). That
        // also means refreshing labResults and cleaning up its file count, the
        // same as handleDeleteLabResult does below — deleting only through
        // patientComponents would leave a ghost entry in Panels view
        // that 404s when opened.
        if (comp.is_legacy) {
          await apiService.deleteLabResult(comp.lab_result_id);
          await refreshData();
          cleanupFileCount(comp.lab_result_id);
        } else {
          await labTestComponentApi.delete(comp.id, currentPatient?.id);
        }
        refreshPatientComponents();
        notifications.show({
          title: t('shared:labels.success', 'Success'),
          message: comp.is_legacy
            ? t('labresults:labResultDeleted', 'Lab result deleted')
            : t('labresults:testComponents.notifications.componentDeleted', 'Component deleted'),
          color: 'green',
        });
        return true;
      } catch {
        notifications.show({
          title: t('shared:labels.error', 'Error'),
          message: t('shared:labels.deleteFailed', 'Delete Failed'),
          color: 'red',
        });
        return false;
      }
    },
    [currentPatient?.id, refreshPatientComponents, refreshData, cleanupFileCount, t]
  );

  const handleQuickImportSuccess = useCallback(
    async labResultId => {
      setShowQuickImportModal(false);

      // Refresh lab results list and patient components (new PDF import creates components)
      await refreshData();
      refreshPatientComponents();

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
      refreshPatientComponents,
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

      // Staged test components (advanced create mode only). Computed once and reused
      // both to flag the record as a panel and to submit them after it's created.
      const pendingComponents = editingLabResult
        ? []
        : (pendingComponentsMethods?.getPendingComponents?.() ?? []);

      if (pendingComponents.length > 0) {
        labResultData.is_panel = true;
      }

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
          if (success) {
            newlyCreatedResultRef.current = result;
          }
          // Set flag to refresh after new lab result creation (but only after form submission, not uploads)
          if (success) {
            needsRefreshAfterSubmissionRef.current = true;
          }
        }

        // Complete form submission
        completeFormSubmission(success, resultId);

        if (success && resultId) {
          // Submit pending relationships and pending test components (advanced create
          // mode only) concurrently — neither depends on the other, only on resultId.
          const submitPendingRelationships = async () => {
            if (
              editingLabResult ||
              !pendingRelationshipsMethods?.hasPendingRelationships?.()
            ) {
              return;
            }
            try {
              const pending =
                pendingRelationshipsMethods.getPendingRelationships();

              const conditionPromises = pending.conditions.map(condRel =>
                apiService.createLabResultCondition(resultId, {
                  lab_result_id: resultId,
                  condition_id: condRel.condition_id,
                  purpose: condRel.purpose || null,
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

              const medicationPromises = pending.medications.map(medRel =>
                apiService.createLabResultMedication(resultId, {
                  lab_result_id: resultId,
                  medication_id: medRel.medication_id,
                  relevance_note: medRel.relevance_note,
                })
              );

              const procedurePromises = pending.procedures.map(procRel =>
                apiService.createLabResultProcedure(resultId, {
                  lab_result_id: resultId,
                  procedure_id: procRel.procedure_id,
                  purpose: procRel.purpose || null,
                  relevance_note: procRel.relevance_note,
                })
              );

              const treatmentPromises = pending.treatments.map(treatRel =>
                apiService.createLabResultTreatment(resultId, {
                  treatment_id: treatRel.treatment_id,
                  purpose: treatRel.purpose,
                  expected_frequency: treatRel.expected_frequency,
                  relevance_note: treatRel.relevance_note,
                })
              );

              await Promise.all([
                ...conditionPromises,
                ...encounterPromises,
                ...medicationPromises,
                ...procedurePromises,
                ...treatmentPromises,
              ]);

              logger.info('pending_relationships_created', {
                message: 'Pending relationships created with lab result',
                labResultId: resultId,
                conditionCount: pending.conditions.length,
                encounterCount: pending.encounters.length,
                medicationCount: pending.medications.length,
                procedureCount: pending.procedures.length,
                treatmentCount: pending.treatments.length,
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
          };

          const submitComponents = async () => {
            if (pendingComponents.length === 0) return;
            await submitPendingTestComponents(
              resultId,
              pendingComponents,
              currentPatient.id,
              'LabResults',
              t
            );
            logger.info('pending_components_created', {
              message: 'Pending test components created with lab result',
              labResultId: resultId,
              componentCount: pendingComponents.length,
              component: 'LabResults',
            });
          };

          await Promise.allSettled([
            submitPendingRelationships(),
            submitComponents(),
          ]);

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
      pendingRelationshipsMethods,
      pendingComponentsMethods,
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

  // Auto-populate unit and reference range from the most recent matching result.
  // Only fires in create mode; only fills fields that are still empty.
  useEffect(() => {
    if (editingLabResult || !showModal) return;

    const code = (formData.test_code || '').trim().toUpperCase();
    const name = (formData.test_name || '').toLowerCase().trim();
    if (!code && !name) return;

    const match = [...labResults]
      .filter(r => {
        const rCode = (r.test_code || '').trim().toUpperCase();
        const rName = (r.test_name || '').toLowerCase().trim();
        const codeMatch = !!code && !!rCode && rCode === code;
        const nameMatch = !!name && rName === name;
        return (codeMatch || nameMatch) &&
          (r.unit || r.ref_range_min != null || r.ref_range_max != null ||
            r.ref_range_text || r.test_category || r.practitioner_id);
      })
      .sort((a, b) => {
        const da = a.completed_date || a.ordered_date || '';
        const db = b.completed_date || b.ordered_date || '';
        return db.localeCompare(da);
      })[0];

    if (!match) return;

    setFormData(prev => {
      const updates = {};
      if (!prev.unit && match.unit) updates.unit = match.unit;
      if (prev.ref_range_min == null && match.ref_range_min != null)
        updates.ref_range_min = match.ref_range_min;
      if (prev.ref_range_max == null && match.ref_range_max != null)
        updates.ref_range_max = match.ref_range_max;
      if (!prev.ref_range_text && match.ref_range_text)
        updates.ref_range_text = match.ref_range_text;
      if (!prev.test_category && match.test_category)
        updates.test_category = match.test_category;
      if (!prev.practitioner_id && match.practitioner_id)
        updates.practitioner_id = String(match.practitioner_id);
      return Object.keys(updates).length ? { ...prev, ...updates } : prev;
    });
  }, [formData.test_name, formData.test_code, editingLabResult, showModal, labResults]);

  const handleCloseModal = useCallback(() => {
    // Prevent closing during upload
    if (isBlocking) {
      return;
    }

    resetSubmission(); // Reset submission state
    setShowModal(false);
    setEditingLabResult(null);
    setPostCreateMode(false);
    setDocumentManagerMethods(null); // Reset document manager methods
    setPendingRelationshipsMethods(null); // Reset pending relationships
    setPendingComponentsMethods(null); // Reset pending test components
    // Sync the components table — tests may have been added via TestComponentsTab
    refreshPatientComponents();
    setFormData(EMPTY_FORM_DATA);
  }, [isBlocking, resetSubmission, refreshPatientComponents]);

  // Shared by handleAdvancedModeToggle and handleSwitchToQuickImport: whether the
  // advanced create form has anything a user would lose by abandoning it.
  const hasUnsavedAdvancedFormData = useCallback(
    () =>
      !!formData.test_name?.trim() ||
      pendingRelationshipsMethods?.hasPendingRelationships?.() ||
      pendingComponentsMethods?.hasPendingComponents?.() ||
      documentManagerMethods?.hasPendingFiles?.(),
    [
      formData.test_name,
      pendingRelationshipsMethods,
      pendingComponentsMethods,
      documentManagerMethods,
    ]
  );

  // Lets the user swap between the quick panel-creation dialog and the full
  // tabbed form from within whichever create modal is currently open.
  // Switching away from the advanced form unmounts it (losing formData, staged
  // relationships, and pending files), so confirm first if there's anything to lose.
  // The quick dialog stays mounted in the background when hidden, so no guard is
  // needed switching in that direction.
  const handleAdvancedModeToggle = useCallback(
    checked => {
      if (
        !checked &&
        hasUnsavedAdvancedFormData() &&
        !window.confirm(t('labresults:messages.confirmDiscardAdvancedForm'))
      ) {
        return;
      }
      setAdvancedCreateMode(checked);
      if (checked) {
        setShowPanelCreateDialog(false);
        openAdvancedForm();
      } else {
        handleCloseModal();
        setShowPanelCreateDialog(true);
      }
    },
    [
      hasUnsavedAdvancedFormData,
      openAdvancedForm,
      handleCloseModal,
      setAdvancedCreateMode,
      t,
    ]
  );

  // Abandons the advanced create form (confirming first if there's anything to
  // lose) and opens the separate Quick PDF Import flow instead.
  const handleSwitchToQuickImport = useCallback(() => {
    if (
      hasUnsavedAdvancedFormData() &&
      !window.confirm(t('labresults:messages.confirmDiscardAdvancedForm'))
    ) {
      return;
    }
    handleCloseModal();
    setShowQuickImportModal(true);
  }, [hasUnsavedAdvancedFormData, handleCloseModal, t]);

  const renderViewContent = () => {
    if (viewMode === 'components') {
      if (tableLayout) {
        return (
          <LabResultsComponentTable
            components={patientComponents}
            labResults={labResults}
            practitioners={practitioners}
            patientId={currentPatient?.id}
            onEdit={handleEditComponentFromTable}
            onDelete={handleDeleteComponentFromTable}
            onRefresh={refreshPatientComponents}
            disableActions={isViewOnly}
          />
        );
      }
      return currentPatient?.id ? (
        <TestComponentCatalog
          components={patientComponents}
          labResults={labResults || []}
          practitioners={practitioners || []}
          loading={patientComponentsLoading}
          patientId={currentPatient.id}
          onEdit={isViewOnly ? undefined : handleEditComponentFromTable}
          onDelete={isViewOnly ? undefined : handleDeleteComponentFromTable}
          onRefresh={refreshPatientComponents}
          readOnly={isViewOnly}
        />
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
              {t('medical:labResults.buttons.addLabResults', 'Add Lab Results')}
            </Button>
          }
        />
      );
    }

    if (viewMode === 'panels' && !tableLayout) {
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
              isGroupedResult={!!(result.is_panel || parentIdsWithComponents.has(result.id))}
              worstComponentStatus={worstStatusByPanelId.get(result.id) ?? null}
            />
          )}
        />
      );
    }

    return (
      <Paper shadow="sm" radius="md" withBorder>
        <ResponsiveTable
          persistKey="lab-results"
          data={isPrintingAll ? filteredLabResults : paginatedLabResults}
          pagination={false}
          disableEdit={isViewOnly}
          disableDelete={isViewOnly}
          disableActionsTooltip={viewOnlyTooltip}
          columns={[
            {
              header: t('medical:labResults.addPanel.panelName', 'Lab Results Panel or Type'),
              accessor: 'test_name',
              priority: 'high',
              width: 200,
            },
            {
              header: t('shared:fields.status', 'Status'),
              accessor: 'status',
              priority: 'high',
              width: 120,
              render: (value, row) => {
                const isGrouped = row.is_panel || parentIdsWithComponents.has(row.id);
                const worstStatus = worstStatusByPanelId.get(row.id) ?? null;
                if (isGrouped && worstStatus) return worstStatus;
                if (isGrouped && row.completed_date) return 'completed';
                return value || '—';
              },
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
              header: t(
                'shared:labels.orderingPractitioner',
                'Ordering Practitioner'
              ),
              accessor: 'practitioner_id',
              priority: 'low',
              width: 150,
            },
            {
              header: t('shared:labels.facility', 'Facility'),
              accessor: 'facility',
              priority: 'low',
              width: 150,
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
            status: (value, row) => {
              const isGrouped = row.is_panel || parentIdsWithComponents.has(row.id);
              const worstStatus = worstStatusByPanelId.get(row.id) ?? null;
              if (isGrouped && worstStatus) return worstStatus.charAt(0).toUpperCase() + worstStatus.slice(1);
              if (isGrouped && row.completed_date) return 'Completed';
              return value ? value.charAt(0).toUpperCase() + value.slice(1) : '-';
            },
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
              label: t('medical:labResults.buttons.addLabResults', 'Add Lab Results'),
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
            viewModes={['panels', 'components']}
            viewToggleSize="sm"
            mb={0}
            rightChildren={
              <>
                <Button.Group>
                  <Button
                    size="sm"
                    variant={!tableLayout ? 'filled' : 'default'}
                    leftSection={<IconLayoutGrid size={14} />}
                    onClick={() => setTableLayout(false)}
                  >
                    {t('common:viewToggle.cards', 'Cards')}
                  </Button>
                  <Button
                    size="sm"
                    variant={tableLayout ? 'filled' : 'default'}
                    leftSection={<IconTable size={14} />}
                    onClick={() => setTableLayout(true)}
                  >
                    {t('common:viewToggle.table', 'Table')}
                  </Button>
                </Button.Group>
                {tableLayout && (
                  <PrintButton onClick={handlePrintTable} />
                )}
              </>
            }
          />

          {/* Mantine Filter Controls - hidden in components view (it has its own) */}
          {viewMode !== 'components' && (
            <MedicalPageFilters
              dataManagement={dataManagement}
              config={config}
            />
          )}

          {renderViewContent()}
          {viewMode !== 'components' && filteredLabResults.length > 0 && (
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

      {/* Test Panel Create Dialog */}
      <TestPanelCreateDialog
        opened={showPanelCreateDialog}
        onClose={() => setShowPanelCreateDialog(false)}
        onCreateSuccess={handlePanelCreateSuccess}
        practitioners={practitioners}
        currentPatient={currentPatient}
        advancedMode={advancedCreateMode}
        onAdvancedModeChange={handleAdvancedModeToggle}
      />

      {/* Create/Edit Form Modal */}
      {showModal && (
        <LabResultFormWrapper
          isOpen={showModal}
          onClose={() => !isBlocking && handleCloseModal()}
          title={
            postCreateMode
              ? t('labresults:addDetailsTitle', 'Add Lab Result Details')
              : editingLabResult
                ? t('labresults:editTitle', 'Edit Lab Result')
                : t('labresults:addTitle', 'Add New Lab Result')
          }
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          practitioners={practitioners}
          editingItem={editingLabResult}
          patientId={currentPatient?.id}
          labResultConditions={labResultConditions}
          fetchLabResultConditions={fetchLabResultConditions}
          labResultMedications={labResultMedications}
          fetchLabResultMedications={fetchLabResultMedications}
          labResultProcedures={labResultProcedures}
          fetchLabResultProcedures={fetchLabResultProcedures}
          labResultTreatments={labResultTreatments}
          fetchLabResultTreatments={fetchLabResultTreatments}
          navigate={navigate}
          onDocumentManagerRef={setDocumentManagerMethods}
          onPendingRelationshipsRef={setPendingRelationshipsMethods}
          onPendingComponentsRef={setPendingComponentsMethods}
          onSwitchToQuickImport={handleSwitchToQuickImport}
          postCreate={postCreateMode}
          advancedCreate={advancedCreateMode}
          onAdvancedModeChange={handleAdvancedModeToggle}
          isGroupedResult={!!(editingLabResult && (editingLabResult.is_panel || parentIdsWithComponents.has(editingLabResult.id)))}
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
        labResultConditions={labResultConditions}
        fetchLabResultConditions={fetchLabResultConditions}
        navigate={navigate}
        isBlocking={isBlocking}
        initialTab={initialViewTab}
        isGroupedResult={!!(viewingLabResult && (viewingLabResult.is_panel || parentIdsWithComponents.has(viewingLabResult.id)))}
        onFileUploadComplete={success => {
          if (success && viewingLabResult) {
            refreshFileCount(viewingLabResult.id);
          }
        }}
        onLabResultUpdated={handleLabResultUpdated}
        labResultMedications={labResultMedications}
        fetchLabResultMedications={fetchLabResultMedications}
        labResultProcedures={labResultProcedures}
        fetchLabResultProcedures={fetchLabResultProcedures}
        labResultTreatments={labResultTreatments}
        fetchLabResultTreatments={fetchLabResultTreatments}
      />

      {/* Edit Individual Test Component Modal */}
      <TestComponentEditModal
        component={editingComponent}
        opened={editComponentModalOpen}
        onClose={() => {
          setEditComponentModalOpen(false);
          setEditingComponent(null);
        }}
        onSubmit={handleSaveComponent}
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
