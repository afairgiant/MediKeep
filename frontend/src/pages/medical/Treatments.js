import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { PageHeader } from '../../components';
import MantineFilters from '../../components/mantine/MantineFilters';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import { Button } from '../../components/ui';
import MantineTreatmentForm from '../../components/medical/MantineTreatmentForm';
import StatusBadge from '../../components/medical/StatusBadge';
import {
  Badge,
  Card,
  Group,
  Stack,
  Text,
  Grid,
  Container,
  Alert,
  Loader,
  Center,
  Divider,
  Modal,
  Title,
} from '@mantine/core';

const Treatments = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('cards');

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
    setSuccessMessage,
    setError,
  } = useMedicalData({
    entityName: 'treatment',
    apiMethodsConfig: {
      getAll: signal => apiService.getTreatments(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientTreatments(patientId, signal),
      create: (data, signal) => apiService.createTreatment(data, signal),
      update: (id, data, signal) =>
        apiService.updateTreatment(id, data, signal),
      delete: (id, signal) => apiService.deleteTreatment(id, signal),
    },
    requiresPatient: true,
  });

  // Get standardized configuration
  const config = getMedicalPageConfig('treatments');

  // Use standardized data management
  const dataManagement = useDataManagement(treatments, config);

  // Form and UI state
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingTreatment, setViewingTreatment] = useState(null);
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
    notes: '',
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
      notes: '',
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
      notes: treatment.notes || '',
    });
    setShowModal(true);
  };

  const handleViewTreatment = treatment => {
    setViewingTreatment(treatment);
    setShowViewModal(true);
  };

  const handleDeleteTreatment = async treatmentId => {
    const success = await deleteItem(treatmentId);
    if (success) {
      await refreshData();
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();

    // Validation
    if (!formData.treatment_name.trim()) {
      setError('Treatment name is required');
      return;
    }

    if (!formData.treatment_type.trim()) {
      setError('Treatment type is required');
      return;
    }

    if (!formData.start_date) {
      setError('Start date is required');
      return;
    }

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
      treatment_type: formData.treatment_type,
      description: formData.description,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      status: formData.status,
      dosage: formData.dosage || null,
      frequency: formData.frequency || null,
      notes: formData.notes || null,
      patient_id: currentPatient.id,
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
    }
  };

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Get processed data from data management
  const filteredTreatments = dataManagement.data;

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Center h={200}>
          <Stack align="center">
            <Loader size="lg" />
            <Text>Loading treatments...</Text>
            <Text size="sm" c="dimmed">
              If this takes too long, please refresh the page
            </Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <>
      <Container size="xl" py="md">
        <PageHeader title="Treatments" icon="🩹" />

        <Stack gap="lg">
          {error && (
            <Alert
              variant="light"
              color="red"
              title="Error"
              withCloseButton
              onClose={clearError}
            >
              {error}
            </Alert>
          )}
          {successMessage && (
            <Alert variant="light" color="green" title="Success">
              {successMessage}
            </Alert>
          )}

          <Group justify="space-between" align="center">
            <Button variant="filled" onClick={handleAddTreatment}>
              + Add Treatment
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

          {filteredTreatments.length === 0 ? (
            <Card withBorder p="xl">
              <Stack align="center" gap="md">
                <Text size="3rem">🩹</Text>
                <Text size="xl" fw={600}>
                  No Treatments Found
                </Text>
                <Text ta="center" c="dimmed">
                  {dataManagement.hasActiveFilters
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Start by adding your first treatment.'}
                </Text>
                {!dataManagement.hasActiveFilters && (
                  <Button variant="filled" onClick={handleAddTreatment}>
                    Add Your First Treatment
                  </Button>
                )}
              </Stack>
            </Card>
          ) : viewMode === 'cards' ? (
            <Grid>
              {filteredTreatments.map(treatment => (
                <Grid.Col key={treatment.id} span={{ base: 12, sm: 6, lg: 4 }}>
                  <Card
                    withBorder
                    shadow="sm"
                    radius="md"
                    h="100%"
                    style={{ display: 'flex', flexDirection: 'column' }}
                  >
                    <Stack gap="sm" style={{ flex: 1 }}>
                      <Group justify="space-between" align="flex-start">
                        <Stack gap="xs" style={{ flex: 1 }}>
                          <Text fw={600} size="lg">
                            {treatment.treatment_name}
                          </Text>
                          {treatment.treatment_type && (
                            <Badge variant="light" color="blue" size="md">
                              {treatment.treatment_type}
                            </Badge>
                          )}
                        </Stack>
                        <StatusBadge status={treatment.status} />
                      </Group>

                      <Stack gap="xs">
                        {treatment.start_date && (
                          <Group>
                            <Text size="sm" fw={500} c="dimmed" w={120}>
                              Start Date:
                            </Text>
                            <Text size="sm">
                              {formatDate(treatment.start_date)}
                            </Text>
                          </Group>
                        )}
                        {treatment.end_date && (
                          <Group>
                            <Text size="sm" fw={500} c="dimmed" w={120}>
                              End Date:
                            </Text>
                            <Text size="sm">
                              {formatDate(treatment.end_date)}
                            </Text>
                          </Group>
                        )}
                        {treatment.dosage && (
                          <Group>
                            <Text size="sm" fw={500} c="dimmed" w={120}>
                              Dosage:
                            </Text>
                            <Text size="sm">{treatment.dosage}</Text>
                          </Group>
                        )}
                        {treatment.frequency && (
                          <Group>
                            <Text size="sm" fw={500} c="dimmed" w={120}>
                              Frequency:
                            </Text>
                            <Text size="sm">{treatment.frequency}</Text>
                          </Group>
                        )}
                        {treatment.description && (
                          <Group align="flex-start">
                            <Text size="sm" fw={500} c="dimmed" w={120}>
                              Description:
                            </Text>
                            <Text size="sm" style={{ flex: 1 }}>
                              {treatment.description}
                            </Text>
                          </Group>
                        )}
                      </Stack>

                      {treatment.notes && (
                        <Stack gap="xs">
                          <Divider />
                          <Stack gap="xs">
                            <Text size="sm" fw={500} c="dimmed">
                              Notes
                            </Text>
                            <Text size="sm">{treatment.notes}</Text>
                          </Stack>
                        </Stack>
                      )}
                    </Stack>

                    {/* Buttons always at bottom */}
                    <Stack gap={0} mt="auto">
                      <Divider />
                      <Group justify="flex-end" gap="xs" pt="sm">
                        <Button
                          variant="light"
                          size="xs"
                          onClick={() => handleViewTreatment(treatment)}
                        >
                          View
                        </Button>
                        <Button
                          variant="light"
                          size="xs"
                          onClick={() => handleEditTreatment(treatment)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="light"
                          color="red"
                          size="xs"
                          onClick={() => handleDeleteTreatment(treatment.id)}
                        >
                          Delete
                        </Button>
                      </Group>
                    </Stack>
                  </Card>
                </Grid.Col>
              ))}
            </Grid>
          ) : (
            <MedicalTable
              data={filteredTreatments}
              columns={[
                { header: 'Treatment Name', accessor: 'treatment_name' },
                { header: 'Type', accessor: 'treatment_type' },
                { header: 'Start Date', accessor: 'start_date' },
                { header: 'End Date', accessor: 'end_date' },
                { header: 'Status', accessor: 'status' },
                { header: 'Dosage', accessor: 'dosage' },
                { header: 'Frequency', accessor: 'frequency' },
                { header: 'Notes', accessor: 'notes' },
              ]}
              patientData={currentPatient}
              tableName="Treatments"
              onView={handleViewTreatment}
              onEdit={handleEditTreatment}
              onDelete={handleDeleteTreatment}
              formatters={{
                treatment_name: value => value,
                treatment_type: value =>
                  value ? (
                    <Badge variant="filled" color="blue" size="sm">
                      {value}
                    </Badge>
                  ) : (
                    '-'
                  ),
                start_date: value => (value ? formatDate(value) : '-'),
                end_date: value => (value ? formatDate(value) : '-'),
                status: value => <StatusBadge status={value} size="small" />,
                dosage: value => value || '-',
                frequency: value => value || '-',
                notes: value =>
                  value ? (
                    <span title={value}>
                      {value.length > 50
                        ? `${value.substring(0, 50)}...`
                        : value}
                    </span>
                  ) : (
                    '-'
                  ),
              }}
            />
          )}
        </Stack>
      </Container>

      {/* Treatment Form Modal */}
      <MantineTreatmentForm
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingTreatment ? 'Edit Treatment' : 'Add New Treatment'}
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        editingTreatment={editingTreatment}
      />

      {/* Treatment View Modal */}
      <Modal
        opened={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={
          <Group>
            <Text size="lg" fw={600}>
              Treatment Details
            </Text>
            {viewingTreatment && (
              <StatusBadge status={viewingTreatment.status} />
            )}
          </Group>
        }
        size="lg"
        centered
      >
        {viewingTreatment && (
          <Stack gap="md">
            <Card withBorder p="md">
              <Stack gap="sm">
                <Group justify="space-between" align="flex-start">
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Title order={3}>{viewingTreatment.treatment_name}</Title>
                    {viewingTreatment.treatment_type && (
                      <Badge variant="light" color="blue" size="lg">
                        {viewingTreatment.treatment_type}
                      </Badge>
                    )}
                  </Stack>
                </Group>

                {viewingTreatment.description && (
                  <Stack gap="xs">
                    <Text fw={500} c="dimmed" size="sm">
                      Description
                    </Text>
                    <Text>{viewingTreatment.description}</Text>
                  </Stack>
                )}
              </Stack>
            </Card>

            <Grid>
              <Grid.Col span={6}>
                <Card withBorder p="md" h="100%">
                  <Stack gap="sm">
                    <Text fw={600} size="sm" c="dimmed">
                      SCHEDULE
                    </Text>
                    <Divider />
                    {viewingTreatment.start_date && (
                      <Group>
                        <Text size="sm" fw={500} w={80}>
                          Start:
                        </Text>
                        <Text size="sm">
                          {formatDate(viewingTreatment.start_date)}
                        </Text>
                      </Group>
                    )}
                    {viewingTreatment.end_date && (
                      <Group>
                        <Text size="sm" fw={500} w={80}>
                          End:
                        </Text>
                        <Text size="sm">
                          {formatDate(viewingTreatment.end_date)}
                        </Text>
                      </Group>
                    )}
                    {!viewingTreatment.start_date &&
                      !viewingTreatment.end_date && (
                        <Text size="sm" c="dimmed">
                          No schedule information
                        </Text>
                      )}
                  </Stack>
                </Card>
              </Grid.Col>

              <Grid.Col span={6}>
                <Card withBorder p="md" h="100%">
                  <Stack gap="sm">
                    <Text fw={600} size="sm" c="dimmed">
                      DOSAGE & FREQUENCY
                    </Text>
                    <Divider />
                    {viewingTreatment.dosage && (
                      <Group>
                        <Text size="sm" fw={500} w={80}>
                          Dosage:
                        </Text>
                        <Text size="sm">{viewingTreatment.dosage}</Text>
                      </Group>
                    )}
                    {viewingTreatment.frequency && (
                      <Group>
                        <Text size="sm" fw={500} w={80}>
                          Frequency:
                        </Text>
                        <Text size="sm">{viewingTreatment.frequency}</Text>
                      </Group>
                    )}
                    {!viewingTreatment.dosage &&
                      !viewingTreatment.frequency && (
                        <Text size="sm" c="dimmed">
                          No dosage information
                        </Text>
                      )}
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>

            {viewingTreatment.notes && (
              <Card withBorder p="md">
                <Stack gap="sm">
                  <Text fw={600} size="sm" c="dimmed">
                    NOTES
                  </Text>
                  <Divider />
                  <Text size="sm">{viewingTreatment.notes}</Text>
                </Stack>
              </Card>
            )}

            <Group justify="flex-end" mt="md">
              <Button
                variant="light"
                onClick={() => {
                  setShowViewModal(false);
                  handleEditTreatment(viewingTreatment);
                }}
              >
                Edit Treatment
              </Button>
              <Button variant="filled" onClick={() => setShowViewModal(false)}>
                Close
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
};

export default Treatments;
