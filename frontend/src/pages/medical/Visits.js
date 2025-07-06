import React, { useState } from 'react';
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
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCheck,
  IconPlus,
  IconCalendar,
  IconShieldCheck,
} from '@tabler/icons-react';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { usePractitioners } from '../../hooks/useGlobalData';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { PageHeader } from '../../components';
import { Button } from '../../components/ui';
import MantineFilters from '../../components/mantine/MantineFilters';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import MantineVisitForm from '../../components/medical/MantineVisitForm';

const Visits = () => {
  const [viewMode, setViewMode] = useState('cards');

  // Get practitioners data
  const { practitioners } = usePractitioners();

  // Modern data management with useMedicalData for encounters
  const {
    items: visits,
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
    entityName: 'encounter',
    apiMethodsConfig: {
      getAll: signal => apiService.getEncounters(signal),
      getByPatient: (patientId, signal) =>
        apiService.getPatientEncounters(patientId, signal),
      create: (data, signal) => apiService.createEncounter(data, signal),
      update: (id, data, signal) =>
        apiService.updateEncounter(id, data, signal),
      delete: (id, signal) => apiService.deleteEncounter(id, signal),
    },
    requiresPatient: true,
  });

  // Get standardized configuration
  const config = getMedicalPageConfig('visits');

  // Use standardized data management
  const dataManagement = useDataManagement(visits, config);

  // Form state
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingVisit, setViewingVisit] = useState(null);
  const [editingVisit, setEditingVisit] = useState(null);
  const [formData, setFormData] = useState({
    reason: '',
    date: '',
    notes: '',
    practitioner_id: '',
    visit_type: '',
    chief_complaint: '',
    diagnosis: '',
    treatment_plan: '',
    follow_up_instructions: '',
    duration_minutes: '',
    location: '',
    priority: '',
  });

  const handleAddVisit = () => {
    setEditingVisit(null);
    setFormData({
      reason: '',
      date: '',
      notes: '',
      practitioner_id: '',
      visit_type: '',
      chief_complaint: '',
      diagnosis: '',
      treatment_plan: '',
      follow_up_instructions: '',
      duration_minutes: '',
      location: '',
      priority: '',
    });
    setShowModal(true);
  };

  const handleViewVisit = visit => {
    setViewingVisit(visit);
    setShowViewModal(true);
  };

  const handleEditVisit = visit => {
    setEditingVisit(visit);
    setFormData({
      reason: visit.reason || '',
      date: visit.date ? visit.date.split('T')[0] : '',
      notes: visit.notes || '',
      practitioner_id: visit.practitioner_id || '',
      visit_type: visit.visit_type || '',
      chief_complaint: visit.chief_complaint || '',
      diagnosis: visit.diagnosis || '',
      treatment_plan: visit.treatment_plan || '',
      follow_up_instructions: visit.follow_up_instructions || '',
      duration_minutes: visit.duration_minutes || '',
      location: visit.location || '',
      priority: visit.priority || '',
    });
    setShowModal(true);
  };

  const handleDeleteVisit = async visitId => {
    const success = await deleteItem(visitId);
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

    if (!formData.reason.trim()) {
      setError('Reason for visit is required');
      return;
    }

    if (!formData.date) {
      setError('Visit date is required');
      return;
    }

    if (!currentPatient?.id) {
      setError('Patient information not available');
      return;
    }

    const visitData = {
      reason: formData.reason,
      date: formData.date,
      notes: formData.notes || null,
      practitioner_id: formData.practitioner_id || null,
      visit_type: formData.visit_type || null,
      chief_complaint: formData.chief_complaint || null,
      diagnosis: formData.diagnosis || null,
      treatment_plan: formData.treatment_plan || null,
      follow_up_instructions: formData.follow_up_instructions || null,
      duration_minutes: formData.duration_minutes || null,
      location: formData.location || null,
      priority: formData.priority || null,
      patient_id: currentPatient.id,
    };

    let success;
    if (editingVisit) {
      success = await updateItem(editingVisit.id, visitData);
    } else {
      success = await createItem(visitData);
    }

    if (success) {
      setShowModal(false);
      await refreshData();
    }
  };

  // Helper function to get practitioner display name
  const getPractitionerDisplay = practitionerId => {
    if (!practitionerId) return 'No practitioner assigned';

    const practitioner = practitioners.find(
      p => p.id === parseInt(practitionerId)
    );
    if (practitioner) {
      return `${practitioner.name} - ${practitioner.specialty}`;
    }
    return `Practitioner ID: ${practitionerId}`;
  };

  const getPriorityColor = priority => {
    switch (priority) {
      case 'urgent':
        return 'red';
      case 'high':
        return 'orange';
      case 'medium':
        return 'yellow';
      case 'low':
        return 'blue';
      default:
        return 'gray';
    }
  };

  const getVisitTypeColor = visitType => {
    switch (visitType?.toLowerCase()) {
      case 'emergency':
        return 'red';
      case 'urgent care':
        return 'orange';
      case 'follow-up':
        return 'blue';
      case 'routine':
        return 'green';
      case 'consultation':
        return 'purple';
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
            <Text size="lg">Loading visits...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  const filteredVisits = dataManagement.data;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <PageHeader title="Medical Visits" icon="🏥" />

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
            onClick={handleAddVisit}
            size="md"
          >
            Add New Visit
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

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {filteredVisits.length === 0 ? (
            <Paper shadow="sm" p="xl" radius="md">
              <Center py="xl">
                <Stack align="center" gap="md">
                  <IconShieldCheck
                    size={64}
                    stroke={1}
                    color="var(--mantine-color-gray-5)"
                  />
                  <Stack align="center" gap="xs">
                    <Title order={3}>No medical visits found</Title>
                    <Text c="dimmed" ta="center">
                      {dataManagement.hasActiveFilters
                        ? 'Try adjusting your search or filter criteria.'
                        : 'Click "Add New Visit" to get started.'}
                    </Text>
                  </Stack>
                </Stack>
              </Center>
            </Paper>
          ) : viewMode === 'cards' ? (
            <Grid>
              <AnimatePresence>
                {filteredVisits.map((visit, index) => (
                  <Grid.Col key={visit.id} span={{ base: 12, md: 6, lg: 4 }}>
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
                              <IconCalendar
                                size={20}
                                color="var(--mantine-color-blue-6)"
                              />
                              <Text fw={600} size="lg">
                                {visit.reason || 'General Visit'}
                              </Text>
                            </Group>
                            <Group gap="xs">
                              {visit.visit_type && (
                                <Badge
                                  color={getVisitTypeColor(visit.visit_type)}
                                  variant="light"
                                  size="sm"
                                >
                                  {visit.visit_type}
                                </Badge>
                              )}
                              {visit.priority && (
                                <Badge
                                  color={getPriorityColor(visit.priority)}
                                  variant="filled"
                                  size="sm"
                                >
                                  {visit.priority}
                                </Badge>
                              )}
                            </Group>
                          </Group>
                        </Card.Section>

                        <Stack gap="md" mt="md">
                          <Group justify="space-between">
                            <Text size="sm" c="dimmed">
                              Date:
                            </Text>
                            <Text size="sm" fw={500}>
                              {formatDate(visit.date)}
                            </Text>
                          </Group>

                          <Group justify="space-between">
                            <Text size="sm" c="dimmed">
                              Practitioner:
                            </Text>
                            <Text size="sm" fw={500}>
                              {getPractitionerDisplay(visit.practitioner_id)}
                            </Text>
                          </Group>

                          {visit.chief_complaint && (
                            <Group justify="space-between">
                              <Text size="sm" c="dimmed">
                                Chief Complaint:
                              </Text>
                              <Text size="sm" fw={500}>
                                {visit.chief_complaint}
                              </Text>
                            </Group>
                          )}

                          {visit.location && (
                            <Group justify="space-between">
                              <Text size="sm" c="dimmed">
                                Location:
                              </Text>
                              <Text size="sm" fw={500}>
                                {visit.location}
                              </Text>
                            </Group>
                          )}

                          {visit.duration_minutes && (
                            <Group justify="space-between">
                              <Text size="sm" c="dimmed">
                                Duration:
                              </Text>
                              <Text size="sm" fw={500}>
                                {visit.duration_minutes} minutes
                              </Text>
                            </Group>
                          )}
                        </Stack>

                        {visit.diagnosis && (
                          <Box
                            mt="md"
                            pt="md"
                            style={{
                              borderTop:
                                '1px solid var(--mantine-color-gray-3)',
                            }}
                          >
                            <Text size="sm" c="dimmed" mb="xs">
                              📋 Diagnosis/Assessment
                            </Text>
                            <Text size="sm" c="gray.7">
                              {visit.diagnosis}
                            </Text>
                          </Box>
                        )}

                        {visit.treatment_plan && (
                          <Box
                            mt="md"
                            pt="md"
                            style={{
                              borderTop:
                                '1px solid var(--mantine-color-gray-3)',
                            }}
                          >
                            <Text size="sm" c="dimmed" mb="xs">
                              💊 Treatment Plan
                            </Text>
                            <Text size="sm" c="gray.7">
                              {visit.treatment_plan}
                            </Text>
                          </Box>
                        )}

                        {visit.follow_up_instructions && (
                          <Box
                            mt="md"
                            pt="md"
                            style={{
                              borderTop:
                                '1px solid var(--mantine-color-gray-3)',
                            }}
                          >
                            <Text size="sm" c="dimmed" mb="xs">
                              📅 Follow-up Instructions
                            </Text>
                            <Text size="sm" c="gray.7">
                              {visit.follow_up_instructions}
                            </Text>
                          </Box>
                        )}

                        {visit.notes && (
                          <Box
                            mt="md"
                            pt="md"
                            style={{
                              borderTop:
                                '1px solid var(--mantine-color-gray-3)',
                            }}
                          >
                            <Text size="sm" c="dimmed" mb="xs">
                              📝 Additional Notes
                            </Text>
                            <Text size="sm" c="gray.7">
                              {visit.notes}
                            </Text>
                          </Box>
                        )}

                        <Stack gap={0} mt="auto">
                          <Divider />
                          <Group justify="flex-end" gap="xs" pt="sm">
                            <Button
                              variant="light"
                              size="xs"
                              onClick={() => handleViewVisit(visit)}
                            >
                              View
                            </Button>
                            <Button
                              variant="light"
                              size="xs"
                              onClick={() => handleEditVisit(visit)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="light"
                              color="red"
                              size="xs"
                              onClick={() => handleDeleteVisit(visit.id)}
                            >
                              Delete
                            </Button>
                          </Group>
                        </Stack>
                      </Card>
                    </motion.div>
                  </Grid.Col>
                ))}
              </AnimatePresence>
            </Grid>
          ) : (
            <Paper shadow="sm" radius="md" withBorder>
              <MedicalTable
                data={filteredVisits}
                columns={[
                  { header: 'Visit Date', accessor: 'date' },
                  { header: 'Reason', accessor: 'reason' },
                  { header: 'Visit Type', accessor: 'visit_type' },
                  { header: 'Chief Complaint', accessor: 'chief_complaint' },
                  { header: 'Practitioner', accessor: 'practitioner_name' },
                  { header: 'Location', accessor: 'location' },
                  { header: 'Priority', accessor: 'priority' },
                  { header: 'Diagnosis', accessor: 'diagnosis' },
                ]}
                patientData={currentPatient}
                tableName="Visit History"
                onView={handleViewVisit}
                onEdit={handleEditVisit}
                onDelete={handleDeleteVisit}
                formatters={{
                  date: value => (
                    <Text fw={600} c="blue">
                      {formatDate(value)}
                    </Text>
                  ),
                  reason: value => value || 'General Visit',
                  visit_type: value =>
                    value ? (
                      <Badge
                        color={getVisitTypeColor(value)}
                        variant="light"
                        size="sm"
                      >
                        {value}
                      </Badge>
                    ) : (
                      '-'
                    ),
                  chief_complaint: value =>
                    value ? (
                      <Text size="sm" title={value}>
                        {value.length > 30
                          ? `${value.substring(0, 30)}...`
                          : value}
                      </Text>
                    ) : (
                      '-'
                    ),
                  practitioner_name: (value, item) =>
                    getPractitionerDisplay(item.practitioner_id),
                  location: value => value || '-',
                  priority: value =>
                    value ? (
                      <Badge
                        color={getPriorityColor(value)}
                        variant="filled"
                        size="sm"
                      >
                        {value}
                      </Badge>
                    ) : (
                      '-'
                    ),
                  diagnosis: value =>
                    value ? (
                      <Text size="sm" title={value}>
                        {value.length > 40
                          ? `${value.substring(0, 40)}...`
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

      <MantineVisitForm
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingVisit ? 'Edit Visit' : 'Add New Visit'}
        formData={formData}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        practitioners={practitioners}
        editingVisit={editingVisit}
      />

      {/* Visit View Modal */}
      <Modal
        opened={showViewModal}
        onClose={() => setShowViewModal(false)}
        title={
          <Group>
            <Text size="lg" fw={600}>
              Visit Details
            </Text>
            {viewingVisit && (
              <Group gap="xs">
                {viewingVisit.visit_type && (
                  <Badge
                    color={getVisitTypeColor(viewingVisit.visit_type)}
                    variant="light"
                    size="sm"
                  >
                    {viewingVisit.visit_type}
                  </Badge>
                )}
                {viewingVisit.priority && (
                  <Badge
                    color={getPriorityColor(viewingVisit.priority)}
                    variant="filled"
                    size="sm"
                  >
                    {viewingVisit.priority}
                  </Badge>
                )}
              </Group>
            )}
          </Group>
        }
        size="lg"
        centered
      >
        {viewingVisit && (
          <Stack gap="md">
            <Card withBorder p="md">
              <Stack gap="sm">
                <Group justify="space-between" align="flex-start">
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Title order={3}>
                      {viewingVisit.reason || 'General Visit'}
                    </Title>
                    <Text size="sm" c="dimmed">
                      {formatDate(viewingVisit.date)}
                    </Text>
                  </Stack>
                </Group>
              </Stack>
            </Card>

            <Grid>
              <Grid.Col span={6}>
                <Card withBorder p="md" h="100%">
                  <Stack gap="sm">
                    <Text fw={600} size="sm" c="dimmed">
                      VISIT INFORMATION
                    </Text>
                    <Divider />
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Reason:
                      </Text>
                      <Text
                        size="sm"
                        c={viewingVisit.reason ? 'inherit' : 'dimmed'}
                      >
                        {viewingVisit.reason || 'Not specified'}
                      </Text>
                    </Group>
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Visit Type:
                      </Text>
                      <Text
                        size="sm"
                        c={viewingVisit.visit_type ? 'inherit' : 'dimmed'}
                      >
                        {viewingVisit.visit_type || 'Not specified'}
                      </Text>
                    </Group>
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Priority:
                      </Text>
                      <Text
                        size="sm"
                        c={viewingVisit.priority ? 'inherit' : 'dimmed'}
                      >
                        {viewingVisit.priority || 'Not specified'}
                      </Text>
                    </Group>
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Location:
                      </Text>
                      <Text
                        size="sm"
                        c={viewingVisit.location ? 'inherit' : 'dimmed'}
                      >
                        {viewingVisit.location || 'Not specified'}
                      </Text>
                    </Group>
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Duration:
                      </Text>
                      <Text
                        size="sm"
                        c={viewingVisit.duration_minutes ? 'inherit' : 'dimmed'}
                      >
                        {viewingVisit.duration_minutes
                          ? `${viewingVisit.duration_minutes} minutes`
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
                      CLINICAL DETAILS
                    </Text>
                    <Divider />
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Practitioner:
                      </Text>
                      <Text
                        size="sm"
                        c={viewingVisit.practitioner_id ? 'inherit' : 'dimmed'}
                      >
                        {viewingVisit.practitioner_id
                          ? practitioners.find(
                              p =>
                                p.id === parseInt(viewingVisit.practitioner_id)
                            )?.name ||
                            `Practitioner ID: ${viewingVisit.practitioner_id}`
                          : 'Not specified'}
                      </Text>
                    </Group>
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Practice:
                      </Text>
                      <Text
                        size="sm"
                        c={
                          viewingVisit.practitioner_id &&
                          practitioners.find(
                            p => p.id === parseInt(viewingVisit.practitioner_id)
                          )?.specialty
                            ? 'inherit'
                            : 'dimmed'
                        }
                      >
                        {viewingVisit.practitioner_id &&
                        practitioners.find(
                          p => p.id === parseInt(viewingVisit.practitioner_id)
                        )?.specialty
                          ? practitioners.find(
                              p =>
                                p.id === parseInt(viewingVisit.practitioner_id)
                            )?.specialty
                          : 'Not specified'}
                      </Text>
                    </Group>
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Chief Complaint:
                      </Text>
                      <Text
                        size="sm"
                        c={viewingVisit.chief_complaint ? 'inherit' : 'dimmed'}
                      >
                        {viewingVisit.chief_complaint || 'Not specified'}
                      </Text>
                    </Group>
                    <Group>
                      <Text size="sm" fw={500} w={80}>
                        Diagnosis:
                      </Text>
                      <Text
                        size="sm"
                        c={viewingVisit.diagnosis ? 'inherit' : 'dimmed'}
                      >
                        {viewingVisit.diagnosis || 'Not specified'}
                      </Text>
                    </Group>
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>

            {viewingVisit.treatment_plan && (
              <Card withBorder p="md">
                <Stack gap="sm">
                  <Text fw={600} size="sm" c="dimmed">
                    TREATMENT PLAN
                  </Text>
                  <Divider />
                  <Text
                    size="sm"
                    c={viewingVisit.treatment_plan ? 'inherit' : 'dimmed'}
                  >
                    {viewingVisit.treatment_plan ||
                      'No treatment plan available'}
                  </Text>
                </Stack>
              </Card>
            )}

            {viewingVisit.follow_up_instructions && (
              <Card withBorder p="md">
                <Stack gap="sm">
                  <Text fw={600} size="sm" c="dimmed">
                    FOLLOW-UP INSTRUCTIONS
                  </Text>
                  <Divider />
                  <Text
                    size="sm"
                    c={
                      viewingVisit.follow_up_instructions ? 'inherit' : 'dimmed'
                    }
                  >
                    {viewingVisit.follow_up_instructions ||
                      'No follow-up instructions available'}
                  </Text>
                </Stack>
              </Card>
            )}

            <Card withBorder p="md">
              <Stack gap="sm">
                <Text fw={600} size="sm" c="dimmed">
                  ADDITIONAL NOTES
                </Text>
                <Divider />
                <Text size="sm" c={viewingVisit.notes ? 'inherit' : 'dimmed'}>
                  {viewingVisit.notes || 'No notes available'}
                </Text>
              </Stack>
            </Card>

            <Group justify="flex-end" mt="md">
              <Button
                variant="light"
                onClick={() => {
                  setShowViewModal(false);
                  handleEditVisit(viewingVisit);
                }}
              >
                Edit Visit
              </Button>
              <Button variant="filled" onClick={() => setShowViewModal(false)}>
                Close
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </motion.div>
  );
};

export default Visits;
