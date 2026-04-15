import { useState, useEffect } from 'react';
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
  IconFlask,
  IconInfoCircle,
} from '@tabler/icons-react';
import { useDateFormat } from '../../../hooks/useDateFormat';
import {
  PURPOSE_OPTIONS,
  getPurposeLabel,
  getPurposeColor,
} from '../../../constants/encounterLabResultConstants';

const EncounterLabResultRelationships = ({
  encounterId,
  encounterLabResults = {},
  labResults = [],
  fetchEncounterLabResults,
  navigate,
  isViewMode = false,
}) => {
  const { t } = useTranslation(['common', 'errors', 'shared']);
  const { formatDate } = useDateFormat();
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRelationship, setEditingRelationship] = useState(null);
  const [newRelationship, setNewRelationship] = useState({
    lab_result_id: '',
    purpose: '',
    relevance_note: '',
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    const rels = encounterLabResults[encounterId] || [];
    setRelationships(rels);
  }, [encounterId, encounterLabResults]);

  useEffect(() => {
    if (encounterId && fetchEncounterLabResults) {
      fetchEncounterLabResults(encounterId);
    }
  }, [encounterId]);

  const handleAddRelationship = async () => {
    if (!newRelationship.lab_result_id) {
      setError(
        t('common:messages.selectLabResult', 'Please select a lab result')
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiService.linkEncounterLabResult(encounterId, {
        lab_result_id: parseInt(newRelationship.lab_result_id),
        purpose: newRelationship.purpose || null,
        relevance_note: newRelationship.relevance_note || null,
      });

      if (fetchEncounterLabResults) {
        await fetchEncounterLabResults(encounterId);
      }

      setNewRelationship({
        lab_result_id: '',
        purpose: '',
        relevance_note: '',
      });
      setShowAddModal(false);
    } catch (err) {
      setError(
        err.message ||
          t(
            'common:messages.failedToLinkLabResult',
            'Failed to link lab result'
          )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEditRelationship = async (relationshipId, updates) => {
    setLoading(true);
    setError(null);

    try {
      await apiService.updateEncounterLabResult(
        encounterId,
        relationshipId,
        updates
      );

      if (fetchEncounterLabResults) {
        await fetchEncounterLabResults(encounterId);
      }

      setEditingRelationship(null);
    } catch (err) {
      setError(
        err.message ||
          t(
            'common:messages.failedToUpdateRelationship',
            'Failed to update relationship'
          )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRelationship = async relationshipId => {
    if (
      !window.confirm(
        t(
          'common:messages.confirmRemoveLabResultLink',
          'Remove this lab result link?'
        )
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiService.unlinkEncounterLabResult(encounterId, relationshipId);

      if (fetchEncounterLabResults) {
        await fetchEncounterLabResults(encounterId);
      }
    } catch (err) {
      setError(
        err.message ||
          t(
            'common:messages.failedToUnlinkLabResult',
            'Failed to unlink lab result'
          )
      );
    } finally {
      setLoading(false);
    }
  };

  const getLabResultById = labResultId => {
    return labResults.find(lr => lr.id === labResultId);
  };

  const labResultOptions = labResults.map(lr => ({
    value: lr.id.toString(),
    label: `${lr.test_name}${lr.ordered_date ? ` (${lr.ordered_date})` : ''}${lr.status ? ` - ${lr.status}` : ''}`,
  }));

  const linkedLabResultIds = relationships.map(rel =>
    rel.lab_result_id.toString()
  );
  const availableLabResultOptions = labResultOptions.filter(
    option => !linkedLabResultIds.includes(option.value)
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
            const labResultObj = getLabResultById(relationship.lab_result_id);
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
                          style={{
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                          onClick={() =>
                            navigateToEntity(
                              'lab_result',
                              relationship.lab_result_id,
                              navigate
                            )
                          }
                        >
                          {relationship.lab_result_name ||
                            labResultObj?.test_name ||
                            `Lab Result #${relationship.lab_result_id}`}
                        </Text>
                      ) : (
                        <Badge
                          variant="light"
                          color="teal"
                          leftSection={<IconFlask size={12} />}
                          style={{ cursor: 'pointer' }}
                          onClick={() =>
                            navigateToEntity(
                              'lab_result',
                              relationship.lab_result_id,
                              navigate
                            )
                          }
                        >
                          {relationship.lab_result_name ||
                            labResultObj?.test_name ||
                            `Lab Result #${relationship.lab_result_id}`}
                        </Badge>
                      )}
                      {(relationship.lab_result_status ||
                        labResultObj?.status) && (
                        <Badge variant="outline" size="sm">
                          {relationship.lab_result_status ||
                            labResultObj?.status}
                        </Badge>
                      )}
                      {relationship.purpose && (
                        <Badge
                          variant="light"
                          size="sm"
                          color={getPurposeColor(relationship.purpose)}
                        >
                          {getPurposeLabel(relationship.purpose)}
                        </Badge>
                      )}
                    </Group>

                    {(relationship.lab_result_date ||
                      labResultObj?.ordered_date) && (
                      <Text size="xs" c="dimmed">
                        {t('common:labels.ordered', 'Ordered')}:{' '}
                        {formatDate(
                          relationship.lab_result_date ||
                            labResultObj?.ordered_date
                        )}
                      </Text>
                    )}

                    {!isViewMode && isEditing ? (
                      <Stack gap="xs">
                        <Select
                          size="xs"
                          placeholder={t(
                            'common:labels.selectPurpose',
                            'Select purpose'
                          )}
                          data={PURPOSE_OPTIONS}
                          value={editingRelationship?.purpose || ''}
                          onChange={val =>
                            setEditingRelationship({
                              ...editingRelationship,
                              purpose: val,
                            })
                          }
                          clearable
                          comboboxProps={{ withinPortal: true, zIndex: 3000 }}
                        />
                        <Textarea
                          placeholder={t(
                            'common:modals.relevanceNoteOptional',
                            'Relevance note (optional)'
                          )}
                          value={editingRelationship?.relevance_note || ''}
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
                      </Stack>
                    ) : relationship.relevance_note ? (
                      <Text size="sm" c="dimmed" fs="italic">
                        {relationship.relevance_note}
                      </Text>
                    ) : !isViewMode ? (
                      <Text size="sm" c="dimmed">
                        {t(
                          'common:modals.noRelevanceNoteProvided',
                          'No relevance note provided'
                        )}
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
                            onClick={() =>
                              handleEditRelationship(relationship.id, {
                                purpose: editingRelationship?.purpose || null,
                                relevance_note:
                                  editingRelationship?.relevance_note || null,
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
                            onClick={() =>
                              setEditingRelationship({
                                id: relationship.id,
                                purpose: relationship.purpose || '',
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
                            onClick={() =>
                              handleDeleteRelationship(relationship.id)
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
              'common:labels.noLabResultsLinked',
              'No lab results linked to this visit'
            )}
          </Text>
        </Paper>
      )}

      {!isViewMode && availableLabResultOptions.length > 0 && (
        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={() => setShowAddModal(true)}
          disabled={loading}
        >
          {t('common:buttons.linkLabResult', 'Link Lab Result')}
        </Button>
      )}

      <Modal
        opened={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setNewRelationship({
            lab_result_id: '',
            purpose: '',
            relevance_note: '',
          });
          setError(null);
        }}
        title={t(
          'common:modals.linkLabResultToVisit',
          'Link Lab Result to Visit'
        )}
        size="md"
        centered
        zIndex={2100}
      >
        <Stack gap="md">
          <Select
            label={t('common:modals.selectLabResult', 'Select Lab Result')}
            placeholder={t(
              'common:modals.chooseLabResultToLink',
              'Choose a lab result to link'
            )}
            data={availableLabResultOptions}
            value={newRelationship.lab_result_id}
            onChange={val =>
              setNewRelationship(prev => ({
                ...prev,
                lab_result_id: val || '',
              }))
            }
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
            onChange={val =>
              setNewRelationship(prev => ({
                ...prev,
                purpose: val || '',
              }))
            }
            clearable
            comboboxProps={{ withinPortal: true, zIndex: 3000 }}
          />

          <Textarea
            label={t('common:modals.relevanceNote', 'Relevance Note')}
            placeholder={t(
              'common:modals.describeLabResultRelevance',
              'Describe how this lab result relates to this visit'
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
            <Button
              variant="light"
              onClick={() => {
                setShowAddModal(false);
                setNewRelationship({
                  lab_result_id: '',
                  purpose: '',
                  relevance_note: '',
                });
                setError(null);
              }}
            >
              {t('shared:fields.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleAddRelationship}
              loading={loading}
              disabled={!newRelationship.lab_result_id}
            >
              {t('common:buttons.linkLabResult', 'Link Lab Result')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};

export default EncounterLabResultRelationships;
