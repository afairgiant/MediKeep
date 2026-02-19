import logger from '../../services/logger';

import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { navigateToEntity } from '../../utils/linkNavigation';
import {
  Badge,
  Button,
  Group,
  Stack,
  Text,
  Paper,
  Alert,
  ActionIcon,
  Modal,
  Select,
} from '@mantine/core';
import {
  IconStethoscope,
  IconInfoCircle,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';

const ConditionRelationshipsForMedication = ({
  medicationId,
  conditions = [],
  navigate,
  viewOnly = false,
}) => {
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [conditionsCache, setConditionsCache] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedConditionId, setSelectedConditionId] = useState(null);

  // Load relationships when component mounts
  useEffect(() => {
    if (medicationId) {
      fetchMedicationConditions();
    }
  }, [medicationId]);

  const fetchMedicationConditions = async () => {
    logger.info('Fetching medication conditions for medicationId:', medicationId);
    setLoading(true);
    setError(null);

    try {
      const rels = (await apiService.getMedicationConditions(medicationId)) || [];
      setRelationships(rels);

      // Fetch condition details for each relationship that doesn't have them
      const missingConditions = rels.filter(rel => !rel.condition && rel.condition_id);
      if (missingConditions.length > 0) {
        const conditionPromises = missingConditions.map(rel =>
          apiService.getCondition(rel.condition_id).catch(err => {
            logger.warn(`Condition ${rel.condition_id} not found - may be deleted or orphaned relationship`);
            return null;
          })
        );

        const conditionResults = await Promise.all(conditionPromises);
        const newConditionsCache = {};

        conditionResults.forEach((condition, index) => {
          if (condition) {
            const conditionId = missingConditions[index].condition_id;
            newConditionsCache[conditionId] = condition;
          }
        });

        setConditionsCache(newConditionsCache);
      }
    } catch (error) {
      logger.error('Failed to fetch medication conditions:', error);
      logger.error('Error details:', error.response?.data || error.message);
      setError(`Failed to load related conditions: ${error.response?.data?.detail || error.message}`);
      setRelationships([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRelationship = async () => {
    if (!selectedConditionId) return;

    setLoading(true);
    setError(null);

    try {
      await apiService.createConditionMedication(parseInt(selectedConditionId), {
        condition_id: parseInt(selectedConditionId),
        medication_id: medicationId,
        relevance_note: null,
      });
      setShowAddModal(false);
      setSelectedConditionId(null);
      await fetchMedicationConditions();
    } catch (err) {
      logger.error('Error adding condition relationship:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to add condition relationship');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRelationship = async (relationship) => {
    if (!window.confirm('Remove this condition link?')) return;

    setLoading(true);
    setError(null);

    try {
      await apiService.deleteConditionMedication(relationship.condition_id, relationship.id);
      await fetchMedicationConditions();
    } catch (err) {
      logger.error('Error deleting condition relationship:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to remove condition relationship');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
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
  };

  const getStatusColor = (status) => {
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
  };

  // Build dropdown options, filtering out already-linked conditions
  const linkedConditionIds = relationships.map(rel => String(rel.condition_id));
  const conditionOptions = conditions
    .filter(c => !linkedConditionIds.includes(String(c.id)))
    .map(c => ({
      value: String(c.id),
      label: c.diagnosis || c.condition_name || `Condition #${c.id}`,
    }));

  if (loading && relationships.length === 0) {
    return <Text size="sm" c="dimmed">Loading related conditions...</Text>;
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
            const condition = relationship.condition || conditionsCache[relationship.condition_id];
            const conditionName = condition?.diagnosis || condition?.condition_name || `Deleted Condition (ID: ${relationship.condition_id})`;
            const isOrphaned = !condition;

            return (
              <Paper key={relationship.id} withBorder p="md">
                <Group justify="space-between" align="center">
                  <Group gap="sm" style={{ flex: 1 }}>
                    <Text
                      size="sm"
                      fw={500}
                      c={isOrphaned ? 'red' : 'blue'}
                      style={isOrphaned ? { fontStyle: 'italic' } : { cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={isOrphaned ? undefined : () => {
                        const conditionId = condition?.id || relationship.condition_id;
                        if (conditionId && navigate) {
                          navigateToEntity('condition', conditionId, navigate);
                        }
                      }}
                      title={isOrphaned ? 'This condition has been deleted but the relationship still exists' : 'Click to view condition details'}
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
                  {!viewOnly && (
                    <ActionIcon
                      variant="light"
                      color="red"
                      size="sm"
                      onClick={() => handleDeleteRelationship(relationship)}
                      loading={loading}
                      title="Remove condition link"
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  )}
                </Group>
              </Paper>
            );
          })}
        </Stack>
      ) : (
        <Paper withBorder p="md" ta="center">
          <Text c="dimmed">No conditions linked to this medication</Text>
        </Paper>
      )}

      {!viewOnly && (
        <>
          <Group justify="space-between" align="center">
            <Text size="sm" c="dimmed">
              {conditionOptions.length} condition{conditionOptions.length !== 1 ? 's' : ''} available to link
            </Text>
            <Button
              variant="light"
              leftSection={<IconPlus size={16} />}
              onClick={() => setShowAddModal(true)}
              disabled={loading || conditionOptions.length === 0}
            >
              Link Condition
            </Button>
          </Group>

          <Modal
        opened={showAddModal}
        onClose={() => { setShowAddModal(false); setSelectedConditionId(null); setError(null); }}
        title="Link Condition to Medication"
        size="md"
        centered
        zIndex={3000}
      >
        <Stack gap="md">
          <Select
            label="Select Condition"
            placeholder="Choose a condition to link"
            data={conditionOptions}
            value={selectedConditionId}
            onChange={setSelectedConditionId}
            searchable
            clearable
            required
            comboboxProps={{ withinPortal: true, zIndex: 4000 }}
          />
          {error && (
            <Alert icon={<IconInfoCircle size={16} />} color="red" variant="light">
              {error}
            </Alert>
          )}
          <Group justify="flex-end" gap="sm">
            <Button variant="light" onClick={() => { setShowAddModal(false); setSelectedConditionId(null); setError(null); }}>
              Cancel
            </Button>
            <Button
              onClick={handleAddRelationship}
              loading={loading}
              disabled={!selectedConditionId}
            >
              Link Condition
            </Button>
          </Group>
        </Stack>
      </Modal>
        </>
      )}
    </Stack>
  );
};

export default ConditionRelationshipsForMedication;
