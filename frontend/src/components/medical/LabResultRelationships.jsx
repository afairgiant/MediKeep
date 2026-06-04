import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import {
  Anchor,
  Badge,
  Button,
  Group,
  Stack,
  Text,
  Paper,
  ActionIcon,
  Alert,
  MultiSelect,
  Textarea,
  Modal,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconEdit,
  IconCheck,
  IconX,
  IconInfoCircle,
  IconFlask,
} from '@tabler/icons-react';
import { apiService } from '../../services/api';
import { navigateToEntity } from '../../utils/linkNavigation';
import { useDateFormat } from '../../hooks/useDateFormat';
import logger from '../../services/logger';

function getLabResultColor(labsResult) {
  switch (labsResult) {
    case 'normal':
      return 'green';
    case 'abnormal':
      return 'orange';
    case 'critical':
      return 'red';
    default:
      return 'gray';
  }
}

function getStatusColor(status) {
  switch (status) {
    case 'completed':
      return 'green';
    case 'in_progress':
      return 'blue';
    case 'ordered':
      return 'yellow';
    case 'cancelled':
      return 'gray';
    default:
      return 'gray';
  }
}

const LabResultRelationships = ({
  conditionId,
  navigate,
  isViewMode = true,
  labResults = [],
}) => {
  const { t } = useTranslation(['common', 'errors', 'shared']);
  const { formatDate } = useDateFormat();

  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(false);
  // Separate error states so resetAndCloseModal never clears a delete/edit error
  const [error, setError] = useState(null);       // delete / edit / fetch errors
  const [modalError, setModalError] = useState(null); // add-modal errors only

  // Incrementing this triggers a fresh fetch with a new AbortController
  const [fetchKey, setFetchKey] = useState(0);
  const triggerRefetch = () => setFetchKey(k => k + 1);

  // Edit-mode state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRelationship, setEditingRelationship] = useState(null);
  const [newRelationship, setNewRelationship] = useState({
    lab_result_ids: [],
    relevance_note: '',
  });

  // Single fetch implementation — all fetches go through here with AbortController
  useEffect(() => {
    if (!conditionId) return;
    const controller = new AbortController();
    setLoading(true);

    apiService
      .getConditionLabResults(conditionId, controller.signal)
      .then(data => setRelationships(data || []))
      .catch(err => {
        if (err.name === 'AbortError' || err.name === 'CanceledError') return;
        logger.error('Failed to fetch condition lab results', {
          component: 'LabResultRelationships',
          conditionId,
          error: err.message,
        });
        setError(
          err.response?.data?.detail ||
            err.message ||
            t('errors:relationships.fetchFailed', 'Failed to load lab results')
        );
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [conditionId, fetchKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetAndCloseModal = () => {
    setShowAddModal(false);
    setNewRelationship({ lab_result_ids: [], relevance_note: '' });
    setModalError(null); // only clear modal-scoped error
  };

  const handleAddRelationship = async () => {
    const { lab_result_ids, relevance_note } = newRelationship;
    if (!lab_result_ids.length) {
      setModalError(
        t('errors:form.labResultNotSelected', 'Please select at least one lab result')
      );
      return;
    }

    setLoading(true);
    setModalError(null);

    try {
      for (const labResultId of lab_result_ids.map(Number)) {
        await apiService.createLabResultCondition(labResultId, {
          lab_result_id: labResultId,
          condition_id: conditionId,
          relevance_note: relevance_note || null,
        });
      }
      resetAndCloseModal();
    } catch (err) {
      logger.error('Failed to add lab result relationship', {
        component: 'LabResultRelationships',
        conditionId,
        error: err.message,
      });
      setModalError(
        err.response?.data?.detail ||
          err.message ||
          t('errors:relationships.addFailed', 'Failed to add relationship')
      );
    } finally {
      setLoading(false);
      // Always refresh — ensures partial creates are reflected in the UI
      triggerRefetch();
    }
  };

  const handleEditRelationship = async (relationship, updates) => {
    setLoading(true);
    setError(null);

    try {
      await apiService.updateLabResultCondition(
        relationship.lab_result_id,
        relationship.id,
        updates
      );
      setEditingRelationship(null);
    } catch (err) {
      logger.error('Failed to update lab result relationship', {
        component: 'LabResultRelationships',
        conditionId,
        error: err.message,
      });
      setError(
        err.response?.data?.detail ||
          err.message ||
          t('errors:relationships.updateFailed', 'Failed to update relationship')
      );
    } finally {
      setLoading(false);
      triggerRefetch();
    }
  };

  const handleDeleteRelationship = async relationship => {
    if (
      !window.confirm(
        t(
          'messages.confirmRemoveLabResultRelationship',
          'Remove this lab result link?'
        )
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiService.deleteLabResultCondition(
        relationship.lab_result_id,
        relationship.id
      );
    } catch (err) {
      logger.error('Failed to delete lab result relationship', {
        component: 'LabResultRelationships',
        conditionId,
        error: err.message,
      });
      setError(
        err.response?.data?.detail ||
          err.message ||
          t('errors:relationships.deleteFailed', 'Failed to remove relationship')
      );
    } finally {
      setLoading(false);
      triggerRefetch();
    }
  };

  // Dropdown options: exclude already-linked lab results
  const linkedLabResultIds = new Set(
    relationships.map(r => String(r.lab_result_id))
  );
  const availableOptions = labResults
    .filter(lr => !linkedLabResultIds.has(String(lr.id)))
    .map(lr => ({
      value: String(lr.id),
      label: `${lr.test_name}${lr.completed_date ? ` (${formatDate(lr.completed_date)})` : ''}${lr.status ? ` – ${lr.status}` : ''}`,
    }));

  if (loading && relationships.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {t('labels.loadingLabResults', 'Loading lab results...')}
      </Text>
    );
  }

  return (
    <Stack gap="md">
      {error && (
        <Alert icon={<IconInfoCircle size={16} />} color="red" variant="light">
          {error}
        </Alert>
      )}

      {relationships.length > 0 ? (
        <Stack gap="sm">
          {relationships.map(relationship => {
            const lab = relationship.lab_result;
            const isEditing = editingRelationship?.id === relationship.id;

            return (
              <Paper key={relationship.id} withBorder p="md">
                <Group justify="space-between" align="flex-start">
                  <Stack gap="xs" style={{ flex: 1 }}>
                    <Group gap="sm">
                      <Anchor
                        size="sm"
                        fw={500}
                        component="button"
                        onClick={() =>
                          navigateToEntity(
                            'lab_result',
                            lab?.id || relationship.lab_result_id,
                            navigate
                          )
                        }
                      >
                        <Group gap="xs" component="span">
                          <IconFlask size={14} />
                          {lab?.test_name ||
                            `Lab Result ID: ${relationship.lab_result_id}`}
                        </Group>
                      </Anchor>
                      {lab?.labs_result && (
                        <Badge
                          variant="light"
                          color={getLabResultColor(lab.labs_result)}
                          size="sm"
                        >
                          {lab.labs_result}
                        </Badge>
                      )}
                      {lab?.status && (
                        <Badge
                          variant="outline"
                          color={getStatusColor(lab.status)}
                          size="sm"
                        >
                          {lab.status}
                        </Badge>
                      )}
                    </Group>

                    <Group gap="md">
                      {lab?.test_category && (
                        <Text size="xs" c="dimmed">
                          {lab.test_category}
                        </Text>
                      )}
                      {lab?.completed_date && (
                        <Text size="xs" c="dimmed">
                          {formatDate(lab.completed_date)}
                        </Text>
                      )}
                    </Group>

                    {!isViewMode && isEditing ? (
                      <Textarea
                        placeholder={t('modals.relevanceNoteOptional')}
                        value={editingRelationship.relevance_note || ''}
                        onChange={e =>
                          setEditingRelationship({
                            ...editingRelationship,
                            relevance_note: e.target.value,
                          })
                        }
                        size="sm"
                        autosize
                        minRows={2}
                      />
                    ) : relationship.relevance_note ? (
                      <Text size="sm" c="dimmed" fs="italic">
                        {relationship.relevance_note}
                      </Text>
                    ) : !isViewMode ? (
                      <Text size="sm" c="dimmed">
                        {t('modals.noRelevanceNoteProvided')}
                      </Text>
                    ) : null}
                  </Stack>

                  {!isViewMode && (
                    <Group gap="xs">
                      {isEditing ? (
                        <>
                          <ActionIcon
                            variant="light"
                            color="green"
                            size="sm"
                            aria-label={t('labels.saveRelationship', 'Save relationship')}
                            onClick={() =>
                              handleEditRelationship(relationship, {
                                relevance_note:
                                  editingRelationship.relevance_note || null,
                              })
                            }
                            loading={loading}
                          >
                            <IconCheck size={14} />
                          </ActionIcon>
                          <ActionIcon
                            variant="light"
                            color="gray"
                            size="sm"
                            aria-label={t('labels.cancelEdit', 'Cancel edit')}
                            onClick={() => setEditingRelationship(null)}
                          >
                            <IconX size={14} />
                          </ActionIcon>
                        </>
                      ) : (
                        <>
                          <ActionIcon
                            variant="light"
                            color="blue"
                            size="sm"
                            aria-label={t('labels.editRelationship', 'Edit relationship')}
                            onClick={() =>
                              setEditingRelationship({
                                id: relationship.id,
                                relevance_note:
                                  relationship.relevance_note || '',
                              })
                            }
                          >
                            <IconEdit size={14} />
                          </ActionIcon>
                          <ActionIcon
                            variant="light"
                            color="red"
                            size="sm"
                            aria-label={t('labels.deleteRelationship', 'Delete relationship')}
                            onClick={() =>
                              handleDeleteRelationship(relationship)
                            }
                            loading={loading}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </>
                      )}
                    </Group>
                  )}
                </Group>
              </Paper>
            );
          })}
        </Stack>
      ) : (
        <Paper withBorder p="md" ta="center">
          <Text c="dimmed">
            {t(
              'labels.noLabResultsLinkedToCondition',
              'No lab results linked to this condition'
            )}
          </Text>
        </Paper>
      )}

      {!isViewMode && (
        <Group justify="space-between" align="center">
          <Text size="sm" c="dimmed">
            {t('labels.labResultsAvailableToLink', {
              count: availableOptions.length,
              defaultValue: '{{count}} lab results available to link',
            })}
          </Text>
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={() => setShowAddModal(true)}
            disabled={loading || availableOptions.length === 0}
          >
            {t('buttons.linkLabResult', 'Link Lab Result')}
          </Button>
        </Group>
      )}

      <Modal
        opened={showAddModal}
        onClose={resetAndCloseModal}
        title={t(
          'modals.linkLabResultsToCondition',
          'Link Lab Results to Condition'
        )}
        size="md"
        centered
        zIndex={3000}
      >
        <Stack gap="md">
          {modalError && (
            <Alert
              icon={<IconInfoCircle size={16} />}
              color="red"
              variant="light"
            >
              {modalError}
            </Alert>
          )}

          <MultiSelect
            label={t('modals.selectLabResults', 'Select Lab Results')}
            placeholder={t(
              'modals.chooseLabResultsToLink',
              'Choose lab results to link'
            )}
            data={availableOptions}
            value={newRelationship.lab_result_ids}
            onChange={values =>
              setNewRelationship(prev => ({ ...prev, lab_result_ids: values }))
            }
            searchable
            clearable
            required
            comboboxProps={{ withinPortal: true, zIndex: 4000 }}
          />

          <Textarea
            label={t('modals.relevanceNote', 'Relevance Note')}
            placeholder={t(
              'modals.describeLabResultRelevance',
              'Describe how this lab result relates to the condition (optional)'
            )}
            value={newRelationship.relevance_note}
            onChange={e =>
              setNewRelationship(prev => ({
                ...prev,
                relevance_note: e.target.value,
              }))
            }
            autosize
            minRows={3}
          />

          <Group justify="flex-end" gap="sm">
            <Button variant="light" onClick={resetAndCloseModal}>
              {t('shared:fields.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleAddRelationship}
              loading={loading}
              disabled={newRelationship.lab_result_ids.length === 0}
            >
              {t('buttons.linkLabResult', 'Link Lab Result')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};

LabResultRelationships.propTypes = {
  conditionId: PropTypes.number.isRequired,
  navigate: PropTypes.func,
  isViewMode: PropTypes.bool,
  labResults: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      test_name: PropTypes.string,
      completed_date: PropTypes.string,
      status: PropTypes.string,
      labs_result: PropTypes.string,
    })
  ),
};

export default LabResultRelationships;
