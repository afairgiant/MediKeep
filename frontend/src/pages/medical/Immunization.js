import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Divider,
  Modal,
  SimpleGrid,
} from '@mantine/core';
import { Button } from '../../components/ui';
import {
  IconAlertTriangle,
  IconCheck,
  IconPlus,
  IconShieldCheck,
  IconVaccine,
} from '@tabler/icons-react';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { getEntityFormatters } from '../../utils/tableFormatters';
import { PageHeader } from '../../components';
import MantineFilters from '../../components/mantine/MantineFilters';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import MantineImmunizationForm from '../../components/medical/MantineImmunizationForm';

const Immunization = () => {
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'table'
  const navigate = useNavigate();
  const location = useLocation();

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

  // Form and UI state
  const [showAddForm, setShowAddForm] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingImmunization, setViewingImmunization] = useState(null);
  const [editingImmunization, setEditingImmunization] = useState(null);
  const [formData, setFormData] = useState({
    vaccine_name: '',
    date_administered: '',
    dose_number: '',
    lot_number: '',
    manufacturer: '',
    site: '',
    route: '',
    expiration_date: '',
    notes: '',
    practitioner_id: null,
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
      date_administered: '',
      dose_number: '',
      lot_number: '',
      manufacturer: '',
      site: '',
      route: '',
      expiration_date: '',
      notes: '',
      practitioner_id: null,
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
      date_administered: immunization.date_administered || '',
      dose_number: immunization.dose_number || '',
      lot_number: immunization.lot_number || '',
      manufacturer: immunization.manufacturer || '',
      site: immunization.site || '',
      route: immunization.route || '',
      expiration_date: immunization.expiration_date || '',
      notes: immunization.notes || '',
      practitioner_id: immunization.practitioner_id || null,
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
      date_administered: formData.date_administered,
      patient_id: currentPatient.id,
      dose_number: formData.dose_number
        ? parseInt(formData.dose_number, 10)
        : null,
      lot_number: formData.lot_number || null,
      manufacturer: formData.manufacturer || null,
      site: formData.site || null,
      route: formData.route || null,
      expiration_date: formData.expiration_date || null,
      notes: formData.notes || null,
      practitioner_id: formData.practitioner_id
        ? parseInt(formData.practitioner_id, 10)
        : null,
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

  const handleViewImmunization = immunization => {
    setViewingImmunization(immunization);
    setShowViewModal(true);
    // Update URL with immunization ID for sharing/bookmarking
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', immunization.id);
    navigate(`${location.pathname}?${searchParams.toString()}`, {
      replace: true,
    });
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setViewingImmunization(null);
    // Remove view parameter from URL
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete('view');
    const newSearch = searchParams.toString();
    navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, {
      replace: true,
    });
  };

  const handleDeleteImmunization = async immunizationId => {
    const success = await deleteItem(immunizationId);
    if (success) {
      await refreshData();
    }
  };

  // Get processed data from data management
  const processedImmunizations = dataManagement.data;

  // Handle URL parameters for direct linking to specific immunizations
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const viewId = searchParams.get('view');

    if (
      viewId &&
      processedImmunizations &&
      processedImmunizations.length > 0 &&
      !loading
    ) {
      const immunization = processedImmunizations.find(
        imm => imm.id.toString() === viewId
      );
      if (immunization && !showViewModal) {
        // Only auto-open if modal isn't already open
        setViewingImmunization(immunization);
        setShowViewModal(true);
      }
    }
  }, [location.search, processedImmunizations, loading, showViewModal]);

  // Helper function to get immunization icon based on vaccine name
  const getImmunizationIcon = vaccineName => {
    const vaccineLower = vaccineName.toLowerCase();
    if (vaccineLower.includes('covid') || vaccineLower.includes('corona'))
      return IconShieldCheck;
    if (vaccineLower.includes('flu') || vaccineLower.includes('influenza'))
      return IconVaccine;
    if (vaccineLower.includes('tetanus') || vaccineLower.includes('diphtheria'))
      return IconShieldCheck;
    if (
      vaccineLower.includes('measles') ||
      vaccineLower.includes('mumps') ||
      vaccineLower.includes('rubella')
    )
      return IconVaccine;
    if (vaccineLower.includes('hepatitis')) return IconVaccine;
    if (
      vaccineLower.includes('pneumonia') ||
      vaccineLower.includes('pneumococcal')
    )
      return IconVaccine;
    return IconVaccine; // Default immunization icon
  };

  // Helper function to get dose color
  const getDoseColor = doseNumber => {
    switch (doseNumber) {
      case 1:
        return 'blue';
      case 2:
        return 'green';
      case 3:
        return 'orange';
      case 4:
        return 'red';
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
            <Text size="lg">Loading immunizations...</Text>
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
      <PageHeader title="Immunizations" icon="💉" />

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
            onClick={handleAddImmunization}
            size="md"
          >
            Add New Immunization
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
        <MantineImmunizationForm
          isOpen={showAddForm}
          onClose={resetForm}
          title={
            editingImmunization ? 'Edit Immunization' : 'Add New Immunization'
          }
          formData={formData}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          editingImmunization={editingImmunization}
        />

        {/* View Details Modal */}
        <Modal
          opened={showViewModal}
          onClose={handleCloseViewModal}
          title={
            <Group>
              <Text size="lg" fw={600}>
                Immunization Details
              </Text>
              {viewingImmunization && viewingImmunization.dose_number && (
                <Badge
                  color={getDoseColor(viewingImmunization.dose_number)}
                  variant="filled"
                  size="lg"
                >
                  Dose {viewingImmunization.dose_number}
                </Badge>
              )}
            </Group>
          }
          size="lg"
          centered
        >
          {viewingImmunization && (
            <Stack gap="md">
              <Card withBorder p="md">
                <Stack gap="sm">
                  <Group justify="space-between" align="flex-start">
                    <Stack gap="xs" style={{ flex: 1 }}>
                      <Title order={3}>
                        {viewingImmunization.vaccine_name}
                      </Title>
                      <Group gap="xs">
                        {viewingImmunization.manufacturer && (
                          <Badge variant="light" color="blue" size="lg">
                            {viewingImmunization.manufacturer}
                          </Badge>
                        )}
                        {viewingImmunization.site && (
                          <Badge variant="light" color="teal" size="lg">
                            {viewingImmunization.site
                              .replace(/_/g, ' ')
                              .replace(/\b\w/g, l => l.toUpperCase())}
                          </Badge>
                        )}
                      </Group>
                    </Stack>
                  </Group>
                </Stack>
              </Card>

              <Grid>
                <Grid.Col span={6}>
                  <Card withBorder p="md" h="100%">
                    <Stack gap="sm">
                      <Text fw={600} size="sm" c="dimmed">
                        ADMINISTRATION
                      </Text>
                      <Divider />
                      <Group>
                        <Text size="sm" fw={500} w={80}>
                          Date:
                        </Text>
                        <Text size="sm" fw={600}>
                          {formatDate(viewingImmunization.date_administered)}
                        </Text>
                      </Group>
                      <Group>
                        <Text size="sm" fw={500} w={80}>
                          Route:
                        </Text>
                        <Text
                          size="sm"
                          c={viewingImmunization.route ? 'inherit' : 'dimmed'}
                        >
                          {viewingImmunization.route || 'Not specified'}
                        </Text>
                      </Group>
                      <Group>
                        <Text size="sm" fw={500} w={80}>
                          Site:
                        </Text>
                        <Text
                          size="sm"
                          c={viewingImmunization.site ? 'inherit' : 'dimmed'}
                        >
                          {viewingImmunization.site
                            ? viewingImmunization.site
                                .replace(/_/g, ' ')
                                .replace(/\b\w/g, l => l.toUpperCase())
                            : 'Not specified'}
                        </Text>
                      </Group>
                    </Stack>
                  </Card>
                </Grid.Col>

                <Grid.Col span={6}>
                  <Card withBorder p="md" h="100%">
                    <Stack gap="sm">
                      <Text fw={600} size="sm" c="dimmed">
                        VACCINE DETAILS
                      </Text>
                      <Divider />
                      <Group>
                        <Text size="sm" fw={500} w={80}>
                          Dose:
                        </Text>
                        <Text
                          size="sm"
                          c={
                            viewingImmunization.dose_number
                              ? 'inherit'
                              : 'dimmed'
                          }
                        >
                          {viewingImmunization.dose_number
                            ? `Dose ${viewingImmunization.dose_number}`
                            : 'Not specified'}
                        </Text>
                      </Group>
                      <Group>
                        <Text size="sm" fw={500} w={80}>
                          Lot:
                        </Text>
                        <Text
                          size="sm"
                          c={
                            viewingImmunization.lot_number
                              ? 'inherit'
                              : 'dimmed'
                          }
                        >
                          {viewingImmunization.lot_number || 'Not specified'}
                        </Text>
                      </Group>
                      <Group>
                        <Text size="sm" fw={500} w={80}>
                          Expires:
                        </Text>
                        <Text
                          size="sm"
                          c={
                            viewingImmunization.expiration_date
                              ? 'inherit'
                              : 'dimmed'
                          }
                        >
                          {viewingImmunization.expiration_date
                            ? formatDate(viewingImmunization.expiration_date)
                            : 'Not specified'}
                        </Text>
                      </Group>
                    </Stack>
                  </Card>
                </Grid.Col>

                <Grid.Col span={12}>
                  <Card withBorder p="md">
                    <Stack gap="sm">
                      <Text fw={600} size="sm" c="dimmed">
                        PRACTITIONER
                      </Text>
                      <Divider />
                      <Group>
                        <Text size="sm" fw={500} w={80}>
                          ID:
                        </Text>
                        <Text
                          size="sm"
                          c={
                            viewingImmunization.practitioner_id
                              ? 'inherit'
                              : 'dimmed'
                          }
                        >
                          {viewingImmunization.practitioner_id ||
                            'Not specified'}
                        </Text>
                      </Group>
                    </Stack>
                  </Card>
                </Grid.Col>

                <Grid.Col span={12}>
                  <Card withBorder p="md">
                    <Stack gap="sm">
                      <Text fw={600} size="sm" c="dimmed">
                        NOTES
                      </Text>
                      <Divider />
                      <Text
                        style={{ whiteSpace: 'pre-wrap' }}
                        c={viewingImmunization.notes ? 'inherit' : 'dimmed'}
                      >
                        {viewingImmunization.notes || 'No notes available'}
                      </Text>
                    </Stack>
                  </Card>
                </Grid.Col>
              </Grid>
            </Stack>
          )}
        </Modal>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {processedImmunizations.length === 0 ? (
            <Paper shadow="sm" p="xl" radius="md">
              <Center py="xl">
                <Stack align="center" gap="md">
                  <IconVaccine
                    size={64}
                    stroke={1}
                    color="var(--mantine-color-gray-5)"
                  />
                  <Stack align="center" gap="xs">
                    <Title order={3}>No immunizations found</Title>
                    <Text c="dimmed" ta="center">
                      {dataManagement.hasActiveFilters
                        ? 'Try adjusting your search or filter criteria.'
                        : 'Click "Add New Immunization" to get started.'}
                    </Text>
                  </Stack>
                </Stack>
              </Center>
            </Paper>
          ) : viewMode === 'cards' ? (
            <Grid>
              <AnimatePresence>
                {processedImmunizations.map((immunization, index) => {
                  const ImmunizationIcon = getImmunizationIcon(
                    immunization.vaccine_name
                  );

                  return (
                    <Grid.Col
                      key={immunization.id}
                      span={{ base: 12, md: 6, lg: 4 }}
                    >
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3, delay: index * 0.1 }}
                      >
                        <Card
                          withBorder
                          shadow="sm"
                          radius="md"
                          h="100%"
                          style={{ display: 'flex', flexDirection: 'column' }}
                        >
                          <Stack gap="sm" style={{ flex: 1 }}>
                            <Group justify="space-between" align="flex-start">
                              <Group gap="xs">
                                <ImmunizationIcon
                                  size={20}
                                  color="var(--mantine-color-blue-6)"
                                />
                                <Text fw={600} size="lg">
                                  {immunization.vaccine_name}
                                </Text>
                              </Group>
                              {immunization.dose_number && (
                                <Badge
                                  color={getDoseColor(immunization.dose_number)}
                                  variant="filled"
                                >
                                  Dose {immunization.dose_number}
                                </Badge>
                              )}
                            </Group>

                            <Stack gap="xs">
                              <Group justify="space-between">
                                <Text size="sm" c="dimmed">
                                  Date Administered:
                                </Text>
                                <Text size="sm" fw={500}>
                                  {formatDate(immunization.date_administered)}
                                </Text>
                              </Group>

                              {immunization.manufacturer && (
                                <Group justify="space-between">
                                  <Text size="sm" c="dimmed">
                                    Manufacturer:
                                  </Text>
                                  <Text size="sm" fw={500}>
                                    {immunization.manufacturer}
                                  </Text>
                                </Group>
                              )}

                              {immunization.site && (
                                <Group justify="space-between">
                                  <Text size="sm" c="dimmed">
                                    Site:
                                  </Text>
                                  <Text size="sm" fw={500}>
                                    {immunization.site
                                      .replace(/_/g, ' ')
                                      .replace(/\b\w/g, l => l.toUpperCase())}
                                  </Text>
                                </Group>
                              )}

                              {immunization.route && (
                                <Group justify="space-between">
                                  <Text size="sm" c="dimmed">
                                    Route:
                                  </Text>
                                  <Text size="sm" fw={500}>
                                    {immunization.route}
                                  </Text>
                                </Group>
                              )}

                              {immunization.lot_number && (
                                <Group justify="space-between">
                                  <Text size="sm" c="dimmed">
                                    Lot Number:
                                  </Text>
                                  <Text size="sm" fw={500}>
                                    {immunization.lot_number}
                                  </Text>
                                </Group>
                              )}

                              {immunization.expiration_date && (
                                <Group justify="space-between">
                                  <Text size="sm" c="dimmed">
                                    Expiration Date:
                                  </Text>
                                  <Text size="sm" fw={500}>
                                    {formatDate(immunization.expiration_date)}
                                  </Text>
                                </Group>
                              )}

                              {immunization.practitioner_id && (
                                <Group justify="space-between">
                                  <Text size="sm" c="dimmed">
                                    Practitioner ID:
                                  </Text>
                                  <Text size="sm" fw={500}>
                                    {immunization.practitioner_id}
                                  </Text>
                                </Group>
                              )}
                              {immunization.notes && (
                                <Group align="flex-start">
                                  <Text size="sm" fw={500} c="dimmed" w={120}>
                                    Notes:
                                  </Text>
                                  <Text size="sm" style={{ flex: 1 }}>
                                    {immunization.notes}
                                  </Text>
                                </Group>
                              )}
                            </Stack>
                          </Stack>

                          {/* Buttons always at bottom */}
                          <Stack gap={0} mt="auto">
                            <Divider />
                            <Group justify="flex-end" gap="xs" pt="sm">
                              <Button
                                variant="light"
                                size="xs"
                                onClick={() =>
                                  handleViewImmunization(immunization)
                                }
                              >
                                View
                              </Button>
                              <Button
                                variant="light"
                                size="xs"
                                onClick={() =>
                                  handleEditImmunization(immunization)
                                }
                              >
                                Edit
                              </Button>
                              <Button
                                variant="light"
                                color="red"
                                size="xs"
                                onClick={() =>
                                  handleDeleteImmunization(immunization.id)
                                }
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
                data={processedImmunizations}
                columns={[
                  { header: 'Vaccine Name', accessor: 'vaccine_name' },
                  {
                    header: 'Date Administered',
                    accessor: 'date_administered',
                  },
                  { header: 'Dose Number', accessor: 'dose_number' },
                  { header: 'Manufacturer', accessor: 'manufacturer' },
                  { header: 'Site', accessor: 'site' },
                  { header: 'Route', accessor: 'route' },
                  { header: 'Lot Number', accessor: 'lot_number' },
                  { header: 'Expiration Date', accessor: 'expiration_date' },
                  { header: 'Notes', accessor: 'notes' },
                ]}
                patientData={currentPatient}
                tableName="Immunizations"
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
              />
            </Paper>
          )}
        </motion.div>
      </Container>
    </motion.div>
  );
};

export default Immunization;
