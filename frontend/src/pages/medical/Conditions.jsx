import logger from '../../services/logger';

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Container,
  Paper,
  Stack,
} from '@mantine/core';
import {
  IconPlus,
  IconShieldCheck,
} from '@tabler/icons-react';
import { useMedicalData, useDataManagement, useEntityFileCounts, useViewModalNavigation } from '../../hooks';
import EmptyState from '../../components/shared/EmptyState';
import MedicalPageAlerts from '../../components/shared/MedicalPageAlerts';
import { apiService } from '../../services/api';
import { useDateFormat } from '../../hooks/useDateFormat';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { getEntityFormatters } from '../../utils/tableFormatters';
import { 
  formatDateForAPI, 
  getTodayString, 
  isDateInFuture, 
  isEndDateBeforeStartDate 
} from '../../utils/dateUtils';
import { PageHeader } from '../../components';
import { ResponsiveTable } from '../../components/adapters';
import MedicalPageFilters from '../../components/shared/MedicalPageFilters';
import MedicalPageActions from '../../components/shared/MedicalPageActions';
import MedicalPageLoading from '../../components/shared/MedicalPageLoading';
import AnimatedCardGrid from '../../components/shared/AnimatedCardGrid';
import { withResponsive } from '../../hoc/withResponsive';
import { useResponsive } from '../../hooks/useResponsive';

// Modular components
import {
  ConditionCard,
  ConditionViewModal,
  ConditionFormWrapper,
} from '../../components/medical/conditions';

const Conditions = () => {
  const { t } = useTranslation('common');
  const { formatDate } = useDateFormat();
  const navigate = useNavigate();
  const responsive = useResponsive();
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'
  
  // Load medications and practitioners for linking dropdowns
  const [medications, setMedications] = useState([]);
  const [practitioners, setPractitioners] = useState([]);

  // Condition-medication relationships (for the junction table)
  const [conditionMedications, setConditionMedications] = useState({});
  

  // Standardized data management
  const {
    items: conditions,
    currentPatient,
    loading,
    error,
    successMessage,
    createItem,
    updateItem,
    deleteItem,
    refreshData,
    clearError,
    setSuccessMessage,
    setError,
  } = useMedicalData({
    entityName: 'condition',
    apiMethodsConfig: {
      getAll: signal => apiService.getConditions(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientConditions(patientId, signal),
      create: (data, signal) => apiService.createCondition(data, signal),
      update: (id, data, signal) =>
        apiService.updateCondition(id, data, signal),
      delete: (id, signal) => apiService.deleteCondition(id, signal),
    },
    requiresPatient: true,
  });

  // Standardized filtering and sorting using configuration
  const config = getMedicalPageConfig('conditions');
  const dataManagement = useDataManagement(conditions, config);

  // File count management for cards
  const { fileCounts, fileCountsLoading, cleanupFileCount } = useEntityFileCounts('condition', conditions);

  // View modal navigation with URL deep linking
  const {
    isOpen: showViewModal,
    viewingItem: viewingCondition,
    openModal: handleViewCondition,
    closeModal: handleCloseViewModal,
  } = useViewModalNavigation({
    items: conditions,
    loading,
  });

  // Get standardized formatters for conditions
  const conditionsFormatters = getEntityFormatters('conditions', [], navigate, null, formatDate);

  // Form and UI state
  const [showModal, setShowModal] = useState(false);
  const [editingCondition, setEditingCondition] = useState(null);
  const [formData, setFormData] = useState({
    condition_name: '',
    diagnosis: '',
    notes: '',
    status: 'active',
    severity: '',
    practitioner_id: '',
    icd10_code: '',
    snomed_code: '',
    code_description: '',
    onset_date: '', // Form field name
    end_date: '', // Form field name
    tags: [],
    pending_medication_ids: [], // For linking medications during creation
  });

  const handleAddCondition = () => {
    setEditingCondition(null);
    // Apply default status early to avoid validation conflicts
    setFormData({
      condition_name: '',
      diagnosis: '',
      notes: '',
      status: 'active', // Default status applied early
      severity: '',
      practitioner_id: '',
      icd10_code: '',
      snomed_code: '',
      code_description: '',
      onset_date: '',
      end_date: '',
      tags: [],
      pending_medication_ids: [],
    });
    setShowModal(true);
  };

  // Load medications and practitioners for linking dropdowns
  useEffect(() => {
    if (currentPatient?.id) {
      // Load medications
      apiService.getPatientMedications(currentPatient.id)
        .then(response => {
          setMedications(response || []);
        })
        .catch(error => {
          logger.error('Failed to fetch medications:', error);
          setMedications([]);
        });

      // Load practitioners
      apiService.getPractitioners()
        .then(response => {
          setPractitioners(response || []);
        })
        .catch(error => {
          logger.error('Failed to fetch practitioners:', error);
          setPractitioners([]);
        });
    }
  }, [currentPatient?.id]);

  // Function to fetch condition-medication relationships
  const fetchConditionMedications = async (conditionId) => {
    try {
      const relationships = await apiService.getConditionMedications(conditionId);
      setConditionMedications(prev => ({
        ...prev,
        [conditionId]: relationships || []
      }));
      return relationships;
    } catch (error) {
      logger.error('Failed to fetch condition medications:', error);
      return [];
    }
  };

  const handleEditCondition = condition => {
    setEditingCondition(condition);
    // Apply default status early if condition doesn't have one
    setFormData({
      condition_name: condition.condition_name || '',
      diagnosis: condition.diagnosis || '',
      notes: condition.notes || '',
      status: condition.status || 'active', // Default status applied early for consistency
      severity: condition.severity || '',
      practitioner_id: condition.practitioner_id ? condition.practitioner_id.toString() : '',
      icd10_code: condition.icd10_code || '',
      snomed_code: condition.snomed_code || '',
      code_description: condition.code_description || '',
      onset_date: condition.onset_date
        ? condition.onset_date.split('T')[0]
        : '',
      end_date: condition.end_date ? condition.end_date.split('T')[0] : '',
      tags: condition.tags || [],
      pending_medication_ids: [], // Not used during edit, but keeps formData shape consistent
    });
    setShowModal(true);
  };

  const handleDeleteCondition = async conditionId => {
    const success = await deleteItem(conditionId);
    if (success) {
      cleanupFileCount(conditionId);
      await refreshData();
    }
  };

  const handlePractitionerClick = (practitionerId) => {
    navigate(`/practitioners?view=${practitionerId}`);
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!currentPatient?.id) {
      setError('Patient information not available');
      return;
    }


    // Validate dates
    const todayString = getTodayString();
    
    if (isDateInFuture(formData.onset_date)) {
      setError(`Onset date (${formData.onset_date}) cannot be in the future. Please select a date on or before today (${todayString}).`);
      return;
    }
    
    if (isDateInFuture(formData.end_date)) {
      setError(`End date (${formData.end_date}) cannot be in the future. Please select a date on or before today (${todayString}).`);
      return;
    }
    
    if (isEndDateBeforeStartDate(formData.onset_date, formData.end_date)) {
      setError('End date cannot be before onset date');
      return;
    }

    // Validate required fields
    if (!formData.status) {
      setError('Status is required. Please select a status.');
      return;
    }
    
    if (!formData.diagnosis) {
      setError('Diagnosis is required.');
      return;
    }

    const conditionData = {
      condition_name: formData.condition_name || null,
      diagnosis: formData.diagnosis,
      notes: formData.notes || null,
      status: formData.status || 'active', // Ensure status has a default
      severity: formData.severity || null,
      practitioner_id: formData.practitioner_id ? parseInt(formData.practitioner_id) : null,
      icd10_code: formData.icd10_code || null,
      snomed_code: formData.snomed_code || null,
      code_description: formData.code_description || null,
      onset_date: formatDateForAPI(formData.onset_date),
      end_date: formatDateForAPI(formData.end_date),
      tags: formData.tags || [],
      patient_id: currentPatient.id,
    };


    const pendingMedications = formData.pending_medication_ids || [];

    const result = editingCondition
      ? await updateItem(editingCondition.id, conditionData)
      : await createItem(conditionData);

    if (!result) {
      return;
    }

    setShowModal(false);
    await refreshData();

    // If creating a new condition with pending medications, link them after creation
    // The createItem hook returns the created entity directly
    if (!editingCondition && pendingMedications.length > 0 && result.id) {
      try {
        await apiService.createConditionMedicationsBulk(result.id, {
          medication_ids: pendingMedications.map(id => parseInt(id)),
          relevance_note: null,
        });
        await fetchConditionMedications(result.id);
      } catch (err) {
        logger.error('Failed to link medications to new condition:', err);
        // Don't show error to user - the condition was created successfully
      }
    }
  };

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const filteredConditions = dataManagement.data;


  if (loading) {
    return <MedicalPageLoading message={t('conditions.loading', 'Loading conditions...')} />;
  }

  return (
    <Container size="xl" py="md">
      <PageHeader title={t('conditions.title', 'Medical Conditions')} icon="🩺" />

      <Stack gap="lg">
        <MedicalPageAlerts
          error={error}
          successMessage={successMessage}
          onClearError={clearError}
        />

        <MedicalPageActions
          primaryAction={{
            label: t('conditions.addNew', 'Add New Condition'),
            onClick: handleAddCondition,
            leftSection: <IconPlus size={16} />,
          }}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Mantine Filter Controls */}
        <MedicalPageFilters dataManagement={dataManagement} config={config} />

        {/* Form Modal */}
        <ConditionFormWrapper
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={editingCondition ? t('conditions.editTitle', 'Edit Condition') : t('conditions.addTitle', 'Add New Condition')}
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          editingCondition={editingCondition}
          practitioners={practitioners}
          medications={medications}
          conditionMedications={conditionMedications}
          fetchConditionMedications={fetchConditionMedications}
          navigate={navigate}
        />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {filteredConditions.length === 0 ? (
            <EmptyState
              icon={IconShieldCheck}
              title={t('conditions.noResults', 'No medical conditions found')}
              hasActiveFilters={dataManagement.hasActiveFilters}
              filteredMessage={t('conditions.tryAdjustingFilters', 'Try adjusting your search or filter criteria.')}
              noDataMessage={t('conditions.getStarted', 'Click "Add New Condition" to get started.')}
            />
          ) : viewMode === 'cards' ? (
            <AnimatedCardGrid
              items={filteredConditions}
              renderCard={(condition) => (
                <ConditionCard
                  condition={condition}
                  onView={handleViewCondition}
                  onEdit={handleEditCondition}
                  onDelete={handleDeleteCondition}
                  navigate={navigate}
                  fileCount={fileCounts[condition.id] || 0}
                  fileCountLoading={fileCountsLoading[condition.id] || false}
                />
              )}
            />
          ) : (
            <Paper shadow="sm" radius="md" withBorder>
              <ResponsiveTable
                data={filteredConditions}
                columns={[
                  { header: t('conditions.table.condition', 'Condition'), accessor: 'diagnosis', priority: 'high', width: 200 },
                  { header: t('conditions.table.severity', 'Severity'), accessor: 'severity', priority: 'high', width: 120 },
                  { header: t('conditions.table.onsetDate', 'Onset Date'), accessor: 'onset_date', priority: 'medium', width: 130 },
                  { header: t('conditions.table.endDate', 'End Date'), accessor: 'end_date', priority: 'low', width: 130 },
                  { header: t('conditions.table.status', 'Status'), accessor: 'status', priority: 'high', width: 100 },
                  { header: t('conditions.table.icd10', 'ICD-10'), accessor: 'icd10_code', priority: 'low', width: 100 },
                  { header: t('conditions.table.notes', 'Notes'), accessor: 'notes', priority: 'low', width: 200 },
                ]}
                patientData={currentPatient}
                tableName={t('conditions.title', 'Conditions')}
                onView={handleViewCondition}
                onEdit={handleEditCondition}
                onDelete={handleDeleteCondition}
                formatters={{
                  diagnosis: conditionsFormatters.condition_name,
                  severity: conditionsFormatters.severity,
                  onset_date: conditionsFormatters.onset_date,
                  end_date: conditionsFormatters.end_date,
                  status: conditionsFormatters.status,
                  icd10_code: conditionsFormatters.simple,
                  notes: conditionsFormatters.notes,
                }}
                dataType="medical"
                responsive={responsive}
              />
            </Paper>
          )}
        </motion.div>

        {/* Condition View Modal */}
        <ConditionViewModal
          isOpen={showViewModal}
          onClose={handleCloseViewModal}
          condition={viewingCondition}
          onEdit={handleEditCondition}
          medications={medications}
          practitioners={practitioners}
          onPractitionerClick={handlePractitionerClick}
          conditionMedications={conditionMedications}
          fetchConditionMedications={fetchConditionMedications}
          navigate={navigate}
        />
      </Stack>
    </Container>
  );
};

// Wrap with responsive HOC for enhanced responsive capabilities
export default withResponsive(Conditions, {
  injectResponsive: true,
  displayName: 'ResponsiveConditions'
});
