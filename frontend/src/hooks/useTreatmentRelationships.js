import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api';
import logger from '../services/logger';

/**
 * Configuration for different relationship types.
 * Each type defines its API methods and entity-specific settings.
 */
const RELATIONSHIP_CONFIGS = {
  medication: {
    entityName: 'medication',
    entityIdField: 'medication_id',
    idsField: 'medication_ids',
    fetchMethod: 'getTreatmentMedications',
    linkMethod: 'linkTreatmentMedication',
    linkBulkMethod: 'linkTreatmentMedicationsBulk',
    updateMethod: 'updateTreatmentMedication',
    unlinkMethod: 'unlinkTreatmentMedication',
    logPrefix: 'treatment_medication',
    componentName: 'TreatmentMedicationRelationships',
  },
  encounter: {
    entityName: 'encounter',
    entityIdField: 'encounter_id',
    idsField: 'encounter_ids',
    fetchMethod: 'getTreatmentEncounters',
    linkMethod: 'linkTreatmentEncounter',
    linkBulkMethod: 'linkTreatmentEncountersBulk',
    updateMethod: 'updateTreatmentEncounter',
    unlinkMethod: 'unlinkTreatmentEncounter',
    logPrefix: 'treatment_encounter',
    componentName: 'TreatmentEncounterRelationships',
  },
  labResult: {
    entityName: 'lab result',
    entityIdField: 'lab_result_id',
    idsField: 'lab_result_ids',
    fetchMethod: 'getTreatmentLabResults',
    linkMethod: 'linkTreatmentLabResult',
    linkBulkMethod: 'linkTreatmentLabResultsBulk',
    updateMethod: 'updateTreatmentLabResult',
    unlinkMethod: 'unlinkTreatmentLabResult',
    logPrefix: 'treatment_lab_result',
    componentName: 'TreatmentLabResultRelationships',
  },
};

/**
 * Custom hook for managing treatment relationships with medications, encounters, or lab results.
 * Extracts common CRUD logic shared across all relationship components.
 *
 * @param {Object} options - Hook configuration options
 * @param {string} options.type - Relationship type ('medication', 'encounter', or 'labResult')
 * @param {number} options.treatmentId - The treatment ID to manage relationships for
 * @param {Object} options.initialState - Initial state for new relationship form
 * @param {Function} options.onRelationshipsChange - Callback when relationships change
 * @param {Function} options.buildSinglePayload - Function to build payload for single link
 * @param {Function} options.buildBulkPayload - Function to build payload for bulk link
 * @returns {Object} State and handlers for managing relationships
 */
export function useTreatmentRelationships({
  type,
  treatmentId,
  initialState,
  onRelationshipsChange,
  buildSinglePayload,
  buildBulkPayload,
}) {
  const { t } = useTranslation('common');
  const { t: tErrors } = useTranslation('errors');

  const config = RELATIONSHIP_CONFIGS[type];
  if (!config) {
    throw new Error(`Unknown relationship type: ${type}`);
  }

  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRelationship, setEditingRelationship] = useState(null);
  const [newRelationship, setNewRelationship] = useState(initialState);
  const [error, setError] = useState(null);

  // Use ref for callback to avoid infinite re-renders when parent passes inline function
  const onRelationshipsChangeRef = useRef(onRelationshipsChange);
  useEffect(() => {
    onRelationshipsChangeRef.current = onRelationshipsChange;
  }, [onRelationshipsChange]);

  const resetAndCloseModal = useCallback(() => {
    setShowAddModal(false);
    setNewRelationship(initialState);
    setError(null);
  }, [initialState]);

  const fetchRelationships = useCallback(async (signal) => {
    if (!treatmentId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await apiService[config.fetchMethod](treatmentId, signal);

      // Check if aborted before updating state
      if (signal?.aborted) return;

      setRelationships(data || []);
      if (onRelationshipsChangeRef.current) {
        onRelationshipsChangeRef.current(data || []);
      }
    } catch (err) {
      // Don't update state or log if request was aborted
      if (err.name === 'AbortError' || signal?.aborted) return;

      logger.error(`${config.logPrefix}_fetch_error`, {
        treatmentId,
        error: err.message,
        component: config.componentName,
      });
      setError(err.message || `Failed to load ${config.entityName} relationships`);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [treatmentId, config]);

  // Effect with proper cleanup using AbortController
  useEffect(() => {
    const controller = new AbortController();
    fetchRelationships(controller.signal);

    return () => {
      controller.abort();
    };
  }, [fetchRelationships]);

  const handleAddRelationship = useCallback(async () => {
    const ids = newRelationship[config.idsField];
    if (!ids || ids.length === 0) {
      setError(tErrors(`form.${config.entityName.replace(' ', '')}NotSelected`, `Please select at least one ${config.entityName}`));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (ids.length > 1 && buildBulkPayload) {
        const bulkPayload = buildBulkPayload(newRelationship);
        await apiService[config.linkBulkMethod](treatmentId, ...bulkPayload);
      } else {
        const singlePayload = buildSinglePayload(newRelationship);
        await apiService[config.linkMethod](treatmentId, singlePayload);
      }

      await fetchRelationships();
      resetAndCloseModal();
    } catch (err) {
      logger.error(`${config.logPrefix}_add_error`, {
        treatmentId,
        error: err.message,
        component: config.componentName,
      });
      setError(err.response?.data?.detail || err.message || `Failed to add ${config.entityName} relationship`);
    } finally {
      setLoading(false);
    }
  }, [
    newRelationship,
    config,
    treatmentId,
    buildSinglePayload,
    buildBulkPayload,
    fetchRelationships,
    resetAndCloseModal,
    tErrors,
  ]);

  const handleEditRelationship = useCallback(async (relationshipId, updates) => {
    setLoading(true);
    setError(null);

    try {
      await apiService[config.updateMethod](treatmentId, relationshipId, updates);
      await fetchRelationships();
      setEditingRelationship(null);
    } catch (err) {
      logger.error(`${config.logPrefix}_update_error`, {
        treatmentId,
        relationshipId,
        error: err.message,
        component: config.componentName,
      });
      setError(err.response?.data?.detail || err.message || `Failed to update ${config.entityName} relationship`);
    } finally {
      setLoading(false);
    }
  }, [treatmentId, fetchRelationships, config]);

  const handleDeleteRelationship = useCallback(async (relationshipId, confirmMessage) => {
    const defaultMessage = t(
      `messages.confirmRemove${type.charAt(0).toUpperCase() + type.slice(1)}Relationship`,
      `Are you sure you want to remove this ${config.entityName} link?`
    );

    if (!window.confirm(confirmMessage || defaultMessage)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiService[config.unlinkMethod](treatmentId, relationshipId);
      await fetchRelationships();
    } catch (err) {
      logger.error(`${config.logPrefix}_delete_error`, {
        treatmentId,
        relationshipId,
        error: err.message,
        component: config.componentName,
      });
      setError(err.response?.data?.detail || err.message || `Failed to delete ${config.entityName} relationship`);
    } finally {
      setLoading(false);
    }
  }, [treatmentId, fetchRelationships, config, type, t]);

  const updateNewRelationship = useCallback((field, value) => {
    setNewRelationship(prev => ({ ...prev, [field]: value }));
  }, []);

  const updateEditingRelationship = useCallback((field, value) => {
    setEditingRelationship(prev => prev ? { ...prev, [field]: value } : null);
  }, []);

  const startEditing = useCallback((relationship, editFields) => {
    const editState = { id: relationship.id };
    for (const field of editFields) {
      editState[field] = relationship[field] || '';
    }
    setEditingRelationship(editState);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingRelationship(null);
  }, []);

  const openAddModal = useCallback(() => {
    setShowAddModal(true);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    relationships,
    loading,
    showAddModal,
    editingRelationship,
    newRelationship,
    error,
    config,

    // Actions
    fetchRelationships,
    handleAddRelationship,
    handleEditRelationship,
    handleDeleteRelationship,
    resetAndCloseModal,
    openAddModal,
    startEditing,
    cancelEditing,
    updateNewRelationship,
    updateEditingRelationship,
    clearError,
  };
}

export default useTreatmentRelationships;
