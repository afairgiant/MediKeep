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
  IconMedicalCross,
  IconInfoCircle,
} from '@tabler/icons-react';

const LabResultProcedureRelationships = ({
  labResultId,
  labResultProcedures = {},
  procedures = [],
  fetchLabResultProcedures,
  navigate,
  isViewMode = false,
}) => {
  const { t } = useTranslation(['common', 'errors', 'shared']);
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRelationship, setEditingRelationship] = useState(null);
  const [newRelationship, setNewRelationship] = useState({
    procedure_id: '',
    relevance_note: '',
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    const rels = labResultProcedures[labResultId];
    setRelationships(Array.isArray(rels) ? rels : []);
  }, [labResultId, labResultProcedures]);

  useEffect(() => {
    if (labResultId && fetchLabResultProcedures) {
      fetchLabResultProcedures(labResultId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchLabResultProcedures identity changes on every render; including it would cause infinite reload loop
  }, [labResultId]);

  const handleAddRelationship = async () => {
    if (!newRelationship.procedure_id) {
      setError(
        t('common:messages.selectProcedure', 'Please select a procedure')
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiService.createLabResultProcedure(labResultId, {
        procedure_id: parseInt(newRelationship.procedure_id),
        relevance_note: newRelationship.relevance_note || null,
      });

      if (fetchLabResultProcedures) {
        await fetchLabResultProcedures(labResultId);
      }

      setNewRelationship({ procedure_id: '', relevance_note: '' });
      setShowAddModal(false);
    } catch (err) {
      setError(
        err.message ||
          t(
            'common:messages.failedToLinkProcedure',
            'Failed to link procedure'
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
      await apiService.updateLabResultProcedure(
        labResultId,
        relationshipId,
        updates
      );

      if (fetchLabResultProcedures) {
        await fetchLabResultProcedures(labResultId);
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
          'common:messages.confirmRemoveProcedureLink',
          'Remove this procedure link?'
        )
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiService.deleteLabResultProcedure(labResultId, relationshipId);

      if (fetchLabResultProcedures) {
        await fetchLabResultProcedures(labResultId);
      }
    } catch (err) {
      setError(
        err.message ||
          t(
            'common:messages.failedToUnlinkProcedure',
            'Failed to unlink procedure'
          )
      );
    } finally {
      setLoading(false);
    }
  };

  const procedureOptions = procedures.map(proc => ({
    value: proc.id.toString(),
    label: `${proc.procedure_name}${proc.date ? ` (${proc.date})` : ''}`,
  }));

  const linkedProcedureIds = relationships.map(rel =>
    rel.procedure_id.toString()
  );
  const availableProcedureOptions = procedureOptions.filter(
    option => !linkedProcedureIds.includes(option.value)
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
                          style={{
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                          onClick={() =>
                            navigateToEntity(
                              'procedure',
                              relationship.procedure_id,
                              navigate
                            )
                          }
                        >
                          {relationship.procedure?.procedure_name ||
                            `Procedure #${relationship.procedure_id}`}
                        </Text>
                      ) : (
                        <Badge
                          variant="light"
                          color="grape"
                          leftSection={<IconMedicalCross size={12} />}
                          style={{ cursor: 'pointer' }}
                          onClick={() =>
                            navigateToEntity(
                              'procedure',
                              relationship.procedure_id,
                              navigate
                            )
                          }
                        >
                          {relationship.procedure?.procedure_name ||
                            `Procedure #${relationship.procedure_id}`}
                        </Badge>
                      )}
                    </Group>

                    {!isViewMode && isEditing ? (
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
              'common:labels.noProceduresLinked',
              'No procedures linked to this lab result'
            )}
          </Text>
        </Paper>
      )}

      {!isViewMode && availableProcedureOptions.length > 0 && (
        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={() => setShowAddModal(true)}
          disabled={loading}
        >
          {t('common:buttons.linkProcedure', 'Link Procedure')}
        </Button>
      )}

      <Modal
        opened={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setNewRelationship({ procedure_id: '', relevance_note: '' });
          setError(null);
        }}
        title={t(
          'common:modals.linkProcedureToLabResult',
          'Link Procedure to Lab Result'
        )}
        size="md"
        centered
        zIndex={2100}
      >
        <Stack gap="md">
          <Select
            label={t('common:modals.selectProcedure', 'Select Procedure')}
            placeholder={t(
              'common:modals.chooseProcedureToLink',
              'Choose a procedure to link'
            )}
            data={availableProcedureOptions}
            value={newRelationship.procedure_id}
            onChange={val =>
              setNewRelationship(prev => ({
                ...prev,
                procedure_id: val || '',
              }))
            }
            searchable
            clearable
            required
            comboboxProps={{ withinPortal: true, zIndex: 3000 }}
          />

          <Textarea
            label={t('common:modals.relevanceNote', 'Relevance Note')}
            placeholder={t(
              'common:modals.describeProcedureRelevance',
              'Describe how this procedure relates to this lab result'
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
                setNewRelationship({ procedure_id: '', relevance_note: '' });
                setError(null);
              }}
            >
              {t('shared:fields.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleAddRelationship}
              loading={loading}
              disabled={!newRelationship.procedure_id}
            >
              {t('common:buttons.linkProcedure', 'Link Procedure')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};

export default LabResultProcedureRelationships;
