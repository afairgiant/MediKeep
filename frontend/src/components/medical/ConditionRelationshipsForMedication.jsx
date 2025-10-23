import logger from '../../services/logger';

import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { navigateToEntity } from '../../utils/linkNavigation';
import {
  Badge,
  Group,
  Stack,
  Text,
  Paper,
  Alert,
} from '@mantine/core';
import {
  IconStethoscope,
  IconInfoCircle,
} from '@tabler/icons-react';

const ConditionRelationshipsForMedication = ({
  medicationId,
  navigate,
}) => {
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [conditionsCache, setConditionsCache] = useState({});

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
      const relationships = await apiService.getMedicationConditions(medicationId);
      setRelationships(relationships || []);
      
      // Fetch condition details for each relationship that doesn't have them
      const missingConditions = relationships.filter(rel => !rel.condition && rel.condition_id);
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

  if (loading) {
    return <Text size="sm" c="dimmed">Loading related conditions...</Text>;
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
                      c={isOrphaned ? "red" : "blue"}
                      style={isOrphaned ? { fontStyle: 'italic' } : { cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={isOrphaned ? undefined : (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const conditionId = condition?.id || relationship.condition_id;
                        if (conditionId && navigate) {
                          navigateToEntity('condition', conditionId, navigate);
                        }
                      }}
                      title={isOrphaned ? "This condition has been deleted but the relationship still exists" : "Click to view condition details"}
                    >
                      {conditionName}
                    </Text>
                    {condition?.status && (
                      <Badge 
                        variant="outline" 
                        size="sm" 
                        color={getStatusColor(condition.status)}
                      >
                        {condition.status}
                      </Badge>
                    )}
                    {condition?.severity && (
                      <Badge 
                        variant="outline" 
                        size="sm" 
                        color={getSeverityColor(condition.severity)}
                      >
                        {condition.severity}
                      </Badge>
                    )}
                  </Group>
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
    </Stack>
  );
};

export default ConditionRelationshipsForMedication;