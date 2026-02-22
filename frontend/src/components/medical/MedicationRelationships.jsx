import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
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
  IconPill,
} from '@tabler/icons-react';
import { apiService } from '../../services/api';
import { navigateToEntity } from '../../utils/linkNavigation';
import logger from '../../services/logger';

// Direction-specific configuration to avoid scattered ternaries throughout the component
const DIRECTION_CONFIG = {
  medication: {
    idsField: 'condition_ids',
    initialState: { condition_ids: [], relevance_note: '' },
    emptyState: 'labels.noConditionsLinkedToMedication',
    availableCount: 'labels.conditionsAvailableToLink',
    addButton: 'buttons.linkCondition',
    addButtonPlural: 'buttons.linkConditions',
    modalTitle: 'modals.linkConditionsToMedication',
    selectLabel: 'modals.selectConditions',
    selectPlaceholder: 'modals.chooseConditionsToLink',
    relevancePlaceholder: 'modals.describeConditionRelevanceMedication',
    confirmRemove: 'messages.confirmRemoveConditionRelationship',
    validationError: 'errors:form.conditionNotSelected',
  },
  condition: {
    idsField: 'medication_ids',
    initialState: { medication_ids: [], relevance_note: '' },
    emptyState: 'labels.noMedicationsLinked',
    availableCount: 'labels.medicationsAvailableToLink',
    addButton: 'buttons.linkMedication',
    addButtonPlural: 'buttons.linkMedications',
    modalTitle: 'modals.linkMedicationsToCondition',
    selectLabel: 'modals.selectMedications',
    selectPlaceholder: 'modals.chooseMedicationToLink',
    relevancePlaceholder: 'modals.describeMedicationRelevance',
    confirmRemove: 'messages.confirmRemoveMedicationRelationship',
    validationError: 'errors:form.medicationNotSelected',
  },
};

function getSeverityColor(severity) {
  switch (severity) {
    case 'critical':
      return 'red';
    case 'severe':
      return 'orange';
    case 'moderate':
      return 'yellow';
    case 'mild':
      return 'blue';
    default:
      return 'gray';
  }
}

function getStatusColor(status) {
  switch (status) {
    case 'active':
      return 'green';
    case 'inactive':
      return 'gray';
    case 'resolved':
      return 'blue';
    case 'chronic':
      return 'orange';
    default:
      return 'gray';
  }
}

const MedicationRelationships = ({
  // Common props
  direction = 'condition',
  navigate,
  isViewMode = false,
  // Condition-direction props (viewing a condition, linking medications)
  conditionId,
  conditionMedications = {},
  medications = [],
  fetchConditionMedications,
  // Medication-direction props (viewing a medication, linking conditions)
  medicationId,
  conditions = [],
}) => {
  const { t } = useTranslation(['common', 'errors']);
  const isMedicationDirection = direction === 'medication';
  const config = DIRECTION_CONFIG[direction];

  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRelationship, setEditingRelationship] = useState(null);
  const [newRelationship, setNewRelationship] = useState(config.initialState);
  const [error, setError] = useState(null);
  const [conditionsCache, setConditionsCache] = useState({});

  const resetAndCloseModal = () => {
    setShowAddModal(false);
    setNewRelationship(config.initialState);
    setError(null);
  };

  // Refresh relationships after a mutation, using the appropriate fetch strategy per direction
  const refreshRelationships = async () => {
    if (isMedicationDirection) {
      await fetchMedicationConditions();
    } else if (fetchConditionMedications) {
      await fetchConditionMedications(conditionId);
    }
  };

  // Resolve the condition ID used for API calls depending on direction
  const getRelConditionId = (relationship) =>
    isMedicationDirection ? relationship.condition_id : conditionId;

  // === Condition direction: sync relationships from parent cache ===
  useEffect(() => {
    if (!isMedicationDirection) {
      setRelationships(conditionMedications[conditionId] || []);
    }
  }, [isMedicationDirection, conditionId, conditionMedications]);

  // === Condition direction: fetch if cache is empty ===
  useEffect(() => {
    if (!isMedicationDirection && conditionId && fetchConditionMedications) {
      const hasExistingData = conditionMedications && conditionMedications[conditionId];
      if (!hasExistingData) {
        fetchConditionMedications(conditionId).catch(err => {
          logger.error('Failed to fetch condition medications:', err);
          setError(err.message || t('errors:relationships.fetchFailed'));
        });
      }
    }
  }, [conditionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // === Medication direction: self-fetch relationships ===
  const fetchMedicationConditions = async () => {
    setLoading(true);
    setError(null);

    try {
      const rels = (await apiService.getMedicationConditions(medicationId)) || [];
      setRelationships(rels);

      // Fetch condition details for relationships missing condition data
      const missingConditions = rels.filter(rel => !rel.condition && rel.condition_id);
      if (missingConditions.length > 0) {
        const conditionResults = await Promise.all(
          missingConditions.map(rel =>
            apiService.getCondition(rel.condition_id).catch(() => {
              logger.warn('Condition not found - may be deleted or orphaned relationship', {
                component: 'MedicationRelationships',
                conditionId: rel.condition_id,
              });
              return null;
            })
          )
        );

        const newCache = {};
        conditionResults.forEach((condition, index) => {
          if (condition) {
            newCache[missingConditions[index].condition_id] = condition;
          }
        });
        setConditionsCache(newCache);
      }
    } catch (err) {
      logger.error('Failed to fetch medication conditions', {
        component: 'MedicationRelationships',
        medicationId,
        error: err.message,
      });
      setError(err.response?.data?.detail || err.message || t('errors:relationships.fetchFailed'));
      setRelationships([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isMedicationDirection && medicationId) {
      fetchMedicationConditions();
    }
  }, [medicationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // === CRUD handlers ===

  const handleAddRelationship = async () => {
    const selectedIds = newRelationship[config.idsField] || [];
    if (selectedIds.length === 0) {
      setError(t(config.validationError, 'Please select at least one item'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isMedicationDirection) {
        const parsedIds = selectedIds.map(id => parseInt(id));
        for (const selectedConditionId of parsedIds) {
          await apiService.createConditionMedication(selectedConditionId, {
            condition_id: selectedConditionId,
            medication_id: medicationId,
            relevance_note: newRelationship.relevance_note || null,
          });
        }
      } else {
        if (selectedIds.length > 1) {
          await apiService.createConditionMedicationsBulk(conditionId, {
            medication_ids: selectedIds.map(id => parseInt(id)),
            relevance_note: newRelationship.relevance_note || null,
          });
        } else {
          await apiService.createConditionMedication(conditionId, {
            condition_id: conditionId,
            medication_id: parseInt(selectedIds[0]),
            relevance_note: newRelationship.relevance_note || null,
          });
        }
      }

      await refreshRelationships();
      resetAndCloseModal();
    } catch (err) {
      logger.error('Error adding relationship:', err);
      setError(err.response?.data?.detail || err.message || t('errors:relationships.addFailed', 'Failed to add relationship'));
    } finally {
      setLoading(false);
    }
  };

  const handleEditRelationship = async (relationship, updates) => {
    setLoading(true);
    setError(null);

    try {
      await apiService.updateConditionMedication(getRelConditionId(relationship), relationship.id, updates);
      await refreshRelationships();
      setEditingRelationship(null);
    } catch (err) {
      logger.error('Error updating relationship:', err);
      setError(err.response?.data?.detail || err.message || t('errors:relationships.updateFailed', 'Failed to update relationship'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRelationship = async (relationship) => {
    if (!window.confirm(t(config.confirmRemove))) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiService.deleteConditionMedication(getRelConditionId(relationship), relationship.id);
      await refreshRelationships();
    } catch (err) {
      logger.error('Error deleting relationship:', err);
      setError(err.response?.data?.detail || err.message || t('errors:relationships.deleteFailed', 'Failed to delete relationship'));
    } finally {
      setLoading(false);
    }
  };

  // === Render helpers ===

  const renderRelevanceNote = (relationship, isEditing) => {
    if (!isViewMode && isEditing) {
      return (
        <Textarea
          placeholder={t('modals.relevanceNoteOptional')}
          value={editingRelationship?.relevance_note || relationship.relevance_note || ''}
          onChange={(e) => setEditingRelationship({
            ...editingRelationship,
            relevance_note: e.target.value
          })}
          size="sm"
          autosize
          minRows={2}
        />
      );
    }

    if (relationship.relevance_note) {
      return (
        <Text size="sm" c="dimmed" fs="italic">
          {relationship.relevance_note}
        </Text>
      );
    }

    if (!isViewMode) {
      return (
        <Text size="sm" c="dimmed">
          {t('modals.noRelevanceNoteProvided')}
        </Text>
      );
    }

    return null;
  };

  const renderConditionDirectionItem = (relationship) => {
    const medication = relationship.medication
      || medications.find(m => m.id === relationship.medication_id);

    return (
      <Group gap="sm">
        {isViewMode ? (
          <Text
            size="sm"
            fw={500}
            c="blue"
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => navigateToEntity('medication', medication?.id, navigate)}
          >
            {medication?.medication_name || `Medication ID: ${relationship.medication_id}`}
          </Text>
        ) : (
          <Badge
            variant="light"
            color="teal"
            leftSection={<IconPill size={12} />}
            style={{ cursor: 'pointer' }}
            onClick={() => navigateToEntity('medication', medication?.id, navigate)}
          >
            {medication?.medication_name || `Medication ID: ${relationship.medication_id}`}
          </Badge>
        )}
        {medication?.dosage && (
          <Badge variant="outline" size="sm">
            {medication.dosage}
          </Badge>
        )}
        {medication?.frequency && (
          <Badge variant="outline" size="sm" color="cyan">
            {medication.frequency}
          </Badge>
        )}
        {medication?.status && (
          <Badge variant="outline" size="sm" color="green">
            {medication.status}
          </Badge>
        )}
      </Group>
    );
  };

  const renderMedicationDirectionItem = (relationship) => {
    const condition = relationship.condition || conditionsCache[relationship.condition_id];
    const conditionName = condition?.diagnosis || condition?.condition_name || `Deleted Condition (ID: ${relationship.condition_id})`;
    const isOrphaned = !condition;

    return (
      <Group gap="sm" style={{ flex: 1 }}>
        <Text
          size="sm"
          fw={500}
          c={isOrphaned ? 'red' : 'blue'}
          style={isOrphaned ? { fontStyle: 'italic' } : { cursor: 'pointer', textDecoration: 'underline' }}
          onClick={isOrphaned ? undefined : () => {
            const condId = condition?.id || relationship.condition_id;
            if (condId && navigate) {
              navigateToEntity('condition', condId, navigate);
            }
          }}
        >
          {conditionName}
        </Text>
        {condition?.status && (
          <Badge variant="outline" size="sm" color={getStatusColor(condition.status)}>
            {condition.status}
          </Badge>
        )}
        {condition?.severity && (
          <Badge variant="outline" size="sm" color={getSeverityColor(condition.severity)}>
            {condition.severity}
          </Badge>
        )}
      </Group>
    );
  };

  // === Dropdown options ===

  let availableOptions = [];
  let selectedIds = [];

  if (isMedicationDirection) {
    const linkedConditionIds = relationships.map(rel => String(rel.condition_id));
    availableOptions = conditions
      .filter(c => !linkedConditionIds.includes(String(c.id)))
      .map(c => ({
        value: String(c.id),
        label: c.diagnosis || c.condition_name || `Condition #${c.id}`,
      }));
    selectedIds = newRelationship.condition_ids || [];
  } else {
    const medicationOptions = medications.map(medication => ({
      value: medication.id.toString(),
      label: `${medication.medication_name}${medication.dosage ? ` (${medication.dosage})` : ''}${medication.status ? ` - ${medication.status}` : ''}`,
    }));
    const linkedMedicationIds = relationships.map(rel => rel.medication_id.toString());
    availableOptions = medicationOptions.filter(
      option => !linkedMedicationIds.includes(option.value)
    );
    selectedIds = newRelationship.medication_ids || [];
  }

  // === Loading state for medication direction ===
  if (isMedicationDirection && loading && relationships.length === 0) {
    return <Text size="sm" c="dimmed">{t('labels.loadingRelatedConditions')}</Text>;
  }

  return (
    <Stack gap="md">
      {error && (
        <Alert icon={<IconInfoCircle size={16} />} color="red" variant="light">
          {error}
        </Alert>
      )}

      {/* Existing Relationships */}
      {relationships.length > 0 ? (
        <Stack gap="sm">
          {relationships.map(relationship => {
            const isEditing = editingRelationship?.id === relationship.id;

            return (
              <Paper key={relationship.id} withBorder p="md">
                <Group justify="space-between" align="flex-start">
                  <Stack gap="xs" style={{ flex: 1 }}>
                    {isMedicationDirection
                      ? renderMedicationDirectionItem(relationship)
                      : renderConditionDirectionItem(relationship)
                    }
                    {renderRelevanceNote(relationship, isEditing)}
                  </Stack>

                  {!isViewMode && (
                    <Group gap="xs">
                      {isEditing ? (
                        <>
                          <ActionIcon
                            variant="light"
                            color="green"
                            size="sm"
                            onClick={() => handleEditRelationship(relationship, {
                              relevance_note: editingRelationship?.relevance_note || relationship.relevance_note
                            })}
                            loading={loading}
                          >
                            <IconCheck size={14} />
                          </ActionIcon>
                          <ActionIcon
                            variant="light"
                            color="gray"
                            size="sm"
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
                            onClick={() => setEditingRelationship({
                              id: relationship.id,
                              relevance_note: relationship.relevance_note || ''
                            })}
                          >
                            <IconEdit size={14} />
                          </ActionIcon>
                          <ActionIcon
                            variant="light"
                            color="red"
                            size="sm"
                            onClick={() => handleDeleteRelationship(relationship)}
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
          <Text c="dimmed">{t(config.emptyState)}</Text>
        </Paper>
      )}

      {/* Add New Relationship Button */}
      {!isViewMode && (
        <Group justify="space-between" align="center">
          <Text size="sm" c="dimmed">
            {t(config.availableCount, { count: availableOptions.length })}
          </Text>
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={() => setShowAddModal(true)}
            disabled={loading || availableOptions.length === 0}
          >
            {t(config.addButton)}
          </Button>
        </Group>
      )}

      {/* Add Relationship Modal */}
      <Modal
        opened={showAddModal}
        onClose={resetAndCloseModal}
        title={t(config.modalTitle)}
        size="md"
        centered
        zIndex={3000}
      >
        <Stack gap="md">
          <MultiSelect
            label={t(config.selectLabel)}
            placeholder={t(config.selectPlaceholder)}
            data={availableOptions}
            value={selectedIds}
            onChange={(values) => {
              setNewRelationship(prev => ({ ...prev, [config.idsField]: values }));
            }}
            searchable
            clearable
            required
            comboboxProps={{ withinPortal: true, zIndex: 4000 }}
          />

          <Textarea
            label={t('modals.relevanceNote')}
            placeholder={t(config.relevancePlaceholder)}
            value={newRelationship.relevance_note}
            onChange={(e) => setNewRelationship(prev => ({
              ...prev,
              relevance_note: e.target.value
            }))}
            autosize
            minRows={3}
          />

          <Group justify="flex-end" gap="sm">
            <Button variant="light" onClick={resetAndCloseModal}>
              {t('buttons.cancel')}
            </Button>
            <Button
              onClick={handleAddRelationship}
              loading={loading}
              disabled={selectedIds.length === 0}
            >
              {selectedIds.length > 1
                ? t(config.addButtonPlural)
                : t(config.addButton)}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};

export default MedicationRelationships;
