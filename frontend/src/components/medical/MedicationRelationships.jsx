import React, { useState, useEffect } from 'react';
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

const INITIAL_RELATIONSHIP_STATE = {
  medication_ids: [],
  relevance_note: '',
};

const MedicationRelationships = ({
  conditionId,
  conditionMedications = {},
  medications = [],
  fetchConditionMedications,
  navigate,
  isViewMode = false,
}) => {
  const { t } = useTranslation(['common', 'errors']);
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRelationship, setEditingRelationship] = useState(null);
  const [newRelationship, setNewRelationship] = useState(INITIAL_RELATIONSHIP_STATE);
  const [error, setError] = useState(null);

  const resetAndCloseModal = () => {
    setShowAddModal(false);
    setNewRelationship(INITIAL_RELATIONSHIP_STATE);
    setError(null);
  };

  // Get relationships for this condition
  useEffect(() => {
    const conditionRelationships = conditionMedications[conditionId] || [];
    setRelationships(conditionRelationships);
  }, [conditionId, conditionMedications]);

  // Load relationships when component mounts
  useEffect(() => {
    if (conditionId && fetchConditionMedications) {
      // Only fetch if we don't already have the data for this condition
      const hasExistingData = conditionMedications && conditionMedications[conditionId];
      if (!hasExistingData) {
        fetchConditionMedications(conditionId).catch(error => {
          logger.error('Failed to fetch condition medications:', error);
          setError(error.message || 'Failed to load medication relationships');
        });
      }
    }
  }, [conditionId]); // Remove fetchConditionMedications from dependencies to prevent infinite loop

  const handleAddRelationship = async () => {
    if (!newRelationship.medication_ids || newRelationship.medication_ids.length === 0) {
      setError(t('errors:form.medicationNotSelected'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use bulk create endpoint if multiple medications selected
      if (newRelationship.medication_ids.length > 1) {
        await apiService.createConditionMedicationsBulk(conditionId, {
          medication_ids: newRelationship.medication_ids.map(id => parseInt(id)),
          relevance_note: newRelationship.relevance_note || null,
        });
      } else {
        // Single medication - use regular endpoint
        await apiService.createConditionMedication(conditionId, {
          condition_id: conditionId,
          medication_id: parseInt(newRelationship.medication_ids[0]),
          relevance_note: newRelationship.relevance_note || null,
        });
      }

      // Refresh relationships
      if (fetchConditionMedications) {
        await fetchConditionMedications(conditionId);
      }

      resetAndCloseModal();
    } catch (err) {
      logger.error('Error adding medication relationship:', err);
      setError(err.response?.data?.detail || err.message || t('errors:relationships.addMedicationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleEditRelationship = async (relationshipId, updates) => {
    setLoading(true);
    setError(null);

    try {
      await apiService.updateConditionMedication(conditionId, relationshipId, updates);

      // Refresh relationships
      if (fetchConditionMedications) {
        await fetchConditionMedications(conditionId);
      }

      setEditingRelationship(null);
    } catch (err) {
      logger.error('Error updating medication relationship:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to update medication relationship');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRelationship = async (relationshipId) => {
    if (!window.confirm(t('messages.confirmRemoveMedicationRelationship'))) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiService.deleteConditionMedication(conditionId, relationshipId);

      // Refresh relationships
      if (fetchConditionMedications) {
        await fetchConditionMedications(conditionId);
      }
    } catch (err) {
      logger.error('Error deleting medication relationship:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to delete medication relationship');
    } finally {
      setLoading(false);
    }
  };

  const getMedicationById = (medicationId) => {
    return medications.find(medication => medication.id === medicationId);
  };

  // Render the relevance note section based on mode and state
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

  // Prepare medication options for MultiSelect
  const medicationOptions = medications.map(medication => ({
    value: medication.id.toString(),
    label: `${medication.medication_name}${medication.dosage ? ` (${medication.dosage})` : ''}${medication.status ? ` - ${medication.status}` : ''}`,
  }));

  // Filter out already linked medications
  const linkedMedicationIds = relationships.map(rel => rel.medication_id.toString());
  const availableMedicationOptions = medicationOptions.filter(
    option => !linkedMedicationIds.includes(option.value)
  );

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
            const medication = relationship.medication || getMedicationById(relationship.medication_id);
            const isEditing = editingRelationship?.id === relationship.id;

            return (
              <Paper key={relationship.id} withBorder p="md">
                <Group justify="space-between" align="flex-start">
                  <Stack gap="xs" style={{ flex: 1 }}>
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
                            onClick={() => handleEditRelationship(relationship.id, {
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
                            onClick={() => handleDeleteRelationship(relationship.id)}
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
          <Text c="dimmed">{t('labels.noMedicationsLinked')}</Text>
        </Paper>
      )}

      {/* Add New Relationship Button */}
      {!isViewMode && (
        <Group justify="space-between" align="center">
          <Text size="sm" c="dimmed">
            {t('labels.medicationsAvailableToLink', { count: availableMedicationOptions.length })}
          </Text>
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={() => setShowAddModal(true)}
            disabled={loading || availableMedicationOptions.length === 0}
          >
            {t('buttons.linkMedication')}
          </Button>
        </Group>
      )}

      {/* Add Relationship Modal */}
      <Modal
        opened={showAddModal}
        onClose={resetAndCloseModal}
        title={t('modals.linkMedicationsToCondition')}
        size="md"
        centered
        zIndex={3000}
      >
        <Stack gap="md">
          <MultiSelect
            label={t('modals.selectMedications')}
            placeholder={t('modals.chooseMedicationToLink')}
            data={availableMedicationOptions}
            value={newRelationship.medication_ids}
            onChange={(values) => setNewRelationship(prev => ({
              ...prev,
              medication_ids: values
            }))}
            searchable
            clearable
            required
            comboboxProps={{ withinPortal: true, zIndex: 4000 }}
          />

          <Textarea
            label={t('modals.relevanceNote')}
            placeholder={t('modals.describeMedicationRelevance')}
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
              disabled={!newRelationship.medication_ids || newRelationship.medication_ids.length === 0}
            >
              {newRelationship.medication_ids.length > 1
                ? t('buttons.linkMedications')
                : t('buttons.linkMedication')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};

export default MedicationRelationships;
