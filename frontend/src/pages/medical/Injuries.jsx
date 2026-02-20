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
  IconBandage,
  IconPlus,
} from '@tabler/icons-react';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { useEntityFileCounts } from '../../hooks/useEntityFileCounts';
import { useViewModalNavigation } from '../../hooks/useViewModalNavigation';
import { apiService } from '../../services/api';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { getEntityFormatters } from '../../utils/tableFormatters';
import { useDateFormat } from '../../hooks/useDateFormat';
import { PageHeader } from '../../components';
import { ResponsiveTable } from '../../components/adapters';
import MedicalPageFilters from '../../components/shared/MedicalPageFilters';
import MedicalPageActions from '../../components/shared/MedicalPageActions';
import EmptyState from '../../components/shared/EmptyState';
import MedicalPageAlerts from '../../components/shared/MedicalPageAlerts';
import MedicalPageLoading from '../../components/shared/MedicalPageLoading';
import AnimatedCardGrid from '../../components/shared/AnimatedCardGrid';
import { InjuryCard, InjuryViewModal, InjuryFormWrapper } from '../../components/medical/injuries';
import { withResponsive } from '../../hoc/withResponsive';
import { useResponsive } from '../../hooks/useResponsive';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import logger from '../../services/logger';

const Injuries = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('medical');
  const { formatDate } = useDateFormat();
  const responsive = useResponsive();
  const [viewMode, setViewMode] = usePersistedViewMode('injuries');

  // Standardized data management
  const {
    items: injuries,
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
    entityName: 'injury',
    apiMethodsConfig: {
      getAll: signal => apiService.getInjuries(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientInjuries(patientId, signal),
      create: (data, signal) => apiService.createInjury(data, signal),
      update: (id, data, signal) => apiService.updateInjury(id, data, signal),
      delete: (id, signal) => apiService.deleteInjury(id, signal),
    },
    requiresPatient: true,
  });

  // Get standardized configuration
  const config = getMedicalPageConfig('injuries');

  // Use standardized data management
  const dataManagement = useDataManagement(injuries, config);

  // Get practitioners for linking
  const [practitioners, setPractitioners] = useState([]);
  const [practitionersLoading, setPractitionersLoading] = useState(false);

  // Get injury types for dropdown
  const [injuryTypes, setInjuryTypes] = useState([]);
  const [injuryTypesLoading, setInjuryTypesLoading] = useState(false);

  useEffect(() => {
    // Fetch practitioners
    setPractitionersLoading(true);
    apiService.getPractitioners()
      .then(response => {
        // Ensure we always set an array
        setPractitioners(Array.isArray(response) ? response : []);
      })
      .catch(err => {
        logger.error('injuries_fetch_practitioners_error', 'Failed to fetch practitioners', {
          component: 'Injuries',
          error: err.message,
        });
        setPractitioners([]);
      })
      .finally(() => setPractitionersLoading(false));

    // Fetch injury types
    setInjuryTypesLoading(true);
    apiService.getInjuryTypes()
      .then(response => {
        // Ensure we always set an array
        setInjuryTypes(Array.isArray(response) ? response : []);
      })
      .catch(err => {
        logger.error('injuries_fetch_types_error', 'Failed to fetch injury types', {
          component: 'Injuries',
          error: err.message,
        });
        setInjuryTypes([]);
      })
      .finally(() => setInjuryTypesLoading(false));
  }, []);

  // File count management for cards
  const { fileCounts, fileCountsLoading, cleanupFileCount } = useEntityFileCounts('injury', injuries);

  // View modal navigation with URL deep linking
  const {
    isOpen: showViewModal,
    viewingItem: viewingInjury,
    openModal: handleViewInjury,
    closeModal: handleCloseViewModal,
  } = useViewModalNavigation({
    items: injuries,
    loading,
  });

  // Get standardized formatters for injuries
  const formatters = {
    ...getEntityFormatters('injuries', [], navigate, null, formatDate),
    practitioner_name: (value, injury) => {
      const practitioner = practitioners.find(p => p.id === injury.practitioner_id);
      return practitioner?.name || '';
    },
    injury_type_name: (value, injury) => {
      const injuryType = injuryTypes.find(t => t.id === injury.injury_type_id);
      return injuryType?.name || '';
    },
  };

  // Form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingInjury, setEditingInjury] = useState(null);
  const [formData, setFormData] = useState({
    injury_name: '',
    injury_type_id: null,
    body_part: '',
    laterality: '',
    date_of_injury: '',
    mechanism: '',
    severity: '',
    status: 'active',
    treatment_received: '',
    recovery_notes: '',
    practitioner_id: null,
    notes: '',
    tags: [],
  });

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      injury_name: '',
      injury_type_id: null,
      body_part: '',
      laterality: '',
      date_of_injury: '',
      mechanism: '',
      severity: '',
      status: 'active',
      treatment_received: '',
      recovery_notes: '',
      practitioner_id: null,
      notes: '',
      tags: [],
    });
    setEditingInjury(null);
    setShowAddForm(false);
  };

  const handleAddInjury = () => {
    resetForm();
    setShowAddForm(true);
  };

  const handleEditInjury = injury => {
    setFormData({
      injury_name: injury.injury_name || '',
      injury_type_id: injury.injury_type_id || null,
      body_part: injury.body_part || '',
      laterality: injury.laterality || '',
      date_of_injury: injury.date_of_injury || '',
      mechanism: injury.mechanism || '',
      severity: injury.severity || '',
      status: injury.status || 'active',
      treatment_received: injury.treatment_received || '',
      recovery_notes: injury.recovery_notes || '',
      practitioner_id: injury.practitioner_id || null,
      notes: injury.notes || '',
      tags: injury.tags || [],
    });
    setEditingInjury(injury);
    setShowAddForm(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!currentPatient?.id) {
      setError('Patient information not available');
      return;
    }

    const injuryData = {
      ...formData,
      date_of_injury: formData.date_of_injury || null,
      mechanism: formData.mechanism || null,
      severity: formData.severity || null,
      laterality: formData.laterality || null,
      treatment_received: formData.treatment_received || null,
      recovery_notes: formData.recovery_notes || null,
      practitioner_id: formData.practitioner_id || null,
      injury_type_id: formData.injury_type_id || null,
      notes: formData.notes || null,
      patient_id: currentPatient.id,
    };

    let success;
    if (editingInjury) {
      success = await updateItem(editingInjury.id, injuryData);
    } else {
      success = await createItem(injuryData);
    }

    if (success) {
      resetForm();
      await refreshData();
    }
  };

  const handleDeleteInjury = async injuryId => {
    const success = await deleteItem(injuryId);
    if (success) {
      cleanupFileCount(injuryId);
      await refreshData();
    }
  };

  // Get processed data from data management
  const processedInjuries = dataManagement.data;

  if (loading) {
    return <MedicalPageLoading message={t('injuries.messages.loading', 'Loading injuries...')} />;
  }

  return (
    <Container size="xl" py="md">
      <PageHeader title={t('injuries.title', 'Injuries')} icon={<IconBandage size={24} />} />

      <Stack gap="lg">
        <MedicalPageAlerts
          error={error}
          successMessage={successMessage}
          onClearError={clearError}
        />

        <MedicalPageActions
          primaryAction={{
            label: t('injuries.addNew', 'Add New Injury'),
            onClick: handleAddInjury,
            leftSection: <IconPlus size={16} />,
          }}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Mantine Filter Controls */}
        <MedicalPageFilters dataManagement={dataManagement} config={config} />

        {/* Form Modal */}
        <InjuryFormWrapper
          isOpen={showAddForm}
          onClose={resetForm}
          title={editingInjury ? t('injuries.editTitle', 'Edit Injury') : t('injuries.addTitle', 'Add New Injury')}
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          editingInjury={editingInjury}
          practitionersOptions={practitioners}
          practitionersLoading={practitionersLoading}
          injuryTypes={injuryTypes}
          injuryTypesLoading={injuryTypesLoading}
        />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {processedInjuries.length === 0 ? (
            <EmptyState
              icon={IconBandage}
              title={t('injuries.emptyState.title', 'No injuries found')}
              hasActiveFilters={dataManagement.hasActiveFilters}
              filteredMessage={t('injuries.emptyState.filtered', 'Try adjusting your search or filter criteria.')}
              noDataMessage={t('injuries.emptyState.noData', 'Click "Add New Injury" to get started.')}
            />
          ) : viewMode === 'cards' ? (
            <AnimatedCardGrid
              items={processedInjuries}
              renderCard={(injury) => (
                <InjuryCard
                  injury={injury}
                  onView={handleViewInjury}
                  onEdit={handleEditInjury}
                  onDelete={handleDeleteInjury}
                  practitioners={practitioners}
                  injuryTypes={injuryTypes}
                  navigate={navigate}
                  fileCount={fileCounts[injury.id] || 0}
                  fileCountLoading={fileCountsLoading[injury.id] || false}
                  onError={setError}
                />
              )}
            />
          ) : (
            <Paper shadow="sm" radius="md" withBorder>
              <ResponsiveTable
                persistKey="injuries"
                data={processedInjuries}
                columns={[
                  { header: t('injuries.injuryName.label', 'Injury Name'), accessor: 'injury_name', priority: 'high', width: 180 },
                  { header: t('injuries.bodyPart.label', 'Body Part'), accessor: 'body_part', priority: 'high', width: 120 },
                  { header: t('injuries.dateOfInjury.label', 'Date'), accessor: 'date_of_injury', priority: 'high', width: 110 },
                  { header: t('injuries.injuryType.label', 'Type'), accessor: 'injury_type_name', priority: 'medium', width: 100 },
                  { header: t('common:fields.severity.label', 'Severity'), accessor: 'severity', priority: 'medium', width: 100 },
                  { header: t('common:fields.status.label', 'Status'), accessor: 'status', priority: 'medium', width: 100 },
                  { header: t('injuries.practitioner.label', 'Practitioner'), accessor: 'practitioner_name', priority: 'low', width: 150 },
                ]}
                patientData={currentPatient}
                tableName={t('injuries.title', 'Injuries')}
                onView={handleViewInjury}
                onEdit={handleEditInjury}
                onDelete={handleDeleteInjury}
                formatters={formatters}
                dataType="medical"
                responsive={responsive}
              />
            </Paper>
          )}
        </motion.div>

        {/* Injury View Modal */}
        <InjuryViewModal
          isOpen={showViewModal}
          onClose={handleCloseViewModal}
          injury={viewingInjury}
          onEdit={handleEditInjury}
          practitioners={practitioners}
          injuryTypes={injuryTypes}
          navigate={navigate}
        />
      </Stack>
    </Container>
  );
};

// Wrap with responsive HOC for enhanced responsive capabilities
export default withResponsive(Injuries, {
  injectResponsive: true,
  displayName: 'ResponsiveInjuries'
});
