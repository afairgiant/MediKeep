import React, { useState, useEffect } from 'react';
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
  IconCalendar,
  IconShieldCheck,
} from '@tabler/icons-react';
import { useMedicalData } from '../../hooks/useMedicalData';
import { useDataManagement } from '../../hooks/useDataManagement';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiService } from '../../services/api';
import { formatDate } from '../../utils/helpers';
import { usePractitioners } from '../../hooks/useGlobalData';
import { getMedicalPageConfig } from '../../utils/medicalPageConfigs';
import { getEntityFormatters } from '../../utils/tableFormatters';
import { navigateToEntity } from '../../utils/linkNavigation';
import { PageHeader } from '../../components';
import MantineFilters from '../../components/mantine/MantineFilters';
import MedicalTable from '../../components/shared/MedicalTable';
import ViewToggle from '../../components/shared/ViewToggle';
import MantineVisitForm from '../../components/medical/MantineVisitForm';
import DocumentManager from '../../components/shared/DocumentManager';
import FileCountBadge from '../../components/shared/FileCountBadge';

const Visits = () => {
  const [viewMode, setViewMode] = useState('cards');
  const navigate = useNavigate();
  const location = useLocation();

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

  // Get patient conditions for linking
  const [conditions, setConditions] = useState([]);
  
  // File count management for cards
  const [fileCounts, setFileCounts] = useState({});
  const [fileCountsLoading, setFileCountsLoading] = useState({});
  
  useEffect(() => {
    if (currentPatient?.id) {
      apiService.getPatientConditions(currentPatient.id)
        .then(response => {
          setConditions(response || []);
        })
        .catch(error => {
          console.error('Failed to fetch conditions:', error);
          setConditions([]);
        });
    }
  }, [currentPatient?.id]);

  // Load file counts for visits
  useEffect(() => {
    const loadFileCountsForVisits = async () => {
      if (!visits || visits.length === 0) return;
      
      const countPromises = visits.map(async (visit) => {
        if (fileCounts[visit.id] !== undefined) return; // Already loaded
        
        setFileCountsLoading(prev => ({ ...prev, [visit.id]: true }));
        try {
          const files = await apiService.getEntityFiles('visit', visit.id);
          const count = Array.isArray(files) ? files.length : 0;
          setFileCounts(prev => ({ ...prev, [visit.id]: count }));
        } catch (error) {
          console.error(`Error loading file count for visit ${visit.id}:`, error);
          setFileCounts(prev => ({ ...prev, [visit.id]: 0 }));
        } finally {
          setFileCountsLoading(prev => ({ ...prev, [visit.id]: false }));
        }
      });
      
      await Promise.all(countPromises);
    };

    loadFileCountsForVisits();
  }, [visits, fileCounts]);

  // Helper function to get condition details
  const getConditionDetails = (conditionId) => {
    if (!conditionId || conditions.length === 0) return null;
    return conditions.find(cond => cond.id === conditionId);
  };

  // Get standardized formatters for visits with condition linking
  const formatters = {
    ...getEntityFormatters('visits', [], navigate),
    condition_name: (value, visit) => {
      const condition = getConditionDetails(visit.condition_id);
      return condition?.diagnosis || '';
    },
  };

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
    condition_id: '',
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
      condition_id: '',
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
    // Update URL with visit ID for sharing/bookmarking
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('view', visit.id);
    navigate(`${location.pathname}?${searchParams.toString()}`, {
      replace: true,
    });
  };

  const handleEditVisit = visit => {
    setEditingVisit(visit);
    setFormData({
      reason: visit.reason || '',
      date: visit.date ? visit.date.split('T')[0] : '',
      notes: visit.notes || '',
      practitioner_id: visit.practitioner_id || '',
      condition_id: visit.condition_id ? visit.condition_id.toString() : '',
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

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setViewingVisit(null);
    // Remove view parameter from URL
    const searchParams = new URLSearchParams(location.search);
    searchParams.delete('view');
    const newSearch = searchParams.toString();
    navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`, {
      replace: true,
    });
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
      condition_id: formData.condition_id ? parseInt(formData.condition_id) : null,
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

  // Handle URL parameters for direct linking to specific visits
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const viewId = searchParams.get('view');

    if (viewId && visits && visits.length > 0 && !loading) {
      const visit = visits.find(v => v.id.toString() === viewId);
      if (visit && !showViewModal) {
        // Only auto-open if modal isn't already open
        setViewingVisit(visit);
        setShowViewModal(true);
      }
    }
  }, [location.search, visits, loading, showViewModal]);

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
            variant="filled"
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
                              <FileCountBadge
                                count={fileCounts[visit.id] || 0}
                                entityType="visit"
                                variant="badge"
                                size="sm"
                                loading={fileCountsLoading[visit.id] || false}
                                onClick={() => handleViewVisit(visit)}
                              />
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

                          {(() => {
                            const condition = getConditionDetails(visit.condition_id);
                            return condition ? (
                              <Group justify="space-between">
                                <Text size="sm" c="dimmed">
                                  Related Condition:
                                </Text>
                                <Text
                                  size="sm"
                                  fw={500}
                                  c="blue"
                                  style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                  onClick={() => navigateToEntity('condition', condition.id, navigate)}
                                  title="View condition details"
                                >
                                  {condition.diagnosis}
                                </Text>
                              </Group>
                            ) : null;
                          })()}

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
                            <Text size="sm">
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
                            <Text size="sm">
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
                            <Text size="sm">
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
                            <Text size="sm">
                              {visit.notes}
                            </Text>
                          </Box>
                        )}

                        <Stack gap={0} mt="auto">
                          <Divider />
                          <Group justify="flex-end" gap="xs" pt="sm">
                            <Button
                              variant="filled"
                              size="xs"
                              onClick={() => handleViewVisit(visit)}
                            >
                              View
                            </Button>
                            <Button
                              variant="filled"
                              size="xs"
                              onClick={() => handleEditVisit(visit)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="filled"
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
                  { header: 'Facility', accessor: 'location' },
                  { header: 'Practitioner', accessor: 'practitioner_name' },
                  { header: 'Related Condition', accessor: 'condition_name' },
                  { header: 'Diagnosis', accessor: 'diagnosis' },
                  { header: 'Notes', accessor: 'notes' },
                ]}
                patientData={currentPatient}
                tableName="Visit History"
                onView={handleViewVisit}
                onEdit={handleEditVisit}
                onDelete={handleDeleteVisit}
                formatters={{
                  date: getEntityFormatters('visits').date,
                  reason: getEntityFormatters('visits').text,
                  visit_type: getEntityFormatters('visits').simple,
                  location: getEntityFormatters('visits').simple,
                  practitioner_name: (value, item) =>
                    getEntityFormatters(
                      'visits',
                      practitioners
                    ).practitioner_name(value, item),
                  condition_name: formatters.condition_name,
                  diagnosis: getEntityFormatters('visits').text,
                  notes: getEntityFormatters('visits').text,
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
        conditionsOptions={conditions}
        conditionsLoading={false}
        editingVisit={editingVisit}
      />

      {/* Visit View Modal */}
      <Modal
        opened={showViewModal}
        onClose={handleCloseViewModal}
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
                    {(() => {
                      const condition = getConditionDetails(viewingVisit.condition_id);
                      return condition ? (
                        <Group>
                          <Text size="sm" fw={500} w={80}>
                            Condition:
                          </Text>
                          <Text
                            size="sm"
                            c="blue"
                            style={{ cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => navigateToEntity('condition', condition.id, navigate)}
                            title="View condition details"
                          >
                            {condition.diagnosis}
                          </Text>
                        </Group>
                      ) : null;
                    })()}
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

            {/* Document Management */}
            <Card withBorder p="md">
              <Stack gap="sm">
                <Text fw={600} size="sm" c="dimmed">
                  ATTACHED DOCUMENTS
                </Text>
                <Divider />
                <DocumentManager
                  entityType="visit"
                  entityId={viewingVisit.id}
                  mode="view"
                  config={{
                    acceptedTypes: ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'],
                    maxSize: 10 * 1024 * 1024, // 10MB
                    maxFiles: 10
                  }}
                  onError={(error) => {
                    console.error('Document manager error:', error);
                  }}
                />
              </Stack>
            </Card>

            <Group justify="flex-end" mt="md">
              <Button
                variant="filled"
                size="xs"
                onClick={() => {
                  handleCloseViewModal();
                  // Small delay to ensure view modal is closed before opening edit modal
                  setTimeout(() => {
                    handleEditVisit(viewingVisit);
                  }, 100);
                }}
              >
                Edit Visit
              </Button>
              <Button variant="filled" size="xs" onClick={handleCloseViewModal}>
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
