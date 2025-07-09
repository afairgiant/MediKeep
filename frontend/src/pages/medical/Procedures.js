import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { usePractitioners } from '../../hooks/useGlobalData';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { getEntityFormatters } from '../../utils/tableFormatters';
import { getAndClearStoredEntityId, navigateToEntity } from '../../utils/linkNavigation';
import { PageHeader } from '../../components';
import MantineFilters from '../../components/mantine/MantineFilters';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import { Button } from '../../components/ui';
import MantineProcedureForm from '../../components/medical/MantineProcedureForm';
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

const Procedures = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [viewMode, setViewMode] = useState('cards');

  // Get practitioners data
  const { practitioners } = usePractitioners();

  // Get standardized formatters for procedures with linking support
  const formatters = getEntityFormatters('procedures', practitioners, navigate);

  // Modern data management with useMedicalData
  const {
    items: procedures,
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
    entityName: 'procedure',
    apiMethodsConfig: {
      getAll: signal => apiService.getProcedures(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientProcedures(patientId, signal),
      create: (data, signal) => apiService.createProcedure(data, signal),
      update: (id, data, signal) =>
        apiService.updateProcedure(id, data, signal),
      delete: (id, signal) => apiService.deleteProcedure(id, signal),
    },
    requiresPatient: true,
  });

  // Get standardized configuration
  const config = getMedicalPageConfig('procedures');

  // Use standardized data management
  const dataManagement = useDataManagement(procedures, config);

  // Form state
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingProcedure, setViewingProcedure] = useState(null);
  const [editingProcedure, setEditingProcedure] = useState(null);
  const [formData, setFormData] = useState({
    procedure_name: '',
    procedure_type: '',
    procedure_code: '',
    description: '',
    procedure_date: '',
    status: 'scheduled',
    notes: '',
    facility: '',
    procedure_setting: '',
    procedure_complications: '',
    procedure_duration: '',
    practitioner_id: '',
    anesthesia_type: '',
    anesthesia_notes: '',
  });

  const handleAddProcedure = () => {
    setEditingProcedure(null);
    setFormData({
      procedure_name: '',
      procedure_type: '',
      procedure_code: '',
      description: '',
      procedure_date: '',
      status: 'scheduled',
      notes: '',
      facility: '',
      procedure_setting: '',
      procedure_complications: '',
      procedure_duration: '',
      practitioner_id: '',
      anesthesia_type: '',
      anesthesia_notes: '',
    });
    setShowModal(true);
  };

  const handleViewProcedure = procedure => {
    setViewingProcedure(procedure);
    setShowViewModal(true);
    // Update URL with procedure ID for sharing/bookmarking
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', procedure.id);
    navigate(`${location.pathname}?${searchParams.toString()}`, {
      replace: true,
    });
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setViewingProcedure(null);
    // Remove view parameter from URL
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete('view');
    const newSearch = searchParams.toString();
    navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, {
      replace: true,
    });
  };

  const handleEditProcedure = procedure => {
    setEditingProcedure(procedure);
    setFormData({
      procedure_name: procedure.procedure_name || '',
      procedure_type: procedure.procedure_type || '',
      procedure_code: procedure.procedure_code || '',
      description: procedure.description || '',
      procedure_date: procedure.date || '',
      status: procedure.status || 'scheduled',
      notes: procedure.notes || '',
      facility: procedure.facility || '',
      procedure_setting: procedure.procedure_setting || '',
      procedure_complications: procedure.procedure_complications || '',
      procedure_duration: procedure.procedure_duration || '',
      practitioner_id: procedure.practitioner_id || '',
      anesthesia_type: procedure.anesthesia_type || '',
      anesthesia_notes: procedure.anesthesia_notes || '',
    });
    setShowModal(true);
  };

  // Handle URL parameters for direct linking to specific procedures
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const viewId = searchParams.get('view');

    if (viewId && procedures.length > 0 && !loading) {
      const procedure = procedures.find(p => p.id.toString() === viewId);
      if (procedure && !showViewModal) {
        // Only auto-open if modal isn't already open
        setViewingProcedure(procedure);
        setShowViewModal(true);
      }
    }
  }, [location.search, procedures, loading, showViewModal]);

  // Handle auto-open from entity navigation (e.g., from other pages)
  useEffect(() => {
    const procedureIdToOpen = getAndClearStoredEntityId('procedure');
    if (procedureIdToOpen && procedures.length > 0 && !loading) {
      const procedureToView = procedures.find(p => p.id === parseInt(procedureIdToOpen));
      if (procedureToView && !showViewModal) {
        handleViewProcedure(procedureToView);
      }
    }
  }, [procedures, loading, showViewModal]);

  const handleDeleteProcedure = async procedureId => {
    const success = await deleteItem(procedureId);
    if (success) {
      await refreshData();
    }
  };

  const handleInputChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!formData.procedure_name.trim()) {
      setError('Procedure name is required');
      return;
    }

    if (!formData.procedure_date) {
      setError('Procedure date is required');
      return;
    }

    if (!currentPatient?.id) {
      setError('Patient information not available');
      return;
    }

    const procedureData = {
      procedure_name: formData.procedure_name,
      procedure_type: formData.procedure_type || null,
      procedure_code: formData.procedure_code || null,
      description: formData.description,
      date: formData.procedure_date || null,
      status: formData.status,
      notes: formData.notes || null,
      facility: formData.facility || null,
      procedure_setting: formData.procedure_setting || null,
      procedure_complications: formData.procedure_complications || null,
      procedure_duration: formData.procedure_duration
        ? parseInt(formData.procedure_duration)
        : null,
      practitioner_id: formData.practitioner_id
        ? parseInt(formData.practitioner_id)
        : null,
      anesthesia_type: formData.anesthesia_type || null,
      anesthesia_notes: formData.anesthesia_notes || null,
      patient_id: currentPatient.id,
    };

    let success;
    if (editingProcedure) {
      success = await updateItem(editingProcedure.id, procedureData);
    } else {
      success = await createItem(procedureData);
    }

    if (success) {
      setShowModal(false);
      await refreshData();
    }
  };

  // Get processed data from data management
  const filteredProcedures = dataManagement.data;

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Center h={200}>
          <Stack align="center">
            <Loader size="lg" />
            <Text>Loading procedures...</Text>
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
        <PageHeader title="Procedures" icon="🔬" />

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
            <Button variant="filled" onClick={handleAddProcedure}>
              + Add Procedure
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
            dateRangeOptions={dataManagement.dateRangeOptions}
            sortOptions={dataManagement.sortOptions}
            sortBy={dataManagement.sortBy}
            sortOrder={dataManagement.sortOrder}
            handleSortChange={dataManagement.handleSortChange}
            totalCount={dataManagement.totalCount}
            filteredCount={dataManagement.filteredCount}
            config={config.filterControls}
          />

          {filteredProcedures.length === 0 ? (
            <Card withBorder p="xl">
              <Stack align="center" gap="md">
                <Text size="3rem">🔬</Text>
                <Text size="xl" fw={600}>
                  No Procedures Found
                </Text>
                <Text ta="center" c="dimmed">
                  {dataManagement.hasActiveFilters
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Start by adding your first procedure.'}
                </Text>
                {!dataManagement.hasActiveFilters && (
                  <Button variant="filled" onClick={handleAddProcedure}>
                    Add Your First Procedure
                  </Button>
                )}
              </Stack>
            </Card>
          ) : viewMode === 'cards' ? (
            <Grid>
              {filteredProcedures.map(procedure => (
                <Grid.Col key={procedure.id} span={{ base: 12, sm: 6, lg: 4 }}>
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
                            {procedure.procedure_name}
                          </Text>
                          {procedure.procedure_type && (
                            <Badge variant="light" color="blue" size="md">
                              {procedure.procedure_type}
                            </Badge>
                          )}
                        </Stack>
                        <StatusBadge status={procedure.status} />
                      </Group>

                      <Stack gap="xs">
                        {procedure.date && (
                          <Group>
                            <Text size="sm" fw={500} c="dimmed" w={120}>
                              Procedure Date:
                            </Text>
                            <Text size="sm">{formatDate(procedure.date)}</Text>
                          </Group>
                        )}
                        {procedure.procedure_code && (
                          <Group>
                            <Text size="sm" fw={500} c="dimmed" w={120}>
                              Code:
                            </Text>
                            <Text size="sm">{procedure.procedure_code}</Text>
                          </Group>
                        )}
                        {procedure.procedure_setting && (
                          <Group>
                            <Text size="sm" fw={500} c="dimmed" w={120}>
                              Setting:
                            </Text>
                            <Badge variant="light" color="cyan" size="sm">
                              {procedure.procedure_setting}
                            </Badge>
                          </Group>
                        )}
                        {procedure.procedure_duration && (
                          <Group>
                            <Text size="sm" fw={500} c="dimmed" w={120}>
                              Duration:
                            </Text>
                            <Text size="sm">
                              {procedure.procedure_duration} minutes
                            </Text>
                          </Group>
                        )}
                        {procedure.facility && (
                          <Group>
                            <Text size="sm" fw={500} c="dimmed" w={120}>
                              Facility:
                            </Text>
                            <Text size="sm">{procedure.facility}</Text>
                          </Group>
                        )}
                        {procedure.practitioner_id && (
                          <Group>
                            <Text size="sm" fw={500} c="dimmed" w={120}>
                              Doctor:
                            </Text>
                            <Text 
                              size="sm"
                              style={{ cursor: 'pointer', color: '#1c7ed6', textDecoration: 'underline' }}
                              onClick={() => navigateToEntity('practitioner', procedure.practitioner_id, navigate)}
                              title="View practitioner details"
                            >
                              {practitioners.find(
                                p => p.id === procedure.practitioner_id
                              )?.name ||
                                `Practitioner ID: ${procedure.practitioner_id}`}
                            </Text>
                          </Group>
                        )}
                        {procedure.description && (
                          <Group align="flex-start">
                            <Text size="sm" fw={500} c="dimmed" w={120}>
                              Description:
                            </Text>
                            <Text size="sm" style={{ flex: 1 }}>
                              {procedure.description}
                            </Text>
                          </Group>
                        )}
                        {procedure.procedure_complications && (
                          <Group align="flex-start">
                            <Text size="sm" fw={500} c="dimmed" w={120}>
                              Complications:
                            </Text>
                            <Text
                              size="sm"
                              style={{ flex: 1, color: '#d63384' }}
                            >
                              {procedure.procedure_complications}
                            </Text>
                          </Group>
                        )}
                      </Stack>

                      {procedure.notes && (
                        <Stack gap="xs">
                          <Divider />
                          <Stack gap="xs">
                            <Text size="sm" fw={500} c="dimmed">
                              Notes
                            </Text>
                            <Text size="sm">{procedure.notes}</Text>
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
                          onClick={() => handleViewProcedure(procedure)}
                        >
                          View
                        </Button>
                        <Button
                          variant="light"
                          size="xs"
                          onClick={() => handleEditProcedure(procedure)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="light"
                          color="red"
                          size="xs"
                          onClick={() => handleDeleteProcedure(procedure.id)}
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
              data={filteredProcedures}
              columns={[
                { header: 'Procedure Name', accessor: 'procedure_name' },
                { header: 'Type', accessor: 'procedure_type' },
                { header: 'Code', accessor: 'procedure_code' },
                { header: 'Date', accessor: 'date' },
                { header: 'Status', accessor: 'status' },
                { header: 'Setting', accessor: 'procedure_setting' },
                { header: 'Facility', accessor: 'facility' },
                { header: 'Practitioner', accessor: 'practitioner_name' },
                { header: 'Description', accessor: 'description' },
              ]}
              patientData={currentPatient}
              tableName="Procedures"
              onView={handleViewProcedure}
              onEdit={handleEditProcedure}
              onDelete={handleDeleteProcedure}
              formatters={formatters}
            />
          )}
        </Stack>
      </Container>

      <MantineProcedureForm
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingProcedure ? 'Edit Procedure' : 'Add New Procedure'}
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        practitioners={practitioners}
        editingProcedure={editingProcedure}
      />

      {/* Procedure View Modal */}
      <Modal
        opened={showViewModal}
        onClose={handleCloseViewModal}
        title={
          <Group>
            <Text size="lg" fw={600}>
              Procedure Details
            </Text>
            {viewingProcedure && (
              <StatusBadge status={viewingProcedure.status} />
            )}
          </Group>
        }
        size="lg"
        centered
      >
        {viewingProcedure && (
          <Stack gap="md">
            <Card withBorder p="md">
              <Stack gap="sm">
                <Group justify="space-between" align="flex-start">
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Title order={3}>{viewingProcedure.procedure_name}</Title>
                    <Group gap="xs">
                      {viewingProcedure.procedure_type && (
                        <Badge variant="light" color="blue" size="lg">
                          {viewingProcedure.procedure_type}
                        </Badge>
                      )}
                      {viewingProcedure.procedure_code && (
                        <Badge variant="light" color="teal" size="lg">
                          {viewingProcedure.procedure_code}
                        </Badge>
                      )}
                    </Group>
                  </Stack>
                </Group>
              </Stack>
            </Card>

            <Grid>
              <Grid.Col span={6}>
                <Card withBorder p="md">
                  <Stack gap="sm">
                    <Text fw={600} size="sm" c="dimmed">
                      PROCEDURE INFORMATION
                    </Text>
                    <Divider />
                    <Stack gap="xs">
                      <Group>
                        <Text size="sm" fw={500} w={100}>
                          Date:
                        </Text>
                        <Text
                          size="sm"
                          c={viewingProcedure.date ? 'inherit' : 'dimmed'}
                        >
                          {viewingProcedure.date
                            ? formatDate(viewingProcedure.date)
                            : 'Not specified'}
                        </Text>
                      </Group>
                      <Group>
                        <Text size="sm" fw={500} w={100}>
                          Setting:
                        </Text>
                        {viewingProcedure.procedure_setting ? (
                          <Badge variant="light" color="cyan" size="sm">
                            {viewingProcedure.procedure_setting}
                          </Badge>
                        ) : (
                          <Text size="sm" c="dimmed">
                            Not specified
                          </Text>
                        )}
                      </Group>
                      <Group>
                        <Text size="sm" fw={500} w={100}>
                          Duration:
                        </Text>
                        <Text
                          size="sm"
                          c={
                            viewingProcedure.procedure_duration
                              ? 'inherit'
                              : 'dimmed'
                          }
                        >
                          {viewingProcedure.procedure_duration
                            ? `${viewingProcedure.procedure_duration} minutes`
                            : 'Not specified'}
                        </Text>
                      </Group>
                      <Group>
                        <Text size="sm" fw={500} w={100}>
                          Facility:
                        </Text>
                        <Text
                          size="sm"
                          c={viewingProcedure.facility ? 'inherit' : 'dimmed'}
                        >
                          {viewingProcedure.facility || 'Not specified'}
                        </Text>
                      </Group>
                    </Stack>
                  </Stack>
                </Card>
              </Grid.Col>

              <Grid.Col span={6}>
                <Card withBorder p="md">
                  <Stack gap="sm">
                    <Text fw={600} size="sm" c="dimmed">
                      PRACTITIONER INFORMATION
                    </Text>
                    <Divider />
                    <Stack gap="xs">
                      <Group>
                        <Text size="sm" fw={500} w={100}>
                          Doctor:
                        </Text>
                        <Text
                          size="sm"
                          c={
                            viewingProcedure.practitioner_id
                              ? 'inherit'
                              : 'dimmed'
                          }
                          style={viewingProcedure.practitioner_id ? { cursor: 'pointer', color: '#1c7ed6', textDecoration: 'underline' } : {}}
                          onClick={viewingProcedure.practitioner_id ? () => navigateToEntity('practitioner', viewingProcedure.practitioner_id, navigate) : undefined}
                          title={viewingProcedure.practitioner_id ? "View practitioner details" : undefined}
                        >
                          {viewingProcedure.practitioner_id
                            ? practitioners.find(
                                p => p.id === viewingProcedure.practitioner_id
                              )?.name ||
                              `Practitioner ID: ${viewingProcedure.practitioner_id}`
                            : 'Not specified'}
                        </Text>
                      </Group>
                      <Group>
                        <Text size="sm" fw={500} w={100}>
                          Specialty:
                        </Text>
                        <Text
                          size="sm"
                          c={
                            viewingProcedure.practitioner_id
                              ? 'inherit'
                              : 'dimmed'
                          }
                        >
                          {viewingProcedure.practitioner_id
                            ? practitioners.find(
                                p => p.id === viewingProcedure.practitioner_id
                              )?.specialty || 'Not specified'
                            : 'Not specified'}
                        </Text>
                      </Group>
                    </Stack>
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>

            <Card withBorder p="md">
              <Stack gap="sm">
                <Text fw={600} size="sm" c="dimmed">
                  PROCEDURE DESCRIPTION
                </Text>
                <Divider />
                <Text
                  size="sm"
                  c={viewingProcedure.description ? 'inherit' : 'dimmed'}
                >
                  {viewingProcedure.description || 'No description available'}
                </Text>
              </Stack>
            </Card>

            <Card withBorder p="md">
              <Stack gap="sm">
                <Text fw={600} size="sm" c="dimmed">
                  COMPLICATIONS
                </Text>
                <Divider />
                <Text
                  size="sm"
                  c={
                    viewingProcedure.procedure_complications
                      ? '#d63384'
                      : 'dimmed'
                  }
                >
                  {viewingProcedure.procedure_complications ||
                    'No complications reported'}
                </Text>
              </Stack>
            </Card>

            <Card withBorder p="md">
              <Stack gap="sm">
                <Text fw={600} size="sm" c="dimmed">
                  ANESTHESIA INFORMATION
                </Text>
                <Divider />
                <Stack gap="xs">
                  <Group>
                    <Text size="sm" fw={500} w={100}>
                      Type:
                    </Text>
                    {viewingProcedure.anesthesia_type ? (
                      <Badge variant="light" color="purple" size="sm">
                        {viewingProcedure.anesthesia_type}
                      </Badge>
                    ) : (
                      <Text size="sm" c="dimmed">
                        Not specified
                      </Text>
                    )}
                  </Group>
                  <Group align="flex-start">
                    <Text size="sm" fw={500} w={100}>
                      Notes:
                    </Text>
                    <Text
                      size="sm"
                      style={{ flex: 1 }}
                      c={
                        viewingProcedure.anesthesia_notes ? 'inherit' : 'dimmed'
                      }
                    >
                      {viewingProcedure.anesthesia_notes ||
                        'No anesthesia notes available'}
                    </Text>
                  </Group>
                </Stack>
              </Stack>
            </Card>

            <Card withBorder p="md">
              <Stack gap="sm">
                <Text fw={600} size="sm" c="dimmed">
                  CLINICAL NOTES
                </Text>
                <Divider />
                <Text
                  size="sm"
                  c={viewingProcedure.notes ? 'inherit' : 'dimmed'}
                >
                  {viewingProcedure.notes || 'No clinical notes available'}
                </Text>
              </Stack>
            </Card>

            <Group justify="flex-end" mt="md">
              <Button
                variant="light"
                onClick={() => {
                  handleCloseViewModal();
                  handleEditProcedure(viewingProcedure);
                }}
              >
                Edit Procedure
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

export default Procedures;
