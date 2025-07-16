import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from './useApi';
import { apiService } from '../services/api';
import { useCurrentPatient } from './useGlobalData';
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
  const currentPatientRef = useRef(currentPatient);
  const { loading, error, execute, clearError, setError, cleanup } = useApi();

  // Refresh data function that uses execute wrapper
  const refreshData = useCallback(async () => {
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
          console.log('Refresh: Setting items for', config.entityName, ':', {
            rawData: data,
            extractedData,
            isArray: Array.isArray(extractedData),
            length: extractedData?.length
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
  }, [execute]);

  // Keep ref in sync with global patient state and force refresh when patient changes
  useEffect(() => {
    const previousPatientId = currentPatientRef.current?.id;
    currentPatientRef.current = currentPatient;
    
    // If patient ID actually changed (not just initial load), force refresh
    if (currentPatient?.id && previousPatientId && currentPatient.id !== previousPatientId) {
      console.log('Patient changed, refreshing medical data:', { 
        from: previousPatientId, 
        to: currentPatient.id,
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
        async signal => await apiMethodsConfig.delete(id, signal),
        { errorMessage: `Failed to delete ${entityName}` }
      );

      if (result) {
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

  // Initialize data - run once on mount
  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const initializeData = async () => {
      if (isInitialized.current || !isMounted) return;

      const config = configRef.current;

      logger.info('medical_data_init', 'Starting data initialization', {
        entityName: config.entityName,
        requiresPatient: config.requiresPatient,
        loadFilesCounts: config.loadFilesCounts
      });
      isInitialized.current = true;

      try {
        // Wait for patient data to be available if required
        if (config.requiresPatient) {
          if (!currentPatient?.id) {
            logger.warn('medical_data_warning', 'Patient data not available for initialization', {
              entityName: config.entityName,
              requiresPatient: config.requiresPatient,
              patientAvailable: false
            });
            return;
          }
        }

        if (!isMounted) return;

        let data = [];
        if (config.requiresPatient && currentPatient?.id) {
          console.log('Initial fetch for', config.entityName, 'with patient ID:', currentPatient.id);
          data = await config.apiMethodsConfig.getByPatient(
            currentPatient.id,
            abortController.signal
          );
          console.log('Initial API response for', config.entityName, ':', data);
        } else if (!config.requiresPatient) {
          console.log('Initial fetch for', config.entityName, '(no patient required)');
          data = await config.apiMethodsConfig.getAll(abortController.signal);
        } else {
          console.log('No patient available for initial', config.entityName, 'fetch, currentPatient:', currentPatient);
        }

        if (data && isMounted) {
          // Extract data array from API response if it's wrapped in a response object
          const extractedData = data?.data || data;
          console.log('Setting items for', config.entityName, ':', {
            rawData: data,
            extractedData,
            isArray: Array.isArray(extractedData),
            length: extractedData?.length
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
  }, [setError, cleanup, currentPatient?.id]); // Include currentPatient.id to reinitialize when patient loads

  return {
    // Data
    items,
    currentPatient,
    filesCounts,

    // State
    loading: loading || patientLoading, // Combine API loading and patient loading
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
