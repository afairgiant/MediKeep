import logger from '../../services/logger';

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Container,
  Paper,
  Group,
  Text,
  Stack,
  Alert,
  Grid,
  Button,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCheck,
  IconPlus,
} from '@tabler/icons-react';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { useEntityFileCounts } from '../../hooks/useEntityFileCounts';
import { useViewModalNavigation } from '../../hooks/useViewModalNavigation';
import { apiService } from '../../services/api';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { getEntityFormatters } from '../../utils/tableFormatters';
import { navigateToEntity } from '../../utils/linkNavigation';
import { PageHeader } from '../../components';
import { ResponsiveTable } from '../../components/adapters';
import MantineFilters from '../../components/mantine/MantineFilters';
import ViewToggle from '../../components/shared/ViewToggle';
import EmptyState from '../../components/shared/EmptyState';
import MedicalPageLoading from '../../components/shared/MedicalPageLoading';
import { AllergyCard, AllergyViewModal, AllergyFormWrapper } from '../../components/medical/allergies';
import { withResponsive } from '../../hoc/withResponsive';
import { useResponsive } from '../../hooks/useResponsive';

const Allergies = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('medical');
  const { t: tCommon } = useTranslation('common');
  const responsive = useResponsive();
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'

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
      apiService.getPatientMedications(currentPatient.id)
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
  const { fileCounts, fileCountsLoading, cleanupFileCount } = useEntityFileCounts('allergy', allergies);

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
    ...getEntityFormatters('allergies', [], navigate),
    medication_name: (value, allergy) => {
      const medication = medications.find(med => med.id === allergy.medication_id);
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
    resetForm();
    setShowAddForm(true);
  };

  const handleEditAllergy = allergy => {
    setFormData({
      allergen: allergy.allergen || '',
      severity: allergy.severity || '',
      reaction: allergy.reaction || '',
      onset_date: allergy.onset_date || '',
      status: allergy.status || 'active',
      notes: allergy.notes || '',
      medication_id: allergy.medication_id ? allergy.medication_id.toString() : '',
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

    const allergyData = {
      ...formData,
      onset_date: formData.onset_date || null,
      notes: formData.notes || null,
      medication_id: formData.medication_id ? parseInt(formData.medication_id) : null,
      patient_id: currentPatient.id,
    };

    let success;
    if (editingAllergy) {
      success = await updateItem(editingAllergy.id, allergyData);
    } else {
      success = await createItem(allergyData);
    }

    if (success) {
      resetForm();
      await refreshData();
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

  if (loading) {
    return <MedicalPageLoading message={t('allergies.messages.loading', 'Loading allergies...')} />;
  }

  return (
    <Container size="xl" py="md">
      <PageHeader title={t('allergies.title')} icon="⚠️" />

      <Stack gap="lg">
        {error && (
          <Alert
            variant="light"
            color="red"
            title={tCommon('labels.error', 'Error')}
            icon={<IconAlertTriangle size={16} />}
            withCloseButton
            onClose={clearError}
            mb="md"
            style={{ whiteSpace: 'pre-line' }}
          >
            {error}
          </Alert>
        )}

        {successMessage && (
          <Alert
            variant="light"
            color="green"
            title={tCommon('labels.success', 'Success')}
            icon={<IconCheck size={16} />}
            mb="md"
          >
            {successMessage}
          </Alert>
        )}

        <Group justify="space-between" mb="lg">
          <Button
            variant="filled"
            leftSection={<IconPlus size={16} />}
            onClick={handleAddAllergy}
            size="md"
          >
            {t('allergies.addNew', 'Add New Allergy')}
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
          categoryOptions={dataManagement.categoryOptions}
          dateRangeOptions={dataManagement.dateRangeOptions}
          sortOptions={dataManagement.sortOptions}
          sortBy={dataManagement.sortBy}
          sortOrder={dataManagement.sortOrder}
          handleSortChange={dataManagement.handleSortChange}
          totalCount={dataManagement.totalCount}
          filteredCount={dataManagement.filteredCount}
          config={config.filterControls}
        />

        {/* Form Modal */}
        <AllergyFormWrapper
          isOpen={showAddForm}
          onClose={resetForm}
          title={editingAllergy ? t('allergies.editTitle', 'Edit Allergy') : t('allergies.addTitle', 'Add New Allergy')}
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          editingAllergy={editingAllergy}
          medicationsOptions={medications}
          medicationsLoading={false}
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
              filteredMessage={t('allergies.emptyState.filtered', 'Try adjusting your search or filter criteria.')}
              noDataMessage={t('allergies.emptyState.noData', 'Click "Add New Allergy" to get started.')}
            />
          ) : viewMode === 'cards' ? (
            <Grid>
              <AnimatePresence>
                {processedAllergies.map((allergy, index) => (
                  <Grid.Col
                    key={allergy.id}
                    span={responsive.isMobile ? 12 : responsive.isTablet ? 6 : 4}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
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
                      />
                    </motion.div>
                  </Grid.Col>
                ))}
              </AnimatePresence>
            </Grid>
          ) : (
            <Paper shadow="sm" radius="md" withBorder>
              <ResponsiveTable
                data={processedAllergies}
                columns={[
                  { header: t('allergies.allergen.label'), accessor: 'allergen', priority: 'high', width: 150 },
                  { header: t('allergies.reaction.label'), accessor: 'reaction', priority: 'high', width: 180 },
                  { header: t('common.fields.severity.label'), accessor: 'severity', priority: 'high', width: 100 },
                  { header: t('allergies.onsetDate.label'), accessor: 'onset_date', priority: 'medium', width: 120 },
                  { header: t('allergies.relatedMedication.label'), accessor: 'medication_name', priority: 'low', width: 150 },
                  { header: t('common.fields.status.label'), accessor: 'status', priority: 'medium', width: 100 },
                  { header: t('common.fields.notes.label'), accessor: 'notes', priority: 'low', width: 200 },
                ]}
                patientData={currentPatient}
                tableName={t('allergies.title')}
                onView={handleViewAllergy}
                onEdit={handleEditAllergy}
                onDelete={handleDeleteAllergy}
                formatters={formatters}
                dataType="medical"
                responsive={responsive}
              />
            </Paper>
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
        />
      </Stack>
    </Container>
  );
};

// Wrap with responsive HOC for enhanced responsive capabilities
export default withResponsive(Allergies, {
  injectResponsive: true,
  displayName: 'ResponsiveAllergies'
});
