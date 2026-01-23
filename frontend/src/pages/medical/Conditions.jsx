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
  Title,
  Stack,
  Alert,
  Loader,
  Center,
  Badge,
  Grid,
  Card,
  Box,
  Divider,
  Modal,
  Button,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCheck,
  IconPlus,
  IconShieldCheck,
  IconHeart,
  IconBrain,
  IconLungs,
  IconBone,
  IconDroplet,
  IconAward,
} from '@tabler/icons-react';
import { useMedicalData, useDataManagement, useEntityFileCounts, useViewModalNavigation } from '../../hooks';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
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
import MantineFilters from '../../components/mantine/MantineFilters';
import ViewToggle from '../../components/shared/ViewToggle';
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
  const navigate = useNavigate();
  const responsive = useResponsive();
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'
  
  // Load medications and practitioners for linking dropdowns
  const [medications, setMedications] = useState([]);
  const [practitioners, setPractitioners] = useState([]);
  

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

  // Form and UI state
  const [showModal, setShowModal] = useState(false);
  const [editingCondition, setEditingCondition] = useState(null);
  const [formData, setFormData] = useState({
    condition_name: '',
    diagnosis: '',
    notes: '',
    status: 'active',
    severity: '',
    medication_id: '',
    practitioner_id: '',
    icd10_code: '',
    snomed_code: '',
    code_description: '',
    onset_date: '', // Form field name
    end_date: '', // Form field name
    tags: [],
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
      medication_id: '',
      practitioner_id: '',
      icd10_code: '',
      snomed_code: '',
      code_description: '',
      onset_date: '',
      end_date: '',
      tags: [],
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

  const handleEditCondition = condition => {
    setEditingCondition(condition);
    // Apply default status early if condition doesn't have one
    setFormData({
      condition_name: condition.condition_name || '',
      diagnosis: condition.diagnosis || '',
      notes: condition.notes || '',
      status: condition.status || 'active', // Default status applied early for consistency
      severity: condition.severity || '',
      medication_id: condition.medication_id ? condition.medication_id.toString() : '',
      practitioner_id: condition.practitioner_id ? condition.practitioner_id.toString() : '',
      icd10_code: condition.icd10_code || '',
      snomed_code: condition.snomed_code || '',
      code_description: condition.code_description || '',
      onset_date: condition.onset_date
        ? condition.onset_date.split('T')[0]
        : '',
      end_date: condition.end_date ? condition.end_date.split('T')[0] : '',
      tags: condition.tags || [],
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

  const handleMedicationClick = (medicationId) => {
    navigate(`/medications?view=${medicationId}`);
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
      medication_id: formData.medication_id ? parseInt(formData.medication_id) : null,
      practitioner_id: formData.practitioner_id ? parseInt(formData.practitioner_id) : null,
      icd10_code: formData.icd10_code || null,
      snomed_code: formData.snomed_code || null,
      code_description: formData.code_description || null,
      onset_date: formatDateForAPI(formData.onset_date),
      end_date: formatDateForAPI(formData.end_date),
      tags: formData.tags || [],
      patient_id: currentPatient.id,
    };


    let success;
    if (editingCondition) {
      success = await updateItem(editingCondition.id, conditionData);
    } else {
      success = await createItem(conditionData);
    }

    if (success) {
      setShowModal(false);
      await refreshData();
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
    return (
      <Container size="xl" py="md">
        <Center h={200}>
          <Stack align="center">
            <Loader size="lg" />
            <Text>{t('conditions.loading', 'Loading conditions...')}</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <PageHeader title={t('conditions.title', 'Medical Conditions')} icon="🩺" />

      <Stack gap="lg">
        {error && (
          <Alert
            variant="light"
            color="red"
            title={t('labels.error', 'Error')}
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
            title={t('labels.success', 'Success')}
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
            onClick={handleAddCondition}
            size="md"
          >
            {t('conditions.addNew', 'Add New Condition')}
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
        <ConditionFormWrapper
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={editingCondition ? t('conditions.editTitle', 'Edit Condition') : t('conditions.addTitle', 'Add New Condition')}
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          editingCondition={editingCondition}
          medications={medications}
          practitioners={practitioners}
          navigate={navigate}
        />

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {filteredConditions.length === 0 ? (
            <Paper shadow="sm" p="xl" radius="md">
              <Center py="xl">
                <Stack align="center" gap="md">
                  <IconShieldCheck
                    size={64}
                    stroke={1}
                    color="var(--mantine-color-gray-5)"
                  />
                  <Stack align="center" gap="xs">
                    <Title order={3}>{t('conditions.noResults', 'No medical conditions found')}</Title>
                    <Text c="dimmed" ta="center">
                      {dataManagement.hasActiveFilters
                        ? t('conditions.tryAdjustingFilters', 'Try adjusting your search or filter criteria.')
                        : t('conditions.getStarted', 'Click "Add New Condition" to get started.')}
                    </Text>
                  </Stack>
                </Stack>
              </Center>
            </Paper>
          ) : viewMode === 'cards' ? (
            <Grid>
              <AnimatePresence>
                {filteredConditions.map((condition, index) => (
                  <Grid.Col
                    key={condition.id}
                    span={responsive.isMobile ? 12 : responsive.isTablet ? 6 : 4}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <ConditionCard
                        condition={condition}
                        onView={handleViewCondition}
                        onEdit={handleEditCondition}
                        onDelete={handleDeleteCondition}
                        navigate={navigate}
                        fileCount={fileCounts[condition.id] || 0}
                        fileCountLoading={fileCountsLoading[condition.id] || false}
                      />
                    </motion.div>
                  </Grid.Col>
                ))}
              </AnimatePresence>
            </Grid>
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
                  diagnosis: getEntityFormatters('conditions').condition_name,
                  severity: getEntityFormatters('conditions').severity,
                  onset_date: getEntityFormatters('conditions').onset_date,
                  end_date: getEntityFormatters('conditions').end_date,
                  status: getEntityFormatters('conditions').status,
                  icd10_code: getEntityFormatters('conditions').simple,
                  notes: getEntityFormatters('conditions').notes,
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
          onMedicationClick={handleMedicationClick}
          onPractitionerClick={handlePractitionerClick}
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
