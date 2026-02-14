import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { useEntityFileCounts } from '../../hooks/useEntityFileCounts';
import { useViewModalNavigation } from '../../hooks/useViewModalNavigation';
import { apiService } from '../../services/api';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { usePatientWithStaticData } from '../../hooks/useGlobalData';
import { getEntityFormatters } from '../../utils/tableFormatters';
import { useDateFormat } from '../../hooks/useDateFormat';
import { PageHeader } from '../../components';
import { withResponsive } from '../../hoc/withResponsive';
import { useResponsive } from '../../hooks/useResponsive';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import logger from '../../services/logger';
import MedicalPageFilters from '../../components/shared/MedicalPageFilters';
import { ResponsiveTable } from '../../components/adapters';
import MedicalPageActions from '../../components/shared/MedicalPageActions';
import EmptyState from '../../components/shared/EmptyState';
import MedicalPageLoading from '../../components/shared/MedicalPageLoading';
import AnimatedCardGrid from '../../components/shared/AnimatedCardGrid';

// Modular components
import TreatmentCard from '../../components/medical/treatments/TreatmentCard';
import TreatmentViewModal from '../../components/medical/treatments/TreatmentViewModal';
import TreatmentFormWrapper from '../../components/medical/treatments/TreatmentFormWrapper';
import {
  Button,
  Card,
  Stack,
  Text,
  Container,
  Alert,
  Paper,
} from '@mantine/core';
import MedicalPageAlerts from '../../components/shared/MedicalPageAlerts';

const Treatments = () => {
  const { t } = useTranslation('common');
  const { formatDate } = useDateFormat();
  const navigate = useNavigate();
  const responsive = useResponsive();
  const [viewMode, setViewMode] = usePersistedViewMode('cards');

  // Get practitioners data
  const { practitioners: practitionersObject } =
    usePatientWithStaticData();

  const practitioners = practitionersObject?.practitioners || [];

  // Get standardized formatters for treatments
  const treatmentFormatters = getEntityFormatters('treatments', practitioners, navigate, null, formatDate);

  // Modern data management with useMedicalData
  const {
    items: treatments,
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
    entityName: 'treatment',
    apiMethodsConfig: {
      getAll: signal => apiService.getTreatments(signal),
      getByPatient: (patientId, signal) => apiService.getPatientTreatments(patientId, signal),
      create: (data, signal) => apiService.createTreatment(data, signal),
      update: (id, data, signal) =>
        apiService.updateTreatment(id, data, signal),
      delete: (id, signal) => apiService.deleteTreatment(id, signal),
    },
    requiresPatient: true,
  });

  // Conditions data for dropdown - following DRY principles with existing pattern
  const {
    items: conditions,
    loading: conditionsLoading,
    error: conditionsError,
  } = useMedicalData({
    entityName: 'conditionsDropdown',
    apiMethodsConfig: {
      getAll: signal => apiService.getConditions(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientConditions(patientId, signal),
    },
    requiresPatient: true, // Get conditions for the current patient only
  });

  // Get standardized configuration
  const config = getMedicalPageConfig('treatments');

  // Use standardized data management
  const dataManagement = useDataManagement(treatments, config);

  // File count management for cards
  const { fileCounts, fileCountsLoading, cleanupFileCount } = useEntityFileCounts('treatment', treatments);

  // View modal navigation with URL deep linking
  const {
    isOpen: showViewModal,
    viewingItem: viewingTreatment,
    openModal: handleViewTreatment,
    closeModal: handleCloseViewModal,
  } = useViewModalNavigation({
    items: treatments,
    loading,
  });

  // Form and UI state
  const [showModal, setShowModal] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState(null);
  const [formData, setFormData] = useState({
    treatment_name: '',
    treatment_type: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'planned',
    dosage: '',
    frequency: '',
    mode: 'simple',
    notes: '',
    condition_id: '',
    practitioner_id: '',
    tags: [],
  });

  const handleAddTreatment = () => {
    setEditingTreatment(null);
    setFormData({
      treatment_name: '',
      treatment_type: '',
      description: '',
      start_date: '',
      end_date: '',
      status: 'planned',
      dosage: '',
      frequency: '',
      mode: 'simple',
      notes: '',
      condition_id: '',
      practitioner_id: '',
      tags: [],
    });
    setShowModal(true);
  };

  const handleEditTreatment = treatment => {
    setEditingTreatment(treatment);
    setFormData({
      treatment_name: treatment.treatment_name || '',
      treatment_type: treatment.treatment_type || '',
      description: treatment.description || '',
      start_date: treatment.start_date || '',
      end_date: treatment.end_date || '',
      status: treatment.status || 'planned',
      dosage: treatment.dosage || '',
      frequency: treatment.frequency || '',
      mode: treatment.mode || 'simple',
      notes: treatment.notes || '',
      condition_id: treatment.condition_id ? String(treatment.condition_id) : '',
      practitioner_id: treatment.practitioner_id ? String(treatment.practitioner_id) : '',
      tags: treatment.tags || [],
    });
    setShowModal(true);
  };

  const handleDeleteTreatment = async treatmentId => {
    const success = await deleteItem(treatmentId);
    if (success) {
      cleanupFileCount(treatmentId);
      await refreshData();
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();

    // Validation - only treatment_name is required
    if (!formData.treatment_name.trim()) {
      setError('Treatment name is required');
      return;
    }

    // Validate end date is after start date (only if both are provided)
    if (
      formData.end_date &&
      formData.start_date &&
      new Date(formData.end_date) < new Date(formData.start_date)
    ) {
      setError('End date cannot be before start date');
      return;
    }

    if (!currentPatient?.id) {
      setError('Patient information not available');
      return;
    }

    const treatmentData = {
      treatment_name: formData.treatment_name,
      treatment_type: formData.treatment_type || null,
      description: formData.description || null,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      status: formData.status,
      dosage: formData.dosage || null,
      frequency: formData.frequency || null,
      mode: formData.mode || 'simple',
      notes: formData.notes || null,
      tags: formData.tags || [],
      patient_id: currentPatient.id,
      condition_id: formData.condition_id || null,
      practitioner_id: formData.practitioner_id || null,
    };

    let success;
    if (editingTreatment) {
      success = await updateItem(editingTreatment.id, treatmentData);
    } else {
      success = await createItem(treatmentData);
    }

    if (success) {
      setShowModal(false);
      await refreshData();
      return success;
    }
  };

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Helper functions moved to component files, keeping these for table formatters
  const getConditionName = conditionId => {
    if (!conditionId || !conditions || conditions.length === 0) {
      return null;
    }
    const condition = conditions.find(c => c.id === conditionId);
    return condition ? condition.diagnosis || condition.name : null;
  };

  const getPractitionerInfo = practitionerId => {
    if (
      !practitionerId ||
      !practitioners ||
      practitioners.length === 0
    ) {
      return null;
    }
    const practitioner = practitioners.find(
      p => p.id === practitionerId
    );
    return practitioner;
  };

  // Generic handler factory for navigating to entity pages with view modal
  const createEntityClickHandler = (path) => (entityId) => {
    if (entityId) {
      navigate(`${path}?view=${entityId}`);
    }
  };

  const handleConditionClick = createEntityClickHandler('/conditions');
  const handleMedicationClick = createEntityClickHandler('/medications');
  const handleEncounterClick = createEntityClickHandler('/visits');
  const handleLabResultClick = createEntityClickHandler('/lab-results');
  const handleEquipmentClick = createEntityClickHandler('/medical-equipment');

  // Get processed data from data management
  const filteredTreatments = dataManagement.data;

  if (loading) {
    return (
      <MedicalPageLoading
        message={t('treatments.loadingTreatments', 'Loading treatments...')}
        hint={t('treatments.loadingHint', 'If this takes too long, please refresh the page')}
      />
    );
  }

  return (
    <>
      <Container size="xl" py="md">
        <PageHeader title={t('treatments.title', 'Treatments')} icon="🩹" />

        <Stack gap="lg">
          <MedicalPageAlerts
            error={error}
            successMessage={successMessage}
            onClearError={clearError}
          />
          {conditionsError && (
            <Alert
              variant="light"
              color="orange"
              title={t('treatments.conditionsLoadingError', 'Conditions Loading Error')}
            >
              {conditionsError}
            </Alert>
          )}

          <MedicalPageActions
            primaryAction={{
              label: t('treatments.addTreatment', '+ Add Treatment'),
              onClick: handleAddTreatment,
            }}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            mb={0}
          />

          {/* Mantine Filter Controls */}
          <MedicalPageFilters dataManagement={dataManagement} config={config} />

          {filteredTreatments.length === 0 ? (
            <EmptyState
              emoji="🩹"
              title={t('treatments.noTreatmentsFound', 'No Treatments Found')}
              hasActiveFilters={dataManagement.hasActiveFilters}
              filteredMessage={t('treatments.tryAdjustingFilters', 'Try adjusting your search or filter criteria.')}
              noDataMessage={t('treatments.startAdding', 'Start by adding your first treatment.')}
              actionButton={
                <Button variant="filled" onClick={handleAddTreatment}>
                  {t('treatments.addFirstTreatment', 'Add Your First Treatment')}
                </Button>
              }
            />
          ) : viewMode === 'cards' ? (
            <AnimatedCardGrid
              items={filteredTreatments}
              columns={{ base: 12, sm: 6, lg: 4 }}
              renderCard={(treatment) => (
                <TreatmentCard
                  treatment={treatment}
                  conditions={conditions}
                  onEdit={handleEditTreatment}
                  onDelete={handleDeleteTreatment}
                  onView={handleViewTreatment}
                  onConditionClick={handleConditionClick}
                  navigate={navigate}
                  fileCount={fileCounts[treatment.id] || 0}
                  fileCountLoading={fileCountsLoading[treatment.id] || false}
                  onError={(error) => {
                    logger.error('TreatmentCard error', {
                      treatmentId: treatment.id,
                      error: error.message,
                      page: 'Treatments',
                    });
                  }}
                />
              )}
            />
          ) : (
            <Paper shadow="sm" radius="md" withBorder>
              <ResponsiveTable
              persistKey="treatments"
              data={filteredTreatments}
              columns={[
                  { header: 'Treatment', accessor: 'treatment_name', priority: 'high', width: 200 },
                  { header: 'Type', accessor: 'treatment_type', priority: 'medium', width: 120 },
                  { header: 'Practitioner', accessor: 'practitioner', priority: 'low', width: 150 },
                  { header: 'Related Condition', accessor: 'condition', priority: 'low', width: 150 },
                  { header: 'Start Date', accessor: 'start_date', priority: 'high', width: 120 },
                  { header: 'End Date', accessor: 'end_date', priority: 'medium', width: 120 },
                  { header: 'Status', accessor: 'status', priority: 'high', width: 120 },
                  { header: 'Dosage', accessor: 'dosage', priority: 'low', width: 150 },
                  { header: 'Frequency', accessor: 'frequency', priority: 'low', width: 150 },
                  { header: 'Notes', accessor: 'notes', priority: 'low', width: 200 }
                ]}
              patientData={currentPatient}
              tableName="Treatments"
              onView={handleViewTreatment}
              onEdit={handleEditTreatment}
              onDelete={handleDeleteTreatment}
              formatters={{
                treatment_name: treatmentFormatters.treatment_name,
                treatment_type: treatmentFormatters.treatment_type,
                practitioner: (value, row) => {
                  if (row.practitioner_id) {
                    const practitionerInfo = getPractitionerInfo(
                      row.practitioner_id
                    );
                    return `Dr. ${
                      row.practitioner?.name ||
                      practitionerInfo?.name ||
                      `#${row.practitioner_id}`
                    }`;
                  }
                  return 'No practitioner';
                },
                condition: (value, row) => {
                  if (row.condition_id) {
                    return (
                      row.condition?.diagnosis ||
                      getConditionName(row.condition_id) ||
                      `Condition #${row.condition_id}`
                    );
                  }
                  return 'No condition linked';
                },
                start_date: treatmentFormatters.start_date,
                end_date: treatmentFormatters.end_date,
                status: treatmentFormatters.status,
                dosage: treatmentFormatters.dosage,
                frequency: treatmentFormatters.frequency,
                notes: treatmentFormatters.notes,
              }}
              dataType="medical"
              responsive={responsive}
            />
          </Paper>
          )}
        </Stack>
      </Container>

      <TreatmentFormWrapper
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTreatment ? 'Edit Treatment' : 'Add New Treatment'}
        editingTreatment={editingTreatment}
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        conditionsOptions={conditions}
        conditionsLoading={conditionsLoading}
        practitionersOptions={practitioners}
        practitionersLoading={false}
        isLoading={false}
      />

      <TreatmentViewModal
        isOpen={showViewModal}
        onClose={handleCloseViewModal}
        treatment={viewingTreatment}
        onEdit={handleEditTreatment}
        conditions={conditions}
        practitioners={practitioners}
        onConditionClick={handleConditionClick}
        onMedicationClick={handleMedicationClick}
        onEncounterClick={handleEncounterClick}
        onLabResultClick={handleLabResultClick}
        onEquipmentClick={handleEquipmentClick}
        navigate={navigate}
      />
    </>
  );
};

// Wrap with responsive HOC for enhanced responsive capabilities
export default withResponsive(Treatments, {
  injectResponsive: true,
  displayName: 'ResponsiveTreatments'
});
