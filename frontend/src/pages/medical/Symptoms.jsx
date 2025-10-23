import logger from '../../services/logger';

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Container,
  Paper,
  Group,
  Text,
  Stack,
  Alert,
  Loader,
  Center,
  Button,
  Tabs,
  Badge,
} from '@mantine/core';
import {
  IconStethoscope,
  IconPlus,
  IconTrash,
  IconTimeline,
  IconCalendar,
  IconList,
  IconEye,
  IconNote,
  IconEdit,
} from '@tabler/icons-react';
import { useViewNavigation } from '../../hooks/useViewNavigation';
import { usePatientWithStaticData } from '../../hooks/useGlobalData';
import { symptomApi } from '../../services/api/symptomApi';
import { PageHeader } from '../../components';
import MantineSymptomForm from '../../components/medical/MantineSymptomForm';
import MantineSymptomOccurrenceForm from '../../components/medical/MantineSymptomOccurrenceForm';
import SymptomTimeline from '../../components/medical/SymptomTimeline';
import SymptomCalendar from '../../components/medical/SymptomCalendar';
import { SymptomViewModal } from '../../components/medical/symptoms';
import { SYMPTOM_STATUS_COLORS } from '../../constants/symptomEnums';

const Symptoms = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { navigateToView, closeView } = useViewNavigation();

  // Get current patient from global hook (same as Medication.js)
  const { patient } = usePatientWithStaticData();
  const currentPatient = patient?.patient;

  // Data state
  const [symptoms, setSymptoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // View state
  const [activeTab, setActiveTab] = useState('list');
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewingSymptom, setViewingSymptom] = useState(null);

  // Symptom Definition Form state
  const [showSymptomForm, setShowSymptomForm] = useState(false);
  const [editingSymptom, setEditingSymptom] = useState(null);
  const [symptomFormData, setSymptomFormData] = useState({
    symptom_name: '',
    category: '',
    first_occurrence_date: '',
    status: 'active',
    is_chronic: false,
    typical_triggers: [],
    general_notes: '',
    tags: [],
  });

  // Occurrence Form state
  const [showOccurrenceForm, setShowOccurrenceForm] = useState(false);
  const [selectedSymptomForOccurrence, setSelectedSymptomForOccurrence] = useState(null);
  const [editingOccurrence, setEditingOccurrence] = useState(null);
  const [occurrenceFormData, setOccurrenceFormData] = useState({
    occurrence_date: '',
    time_of_day: '',
    severity: 'moderate',
    pain_scale: '',
    duration: '',
    location: '',
    impact_level: '',
    triggers: [],
    relief_methods: [],
    associated_symptoms: [],
    resolved_date: '',
    resolution_notes: '',
    notes: '',
  });

  const fetchSymptoms = useCallback(async () => {
    if (!currentPatient?.id) return;

    try {
      setLoading(true);
      setError(null);

      logger.debug('symptoms_page_fetch', {
        patientId: currentPatient?.id,
        component: 'Symptoms',
      });

      const data = await symptomApi.getAll({
        patient_id: currentPatient.id,
      });

      setSymptoms(data || []);

      logger.info('symptoms_page_fetch_success', {
        count: data?.length || 0,
        component: 'Symptoms',
      });
    } catch (err) {
      logger.error('symptoms_page_fetch_error', {
        error: err.message,
        component: 'Symptoms',
      });
      setError('Failed to load symptoms. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [currentPatient]);

  // Fetch symptoms when patient changes
  useEffect(() => {
    if (currentPatient?.id) {
      fetchSymptoms();
    } else {
      setSymptoms([]);
      setLoading(false);
    }
  }, [currentPatient?.id, fetchSymptoms]);

  // Symptom Definition Handlers
  const handleAddSymptom = () => {
    setSymptomFormData({
      symptom_name: '',
      category: '',
      first_occurrence_date: new Date().toISOString().split('T')[0],
      status: 'active',
      is_chronic: false,
      typical_triggers: [],
      general_notes: '',
      tags: [],
    });
    setEditingSymptom(null);
    setShowSymptomForm(true);
  };

  const handleEditSymptom = symptom => {
    setSymptomFormData({
      symptom_name: symptom.symptom_name || '',
      category: symptom.category || '',
      first_occurrence_date: symptom.first_occurrence_date || '',
      status: symptom.status || 'active',
      is_chronic: symptom.is_chronic || false,
      typical_triggers: symptom.typical_triggers || [],
      general_notes: symptom.general_notes || '',
      tags: symptom.tags || [],
    });
    setEditingSymptom(symptom);
    setShowSymptomForm(true);
  };

  const handleSymptomInputChange = e => {
    const { name, value, type, checked } = e.target;
    setSymptomFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSymptomSubmit = async e => {
    e.preventDefault();

    if (!currentPatient?.id) {
      setError('Patient information not available');
      return;
    }

    try {
      const submitData = {
        ...symptomFormData,
        patient_id: currentPatient.id,
      };

      if (editingSymptom) {
        await symptomApi.update(editingSymptom.id, submitData);
        setSuccessMessage('Symptom updated successfully');
      } else {
        await symptomApi.create(submitData);
        setSuccessMessage('Symptom created successfully');
      }

      setShowSymptomForm(false);
      setEditingSymptom(null);
      fetchSymptoms();

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      logger.error('symptom_submit_error', {
        error: err.message,
        editing: !!editingSymptom,
        component: 'Symptoms',
      });
      setError(err.message || 'Failed to save symptom');
    }
  };

  const handleDeleteSymptom = async symptomId => {
    if (!window.confirm('Are you sure you want to delete this symptom and all its occurrences?')) {
      return;
    }

    try {
      await symptomApi.delete(symptomId);
      setSuccessMessage('Symptom deleted successfully');
      fetchSymptoms();

      if (viewingSymptom?.id === symptomId) {
        handleCloseViewModal();
      }

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      logger.error('symptom_delete_error', {
        symptomId,
        error: err.message,
        component: 'Symptoms',
      });
      setError(err.message || 'Failed to delete symptom');
    }
  };

  // Occurrence Handlers
  const handleLogEpisode = symptom => {
    setSelectedSymptomForOccurrence(symptom);
    setEditingOccurrence(null);
    setOccurrenceFormData({
      occurrence_date: new Date().toISOString().split('T')[0],
      time_of_day: '',
      severity: 'moderate',
      pain_scale: '',
      duration: '',
      location: '',
      impact_level: '',
      triggers: [],
      relief_methods: [],
      associated_symptoms: [],
      resolved_date: '',
      resolution_notes: '',
      notes: '',
    });
    setShowOccurrenceForm(true);
  };

  const handleEditOccurrence = (symptom, occurrence) => {
    setSelectedSymptomForOccurrence(symptom);
    setEditingOccurrence(occurrence);
    setOccurrenceFormData({
      occurrence_date: occurrence.occurrence_date || '',
      time_of_day: occurrence.time_of_day || '',
      severity: occurrence.severity || 'moderate',
      pain_scale: occurrence.pain_scale !== null ? occurrence.pain_scale.toString() : '',
      duration: occurrence.duration || '',
      location: occurrence.location || '',
      impact_level: occurrence.impact_level || '',
      triggers: occurrence.triggers || [],
      relief_methods: occurrence.relief_methods || [],
      associated_symptoms: occurrence.associated_symptoms || [],
      resolved_date: occurrence.resolved_date || '',
      resolution_notes: occurrence.resolution_notes || '',
      notes: occurrence.notes || '',
    });
    setShowOccurrenceForm(true);
  };

  const handleOccurrenceInputChange = e => {
    const { name, value } = e.target;
    setOccurrenceFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleOccurrenceSubmit = async e => {
    e.preventDefault();

    if (!selectedSymptomForOccurrence?.id) {
      setError('Symptom information not available');
      return;
    }

    try {
      const submitData = {
        ...occurrenceFormData,
        pain_scale:
          occurrenceFormData.pain_scale !== ''
            ? parseInt(occurrenceFormData.pain_scale, 10)
            : null,
        resolved_date: occurrenceFormData.resolved_date || null,
      };

      if (editingOccurrence) {
        await symptomApi.updateOccurrence(
          selectedSymptomForOccurrence.id,
          editingOccurrence.id,
          submitData
        );
        setSuccessMessage('Episode updated successfully');
      } else {
        await symptomApi.createOccurrence(selectedSymptomForOccurrence.id, submitData);
        setSuccessMessage('Episode logged successfully');
      }

      setShowOccurrenceForm(false);
      setSelectedSymptomForOccurrence(null);
      setEditingOccurrence(null);
      fetchSymptoms();

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      logger.error('occurrence_submit_error', {
        symptomId: selectedSymptomForOccurrence.id,
        editing: !!editingOccurrence,
        error: err.message,
        component: 'Symptoms',
      });
      setError(err.message || 'Failed to save episode');
    }
  };

  // View Modal Handlers
  const handleViewSymptom = symptom => {
    setViewingSymptom(symptom);
    setViewModalOpen(true);
    navigateToView(symptom.id);
  };

  const handleCloseViewModal = () => {
    setViewModalOpen(false);
    setViewingSymptom(null);
    closeView();
  };

  // Handle URL parameters for direct linking
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const viewId = searchParams.get('view');

    if (viewId && symptoms.length > 0 && !loading) {
      const symptom = symptoms.find(s => s.id.toString() === viewId);
      if (symptom && !viewModalOpen) {
        setViewingSymptom(symptom);
        setViewModalOpen(true);
      }
    }
  }, [location.search, symptoms, loading, viewModalOpen]);

  // Clear messages after timeout
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Loading state
  if (loading && symptoms.length === 0) {
    return (
      <Container size="xl">
        <PageHeader title="Symptoms" icon="🩺" />
        <Center style={{ minHeight: 400 }}>
          <Loader size="lg" />
        </Center>
      </Container>
    );
  }

  // No patient selected
  if (!currentPatient) {
    return (
      <Container size="xl">
        <PageHeader title="Symptoms" icon="🩺" />
        <Alert title="No Patient Selected" color="blue">
          Please select or create a patient to track symptoms.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <PageHeader title="Symptoms" icon="🩺" />

      {/* Success/Error Messages */}
      {error && (
        <Alert
          title="Error"
          color="red"
          onClose={() => setError(null)}
          withCloseButton
          mb="md"
        >
          {error}
        </Alert>
      )}
      {successMessage && (
        <Alert title="Success" color="green" mb="md">
          {successMessage}
        </Alert>
      )}

      {/* Add Symptom Button */}
      <Group mb="md">
        <Button leftSection={<IconPlus size={16} />} onClick={handleAddSymptom}>
          Add Symptom
        </Button>
      </Group>

      {/* Tabs for different views */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="list" leftSection={<IconList size={16} />}>
            List
          </Tabs.Tab>
          <Tabs.Tab value="timeline" leftSection={<IconTimeline size={16} />}>
            Timeline
          </Tabs.Tab>
          <Tabs.Tab value="calendar" leftSection={<IconCalendar size={16} />}>
            Calendar
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="list">
          {/* Symptoms List */}
          {symptoms.length === 0 ? (
            <Paper p="xl" withBorder>
              <Stack align="center" gap="md">
                <IconStethoscope size={48} stroke={1.5} color="gray" />
                <Text size="lg" c="dimmed">
                  No symptoms recorded yet
                </Text>
                <Text size="sm" c="dimmed">
                  Click "Add Symptom" to start tracking a new symptom
                </Text>
              </Stack>
            </Paper>
          ) : (
            <Stack gap="md">
              {symptoms.map(symptom => (
                <Paper
                  key={symptom.id}
                  p="md"
                  withBorder
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleViewSymptom(symptom)}
                >
                  <Group justify="space-between" align="flex-start">
                    <Stack gap="xs" style={{ flex: 1 }}>
                      <Group gap="sm">
                        <Text fw={600} size="lg">
                          {symptom.symptom_name}
                        </Text>
                        <Badge
                          color={SYMPTOM_STATUS_COLORS[symptom.status]}
                          variant="light"
                        >
                          {symptom.status}
                        </Badge>
                        {symptom.is_chronic && (
                          <Badge color="violet" variant="light">
                            Chronic
                          </Badge>
                        )}
                      </Group>

                      {symptom.category && (
                        <Text size="sm" c="dimmed">
                          Category: {symptom.category}
                        </Text>
                      )}

                      <Group gap="md">
                        <Text size="sm" c="dimmed">
                          First: {new Date(symptom.first_occurrence_date).toLocaleDateString()}
                        </Text>
                        {symptom.last_occurrence_date && (
                          <Text size="sm" c="dimmed">
                            Last: {new Date(symptom.last_occurrence_date).toLocaleDateString()}
                          </Text>
                        )}
                        <Text size="sm" fw={500} c="blue">
                          {symptom.occurrence_count || 0} episode{symptom.occurrence_count === 1 ? '' : 's'}
                        </Text>
                      </Group>

                      {symptom.general_notes && (
                        <Text size="sm" lineClamp={2}>
                          {symptom.general_notes}
                        </Text>
                      )}

                      {symptom.typical_triggers && symptom.typical_triggers.length > 0 && (
                        <Group gap="xs">
                          <Text size="xs" c="dimmed">
                            Common Triggers:
                          </Text>
                          {symptom.typical_triggers.slice(0, 3).map((trigger, index) => (
                            <Badge key={index} size="sm" variant="outline">
                              {trigger}
                            </Badge>
                          ))}
                          {symptom.typical_triggers.length > 3 && (
                            <Text size="xs" c="dimmed">
                              +{symptom.typical_triggers.length - 3} more
                            </Text>
                          )}
                        </Group>
                      )}

                      {symptom.tags && symptom.tags.length > 0 && (
                        <Group gap="xs">
                          {symptom.tags.map((tag, index) => (
                            <Badge key={index} size="sm" color="blue">
                              {tag}
                            </Badge>
                          ))}
                        </Group>
                      )}
                    </Stack>

                    <Group gap="xs" onClick={e => e.stopPropagation()}>
                      <Button
                        size="xs"
                        variant="filled"
                        color="green"
                        leftSection={<IconNote size={14} />}
                        onClick={() => handleLogEpisode(symptom)}
                      >
                        Log Episode
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconEye size={14} />}
                        onClick={() => handleViewSymptom(symptom)}
                      >
                        View
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconEdit size={14} />}
                        onClick={() => handleEditSymptom(symptom)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        onClick={() => handleDeleteSymptom(symptom.id)}
                      >
                        Delete
                      </Button>
                    </Group>
                  </Group>
                </Paper>
              ))}
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="timeline">
          <SymptomTimeline patientId={currentPatient?.id} hidden={activeTab !== 'timeline'} />
        </Tabs.Panel>

        <Tabs.Panel value="calendar">
          <SymptomCalendar patientId={currentPatient?.id} hidden={activeTab !== 'calendar'} />
        </Tabs.Panel>
      </Tabs>

      {/* View Symptom Details Modal */}
      <SymptomViewModal
        isOpen={viewModalOpen}
        onClose={handleCloseViewModal}
        symptom={viewingSymptom}
        onEdit={handleEditSymptom}
        onDelete={handleDeleteSymptom}
        onLogEpisode={handleLogEpisode}
        onEditOccurrence={handleEditOccurrence}
        onRefresh={fetchSymptoms}
      />

      {/* Symptom Definition Form Modal */}
      <MantineSymptomForm
        isOpen={showSymptomForm}
        onClose={() => {
          setShowSymptomForm(false);
          setEditingSymptom(null);
        }}
        title={editingSymptom ? 'Edit Symptom' : 'Add New Symptom'}
        formData={symptomFormData}
        onInputChange={handleSymptomInputChange}
        onSubmit={handleSymptomSubmit}
        editingSymptom={editingSymptom}
      />

      {/* Occurrence Form Modal */}
      <MantineSymptomOccurrenceForm
        isOpen={showOccurrenceForm}
        onClose={() => {
          setShowOccurrenceForm(false);
          setSelectedSymptomForOccurrence(null);
          setEditingOccurrence(null);
        }}
        title={
          editingOccurrence
            ? `Edit Episode: ${selectedSymptomForOccurrence?.symptom_name}`
            : `Log Episode: ${selectedSymptomForOccurrence?.symptom_name}`
        }
        formData={occurrenceFormData}
        onInputChange={handleOccurrenceInputChange}
        onSubmit={handleOccurrenceSubmit}
        editingOccurrence={editingOccurrence}
      />
    </Container>
  );
};

export default Symptoms;
