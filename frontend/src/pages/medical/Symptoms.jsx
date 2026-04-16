import logger from '../../services/logger';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useFormSubmissionWithUploads } from '../../hooks/useFormSubmissionWithUploads';
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
import { usePagination } from '../../hooks/usePagination';
import PaginationControls from '../../components/shared/PaginationControls';
import { usePatientPermissions } from '../../hooks/usePatientPermissions';

const Symptoms = () => {
  const { t } = useTranslation(['common', 'shared']);
  const { isViewOnly, viewOnlyTooltip } = usePatientPermissions();
  const { formatDate } = useDateFormat();
  const {
    page,
    setPage,
    pageSize,
    handlePageSizeChange,
    paginateData,
    totalPages,
    clampPage,
    PAGE_SIZE_OPTIONS,
  } = usePagination();

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
    resolved_date: '',
    typical_triggers: [],
    general_notes: '',
    tags: [],
  });

  // Default occurrence form state - used for both initial state and reset
  const getDefaultOccurrenceFormData = useCallback(
    (withTodayDate = false) => ({
      occurrence_date: withTodayDate
        ? new Date().toISOString().split('T')[0]
        : '',
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
    }),
    []
  );

  // Occurrence Form state
  const [showOccurrenceForm, setShowOccurrenceForm] = useState(false);
  const [selectedSymptomForOccurrence, setSelectedSymptomForOccurrence] =
    useState(null);
  const [editingOccurrence, setEditingOccurrence] = useState(null);
  const [occurrenceFormData, setOccurrenceFormData] = useState(
    getDefaultOccurrenceFormData()
  );

  // Document manager methods ref for upload orchestration
  const [documentManagerMethods, setDocumentManagerMethods] = useState(null);

  // Fetch guard — incremented on each intentional fetch so stale responses are ignored
  const fetchIdRef = useRef(0);

  const patientId = currentPatient?.id;
  const fetchSymptoms = useCallback(async () => {
    if (!patientId) return;

    const id = ++fetchIdRef.current;

    try {
      setLoading(true);
      setError(null);

      const data = await symptomApi.getAll({
        patient_id: patientId,
      });

      // Only apply if this is still the latest fetch
      if (id === fetchIdRef.current) {
        setSymptoms(data || []);
      }
    } catch (err) {
      if (id === fetchIdRef.current) {
        logger.error('symptoms_page_fetch_error', {
          error: err.message,
          component: 'Symptoms',
        });
        setError('Failed to load symptoms. Please try again.');
      }
    } finally {
      if (id === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [patientId]);

  // Fetch symptoms when patient ID changes (effect only re-fires when the primitive ID changes)
  useEffect(() => {
    if (patientId) {
      fetchSymptoms();
    } else {
      // Invalidate any in-flight fetch for the now-cleared patient
      fetchIdRef.current++;
      setSymptoms([]);
      setLoading(false);
    }

    // Cleanup: invalidate any in-flight fetch when dependencies change or on unmount
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchIdRef is a fetch-id counter; we intentionally increment the live ref so any in-flight fetch sees the latest value
      fetchIdRef.current++;
    };
  }, [patientId, fetchSymptoms]);

  const {
    startSubmission,
    completeFormSubmission,
    startFileUpload,
    completeFileUpload,
    handleSubmissionFailure,
    resetSubmission,
    isBlocking,
    statusMessage,
  } = useFormSubmissionWithUploads({
    entityType: 'symptom',
    onSuccess: () => {
      setShowSymptomForm(false);
      setEditingSymptom(null);
      fetchSymptoms();
    },
    onError: error => {
      logger.error('symptom_form_error', {
        message: 'Form submission error in symptoms',
        error,
        component: 'Symptoms',
      });
    },
    component: 'Symptoms',
  });

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
    resetSubmission();
    setDocumentManagerMethods(null);
    setSymptomFormData({
      symptom_name: '',
      category: '',
      first_occurrence_date: new Date().toISOString().split('T')[0],
      status: 'active',
      is_chronic: false,
      resolved_date: '',
      typical_triggers: [],
      general_notes: '',
      tags: [],
    });
    setEditingSymptom(null);
    setShowSymptomForm(true);
  };

  const handleEditSymptom = symptom => {
    resetSubmission();
    setDocumentManagerMethods(null);
    setSymptomFormData({
      symptom_name: symptom.symptom_name || '',
      category: symptom.category || '',
      first_occurrence_date: symptom.first_occurrence_date || '',
      status: symptom.status || 'active',
      is_chronic: symptom.is_chronic || false,
      resolved_date: symptom.resolved_date || '',
      typical_triggers: symptom.typical_triggers || [],
      general_notes: symptom.general_notes || '',
      tags: symptom.tags || [],
    });
    setEditingSymptom(symptom);
    setShowSymptomForm(true);
  };

  const handleSymptomInputChange = e => {
    const { name, value, type, checked } = e.target;
    setSymptomFormData(prev => {
      const updated = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      };
      if (name === 'status') {
        if (value === 'resolved' && !prev.resolved_date) {
          // Auto-fill resolved_date with today when status changes to resolved
          updated.resolved_date = new Date().toISOString().split('T')[0];
        } else if (value !== 'resolved') {
          // Clear resolved_date when status changes away from resolved
          updated.resolved_date = '';
        }
      }
      return updated;
    });
  };

  const handleSymptomSubmit = async e => {
    e.preventDefault();

    if (!currentPatient?.id) {
      setError('Patient information not available');
      return;
    }

    startSubmission();

    try {
      const submitData = {
        ...symptomFormData,
        patient_id: currentPatient.id,
        resolved_date: symptomFormData.resolved_date || null,
      };

      let success;
      let resultId;

      if (editingSymptom) {
        await symptomApi.update(editingSymptom.id, submitData);
        success = true;
        resultId = editingSymptom.id;
      } else {
        const result = await symptomApi.create(submitData);
        success = !!result;
        resultId = result?.id;
      }

      completeFormSubmission(success, resultId);

      if (success && resultId) {
        const hasPendingFiles = documentManagerMethods?.hasPendingFiles?.();
        if (hasPendingFiles) {
          startFileUpload();
          try {
            await documentManagerMethods.uploadPendingFiles(resultId);
            completeFileUpload(
              true,
              documentManagerMethods.getPendingFilesCount(),
              0
            );
          } catch (uploadError) {
            logger.error('symptom_file_upload_error', {
              message: 'File upload failed',
              symptomId: resultId,
              error: uploadError.message,
              component: 'Symptoms',
            });
            completeFileUpload(
              false,
              0,
              documentManagerMethods.getPendingFilesCount()
            );
          }
        } else {
          completeFileUpload(true, 0, 0);
        }
      }

      setSuccessMessage(
        editingSymptom
          ? 'Symptom updated successfully'
          : 'Symptom created successfully'
      );
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      handleSubmissionFailure(err, 'form');
      logger.error('symptom_submit_error', {
        error: err.message,
        editing: !!editingSymptom,
        component: 'Symptoms',
      });
      setError(err.message || 'Failed to save symptom');
    }
  };

  const handleDeleteSymptom = async symptomId => {
    if (
      !window.confirm(
        t(
          'symptoms.confirmDeleteSymptom',
          'Are you sure you want to delete this symptom and all its occurrences?'
        )
      )
    ) {
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
    const arrayToString = value =>
      Array.isArray(value) ? value.join(', ') : value || '';

    setSelectedSymptomForOccurrence(symptom);
    setEditingOccurrence(occurrence);
    setOccurrenceFormData({
      occurrence_date: occurrence.occurrence_date || '',
      occurrence_time: occurrence.occurrence_time || '',
      severity: occurrence.severity || 'moderate',
      pain_scale:
        occurrence.pain_scale !== null ? occurrence.pain_scale.toString() : '',
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
          ? occurrenceFormData.triggers
              .split(',')
              .map(s => s.trim())
              .filter(s => s.length > 0)
          : [],
        relief_methods: occurrenceFormData.relief_methods
          ? occurrenceFormData.relief_methods
              .split(',')
              .map(s => s.trim())
              .filter(s => s.length > 0)
          : [],
        associated_symptoms: occurrenceFormData.associated_symptoms
          ? occurrenceFormData.associated_symptoms
              .split(',')
              .map(s => s.trim())
              .filter(s => s.length > 0)
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
        await symptomApi.createOccurrence(
          selectedSymptomForOccurrence.id,
          submitData
        );
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

  const paginatedSymptoms = paginateData(symptoms);

  useEffect(() => {
    clampPage(symptoms.length);
  }, [symptoms.length, clampPage]);

  // Loading state
  if (loading && symptoms.length === 0) {
    return (
      <MedicalPageLoading
        message={t('symptoms.loading', 'Loading symptoms...')}
      />
    );
  }

  // No patient selected
  if (!currentPatient) {
    return (
      <Container size="xl" py="sm">
        <PageHeader title={t('symptoms.title', 'Symptoms')} icon="🩺" />
        <Alert
          title={t('symptoms.noPatientSelected', 'No Patient Selected')}
          color="blue"
        >
          {t(
            'symptoms.selectPatientPrompt',
            'Please select or create a patient to track symptoms.'
          )}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="sm">
      <PageHeader title={t('symptoms.title', 'Symptoms')} icon="🩺" />

      {/* Success/Error Messages */}
      <Stack gap="sm" mt="md">
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
            size: 'sm',
            disabled: isViewOnly,
            tooltip: viewOnlyTooltip,
          }}
          showViewToggle={false}
          mb={0}
        />

        {/* Tabs for different views */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List mb="md">
            <Tabs.Tab value="list" leftSection={<IconList size={16} />}>
              {t('symptoms.tabs.list', 'List')}
            </Tabs.Tab>
            <Tabs.Tab value="timeline" leftSection={<IconTimeline size={16} />}>
              {t('shared:labels.timeline', 'Timeline')}
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
                    {t(
                      'symptoms.noRecordsPrompt',
                      'Click "Add Symptom" to start tracking a new symptom'
                    )}
                  </Text>
                </Stack>
              </Paper>
            ) : (
              <Stack gap="md">
                {paginatedSymptoms.map(symptom => (
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
                            {t('shared:labels.category', 'Category')}:{' '}
                            {symptom.category}
                          </Text>
                        )}

                        <Group gap="md">
                          <Text size="sm" c="dimmed">
                            {t('symptoms.first', 'First')}:{' '}
                            {formatDate(symptom.first_occurrence_date)}
                          </Text>
                          {symptom.last_occurrence_date && (
                            <Text size="sm" c="dimmed">
                              {t('symptoms.last', 'Last')}:{' '}
                              {formatDate(symptom.last_occurrence_date)}
                            </Text>
                          )}
                          {symptom.resolved_date && (
                            <Text size="sm" c="green">
                              {t('shared:labels.resolved', 'Resolved')}:{' '}
                              {formatDate(symptom.resolved_date)}
                            </Text>
                          )}
                          <Text size="sm" fw={500} c="blue">
                            {symptom.occurrence_count || 0}{' '}
                            {symptom.occurrence_count === 1
                              ? t('symptoms.episode', 'episode')
                              : t('symptoms.episodes', 'episodes')}
                          </Text>
                        </Group>

                        {symptom.general_notes && (
                          <Text size="sm" lineClamp={2}>
                            {symptom.general_notes}
                          </Text>
                        )}

                        {symptom.typical_triggers &&
                          symptom.typical_triggers.length > 0 && (
                            <Group gap="xs">
                              <Text size="xs" c="dimmed">
                                {t(
                                  'symptoms.commonTriggers',
                                  'Common Triggers'
                                )}
                                :
                              </Text>
                              {symptom.typical_triggers
                                .slice(0, 3)
                                .map((trigger, index) => (
                                  <Badge
                                    key={index}
                                    size="sm"
                                    variant="outline"
                                  >
                                    {trigger}
                                  </Badge>
                                ))}
                              {symptom.typical_triggers.length > 3 && (
                                <Text size="xs" c="dimmed">
                                  {t(
                                    'shared:labels.countMore',
                                    '+{{count}} more',
                                    {
                                      count:
                                        symptom.typical_triggers.length - 3,
                                    }
                                  )}
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
                          disabled={isViewOnly}
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
                          disabled={isViewOnly}
                          onClick={() => handleEditSymptom(symptom)}
                        >
                          {t('shared:labels.edit', 'Edit')}
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          disabled={isViewOnly}
                          onClick={() => handleDeleteSymptom(symptom.id)}
                        >
                          {t('buttons.delete', 'Delete')}
                        </Button>
                      </Group>
                    </Group>
                  </Paper>
                ))}
                <PaginationControls
                  page={page}
                  totalPages={totalPages(symptoms.length)}
                  pageSize={pageSize}
                  totalRecords={symptoms.length}
                  onPageChange={setPage}
                  onPageSizeChange={handlePageSizeChange}
                  pageSizeOptions={PAGE_SIZE_OPTIONS}
                />
              </Stack>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="timeline">
            <SymptomTimeline
              patientId={currentPatient?.id}
              hidden={activeTab !== 'timeline'}
            />
          </Tabs.Panel>

          <Tabs.Panel value="calendar">
            <SymptomCalendar
              patientId={currentPatient?.id}
              hidden={activeTab !== 'calendar'}
            />
          </Tabs.Panel>
        </Tabs>
      </Stack>

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
        disableEdit={isViewOnly}
        disableEditTooltip={viewOnlyTooltip}
      />

      {/* Symptom Definition Form Modal */}
      <MantineSymptomForm
        isOpen={showSymptomForm}
        onClose={() => {
          if (!isBlocking) {
            setShowSymptomForm(false);
            setEditingSymptom(null);
          }
        }}
        title={
          editingSymptom
            ? t('symptoms.editSymptomTitle', 'Edit Symptom')
            : t('symptoms.addSymptomTitle', 'Add New Symptom')
        }
        formData={symptomFormData}
        onInputChange={handleSymptomInputChange}
        onSubmit={handleSymptomSubmit}
        editingSymptom={editingSymptom}
        isLoading={isBlocking}
        statusMessage={statusMessage}
        onDocumentManagerRef={setDocumentManagerMethods}
        onFileUploadComplete={success => {
          if (success) {
            fetchSymptoms();
          }
        }}
        onError={error => {
          logger.error('symptom_document_error', {
            error,
            component: 'Symptoms',
          });
        }}
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
        submitButtonText={
          editingOccurrence
            ? t('buttons.update', 'Update')
            : t('symptoms.logEpisode', 'Log Episode')
        }
      />
    </Container>
  );
};

export default Symptoms;
