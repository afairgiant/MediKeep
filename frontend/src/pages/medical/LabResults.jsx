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
import LabResultStackCard from '../../components/medical/labresults/LabResultStackCard';
import LabResultStackPanel from '../../components/medical/labresults/LabResultStackPanel';
import { notifications } from '@mantine/notifications';
import { labTestComponentApi } from '../../services/api/labTestComponentApi';
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
        value: null,
        unit: null,
        ref_range_min: null,
        ref_range_max: null,
        ref_range_text: null,
      });

      // Re-open the stack panel if the edit was triggered from within it
      if (returningToStackRef.current) {
        returningToStackRef.current = false;
        setStackPanelOpen(true);
      }

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

  // Stack view state
  const [stackPanelOpen, setStackPanelOpen] = useState(false);
  const [selectedGroupKey, setSelectedGroupKey] = useState(null);
  // Set to true before triggering view/edit from the stack panel so close handlers re-open it
  const returningToStackRef = useRef(false);

  // All test components for the current patient, loaded when entering stacked view
  const [patientComponents, setPatientComponents] = useState([]);
  const [patientComponentsLoading, setPatientComponentsLoading] = useState(false);

  useEffect(() => {
    if (!currentPatient?.id) return;
    const controller = new AbortController();
    setPatientComponentsLoading(true);
    labTestComponentApi.getAllForPatient(currentPatient.id, controller.signal)
      .then(components => { setPatientComponents(components); })
      .catch(err => { if (err?.name !== 'AbortError') setPatientComponents([]); })
      .finally(() => { setPatientComponentsLoading(false); });
    return () => { controller.abort(); };
  }, [currentPatient?.id]);

  // IDs of lab results that are "PDF masters" (have at least one test component)
  const parentIdsWithComponents = useMemo(
    () => new Set(patientComponents.map(c => c.lab_result_id)),
    [patientComponents]
  );

  const getGroupKey = r => {
    const code = (r.test_code || '').trim().toUpperCase();
    return code ? `code:${code}` : `name:${(r.test_name || '').toLowerCase().trim()}`;
  };


  const groupedLabResults = useMemo(() => {
    const map = new Map();
    for (const r of filteredLabResults) {
      // Exclude PDF masters (lab results that have test components)
      if (parentIdsWithComponents.has(r.id)) continue;
      const key = getGroupKey(r);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return [...map.values()].map(results => {
      const sorted = [...results].sort((a, b) => {
        const da = a.completed_date || a.ordered_date || a.created_at || '';
        const db = b.completed_date || b.ordered_date || b.created_at || '';
        return db.localeCompare(da);
      });
      return {
        key: getGroupKey(sorted[0]),
        test_name: sorted[0].test_name,
        results: sorted,
        count: sorted.length,
        latest_date: sorted[0]?.completed_date || sorted[0]?.ordered_date || null,
        earliest_date:
          sorted[sorted.length - 1]?.completed_date ||
          sorted[sorted.length - 1]?.ordered_date ||
          null,
        latest_status: sorted[0]?.labs_result || null,
      };
    }).sort((a, b) => {
      if (!a.latest_date && !b.latest_date) return 0;
      if (!a.latest_date) return 1;
      if (!b.latest_date) return -1;
      return b.latest_date.localeCompare(a.latest_date);
    });
  }, [filteredLabResults, parentIdsWithComponents]);

  const currentSelectedGroup = useMemo(
    () =>
      selectedGroupKey
        ? (groupedLabResults.find(g => g.key === selectedGroupKey) ?? null)
        : null,
    [groupedLabResults, selectedGroupKey]
  );

  // Enrich the selected group with matching test components from PDF masters
  const enrichedSelectedGroup = useMemo(() => {
    if (!currentSelectedGroup) return null;
    const groupKey = currentSelectedGroup.key;
    const groupName = currentSelectedGroup.test_name.toLowerCase().trim();
    const existingGroupKeys = new Set(groupedLabResults.map(g => g.key));
    const matchingComponents = patientComponents.filter(comp => {
      const compCode = (comp.test_code || '').trim().toUpperCase();
      // If the component has a code, first try an exact code-group match.
      // If a different code-keyed group exists for this code, don't steal it (avoids double-counting).
      // If no code-keyed group exists at all, fall through to name matching.
      if (compCode) {
        const compCodeKey = `code:${compCode}`;
        if (compCodeKey === groupKey) return true;
        if (existingGroupKeys.has(compCodeKey)) return false;
      }
      const compCanonical = (comp.canonical_test_name || '').toLowerCase().trim();
      const compTestName = (comp.test_name || '').toLowerCase().trim();
      return (!!compCanonical && compCanonical === groupName) || compTestName === groupName;
    });
    // PDF masters whose key matches the group are excluded from group building but should
    // still appear as regular results in the drill-down (they represent real measurements)
    const matchingPDFMasters = filteredLabResults.filter(r => {
      if (!parentIdsWithComponents.has(r.id)) return false;
      return getGroupKey(r) === groupKey;
    });
    if (matchingComponents.length === 0 && matchingPDFMasters.length === 0) return currentSelectedGroup;
    const componentResults = matchingComponents.map(comp => ({
      id: comp.id,
      test_name: comp.test_name,
      labs_result: comp.status ?? null,
      ordered_date: comp.ordered_date ?? null,
      completed_date: comp.completed_date ?? null,
      notes: comp.notes ?? null,
      status: null,
      facility: comp.facility ?? null,
      test_category: comp.category ?? null,
      value: comp.value ?? null,
      unit: comp.unit ?? null,
      ref_range_min: comp.ref_range_min ?? null,
      ref_range_max: comp.ref_range_max ?? null,
      ref_range_text: comp.ref_range_text ?? null,
      source: 'component',
      parent_lab_result_id: comp.lab_result_id,
      result_type: comp.result_type ?? null,
      qualitative_value: comp.qualitative_value ?? null,
    }));
    const allResults = [
      ...currentSelectedGroup.results,
      ...matchingPDFMasters,
      ...componentResults,
    ].sort((a, b) => {
      const da = a.completed_date || a.ordered_date || a.created_at || '';
      const db = b.completed_date || b.ordered_date || b.created_at || '';
      return db.localeCompare(da);
    });
    return { ...currentSelectedGroup, results: allResults, count: allResults.length };
  }, [currentSelectedGroup, patientComponents, filteredLabResults, parentIdsWithComponents, groupedLabResults]);

  // Total display count per group key: base results + matching components + matching PDF masters.
  // Uses the same predicate as enrichedSelectedGroup so badge counts always match drill-down counts.
  const displayCountByGroupKey = useMemo(() => {
    if (patientComponents.length === 0 && parentIdsWithComponents.size === 0) return {};
    const existingGroupKeys = new Set(groupedLabResults.map(g => g.key));
    const map = {};
    for (const group of groupedLabResults) {
      const groupKey = group.key;
      const groupName = group.test_name.toLowerCase().trim();
      let extra = 0;
      for (const comp of patientComponents) {
        const compCode = (comp.test_code || '').trim().toUpperCase();
        if (compCode) {
          if (`code:${compCode}` === groupKey) { extra++; continue; }
          if (existingGroupKeys.has(`code:${compCode}`)) continue;
        }
        const compCanonical = (comp.canonical_test_name || '').toLowerCase().trim();
        const compTestName = (comp.test_name || '').toLowerCase().trim();
        if ((!!compCanonical && compCanonical === groupName) || compTestName === groupName) {
          extra++;
        }
      }
      for (const r of filteredLabResults) {
        if (!parentIdsWithComponents.has(r.id)) continue;
        if (getGroupKey(r) === groupKey) extra++;
      }
      if (extra > 0) map[groupKey] = group.count + extra;
    }
    return map;
  }, [groupedLabResults, patientComponents, filteredLabResults, parentIdsWithComponents]);

  // Auto-close the stack panel when the selected group no longer exists (e.g. all items deleted)
  useEffect(() => {
    if (stackPanelOpen && selectedGroupKey && !currentSelectedGroup) {
      setStackPanelOpen(false);
      setSelectedGroupKey(null);
    }
  }, [stackPanelOpen, selectedGroupKey, currentSelectedGroup]);

  // Combined list for stacked view: stack groups + individual PDF-master results (sorted newest-first).
  const stackedViewItems = useMemo(() => {
    if (viewMode !== 'stacked') return [];
    const stackItems = groupedLabResults.map(g => ({
      type: 'stack',
      key: g.key,
      sortDate: g.latest_date || '',
      data: g,
    }));
    const pdfItems = filteredLabResults
      .filter(r => parentIdsWithComponents.has(r.id))
      .map(r => ({
        type: 'pdf',
        key: `pdf:${r.id}`,
        sortDate: r.completed_date || r.ordered_date || '',
        data: r,
      }));
    return [...stackItems, ...pdfItems].sort((a, b) => b.sortDate.localeCompare(a.sortDate));
  }, [viewMode, groupedLabResults, filteredLabResults, parentIdsWithComponents]);

  const paginatedStackedItems = paginateData(stackedViewItems);

  useEffect(() => {
    resetPage();
  }, [dataManagement.hasActiveFilters, resetPage]);
  useEffect(() => {
    const count =
      viewMode === 'stacked' ? stackedViewItems.length : filteredLabResults.length;
    clampPage(count);
  }, [filteredLabResults.length, stackedViewItems.length, viewMode, clampPage]);

  // Combined loading state — include component fetch when in stacked view to avoid flash of ungrouped results
  const loading = labResultsLoading || practitionersLoading || (viewMode === 'stacked' && patientComponentsLoading);

  // Document management state
  const [documentManagerMethods, setDocumentManagerMethods] = useState(null);

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
      if (returningToStackRef.current) {
        returningToStackRef.current = false;
        setStackPanelOpen(true);
      }
      setInitialViewTab('overview');
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
    value: null,
    unit: null,
    ref_range_min: null,
    ref_range_max: null,
    ref_range_text: null,
  });

  // Modern CRUD handlers using useMedicalData - memoized to prevent LabResultCard re-renders
  const handleAddLabResult = useCallback(() => {
    resetSubmission(); // Reset submission state
    setEditingLabResult(null);
    setDocumentManagerMethods(null); // Reset document manager methods
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
      value: null,
      unit: null,
      ref_range_min: null,
      ref_range_max: null,
      ref_range_text: null,
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
        value: labResult.value ?? null,
        unit: labResult.unit || null,
        ref_range_min: labResult.ref_range_min ?? null,
        ref_range_max: labResult.ref_range_max ?? null,
        ref_range_text: labResult.ref_range_text || null,
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

  const handleViewComponent = useCallback(
    async result => {
      returningToStackRef.current = true;
      const parentId = result.parent_lab_result_id;
      const parent = labResults?.find(r => r.id === parentId);
      const openParent = lr => {
        setInitialViewTab('test-components');
        setViewingLabResult(lr);
        setShowViewModal(true);
      };
      if (parent) {
        openParent(parent);
      } else {
        try {
          const fetched = await apiService.getLabResult(parentId);
          if (fetched) openParent(fetched);
        } catch {
          returningToStackRef.current = false;
        }
      }
    },
    [labResults, setViewingLabResult, setShowViewModal]
  );

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
    if (returningToStackRef.current) {
      returningToStackRef.current = false;
      setStackPanelOpen(true);
    }
    setDocumentManagerMethods(null); // Reset document manager methods
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
      value: null,
      unit: null,
      ref_range_min: null,
      ref_range_max: null,
      ref_range_text: null,
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

    if (viewMode === 'stacked') {
      return (
        <AnimatedCardGrid
          items={paginatedStackedItems}
          keyExtractor={item => item.key}
          columns={{ base: 12, sm: 6, lg: 4 }}
          renderCard={item => {
            if (item.type === 'stack') {
              const group = item.data;
              return (
                <LabResultStackCard
                  group={
                    displayCountByGroupKey[group.key]
                      ? { ...group, count: displayCountByGroupKey[group.key] }
                      : group
                  }
                  onDrillDown={g => {
                    setSelectedGroupKey(g.key);
                    setStackPanelOpen(true);
                  }}
                />
              );
            }
            return (
              <LabResultCard
                labResult={item.data}
                onEdit={handleEditLabResult}
                onDelete={() => handleDeleteLabResult(item.data.id)}
                onView={handleViewLabResult}
                practitioners={practitioners}
                fileCount={fileCounts[item.data.id] || 0}
                fileCountLoading={fileCountsLoading[item.data.id] || false}
                navigate={navigate}
                disableActions={isViewOnly}
                disableActionsTooltip={viewOnlyTooltip}
                isGroupedResult={true}
              />
            );
          }}
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
              isGroupedResult={parentIdsWithComponents.has(result.id)}
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
            viewModes={['cards', 'table', 'stacked', 'components']}
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
          {viewMode !== 'components' &&
            (viewMode === 'stacked'
              ? stackedViewItems.length > 0
              : filteredLabResults.length > 0) && (
            <PaginationControls
              page={page}
              totalPages={totalPages(
                viewMode === 'stacked'
                  ? stackedViewItems.length
                  : filteredLabResults.length
              )}
              pageSize={pageSize}
              totalRecords={
                viewMode === 'stacked'
                  ? stackedViewItems.length
                  : filteredLabResults.length
              }
              onPageChange={setPage}
              onPageSizeChange={handlePageSizeChange}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          )}
        </Stack>
      </Container>

      {/* Stack drill-down panel */}
      {currentPatient?.id && (
        <LabResultStackPanel
          opened={stackPanelOpen}
          onClose={() => setStackPanelOpen(false)}
          group={enrichedSelectedGroup}
          onViewResult={result => {
            returningToStackRef.current = true;
            setInitialViewTab('overview');
            handleViewLabResult(result);
          }}
          onEditResult={result => {
            returningToStackRef.current = true;
            handleEditLabResult(result);
          }}
          onDeleteResult={result => handleDeleteLabResult(result.id)}
          onViewComponent={handleViewComponent}
          disableActions={isViewOnly}
        />
      )}

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
          onPendingRelationshipsRef={setPendingRelationshipsMethods}
          isGroupedResult={!!(editingLabResult && parentIdsWithComponents.has(editingLabResult.id))}
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
