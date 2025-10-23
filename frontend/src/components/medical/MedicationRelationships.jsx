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
  ActionIcon,
  Alert,
  MultiSelect,
  Modal,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconInfoCircle,
} from '@tabler/icons-react';

const MedicationRelationships = ({
  conditionId,
  conditionMedications = {},
  medications = [],
  fetchConditionMedications,
  navigate,
  isViewMode = false, // New prop to distinguish between view and edit modes
}) => {
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRelationship, setNewRelationship] = useState({
    medication_id: '',
  });
  const [error, setError] = useState(null);

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
    if (!newRelationship.medication_id) {
      setError('Please select a medication');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await apiService.createConditionMedication(conditionId, {
        condition_id: conditionId,
        medication_id: parseInt(newRelationship.medication_id),
      });

      // Refresh relationships
      if (fetchConditionMedications) {
        await fetchConditionMedications(conditionId);
      }

      // Reset form and close modal
      setNewRelationship({ medication_id: '' });
      setShowAddModal(false);
    } catch (err) {
      logger.error('Error adding medication relationship:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to add medication relationship');
    } finally {
      setLoading(false);
    }
  };


  const handleDeleteRelationship = async (relationshipId) => {
    if (!window.confirm('Are you sure you want to remove this medication relationship?')) {
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

            return (
              <Paper key={relationship.id} withBorder p="md">
                <Group justify="space-between" align="center">
                  <Group gap="sm" style={{ flex: 1 }}>
                    <Text
                      size="sm"
                      fw={500}
                      c="blue"
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => navigateToEntity('medication', medication?.id, navigate)}
                    >
                      {medication?.medication_name || `Medication ID: ${relationship.medication_id}`}
                    </Text>
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

                  {!isViewMode && (
                    <ActionIcon
                      variant="light"
                      color="red"
                      size="sm"
                      onClick={() => handleDeleteRelationship(relationship.id)}
                      loading={loading}
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
          <Text c="dimmed">No medications linked to this condition</Text>
        </Paper>
      )}

      {/* Add New Relationship Button */}
      {!isViewMode && (
        <Group justify="space-between" align="center">
          <Text size="sm" c="dimmed">
            {availableMedicationOptions.length} medications available to link
          </Text>
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={() => setShowAddModal(true)}
            disabled={loading || availableMedicationOptions.length === 0}
          >
            Link Medication
          </Button>
        </Group>
      )}

      {/* Add Relationship Modal */}
      <Modal
        opened={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setNewRelationship({ medication_id: '' });
          setError(null);
        }}
        title="Link Medication to Condition"
        size="md"
        centered
      >
        <Stack gap="md">
          <MultiSelect
            label="Select Medication"
            placeholder="Choose a medication to link"
            data={availableMedicationOptions}
            value={newRelationship.medication_id ? [newRelationship.medication_id] : []}
            onChange={(values) => setNewRelationship(prev => ({
              ...prev,
              medication_id: values[0] || ''
            }))}
            searchable
            clearable
            required
          />

          <Group justify="flex-end" gap="sm">
            <Button
              variant="light"
              onClick={() => {
                setShowAddModal(false);
                setNewRelationship({ medication_id: '' });
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddRelationship}
              loading={loading}
              disabled={!newRelationship.medication_id}
            >
              Link Medication
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
};

export default MedicationRelationships;