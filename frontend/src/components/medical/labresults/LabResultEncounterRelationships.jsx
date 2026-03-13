import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiService } from '../../../services/api';
import { navigateToEntity } from '../../../utils/linkNavigation';
import {
  Badge,
  Button,
  Group,
  Stack,
  Text,
  Paper,
  ActionIcon,
  Alert,
  Select,
  Textarea,
  Modal,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconEdit,
  IconCheck,
  IconX,
  IconStethoscope,
  IconInfoCircle,
} from '@tabler/icons-react';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { PURPOSE_OPTIONS, getPurposeLabel, getPurposeColor } from '../../../constants/encounterLabResultConstants';

const LabResultEncounterRelationships = ({
  labResultId,
  labResultEncounters = {},
  encounters = [],
  fetchLabResultEncounters,
  navigate,
  isViewMode = false,
}) => {
  const { t } = useTranslation(['common', 'errors']);
  const { formatDate } = useDateFormat();
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRelationship, setEditingRelationship] = useState(null);
  const [newRelationship, setNewRelationship] = useState({
    encounter_id: '',
    purpose: '',
    relevance_note: '',
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    const rels = labResultEncounters[labResultId] || [];
    setRelationships(rels);
  }, [labResultId, labResultEncounters]);

  useEffect(() => {
    if (labResultId && fetchLabResultEncounters) {
      fetchLabResultEncounters(labResultId);
    }
  }, [labResultId]);

  const handleAddRelationship = async () => {
    if (!newRelationship.encounter_id) {
      setError(t('common:messages.selectVisit', 'Please select a visit'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // The lab-result-side endpoint reuses lab_result_id field as encounter_id
      await apiService.createLabResultEncounter(labResultId, {
        lab_result_id: parseInt(newRelationship.encounter_id),
        purpose: newRelationship.purpose || null,
        relevance_note: newRelationship.relevance_note || null,
      });

      if (fetchLabResultEncounters) {
        await fetchLabResultEncounters(labResultId);
      }

      setNewRelationship({ encounter_id: '', purpose: '', relevance_note: '' });
      setShowAddModal(false);
    } catch (err) {
      setError(err.message || t('common:messages.failedToLinkVisit', 'Failed to link visit'));
    } finally {
      setLoading(false);
    }
  };

  const handleEditRelationship = async (relationshipId, updates) => {
    setLoading(true);
    setError(null);

    try {
      await apiService.updateLabResultEncounter(labResultId, relationshipId, updates);

      if (fetchLabResultEncounters) {
        await fetchLabResultEncounters(labResultId);
      }

      setEditingRelationship(null);
    } catch (err) {
      setError(err.message || t('common:messages.failedToUpdateRelationship', 'Failed to update relationship'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRelationship = async (relationshipId) => {
    if (!window.confirm(t('common:messages.confirmRemoveVisitLink', 'Remove this visit link?'))) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiService.deleteLabResultEncounter(labResultId, relationshipId);

      if (fetchLabResultEncounters) {
        await fetchLabResultEncounters(labResultId);
      }
    } catch (err) {
      setError(err.message || t('common:messages.failedToUnlinkVisit', 'Failed to unlink visit'));
    } finally {
      setLoading(false);
    }
  };

  const encounterOptions = encounters.map(enc => ({
    value: enc.id.toString(),
    label: `${enc.reason}${enc.date ? ` (${enc.date})` : ''}${enc.visit_type ? ` - ${enc.visit_type}` : ''}`,
  }));

  const linkedEncounterIds = relationships.map(rel => rel.encounter_id.toString());
  const availableEncounterOptions = encounterOptions.filter(
    option => !linkedEncounterIds.includes(option.value)
  );

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
                          onClick={() => navigateToEntity('encounter', relationship.encounter_id, navigate)}
                        >
                          {relationship.encounter_reason || `Visit #${relationship.encounter_id}`}
                        </Text>
                      ) : (
                        <Badge
                          variant="light"
                          color="indigo"
                          leftSection={<IconStethoscope size={12} />}
                          style={{ cursor: 'pointer' }}
                          onClick={() => navigateToEntity('encounter', relationship.encounter_id, navigate)}
                        >
                          {relationship.encounter_reason || `Visit #${relationship.encounter_id}`}
                        </Badge>
                      )}
                      {relationship.purpose && (
                        <Badge variant="light" size="sm" color={getPurposeColor(relationship.purpose)}>
                          {getPurposeLabel(relationship.purpose)}
                        </Badge>
                      )}
                    </Group>

                    {relationship.encounter_date && (
                      <Text size="xs" c="dimmed">
                        {t('common:labels.visitDate', 'Visit date')}: {formatDate(relationship.encounter_date)}
                      </Text>
                    )}

                    {!isViewMode && isEditing ? (
                      <Stack gap="xs">
                        <Select
                          size="xs"
                          placeholder={t('common:labels.selectPurpose', 'Select purpose')}
                          data={PURPOSE_OPTIONS}
                          value={editingRelationship?.purpose || ''}
                          onChange={(val) => setEditingRelationship({
                            ...editingRelationship,
                            purpose: val,
                          })}
                          clearable
                          comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                        />
                        <Textarea
                          placeholder={t('common:modals.relevanceNoteOptional', 'Relevance note (optional)')}
                          value={editingRelationship?.relevance_note || ''}
                          onChange={(e) => setEditingRelationship({
                            ...editingRelationship,
                            relevance_note: e.target.value,
                          })}
                          size="sm"
                          autosize
                          minRows={2}
                        />
                      </Stack>
                    ) : relationship.relevance_note ? (
                      <Text size="sm" c="dimmed" fs="italic">
                        {relationship.relevance_note}
                      </Text>
                    ) : !isViewMode ? (
                      <Text size="sm" c="dimmed">
                        {t('common:modals.noRelevanceNoteProvided', 'No relevance note provided')}
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
                            onClick={() => handleEditRelationship(relationship.id, {
                              purpose: editingRelationship?.purpose || null,
                              relevance_note: editingRelationship?.relevance_note || null,
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
                              purpose: relationship.purpose || '',
                              relevance_note: relationship.relevance_note || '',
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
          <Text c="dimmed">{t('common:labels.noVisitsLinked', 'No visits linked to this lab result')}</Text>
        </Paper>
      )}

      {!isViewMode && availableEncounterOptions.length > 0 && (
        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={() => setShowAddModal(true)}
          disabled={loading}
        >
          {t('common:buttons.linkVisit', 'Link Visit')}
        </Button>
      )}

      <Modal
        opened={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setNewRelationship({ encounter_id: '', purpose: '', relevance_note: '' });
          setError(null);
        }}
        title={t('common:modals.linkVisitToLabResult', 'Link Visit to Lab Result')}
        size="md"
        centered
        zIndex={2100}
      >
        <Stack gap="md">
          <Select
            label={t('common:modals.selectVisit', 'Select Visit')}
            placeholder={t('common:modals.chooseVisitToLink', 'Choose a visit to link')}
            data={availableEncounterOptions}
            value={newRelationship.encounter_id}
            onChange={(val) => setNewRelationship(prev => ({
              ...prev,
              encounter_id: val || '',
            }))}
            searchable
            clearable
            required
            comboboxProps={{ withinPortal: true, zIndex: 3000 }}
          />

          <Select
            label={t('common:modals.purpose', 'Purpose')}
            placeholder={t('common:modals.selectPurpose', 'Select purpose')}
            data={PURPOSE_OPTIONS}
            value={newRelationship.purpose}
            onChange={(val) => setNewRelationship(prev => ({
              ...prev,
              purpose: val || '',
            }))}
            clearable
            comboboxProps={{ withinPortal: true, zIndex: 3000 }}
          />

          <Textarea
            label={t('common:modals.relevanceNote', 'Relevance Note')}
            placeholder={t('common:modals.describeVisitRelevance', 'Describe how this visit relates to this lab result')}
            value={newRelationship.relevance_note}
            onChange={(e) => setNewRelationship(prev => ({
              ...prev,
              relevance_note: e.target.value,
            }))}
            autosize
            minRows={3}
          />

          <Group justify="flex-end" gap="sm">
            <Button
              variant="light"
              onClick={() => {
                setShowAddModal(false);
                setNewRelationship({ encounter_id: '', purpose: '', relevance_note: '' });
                setError(null);
              }}
            >
              {t('common:buttons.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleAddRelationship}
              loading={loading}
              disabled={!newRelationship.encounter_id}
            >
              {t('common:buttons.linkVisit', 'Link Visit')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};

export default LabResultEncounterRelationships;
