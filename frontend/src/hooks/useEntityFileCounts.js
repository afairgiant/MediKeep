import { useState, useEffect, useRef, useCallback } from 'react';
import { apiService } from '../services/api';
import logger from '../services/logger';

/**
 * Custom hook for managing file counts for entity cards.
 * Handles loading file counts for entities, tracking loaded IDs to prevent
 * duplicate API calls, and cleanup when entities are deleted.
 *
 * @param {string} entityType - The entity type string (e.g., 'allergy', 'condition', 'medication')
 * @param {Array} entities - The array of entities to load file counts for
 * @returns {Object} - { fileCounts, fileCountsLoading, cleanupFileCount }
 */
export function useEntityFileCounts(entityType, entities) {
  const [fileCounts, setFileCounts] = useState({});
  const [fileCountsLoading, setFileCountsLoading] = useState({});
  const loadedFileCountsRef = useRef(new Set());

  // Load file counts for entities that haven't been loaded yet
  useEffect(() => {
    async function loadFileCounts() {
      if (!entities || entities.length === 0) return;

      // Only load file counts for entities we haven't loaded yet
      const entitiesToLoad = entities.filter(
        entity => !loadedFileCountsRef.current.has(entity.id)
      );

      if (entitiesToLoad.length === 0) return;

      const countPromises = entitiesToLoad.map(async entity => {
        loadedFileCountsRef.current.add(entity.id);
        setFileCountsLoading(prev => ({ ...prev, [entity.id]: true }));

        try {
          const files = await apiService.getEntityFiles(entityType, entity.id);
          const count = Array.isArray(files) ? files.length : 0;
          setFileCounts(prev => ({ ...prev, [entity.id]: count }));
        } catch (error) {
          logger.error(`Error loading file count for ${entityType} ${entity.id}:`, error);
          setFileCounts(prev => ({ ...prev, [entity.id]: 0 }));
        } finally {
          setFileCountsLoading(prev => ({ ...prev, [entity.id]: false }));
        }
      });

      await Promise.all(countPromises);
    }

    loadFileCounts();
  }, [entityType, entities]);

  /**
   * Clean up file count state when an entity is deleted.
   * Call this function after successfully deleting an entity.
   *
   * @param {number|string} entityId - The ID of the deleted entity
   */
  const cleanupFileCount = useCallback(entityId => {
    setFileCounts(prev => {
      const updated = { ...prev };
      delete updated[entityId];
      return updated;
    });
    setFileCountsLoading(prev => {
      const updated = { ...prev };
      delete updated[entityId];
      return updated;
    });
    loadedFileCountsRef.current.delete(entityId);
  }, []);

  /**
   * Refresh the file count for a specific entity.
   * Useful after uploading files or closing a view modal.
   *
   * @param {number|string} entityId - The ID of the entity to refresh
   */
  const refreshFileCount = useCallback(async entityId => {
    try {
      // Force reload by removing from loaded set
      loadedFileCountsRef.current.delete(entityId);
      setFileCountsLoading(prev => ({ ...prev, [entityId]: true }));

      const files = await apiService.getEntityFiles(entityType, entityId);
      const count = Array.isArray(files) ? files.length : 0;

      setFileCounts(prev => ({ ...prev, [entityId]: count }));
      loadedFileCountsRef.current.add(entityId);
    } catch (error) {
      logger.error(`Error refreshing file count for ${entityType} ${entityId}:`, error);
      setFileCounts(prev => ({ ...prev, [entityId]: 0 }));
      loadedFileCountsRef.current.add(entityId);
    } finally {
      setFileCountsLoading(prev => ({ ...prev, [entityId]: false }));
    }
  }, [entityType]);

  return {
    fileCounts,
    fileCountsLoading,
    cleanupFileCount,
    refreshFileCount,
  };
}

export default useEntityFileCounts;
