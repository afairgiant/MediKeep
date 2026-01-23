import React, { useState } from 'react';
import logger from '../../services/logger';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Paper,
  Group,
  Text,
  Title,
  Stack,
  Alert,
  Badge,
  Grid,
  Card,
  Divider,
  Modal,
  SimpleGrid,
  Button,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCheck,
  IconPlus,
  IconShieldCheck,
  IconVaccine,
} from '@tabler/icons-react';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { useEntityFileCounts } from '../../hooks/useEntityFileCounts';
import { useViewModalNavigation } from '../../hooks/useViewModalNavigation';
import EmptyState from '../../components/shared/EmptyState';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { getEntityFormatters } from '../../utils/tableFormatters';
import { usePatientWithStaticData } from '../../hooks/useGlobalData';
import { PageHeader } from '../../components';
import { ResponsiveTable } from '../../components/adapters';
import MantineFilters from '../../components/mantine/MantineFilters';
import ViewToggle from '../../components/shared/ViewToggle';
import MedicalPageLoading from '../../components/shared/MedicalPageLoading';
import { withResponsive } from '../../hoc/withResponsive';
import { useResponsive } from '../../hooks/useResponsive';

// Modular components
import {
  ImmunizationCard,
  ImmunizationViewModal,
  ImmunizationFormWrapper,
} from '../../components/medical/immunizations';

const Immunization = () => {
  const { t } = useTranslation('common');
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'
  const navigate = useNavigate();
  const responsive = useResponsive();

  // Standardized data management
  const {
    items: immunizations,
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
    entityName: 'immunization',
    apiMethodsConfig: {
      getAll: signal => apiService.getImmunizations(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientImmunizations(patientId, signal),
      create: (data, signal) => apiService.createImmunization(data, signal),
      update: (id, data, signal) =>
        apiService.updateImmunization(id, data, signal),
      delete: (id, signal) => apiService.deleteImmunization(id, signal),
    },
    requiresPatient: true,
  });

  // Get standardized configuration
  const config = getMedicalPageConfig('immunizations');

  // Use standardized data management
  const dataManagement = useDataManagement(immunizations, config);

  // File count management for cards
  const { fileCounts, fileCountsLoading, cleanupFileCount } = useEntityFileCounts('immunization', immunizations);

  // View modal navigation with URL deep linking
  const {
    isOpen: showViewModal,
    viewingItem: viewingImmunization,
    openModal: handleViewImmunization,
    closeModal: handleCloseViewModal,
  } = useViewModalNavigation({
    items: immunizations,
    loading,
  });

  // Form and UI state
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingImmunization, setEditingImmunization] = useState(null);
  const [formData, setFormData] = useState({
    vaccine_name: '',
    vaccine_trade_name: '',
    date_administered: '',
    dose_number: '',
    lot_number: '',
    ndc_number: '',
    manufacturer: '',
    site: '',
    route: '',
    expiration_date: '',
    location: '',
    notes: '',
    practitioner_id: null,
    tags: [],
  });

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setFormData({
      vaccine_name: '',
      vaccine_trade_name: '',
      date_administered: '',
      dose_number: '',
      lot_number: '',
      ndc_number: '',
      manufacturer: '',
      site: '',
      route: '',
      expiration_date: '',
      location: '',
      notes: '',
      practitioner_id: null,
      tags: [],
    });
    setEditingImmunization(null);
    setShowAddForm(false);
  };

  const handleAddImmunization = () => {
    resetForm();
    setShowAddForm(true);
  };

  const handleEditImmunization = immunization => {
    setFormData({
      vaccine_name: immunization.vaccine_name || '',
      vaccine_trade_name: immunization.vaccine_trade_name || '',
      date_administered: immunization.date_administered || '',
      dose_number: immunization.dose_number || '',
      lot_number: immunization.lot_number || '',
      ndc_number: immunization.ndc_number || '',
      manufacturer: immunization.manufacturer || '',
      site: immunization.site || '',
      route: immunization.route || '',
      expiration_date: immunization.expiration_date || '',
      location: immunization.location || '',
      notes: immunization.notes || '',
      practitioner_id: immunization.practitioner_id || null,
      tags: immunization.tags || [],
    });
    setEditingImmunization(immunization);
    setShowAddForm(true);
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!currentPatient?.id) {
      setError('Patient information not available');
      return;
    }

    const immunizationData = {
      vaccine_name: formData.vaccine_name,
      vaccine_trade_name: formData.vaccine_trade_name || null,
      date_administered: formData.date_administered,
      patient_id: currentPatient.id,
      dose_number: formData.dose_number
        ? parseInt(formData.dose_number, 10)
        : null,
      lot_number: formData.lot_number || null,
      ndc_number: formData.ndc_number || null,
      manufacturer: formData.manufacturer || null,
      site: formData.site || null,
      route: formData.route || null,
      expiration_date: formData.expiration_date || null,
      location: formData.location || null,
      notes: formData.notes || null,
      practitioner_id: formData.practitioner_id
        ? parseInt(formData.practitioner_id, 10)
        : null,
      tags: formData.tags || [],
    };

    let success;
    if (editingImmunization) {
      success = await updateItem(editingImmunization.id, immunizationData);
    } else {
      success = await createItem(immunizationData);
    }

    if (success) {
      resetForm();
      await refreshData();
    }
  };

  const handleDeleteImmunization = async immunizationId => {
    const success = await deleteItem(immunizationId);
    if (success) {
      cleanupFileCount(immunizationId);
      await refreshData();
    }
  };

  // Get processed data from data management
  const processedImmunizations = dataManagement.data;

  // Get practitioners data
  const { practitioners: practitionersObject } = usePatientWithStaticData();
  const practitioners = practitionersObject?.practitioners || [];

  if (loading) {
    return <MedicalPageLoading message={t('immunizations.loadingImmunizations', 'Loading immunizations...')} />;
  }

  return (
    <Container size="xl" py="md">
      <PageHeader title={t('immunizations.title', 'Immunizations')} icon="💉" />

      <Stack gap="lg">
        {error && (
          <Alert
            variant="light"
            color="red"
            title={t('immunizations.error', 'Error')}
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
            title={t('immunizations.success', 'Success')}
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
            onClick={handleAddImmunization}
            size="md"
          >
            {t('immunizations.addImmunization', 'Add New Immunization')}
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
          sortOptions={dataManagement.sortOptions}
          sortBy={dataManagement.sortBy}
          sortOrder={dataManagement.sortOrder}
          handleSortChange={dataManagement.handleSortChange}
          totalCount={dataManagement.totalCount}
          filteredCount={dataManagement.filteredCount}
          config={config.filterControls}
        />

        {/* Form Modal */}
        <ImmunizationFormWrapper
          isOpen={showAddForm}
          onClose={resetForm}
          title={
            editingImmunization ? t('immunizations.editImmunization', 'Edit Immunization') : t('immunizations.addNewImmunization', 'Add New Immunization')
          }
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          editingImmunization={editingImmunization}
          practitioners={practitioners}
        />

        {/* View Details Modal */}
        <ImmunizationViewModal
          isOpen={showViewModal}
          onClose={handleCloseViewModal}
          immunization={viewingImmunization}
          onEdit={handleEditImmunization}
          practitioners={practitioners}
          navigate={navigate}
        />

        {/* Content */}
          {processedImmunizations.length === 0 ? (
            <EmptyState
              icon={IconVaccine}
              title={t('immunizations.noImmunizationsFound', 'No immunizations found')}
              hasActiveFilters={dataManagement.hasActiveFilters}
              filteredMessage={t('immunizations.tryAdjustingFilters', 'Try adjusting your search or filter criteria.')}
              noDataMessage={t('immunizations.clickToGetStarted', 'Click "Add New Immunization" to get started.')}
            />
          ) : viewMode === 'cards' ? (
            <Grid>
              <AnimatePresence>
                {processedImmunizations.map((immunization, index) => (
                  <Grid.Col
                    key={immunization.id}
                    span={responsive.isMobile ? 12 : responsive.isTablet ? 6 : 4}
                  >
                      <ImmunizationCard
                        immunization={immunization}
                        onView={handleViewImmunization}
                        onEdit={handleEditImmunization}
                        onDelete={handleDeleteImmunization}
                        practitioners={practitioners}
                        navigate={navigate}
                        fileCount={fileCounts[immunization.id] || 0}
                        fileCountLoading={fileCountsLoading[immunization.id] || false}
                      />
                  </Grid.Col>
                ))}
              </AnimatePresence>
            </Grid>
          ) : (
            <Paper shadow="sm" radius="md" withBorder>
              <ResponsiveTable
                data={processedImmunizations}
                columns={[
                  { header: t('immunizations.table.vaccineName', 'Vaccine Name'), accessor: 'vaccine_name', priority: 'high', width: 200 },
                  {
                    header: t('immunizations.table.dateAdministered', 'Date Administered'),
                    accessor: 'date_administered',
                    priority: 'high',
                    width: 150
                  },
                  { header: t('immunizations.table.doseNumber', 'Dose Number'), accessor: 'dose_number', priority: 'medium', width: 100 },
                  { header: t('immunizations.table.manufacturer', 'Manufacturer'), accessor: 'manufacturer', priority: 'medium', width: 150 },
                  { header: t('immunizations.table.site', 'Site'), accessor: 'site', priority: 'low', width: 100 },
                  { header: t('immunizations.table.route', 'Route'), accessor: 'route', priority: 'low', width: 100 },
                  { header: t('immunizations.table.lotNumber', 'Lot Number'), accessor: 'lot_number', priority: 'low', width: 120 },
                  { header: t('immunizations.table.expirationDate', 'Expiration Date'), accessor: 'expiration_date', priority: 'medium', width: 130 },
                  { header: t('immunizations.table.notes', 'Notes'), accessor: 'notes', priority: 'low', width: 200 },
                ]}
                patientData={currentPatient}
                tableName={t('immunizations.title', 'Immunizations')}
                onView={handleViewImmunization}
                onEdit={handleEditImmunization}
                onDelete={handleDeleteImmunization}
                formatters={{
                  vaccine_name: (value, item) =>
                    getEntityFormatters('immunizations').immunization_name(
                      value,
                      item
                    ),
                  date_administered:
                    getEntityFormatters('immunizations').administration_date,
                  expiration_date: getEntityFormatters('immunizations').date,
                  site: getEntityFormatters('immunizations').simple,
                  dose_number: getEntityFormatters('immunizations').simple,
                  manufacturer: getEntityFormatters('immunizations').simple,
                  route: getEntityFormatters('immunizations').simple,
                  lot_number: getEntityFormatters('immunizations').lot_number,
                  notes: getEntityFormatters('immunizations').notes,
                }}
                dataType="medical"
                responsive={responsive}
              />
            </Paper>
          )}
        </Stack>
    </Container>
  );
};

// Wrap with responsive HOC for enhanced responsive capabilities
export default withResponsive(Immunization, {
  injectResponsive: true,
  displayName: 'ResponsiveImmunization'
});
