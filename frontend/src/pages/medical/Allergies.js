import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { apiService } from '../../services/api';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { getEntityFormatters } from '../../utils/tableFormatters';
import { navigateToEntity } from '../../utils/linkNavigation';
import { PageHeader } from '../../components';
import MantineFilters from '../../components/mantine/MantineFilters';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import { AllergyCard, AllergyViewModal, AllergyFormWrapper } from '../../components/medical/allergies';

const Allergies = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
          console.error('Failed to fetch medications:', error);
          setMedications([]);
        });
    }
  }, [currentPatient?.id]);

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
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingAllergy, setViewingAllergy] = useState(null);
  const [editingAllergy, setEditingAllergy] = useState(null);
  const [formData, setFormData] = useState({
    allergen: '',
    severity: '',
    reaction: '',
    onset_date: '',
    status: 'active',
    notes: '',
    medication_id: '',
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
    });
    setEditingAllergy(null);
    setShowAddForm(false);
  };

  const handleAddAllergy = () => {
    resetForm();
    setShowAddForm(true);
  };

  const handleViewAllergy = allergy => {
    setViewingAllergy(allergy);
    setShowViewModal(true);
    // Update URL with allergy ID for sharing/bookmarking
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', allergy.id);
    navigate(`${location.pathname}?${searchParams.toString()}`, {
      replace: true,
    });
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setViewingAllergy(null);
    // Remove view parameter from URL
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete('view');
    const newSearch = searchParams.toString();
    navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, {
      replace: true,
    });
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
    });
    setEditingAllergy(allergy);
    setShowAddForm(true);
  };

  // Handle URL parameters for direct linking to specific allergies
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const viewId = searchParams.get('view');

    if (viewId && allergies.length > 0 && !loading) {
      const allergy = allergies.find(a => a.id.toString() === viewId);
      if (allergy && !showViewModal) {
        // Only auto-open if modal isn't already open
        setViewingAllergy(allergy);
        setShowViewModal(true);
      }
    }
  }, [location.search, allergies, loading, showViewModal]);


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
      await refreshData();
    }
  };

  // Get processed data from data management
  const processedAllergies = dataManagement.data;

  if (loading) {
    return (
      <Container size="xl" py="lg">
        <Center py="xl">
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text size="lg">Loading allergies...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <PageHeader title="Allergies" icon="⚠️" />

      <Container size="xl" py="lg">
        {error && (
          <Alert
            variant="light"
            color="red"
            title="Error"
            icon={<IconAlertTriangle size={16} />}
            withCloseButton
            onClose={clearError}
            mb="md"
          >
            {error}
          </Alert>
        )}

        {successMessage && (
          <Alert
            variant="light"
            color="green"
            title="Success"
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
            Add New Allergy
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
          title={editingAllergy ? 'Edit Allergy' : 'Add New Allergy'}
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
            <Paper shadow="sm" p="xl" radius="md">
              <Center py="xl">
                <Stack align="center" gap="md">
                  <IconAlertTriangle
                    size={64}
                    stroke={1}
                    color="var(--mantine-color-gray-5)"
                  />
                  <Stack align="center" gap="xs">
                    <Title order={3}>No allergies found</Title>
                    <Text c="dimmed" ta="center">
                      {dataManagement.hasActiveFilters
                        ? 'Try adjusting your search or filter criteria.'
                        : 'Click "Add New Allergy" to get started.'}
                    </Text>
                  </Stack>
                </Stack>
              </Center>
            </Paper>
          ) : viewMode === 'cards' ? (
            <Grid>
              <AnimatePresence>
                {processedAllergies.map((allergy, index) => (
                  <Grid.Col
                    key={allergy.id}
                    span={{ base: 12, md: 6, lg: 4 }}
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
                        onError={setError}
                      />
                    </motion.div>
                  </Grid.Col>
                ))}
              </AnimatePresence>
            </Grid>
          ) : (
            <Paper shadow="sm" radius="md" withBorder>
              <MedicalTable
                data={processedAllergies}
                columns={[
                  { header: 'Allergen', accessor: 'allergen' },
                  { header: 'Reaction', accessor: 'reaction' },
                  { header: 'Severity', accessor: 'severity' },
                  { header: 'Onset Date', accessor: 'onset_date' },
                  { header: 'Medication', accessor: 'medication_name' },
                  { header: 'Status', accessor: 'status' },
                  { header: 'Notes', accessor: 'notes' },
                ]}
                patientData={currentPatient}
                tableName="Allergies"
                onView={handleViewAllergy}
                onEdit={handleEditAllergy}
                onDelete={handleDeleteAllergy}
                formatters={formatters}
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
      </Container>
    </motion.div>
  );
};

export default Allergies;
