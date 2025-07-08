import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { getEntityFormatters } from '../../utils/tableFormatters';
import { PageHeader } from '../../components';
import logger from '../../services/logger';
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
  const location = useLocation();
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
      getByPatient: (patientId, signal) => apiService.getTreatments(signal),
      create: (data, signal) => apiService.createTreatment(data, signal),
      update: (id, data, signal) =>
        apiService.updateTreatment(id, data, signal),
      delete: (id, signal) => apiService.deleteTreatment(id, signal),
    },
    requiresPatient: true,
  });

  // Conditions data for dropdown - following DRY principles with existing pattern
  const {
    items: conditionsOptions,
    loading: conditionsLoading,
    error: conditionsError,
  } = useMedicalData({
    entityName: 'conditionsDropdown',
    apiMethodsConfig: {
      getAll: signal => apiService.getConditionsDropdown(false, signal), // false to get all conditions, not just active
      getByPatient: (patientId, signal) =>
        apiService.getConditionsDropdown(false, signal), // Use same method for consistency
    },
    requiresPatient: false, // The endpoint handles patient context automatically
  });

  // Practitioners data for dropdown
  const {
    items: practitionersOptions,
    loading: practitionersLoading,
    error: practitionersError,
  } = useMedicalData({
    entityName: 'practitioners',
    apiMethodsConfig: {
      getAll: signal => apiService.getPractitioners(signal),
      getByPatient: (patientId, signal) => apiService.getPractitioners(signal),
    },
    requiresPatient: false,
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
    condition_id: '',
    practitioner_id: '',
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
      condition_id: '',
      practitioner_id: '',
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
      condition_id: treatment.condition_id || '',
      practitioner_id: treatment.practitioner_id || '',
    });
    setShowModal(true);
  };

  const handleViewTreatment = treatment => {
    // Use existing treatment data - no need to fetch again
    setViewingTreatment(treatment);
    setShowViewModal(true);
    // Update URL with treatment ID for sharing/bookmarking
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', treatment.id);
    navigate(`${location.pathname}?${searchParams.toString()}`, {
      replace: true,
    });
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setViewingTreatment(null);
    // Remove view parameter from URL
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete('view');
    const newSearch = searchParams.toString();
    navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, {
      replace: true,
    });
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
    }
  };

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Helper function to get condition name from ID
  const getConditionName = conditionId => {
    if (!conditionId || !conditionsOptions || conditionsOptions.length === 0) {
      return null;
    }
    const condition = conditionsOptions.find(c => c.id === conditionId);
    return condition ? condition.diagnosis || condition.name : null;
  };

  // Helper function to get practitioner information from ID
  const getPractitionerInfo = practitionerId => {
    if (
      !practitionerId ||
      !practitionersOptions ||
      practitionersOptions.length === 0
    ) {
      return null;
    }
    const practitioner = practitionersOptions.find(
      p => p.id === practitionerId
    );
    return practitioner;
  };

  // Handler to navigate to condition page and open view modal
  const handleConditionClick = conditionId => {
    if (conditionId) {
      // Store the condition ID in sessionStorage so the conditions page can auto-open the modal
      sessionStorage.setItem('openConditionId', conditionId.toString());
      // Navigate to conditions page
      navigate('/conditions');
    }
  };

  // Handle URL parameters for direct linking to specific treatments
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const viewId = searchParams.get('view');

    if (viewId && treatments.length > 0 && !loading) {
      const treatment = treatments.find(t => t.id.toString() === viewId);
      if (treatment && !showViewModal) {
        // Only auto-open if modal isn't already open
        setViewingTreatment(treatment);
        setShowViewModal(true);
      }
    }
  }, [location.search, treatments, loading, showViewModal]);

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
          {conditionsError && (
            <Alert
              variant="light"
              color="orange"
              title="Conditions Loading Error"
            >
              {conditionsError}
            </Alert>
          )}
          {practitionersError && (
            <Alert
              variant="light"
              color="orange"
              title="Practitioners Loading Error"
            >
              {practitionersError}
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
                          <Group gap="xs">
                            {treatment.treatment_type && (
                              <Badge variant="light" color="blue" size="md">
                                {treatment.treatment_type}
                              </Badge>
                            )}
                            {treatment.condition_id && (
                              <Badge
                                variant="light"
                                color="teal"
                                size="md"
                                style={{ cursor: 'pointer' }}
                                onClick={() =>
                                  handleConditionClick(treatment.condition_id)
                                }
                              >
                                {treatment.condition?.diagnosis ||
                                  getConditionName(treatment.condition_id) ||
                                  `Condition #${treatment.condition_id}`}
                              </Badge>
                            )}
                          </Group>
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
                              Amount:
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
                { header: 'Treatment', accessor: 'treatment_name' },
                { header: 'Type', accessor: 'treatment_type' },
                { header: 'Practitioner', accessor: 'practitioner' },
                { header: 'Related Condition', accessor: 'condition' },
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
                treatment_name:
                  getEntityFormatters('treatments').treatment_name,
                treatment_type:
                  getEntityFormatters('treatments').treatment_type,
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
                start_date: getEntityFormatters('treatments').start_date,
                end_date: getEntityFormatters('treatments').end_date,
                status: getEntityFormatters('treatments').status,
                dosage: getEntityFormatters('treatments').dosage,
                frequency: getEntityFormatters('treatments').frequency,
                notes: getEntityFormatters('treatments').notes,
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
        conditionsOptions={conditionsOptions}
        conditionsLoading={conditionsLoading}
        practitionersOptions={practitionersOptions}
        practitionersLoading={practitionersLoading}
      />

      {/* Treatment View Modal */}
      <Modal
        opened={showViewModal}
        onClose={handleCloseViewModal}
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
                    <Group gap="xs">
                      {viewingTreatment.treatment_type && (
                        <Badge variant="light" color="blue" size="lg">
                          {viewingTreatment.treatment_type}
                        </Badge>
                      )}
                      {viewingTreatment.condition_id && (
                        <Badge
                          variant="light"
                          color="teal"
                          size="lg"
                          style={{ cursor: 'pointer' }}
                          onClick={() =>
                            handleConditionClick(viewingTreatment.condition_id)
                          }
                        >
                          Related to:{' '}
                          {viewingTreatment.condition?.diagnosis ||
                            getConditionName(viewingTreatment.condition_id) ||
                            `Condition #${viewingTreatment.condition_id}`}
                        </Badge>
                      )}
                    </Group>
                  </Stack>
                </Group>

                <Stack gap="xs">
                  <Text fw={500} c="dimmed" size="sm">
                    Description
                  </Text>
                  <Text c={viewingTreatment.description ? 'inherit' : 'dimmed'}>
                    {viewingTreatment.description || 'Not specified'}
                  </Text>
                </Stack>
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
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Start:
                      </Text>
                      <Text
                        size="sm"
                        c={viewingTreatment.start_date ? 'inherit' : 'dimmed'}
                      >
                        {viewingTreatment.start_date
                          ? formatDate(viewingTreatment.start_date)
                          : 'Not specified'}
                      </Text>
                    </Group>
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        End:
                      </Text>
                      <Text
                        size="sm"
                        c={viewingTreatment.end_date ? 'inherit' : 'dimmed'}
                      >
                        {viewingTreatment.end_date
                          ? formatDate(viewingTreatment.end_date)
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
                      AMOUNT & FREQUENCY
                    </Text>
                    <Divider />
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Amount:
                      </Text>
                      <Text
                        size="sm"
                        c={viewingTreatment.dosage ? 'inherit' : 'dimmed'}
                      >
                        {viewingTreatment.dosage || 'Not specified'}
                      </Text>
                    </Group>
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Frequency:
                      </Text>
                      <Text
                        size="sm"
                        c={viewingTreatment.frequency ? 'inherit' : 'dimmed'}
                      >
                        {viewingTreatment.frequency || 'Not specified'}
                      </Text>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>

              <Grid.Col span={6}>
                <Card withBorder p="md">
                  <Stack gap="sm">
                    <Text fw={600} size="sm" c="dimmed">
                      PRACTITIONER
                    </Text>
                    <Divider />
                    {viewingTreatment.practitioner_id ? (
                      <Stack gap="xs">
                        <Group>
                          <Text size="sm" fw={500} w={80}>
                            Doctor:
                          </Text>
                          <Text size="sm" fw={600}>
                            {viewingTreatment.practitioner?.name ||
                              getPractitionerInfo(
                                viewingTreatment.practitioner_id
                              )?.name ||
                              `Practitioner #${viewingTreatment.practitioner_id}`}
                          </Text>
                        </Group>
                        {(viewingTreatment.practitioner?.practice ||
                          getPractitionerInfo(viewingTreatment.practitioner_id)
                            ?.practice) && (
                          <Group>
                            <Text size="sm" fw={500} w={80}>
                              Practice:
                            </Text>
                            <Text size="sm">
                              {viewingTreatment.practitioner?.practice ||
                                getPractitionerInfo(
                                  viewingTreatment.practitioner_id
                                )?.practice}
                            </Text>
                          </Group>
                        )}
                        {(viewingTreatment.practitioner?.specialty ||
                          getPractitionerInfo(viewingTreatment.practitioner_id)
                            ?.specialty) && (
                          <Group>
                            <Text size="sm" fw={500} w={80}>
                              Specialty:
                            </Text>
                            <Badge variant="light" color="green" size="sm">
                              {viewingTreatment.practitioner?.specialty ||
                                getPractitionerInfo(
                                  viewingTreatment.practitioner_id
                                )?.specialty}
                            </Badge>
                          </Group>
                        )}
                      </Stack>
                    ) : (
                      <Text size="sm" c="dimmed">
                        No practitioner assigned
                      </Text>
                    )}
                  </Stack>
                </Card>
              </Grid.Col>

              <Grid.Col span={6}>
                <Card withBorder p="md">
                  <Stack gap="sm">
                    <Text fw={600} size="sm" c="dimmed">
                      RELATED CONDITION
                    </Text>
                    <Divider />
                    {viewingTreatment.condition_id ? (
                      <Stack gap="xs">
                        <Group>
                          <Text size="sm" fw={500} w={80}>
                            Diagnosis:
                          </Text>
                          <Text
                            size="sm"
                            fw={600}
                            style={{
                              cursor: 'pointer',
                              color: 'var(--mantine-color-blue-6)',
                            }}
                            onClick={() =>
                              handleConditionClick(
                                viewingTreatment.condition_id
                              )
                            }
                          >
                            {viewingTreatment.condition?.diagnosis ||
                              getConditionName(viewingTreatment.condition_id) ||
                              `Condition #${viewingTreatment.condition_id}`}
                          </Text>
                        </Group>
                        {viewingTreatment.condition?.severity && (
                          <Group>
                            <Text size="sm" fw={500} w={80}>
                              Severity:
                            </Text>
                            <Badge variant="light" color="orange" size="sm">
                              {viewingTreatment.condition.severity}
                            </Badge>
                          </Group>
                        )}
                        {viewingTreatment.condition?.status && (
                          <Group>
                            <Text size="sm" fw={500} w={80}>
                              Status:
                            </Text>
                            <Badge variant="light" color="blue" size="sm">
                              {viewingTreatment.condition.status}
                            </Badge>
                          </Group>
                        )}
                      </Stack>
                    ) : (
                      <Text size="sm" c="dimmed">
                        No condition linked
                      </Text>
                    )}
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>

            <Card withBorder p="md">
              <Stack gap="sm">
                <Text fw={600} size="sm" c="dimmed">
                  NOTES
                </Text>
                <Divider />
                <Text
                  size="sm"
                  c={viewingTreatment.notes ? 'inherit' : 'dimmed'}
                >
                  {viewingTreatment.notes || 'No notes available'}
                </Text>
              </Stack>
            </Card>

            <Group justify="flex-end" mt="md">
              <Button
                variant="light"
                onClick={() => {
                  handleCloseViewModal();
                  handleEditTreatment(viewingTreatment);
                }}
              >
                Edit Treatment
              </Button>
              <Button variant="filled" onClick={handleCloseViewModal}>
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
