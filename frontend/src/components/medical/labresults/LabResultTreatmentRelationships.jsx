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
  TextInput,
  Textarea,
  Modal,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconEdit,
  IconCheck,
  IconX,
  IconClipboardHeart,
  IconInfoCircle,
} from '@tabler/icons-react';
import {
  PURPOSE_OPTIONS,
  getPurposeLabel,
  getPurposeColor,
} from '../../../constants/treatmentLabResultConstants';

const LabResultTreatmentRelationships = ({
  labResultId,
  labResultTreatments = {},
  treatments = [],
  fetchLabResultTreatments,
  navigate,
  isViewMode = false,
}) => {
  const { t } = useTranslation(['common', 'errors', 'shared']);
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRelationship, setEditingRelationship] = useState(null);
  const [newRelationship, setNewRelationship] = useState({
    treatment_id: '',
    purpose: '',
    expected_frequency: '',
    relevance_note: '',
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    const rels = labResultTreatments[labResultId];
    setRelationships(Array.isArray(rels) ? rels : []);
  }, [labResultId, labResultTreatments]);

  useEffect(() => {
    if (labResultId && fetchLabResultTreatments) {
      fetchLabResultTreatments(labResultId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchLabResultTreatments identity changes on every render; including it would cause infinite reload loop
  }, [labResultId]);

  const handleAddRelationship = async () => {
    if (!newRelationship.treatment_id) {
      setError(
        t('common:messages.selectTreatment', 'Please select a treatment')
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiService.createLabResultTreatment(labResultId, {
        treatment_id: parseInt(newRelationship.treatment_id),
        purpose: newRelationship.purpose || null,
        expected_frequency: newRelationship.expected_frequency || null,
        relevance_note: newRelationship.relevance_note || null,
      });

      if (fetchLabResultTreatments) {
        await fetchLabResultTreatments(labResultId);
      }

      setNewRelationship({
        treatment_id: '',
        purpose: '',
        expected_frequency: '',
        relevance_note: '',
      });
      setShowAddModal(false);
    } catch (err) {
      setError(
        err.message ||
          t(
            'common:messages.failedToLinkTreatment',
            'Failed to link treatment'
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
      await apiService.updateLabResultTreatment(
        labResultId,
        relationshipId,
        updates
      );

      if (fetchLabResultTreatments) {
        await fetchLabResultTreatments(labResultId);
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
          'common:messages.confirmRemoveTreatmentLink',
          'Remove this treatment link?'
        )
      )
    ) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiService.deleteLabResultTreatment(labResultId, relationshipId);

      if (fetchLabResultTreatments) {
        await fetchLabResultTreatments(labResultId);
      }
    } catch (err) {
      setError(
        err.message ||
          t(
            'common:messages.failedToUnlinkTreatment',
            'Failed to unlink treatment'
          )
      );
    } finally {
      setLoading(false);
    }
  };

  const treatmentOptions = treatments.map(tr => ({
    value: tr.id.toString(),
    label: tr.treatment_name,
  }));

  const linkedTreatmentIds = relationships.map(rel =>
    rel.treatment_id.toString()
  );
  const availableTreatmentOptions = treatmentOptions.filter(
    option => !linkedTreatmentIds.includes(option.value)
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
                              'treatment',
                              relationship.treatment_id,
                              navigate
                            )
                          }
                        >
                          {relationship.treatment?.treatment_name ||
                            `Treatment #${relationship.treatment_id}`}
                        </Text>
                      ) : (
                        <Badge
                          variant="light"
                          color="orange"
                          leftSection={<IconClipboardHeart size={12} />}
                          style={{ cursor: 'pointer' }}
                          onClick={() =>
                            navigateToEntity(
                              'treatment',
                              relationship.treatment_id,
                              navigate
                            )
                          }
                        >
                          {relationship.treatment?.treatment_name ||
                            `Treatment #${relationship.treatment_id}`}
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

                    {relationship.expected_frequency && (
                      <Text size="xs" c="dimmed">
                        {t(
                          'common:labels.expectedFrequency',
                          'Expected frequency'
                        )}
                        : {relationship.expected_frequency}
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
                        <TextInput
                          size="xs"
                          placeholder={t(
                            'common:labels.expectedFrequency',
                            'Expected frequency'
                          )}
                          value={editingRelationship?.expected_frequency || ''}
                          onChange={e =>
                            setEditingRelationship({
                              ...editingRelationship,
                              expected_frequency: e.target.value,
                            })
                          }
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
                                expected_frequency:
                                  editingRelationship?.expected_frequency ||
                                  null,
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
                                expected_frequency:
                                  relationship.expected_frequency || '',
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
              'common:labels.noTreatmentsLinked',
              'No treatments linked to this lab result'
            )}
          </Text>
        </Paper>
      )}

      {!isViewMode && availableTreatmentOptions.length > 0 && (
        <Button
          variant="light"
          leftSection={<IconPlus size={16} />}
          onClick={() => setShowAddModal(true)}
          disabled={loading}
        >
          {t('common:buttons.linkTreatment', 'Link Treatment')}
        </Button>
      )}

      <Modal
        opened={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setNewRelationship({
            treatment_id: '',
            purpose: '',
            expected_frequency: '',
            relevance_note: '',
          });
          setError(null);
        }}
        title={t(
          'common:modals.linkTreatmentToLabResult',
          'Link Treatment to Lab Result'
        )}
        size="md"
        centered
        zIndex={2100}
      >
        <Stack gap="md">
          <Select
            label={t('common:modals.selectTreatment', 'Select Treatment')}
            placeholder={t(
              'common:modals.chooseTreatmentToLink',
              'Choose a treatment to link'
            )}
            data={availableTreatmentOptions}
            value={newRelationship.treatment_id}
            onChange={val =>
              setNewRelationship(prev => ({
                ...prev,
                treatment_id: val || '',
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

          <TextInput
            label={t('common:labels.expectedFrequency', 'Expected frequency')}
            placeholder={t(
              'common:modals.expectedFrequencyPlaceholder',
              'e.g. Monthly, Every 3 months'
            )}
            value={newRelationship.expected_frequency}
            onChange={e =>
              setNewRelationship(prev => ({
                ...prev,
                expected_frequency: e.target.value,
              }))
            }
          />

          <Textarea
            label={t('common:modals.relevanceNote', 'Relevance Note')}
            placeholder={t(
              'common:modals.describeTreatmentRelevance',
              'Describe how this treatment relates to this lab result'
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
                  treatment_id: '',
                  purpose: '',
                  expected_frequency: '',
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
              disabled={!newRelationship.treatment_id}
            >
              {t('common:buttons.linkTreatment', 'Link Treatment')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};

export default LabResultTreatmentRelationships;
