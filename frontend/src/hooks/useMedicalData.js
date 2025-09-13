import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from './useApi';
import { apiService } from '../services/api';
import { useCurrentPatient } from './useGlobalData';
import { useAuth } from '../contexts/AuthContext';
import logger from '../services/logger';

export const useMedicalData = config => {
  const {
    entityName,
    apiMethodsConfig,
    requiresPatient = true,
    loadFilesCounts = false,
  } = config;

  const [items, setItems] = useState([]);
  const [filesCounts, setFilesCounts] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const isInitialized = useRef(false);
  const abortControllerRef = useRef(null);

  // Use global patient context instead of managing patient state locally
  const { patient: currentPatient, loading: patientLoading } =
    useCurrentPatient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const currentPatientRef = useRef(currentPatient);
  const { loading, error, execute, clearError, setError, cleanup } = useApi();

  // Refresh data function that uses execute wrapper
  const refreshData = useCallback(async () => {
    // Don't make API calls if user is not authenticated
    if (!isAuthenticated) {
      logger.debug('medical_data_refresh', 'Skipping refresh - user not authenticated', {
        entityName: entityName,
        isAuthenticated
      });
      return null;
    }

    const config = configRef.current;
    const result = await execute(
      async signal => {
        let data = [];
        if (config.requiresPatient && currentPatientRef.current?.id) {
          data = await config.apiMethodsConfig.getByPatient(
            currentPatientRef.current.id,
            signal
          );
        } else if (!config.requiresPatient) {
          data = await config.apiMethodsConfig.getAll(signal);
        }

        if (data) {
          // Extract data array from API response if it's wrapped in a response object
          const extractedData = data?.data || data;
          logger.debug('medical_data_processing', 'Processing API response data', {
            entityName: config.entityName,
            hasRawData: !!data,
            isArray: Array.isArray(extractedData),
            itemCount: extractedData?.length || 0,
            operation: 'refresh'
          });
          logger.debug('medical_data_refresh', 'Setting items for entity', {
            entityName: config.entityName,
            hasRawData: !!data,
            isArray: Array.isArray(extractedData),
            itemCount: extractedData?.length || 0
          });
          setItems(Array.isArray(extractedData) ? extractedData : []);

          if (
            config.loadFilesCounts &&
            extractedData.length <= 20 &&
            config.apiMethodsConfig.getFiles
          ) {
            const counts = {};
            for (const item of extractedData) {
              try {
                const files = await config.apiMethodsConfig.getFiles(
                  item.id,
                  signal
                );
                counts[item.id] = files?.length || 0;
              } catch (error) {
                if (error.name !== 'AbortError') {
                  logger.warn('medical_data_warning', 'Failed to load file count during refresh', {
                    entityName: config.entityName,
                    itemId: item.id,
                    operation: 'refresh_file_count',
                    error: error.message
                  });
                }
                counts[item.id] = 0;
              }
              await new Promise(resolve => setTimeout(resolve, 100));
            }

            setFilesCounts(counts);
          }
        }

        return [];
      },
      { errorMessage: `Failed to refresh ${config.entityName} data` }
    );
    return result;
  }, [execute, isAuthenticated, entityName]);

  // Keep ref in sync with global patient state and force refresh when patient changes
  useEffect(() => {
    const previousPatientId = currentPatientRef.current?.id;
    currentPatientRef.current = currentPatient;
    
    // If patient ID actually changed (not just initial load), force refresh
    if (currentPatient?.id && previousPatientId && currentPatient.id !== previousPatientId) {
      logger.info('medical_data_patient_change', 'Patient changed, refreshing medical data', {
        fromPatientId: previousPatientId,
        toPatientId: currentPatient.id,
        entityName
      });
      refreshData();
    }
  }, [currentPatient?.id, refreshData, entityName]);

  // Create item
  const createItem = useCallback(
    async data => {
      logger.info('medical_data_create', 'Starting entity creation', {
        entityName,
        operation: 'create',
        hasData: !!data
      });

      const result = await execute(
        async signal => {
          logger.info('medical_data_create', 'Calling API create method', {
            entityName,
            operation: 'api_call'
          });
          return await apiMethodsConfig.create(data, signal);
        },
        { errorMessage: `Failed to create ${entityName}` }
      );

      logger.info('medical_data_create', 'Entity creation completed', {
        entityName,
        operation: 'create_complete',
        success: !!result
      });

      if (result) {
        setSuccessMessage(`${entityName} created successfully!`);
        setTimeout(() => setSuccessMessage(''), 3000);
        return result;
      }
      return false;
    },
    [execute, apiMethodsConfig, entityName]
  );

  // Update item
  const updateItem = useCallback(
    async (id, data) => {
      const result = await execute(
        async signal => await apiMethodsConfig.update(id, data, signal),
        { errorMessage: `Failed to update ${entityName}` }
      );

      if (result) {
        // Update local state immediately with the updated item
        setItems(prevItems => 
          prevItems.map(item => 
            item.id === id ? { ...item, ...result } : item
          )
        );
        
        setSuccessMessage(`${entityName} updated successfully!`);
        setTimeout(() => setSuccessMessage(''), 3000);
        return result;
      }
      return false;
    },
    [execute, apiMethodsConfig, entityName]
  );

  // Delete item
  const deleteItem = useCallback(
    async id => {
      if (
        !window.confirm(`Are you sure you want to delete this ${entityName}?`)
      ) {
        return false;
      }

      const result = await execute(
        async signal => {
          // For multi-patient support, pass the current patient ID if available
          if (entityName === 'emergency_contact' && currentPatientRef.current?.id) {
            return await apiMethodsConfig.delete(id, signal, currentPatientRef.current.id);
          }
          return await apiMethodsConfig.delete(id, signal);
        },
        { errorMessage: `Failed to delete ${entityName}` }
      );

      if (result) {
        // Update local state to remove the deleted item
        setItems(prevItems => prevItems.filter(item => item.id !== id));
        
        setSuccessMessage(`${entityName} deleted successfully!`);
        setTimeout(() => setSuccessMessage(''), 3000);
        return result;
      }
      return false;
    },
    [execute, apiMethodsConfig, entityName]
  ); // Store stable references to prevent dependency changes
  const configRef = useRef({
    entityName,
    apiMethodsConfig,
    requiresPatient,
    loadFilesCounts,
  });

  // Update config ref when props change
  useEffect(() => {
    configRef.current = {
      entityName,
      apiMethodsConfig,
      requiresPatient,
      loadFilesCounts,
    };
  }, [entityName, apiMethodsConfig, requiresPatient, loadFilesCounts]);

  // Initialize data - run once on mount or when patient changes
  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const initializeData = async () => {
      // Reset initialization flag when patient changes
      if (currentPatient?.id) {
        isInitialized.current = false;
      }
      
      if (isInitialized.current || !isMounted) return;
      
      // Wait for authentication to complete first
      if (authLoading) {
        logger.debug('medical_data_init', 'Waiting for authentication to complete', {
          entityName: entityName,
          authLoading,
          isAuthenticated
        });
        isInitialized.current = false; // Reset so it can try again when auth completes
        return;
      }
      
      // Check if user is authenticated
      if (!isAuthenticated) {
        logger.debug('medical_data_init', 'User not authenticated, skipping data initialization', {
          entityName: entityName,
          isAuthenticated
        });
        isInitialized.current = false; // Reset so it can try again when user logs in
        return;
      }
      
      // Add small delay to prevent race conditions between multiple hooks
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));

      const config = configRef.current;

      logger.info('medical_data_init', 'Starting data initialization', {
        entityName: config.entityName,
        requiresPatient: config.requiresPatient,
        loadFilesCounts: config.loadFilesCounts,
        patientId: currentPatient?.id,
        isAuthenticated,
        authLoading
      });
      isInitialized.current = true;

      try {
        // Wait for patient data to be available if required
        if (config.requiresPatient) {
          if (!currentPatient?.id) {
            logger.debug('medical_data_init', 'Waiting for patient data to become available', {
              entityName: config.entityName,
              requiresPatient: config.requiresPatient,
              patientAvailable: false
            });
            isInitialized.current = false; // Reset so it can try again when patient loads
            return;
          }
        }

        if (!isMounted) return;

        let data = [];
        if (config.requiresPatient && currentPatient?.id) {
          logger.info('medical_data_init', 'Starting initial fetch with patient', {
            entityName: config.entityName,
            patientId: currentPatient.id
          });
          data = await config.apiMethodsConfig.getByPatient(
            currentPatient.id,
            abortController.signal
          );
          logger.debug('medical_data_init', 'Received initial API response', {
            entityName: config.entityName,
            hasData: !!data,
            dataType: typeof data
          });
        } else if (!config.requiresPatient) {
          logger.info('medical_data_init', 'Starting initial fetch without patient requirement', {
            entityName: config.entityName
          });
          data = await config.apiMethodsConfig.getAll(abortController.signal);
        } else {
          logger.warn('medical_data_init', 'No patient available for initial fetch', {
            entityName: config.entityName,
            hasPatient: !!currentPatient,
            patientId: currentPatient?.id
          });
        }

        if (data && isMounted) {
          // Extract data array from API response if it's wrapped in a response object
          const extractedData = data?.data || data;
          logger.debug('medical_data_processing', 'Processing initial API response data', {
            entityName: config.entityName,
            hasRawData: !!data,
            isArray: Array.isArray(extractedData),
            itemCount: extractedData?.length || 0,
            operation: 'initialization'
          });
          logger.debug('medical_data_init', 'Setting items for entity', {
            entityName: config.entityName,
            hasRawData: !!data,
            isArray: Array.isArray(extractedData),
            itemCount: extractedData?.length || 0
          });
          setItems(Array.isArray(extractedData) ? extractedData : []);

          if (
            config.loadFilesCounts &&
            extractedData.length <= 20 &&
            config.apiMethodsConfig.getFiles
          ) {
            const counts = {};
            for (const item of extractedData) {
              try {
                const files = await config.apiMethodsConfig.getFiles(
                  item.id,
                  abortController.signal
                );
                counts[item.id] = files?.length || 0;
              } catch (error) {
                if (error.name !== 'AbortError') {
                  logger.warn('medical_data_warning', 'Failed to load file count during initialization', {
                    entityName: config.entityName,
                    itemId: item.id,
                    operation: 'load_file_count',
                    error: error.message
                  });
                }
                counts[item.id] = 0;
              }
              await new Promise(resolve => setTimeout(resolve, 100));
            }

            if (isMounted) {
              setFilesCounts(counts);
            }
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError' && isMounted) {
          setError(
            `Failed to load ${config.entityName} data: ${error.message}`
          );
        }
      }
    };

    initializeData();

    return () => {
      isMounted = false;
      isInitialized.current = false;
      abortController.abort();
      cleanup();
    };
  }, [setError, cleanup, currentPatient?.id, isAuthenticated, authLoading]); // Include auth state to reinitialize when auth completes

  return {
    // Data
    items,
    currentPatient,
    filesCounts,

    // State
    loading: loading || patientLoading || authLoading, // Combine API loading, patient loading, and auth loading
    error,
    successMessage,

    // Actions
    createItem,
    updateItem,
    deleteItem,
    refreshData,
    clearError,

    // Utilities
    setSuccessMessage,
    setError,
  };
};
