import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from '@mantine/core';
import { Button } from '../../components/ui';
import {
  IconAlertTriangle,
  IconCheck,
  IconPlus,
  IconExclamationCircle,
  IconShieldCheck,
  IconAlertCircle,
  IconShield,
} from '@tabler/icons-react';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { PageHeader } from '../../components';
import MantineFilters from '../../components/mantine/MantineFilters';
import MantineAllergyForm from '../../components/medical/MantineAllergyForm';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';

const Allergies = () => {
  const navigate = useNavigate();
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
    setSuccessMessage,
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

  const getSeverityIcon = severity => {
    switch (severity) {
      case 'life-threatening':
        return IconExclamationCircle;
      case 'severe':
        return IconAlertTriangle;
      case 'moderate':
        return IconAlertCircle;
      case 'mild':
        return IconShield;
      default:
        return IconShieldCheck;
    }
  };

  const getSeverityColor = severity => {
    switch (severity) {
      case 'life-threatening':
        return 'red';
      case 'severe':
        return 'orange';
      case 'moderate':
        return 'yellow';
      case 'mild':
        return 'blue';
      default:
        return 'gray';
    }
  };

  const getStatusColor = status => {
    switch (status) {
      case 'active':
        return 'green';
      case 'inactive':
        return 'gray';
      case 'resolved':
        return 'blue';
      default:
        return 'gray';
    }
  };

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
        <MantineAllergyForm
          isOpen={showAddForm}
          onClose={resetForm}
          title={editingAllergy ? 'Edit Allergy' : 'Add New Allergy'}
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          editingAllergy={editingAllergy}
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
                {processedAllergies.map((allergy, index) => {
                  const SeverityIcon = getSeverityIcon(allergy.severity);

                  return (
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
                        <Card shadow="sm" padding="lg" radius="md" withBorder>
                          <Card.Section withBorder inheritPadding py="xs">
                            <Group justify="space-between">
                              <Group gap="xs">
                                <SeverityIcon
                                  size={20}
                                  color={`var(--mantine-color-${getSeverityColor(allergy.severity)}-6)`}
                                />
                                <Text fw={600} size="lg">
                                  {allergy.allergen}
                                </Text>
                              </Group>
                              <Badge
                                color={getStatusColor(allergy.status)}
                                variant="light"
                              >
                                {allergy.status}
                              </Badge>
                            </Group>
                          </Card.Section>

                          <Stack gap="md" mt="md">
                            <Group justify="space-between">
                              <Text size="sm" c="dimmed">
                                Severity:
                              </Text>
                              <Badge
                                color={getSeverityColor(allergy.severity)}
                                variant="filled"
                                leftSection={<SeverityIcon size={12} />}
                              >
                                {allergy.severity}
                              </Badge>
                            </Group>

                            {allergy.reaction && (
                              <Group justify="space-between">
                                <Text size="sm" c="dimmed">
                                  Reaction:
                                </Text>
                                <Text size="sm" fw={500}>
                                  {allergy.reaction}
                                </Text>
                              </Group>
                            )}

                            {allergy.onset_date && (
                              <Group justify="space-between">
                                <Text size="sm" c="dimmed">
                                  Onset Date:
                                </Text>
                                <Text size="sm" fw={500}>
                                  {formatDate(allergy.onset_date)}
                                </Text>
                              </Group>
                            )}

                            {allergy.notes && (
                              <Box>
                                <Text size="sm" c="dimmed" mb="xs">
                                  Notes:
                                </Text>
                                <Text size="sm" c="gray.7">
                                  {allergy.notes}
                                </Text>
                              </Box>
                            )}
                          </Stack>

                          <Stack gap={0} mt="auto">
                            <Divider />
                            <Group justify="flex-end" gap="xs" pt="sm">
                              <Button
                                variant="light"
                                size="xs"
                                onClick={() => handleEditAllergy(allergy)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="light"
                                color="red"
                                size="xs"
                                onClick={() => handleDeleteAllergy(allergy.id)}
                              >
                                Delete
                              </Button>
                            </Group>
                          </Stack>
                        </Card>
                      </motion.div>
                    </Grid.Col>
                  );
                })}
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
                  { header: 'Status', accessor: 'status' },
                  { header: 'Notes', accessor: 'notes' },
                ]}
                patientData={currentPatient}
                tableName="Allergies"
                onEdit={handleEditAllergy}
                onDelete={handleDeleteAllergy}
                formatters={{
                  allergen: value => (
                    <Text fw={600} c="blue">
                      {value}
                    </Text>
                  ),
                  severity: value => {
                    const SeverityIcon = getSeverityIcon(value);
                    return (
                      <Badge
                        color={getSeverityColor(value)}
                        variant="filled"
                        leftSection={<SeverityIcon size={12} />}
                      >
                        {value}
                      </Badge>
                    );
                  },
                  status: value => (
                    <Badge color={getStatusColor(value)} variant="light">
                      {value}
                    </Badge>
                  ),
                  onset_date: value => (value ? formatDate(value) : '-'),
                  notes: value =>
                    value ? (
                      <Text size="sm" title={value}>
                        {value.length > 50
                          ? `${value.substring(0, 50)}...`
                          : value}
                      </Text>
                    ) : (
                      '-'
                    ),
                }}
              />
            </Paper>
          )}
        </motion.div>
      </Container>
    </motion.div>
  );
};

export default Allergies;
