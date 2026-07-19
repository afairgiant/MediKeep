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
  IconPill,
  IconInfoCircle,
} from '@tabler/icons-react';

const LabResultMedicationRelationships = ({
  labResultId,
  labResultMedications = {},
  medications = [],
  fetchLabResultMedications,
  navigate,
  isViewMode = false,
}) => {
  const { t } = useTranslation(['common', 'errors', 'shared']);
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRelationship, setEditingRelationship] = useState(null);
  const [newRelationship, setNewRelationship] = useState({
    medication_id: '',
    relevance_note: '',
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    const rels = labResultMedications[labResultId];
    setRelationships(Array.isArray(rels) ? rels : []);
  }, [labResultId, labResultMedications]);

  useEffect(() => {
    if (labResultId && fetchLabResultMedications) {
      fetchLabResultMedications(labResultId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchLabResultMedications identity changes on every render; including it would cause infinite reload loop
  }, [labResultId]);

  const handleAddRelationship = async () => {
    if (!newRelationship.medication_id) {
      setError(
        t('common:messages.selectMedication', 'Please select a medication')
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiService.createLabResultMedication(labResultId, {
        medication_id: parseInt(newRelationship.medication_id),
        relevance_note: newRelationship.relevance_note || null,
      });

      if (fetchLabResultMedications) {
        await fetchLabResultMedications(labResultId);
      }

      setNewRelationship({ medication_id: '', relevance_note: '' });
      setShowAddModal(false);
    } catch (err) {
      setError(
        err.message ||
          t(
            'common:messages.failedToLinkMedication',
            'Failed to link medication'
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
      await apiService.updateLabResultMedication(
        labResultId,
        relationshipId,
        updates
      );

      if (fetchLabResultMedications) {
        await fetchLabResultMedications(labResultId);
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
          'common:messages.confirmRemoveMedicationLink',
          'Remove this medication link?'
        )
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiService.deleteLabResultMedication(labResultId, relationshipId);

      if (fetchLabResultMedications) {
        await fetchLabResultMedications(labResultId);
      }
    } catch (err) {
      setError(
        err.message ||
          t(
            'common:messages.failedToUnlinkMedication',
            'Failed to unlink medication'
          )
      );
    } finally {
      setLoading(false);
    }
  };

  const medicationOptions = medications.map(med => ({
    value: med.id.toString(),
    label: `${med.medication_name}${med.dosage ? ` (${med.dosage})` : ''}`,
  }));

  const linkedMedicationIds = relationships.map(rel =>
    rel.medication_id.toString()
  );
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
                              'medication',
                              relationship.medication_id,
                              navigate
                            )
                          }
                        >
                          {relationship.medication?.medication_name ||
                            `Medication #${relationship.medication_id}`}
                        </Text>
                      ) : (
                        <Badge
                          variant="light"
                          color="teal"
                          leftSection={<IconPill size={12} />}
                          style={{ cursor: 'pointer' }}
                          onClick={() =>
                            navigateToEntity(
                              'medication',
                              relationship.medication_id,
                              navigate
                            )
                          }
                        >
                          {relationship.medication?.medication_name ||
                            `Medication #${relationship.medication_id}`}
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
              'common:labels.noMedicationsLinkedToLabResult',
              'No medications linked to this lab result'
            )}
          </Text>
        </Paper>
      )}

      {!isViewMode && availableMedicationOptions.length > 0 && (
        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={() => setShowAddModal(true)}
          disabled={loading}
        >
          {t('common:buttons.linkMedication', 'Link Medication')}
        </Button>
      )}

      <Modal
        opened={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setNewRelationship({ medication_id: '', relevance_note: '' });
          setError(null);
        }}
        title={t(
          'common:modals.linkMedicationToLabResult',
          'Link Medication to Lab Result'
        )}
        size="md"
        centered
        zIndex={2100}
      >
        <Stack gap="md">
          <Select
            label={t('common:modals.selectMedication', 'Select Medication')}
            placeholder={t(
              'common:modals.chooseOneMedicationToLink',
              'Choose a medication to link'
            )}
            data={availableMedicationOptions}
            value={newRelationship.medication_id}
            onChange={val =>
              setNewRelationship(prev => ({
                ...prev,
                medication_id: val || '',
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
              'common:modals.describeMedicationLabResultRelevance',
              'Describe how this medication relates to this lab result'
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
                setNewRelationship({ medication_id: '', relevance_note: '' });
                setError(null);
              }}
            >
              {t('shared:fields.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleAddRelationship}
              loading={loading}
              disabled={!newRelationship.medication_id}
            >
              {t('common:buttons.linkMedication', 'Link Medication')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};

export default LabResultMedicationRelationships;
