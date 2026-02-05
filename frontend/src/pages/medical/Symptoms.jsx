import logger from '../../services/logger';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Paper,
  Text,
  Stack,
  Alert,
  Tabs,
  Badge,
  Button,
  Group,
} from '@mantine/core';
import MedicalPageAlerts from '../../components/shared/MedicalPageAlerts';
import MedicalPageActions from '../../components/shared/MedicalPageActions';
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
import { useViewModalNavigation } from '../../hooks/useViewModalNavigation';
import { usePatientWithStaticData } from '../../hooks/useGlobalData';
import { symptomApi } from '../../services/api/symptomApi';
import { PageHeader } from '../../components';
import MantineSymptomForm from '../../components/medical/MantineSymptomForm';
import MantineSymptomOccurrenceForm from '../../components/medical/MantineSymptomOccurrenceForm';
import SymptomTimeline from '../../components/medical/SymptomTimeline';
import SymptomCalendar from '../../components/medical/SymptomCalendar';
import MedicalPageLoading from '../../components/shared/MedicalPageLoading';
import { SymptomViewModal } from '../../components/medical/symptoms';
import { SYMPTOM_STATUS_COLORS } from '../../constants/symptomEnums';
import { useDateFormat } from '../../hooks/useDateFormat';

const Symptoms = () => {
  const { t } = useTranslation('common');
  const { formatDate } = useDateFormat();

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

  // Default occurrence form state - used for both initial state and reset
  const getDefaultOccurrenceFormData = useCallback((withTodayDate = false) => ({
    occurrence_date: withTodayDate ? new Date().toISOString().split('T')[0] : '',
    occurrence_time: '',
    severity: 'moderate',
    pain_scale: '',
    duration: '',
    location: '',
    impact_level: '',
    triggers: '',
    relief_methods: '',
    associated_symptoms: '',
    resolved_date: '',
    resolved_time: '',
    resolution_notes: '',
    notes: '',
  }), []);

  // Occurrence Form state
  const [showOccurrenceForm, setShowOccurrenceForm] = useState(false);
  const [selectedSymptomForOccurrence, setSelectedSymptomForOccurrence] = useState(null);
  const [editingOccurrence, setEditingOccurrence] = useState(null);
  const [occurrenceFormData, setOccurrenceFormData] = useState(getDefaultOccurrenceFormData());

  // Fetch symptoms function defined before hook usage
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

  // View modal navigation with URL deep linking
  const {
    isOpen: viewModalOpen,
    viewingItem: viewingSymptom,
    openModal: handleViewSymptom,
    closeModal: handleCloseViewModal,
  } = useViewModalNavigation({
    items: symptoms,
    loading,
  });

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
    if (!window.confirm(t('symptoms.confirmDeleteSymptom', 'Are you sure you want to delete this symptom and all its occurrences?'))) {
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
    setOccurrenceFormData(getDefaultOccurrenceFormData(true));
    setShowOccurrenceForm(true);
  };

  const handleEditOccurrence = (symptom, occurrence) => {
    // Helper to convert array fields to comma-separated string for form display
    const arrayToString = value => Array.isArray(value) ? value.join(', ') : (value || '');

    setSelectedSymptomForOccurrence(symptom);
    setEditingOccurrence(occurrence);
    setOccurrenceFormData({
      occurrence_date: occurrence.occurrence_date || '',
      occurrence_time: occurrence.occurrence_time || '',
      severity: occurrence.severity || 'moderate',
      pain_scale: occurrence.pain_scale !== null ? occurrence.pain_scale.toString() : '',
      duration: occurrence.duration || '',
      location: occurrence.location || '',
      impact_level: occurrence.impact_level || '',
      triggers: arrayToString(occurrence.triggers),
      relief_methods: arrayToString(occurrence.relief_methods),
      associated_symptoms: arrayToString(occurrence.associated_symptoms),
      resolved_date: occurrence.resolved_date || '',
      resolved_time: occurrence.resolved_time || '',
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
        occurrence_time: occurrenceFormData.occurrence_time || null,
        resolved_date: occurrenceFormData.resolved_date || null,
        resolved_time: occurrenceFormData.resolved_time || null,
        // Convert comma-separated text fields to arrays for backend
        triggers: occurrenceFormData.triggers
          ? occurrenceFormData.triggers.split(',').map(s => s.trim()).filter(s => s.length > 0)
          : [],
        relief_methods: occurrenceFormData.relief_methods
          ? occurrenceFormData.relief_methods.split(',').map(s => s.trim()).filter(s => s.length > 0)
          : [],
        associated_symptoms: occurrenceFormData.associated_symptoms
          ? occurrenceFormData.associated_symptoms.split(',').map(s => s.trim()).filter(s => s.length > 0)
          : [],
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

  // Clear messages after timeout
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Loading state
  if (loading && symptoms.length === 0) {
    return <MedicalPageLoading message={t('symptoms.loading', 'Loading symptoms...')} />;
  }

  // No patient selected
  if (!currentPatient) {
    return (
      <Container size="xl">
        <PageHeader title={t('symptoms.title', 'Symptoms')} icon="🩺" />
        <Alert title={t('symptoms.noPatientSelected', 'No Patient Selected')} color="blue">
          {t('symptoms.selectPatientPrompt', 'Please select or create a patient to track symptoms.')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <PageHeader title={t('symptoms.title', 'Symptoms')} icon="🩺" />

      {/* Success/Error Messages */}
      <MedicalPageAlerts
        error={error}
        successMessage={successMessage}
        onClearError={() => setError(null)}
      />

      {/* Add Symptom Button */}
      <MedicalPageActions
        primaryAction={{
          label: t('symptoms.addSymptom', 'Add Symptom'),
          onClick: handleAddSymptom,
          leftSection: <IconPlus size={16} />,
        }}
        showViewToggle={false}
        mb="md"
      />

      {/* Tabs for different views */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="list" leftSection={<IconList size={16} />}>
            {t('symptoms.tabs.list', 'List')}
          </Tabs.Tab>
          <Tabs.Tab value="timeline" leftSection={<IconTimeline size={16} />}>
            {t('symptoms.tabs.timeline', 'Timeline')}
          </Tabs.Tab>
          <Tabs.Tab value="calendar" leftSection={<IconCalendar size={16} />}>
            {t('symptoms.tabs.calendar', 'Calendar')}
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="list">
          {/* Symptoms List */}
          {symptoms.length === 0 ? (
            <Paper p="xl" withBorder>
              <Stack align="center" gap="md">
                <IconStethoscope size={48} stroke={1.5} color="gray" />
                <Text size="lg" c="dimmed">
                  {t('symptoms.noRecords', 'No symptoms recorded yet')}
                </Text>
                <Text size="sm" c="dimmed">
                  {t('symptoms.noRecordsPrompt', 'Click "Add Symptom" to start tracking a new symptom')}
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
                            {t('symptoms.chronic', 'Chronic')}
                          </Badge>
                        )}
                      </Group>

                      {symptom.category && (
                        <Text size="sm" c="dimmed">
                          {t('symptoms.category', 'Category')}: {symptom.category}
                        </Text>
                      )}

                      <Group gap="md">
                        <Text size="sm" c="dimmed">
                          {t('symptoms.first', 'First')}: {formatDate(symptom.first_occurrence_date)}
                        </Text>
                        {symptom.last_occurrence_date && (
                          <Text size="sm" c="dimmed">
                            {t('symptoms.last', 'Last')}: {formatDate(symptom.last_occurrence_date)}
                          </Text>
                        )}
                        <Text size="sm" fw={500} c="blue">
                          {symptom.occurrence_count || 0} {symptom.occurrence_count === 1 ? t('symptoms.episode', 'episode') : t('symptoms.episodes', 'episodes')}
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
                            {t('symptoms.commonTriggers', 'Common Triggers')}:
                          </Text>
                          {symptom.typical_triggers.slice(0, 3).map((trigger, index) => (
                            <Badge key={index} size="sm" variant="outline">
                              {trigger}
                            </Badge>
                          ))}
                          {symptom.typical_triggers.length > 3 && (
                            <Text size="xs" c="dimmed">
                              {t('symptoms.moreCount', '+{{count}} more', { count: symptom.typical_triggers.length - 3 })}
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
                        {t('symptoms.logEpisode', 'Log Episode')}
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconEye size={14} />}
                        onClick={() => handleViewSymptom(symptom)}
                      >
                        {t('buttons.view', 'View')}
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconEdit size={14} />}
                        onClick={() => handleEditSymptom(symptom)}
                      >
                        {t('buttons.edit', 'Edit')}
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        onClick={() => handleDeleteSymptom(symptom.id)}
                      >
                        {t('buttons.delete', 'Delete')}
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
        title={editingSymptom ? t('symptoms.editSymptomTitle', 'Edit Symptom') : t('symptoms.addSymptomTitle', 'Add New Symptom')}
        formData={symptomFormData}
        onInputChange={handleSymptomInputChange}
        onSubmit={handleSymptomSubmit}
        editingSymptom={editingSymptom}
        submitButtonText={editingSymptom ? t('buttons.update', 'Update') : t('buttons.save', 'Save')}
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
            ? `${t('symptoms.editEpisodeTitle', 'Edit Episode')}: ${selectedSymptomForOccurrence?.symptom_name}`
            : `${t('symptoms.logEpisodeTitle', 'Log Episode')}: ${selectedSymptomForOccurrence?.symptom_name}`
        }
        formData={occurrenceFormData}
        onInputChange={handleOccurrenceInputChange}
        onSubmit={handleOccurrenceSubmit}
        editingOccurrence={editingOccurrence}
        submitButtonText={editingOccurrence ? t('buttons.update', 'Update') : t('symptoms.logEpisode', 'Log Episode')}
      />
    </Container>
  );
};

export default Symptoms;
