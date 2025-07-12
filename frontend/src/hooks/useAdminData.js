import { useState, useEffect, useCallback, useRef } from 'react';
import { useApi } from './useApi';
import logger from '../services/logger';

export const useAdminData = config => {
  const {
    entityName,
    apiMethodsConfig,
    autoRefresh = false,
    refreshInterval = 30000, // 30 seconds default
  } = config;

  const [data, setData] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const isInitialized = useRef(false);
  const refreshIntervalRef = useRef(null);
  const abortControllerRef = useRef(null);

  const { loading, error, execute, clearError, setError, cleanup } = useApi();

  // Store stable references to prevent dependency changes
  const configRef = useRef({
    entityName,
    apiMethodsConfig,
    autoRefresh,
    refreshInterval,
  });

  // Update config ref when props change
  useEffect(() => {
    configRef.current = {
      entityName,
      apiMethodsConfig,
      autoRefresh,
      refreshInterval,
    };
  }, [entityName, apiMethodsConfig, autoRefresh, refreshInterval]);

  // Load data function
  const loadData = useCallback(
    async (silent = false) => {
      const config = configRef.current;

      const result = await execute(
        async signal => {
          logger.info('Loading admin data', {
            category: 'admin_data_load',
            entityName: config.entityName,
            operation: 'load_start'
          });
          const response = await config.apiMethodsConfig.load(signal);

          if (response) {
            setData(response);
            logger.info('Admin data loaded successfully', {
              category: 'admin_data_load',
              entityName: config.entityName,
              operation: 'load_success',
              dataCount: Array.isArray(response) ? response.length : 1
            });
          }

          return response;
        },
        {
          errorMessage: `Failed to load ${config.entityName} data`,
          silent,
        }
      );

      return result;
    },
    [execute]
  );

  // Create item (for admin operations like creating users, backups, etc.)
  const createItem = useCallback(
    async itemData => {
      const config = configRef.current;

      logger.info('Creating admin entity', {
        category: 'admin_data_create',
        entityName: config.entityName,
        operation: 'create_start',
        itemData: typeof itemData === 'object' ? Object.keys(itemData) : itemData
      });

      const result = await execute(
        async signal => {
          logger.debug('Calling API create method', {
            category: 'admin_data_create',
            entityName: config.entityName,
            operation: 'api_call'
          });
          return await config.apiMethodsConfig.create(itemData, signal);
        },
        { errorMessage: `Failed to create ${config.entityName}` }
      );

      logger.info('Admin entity created successfully', {
        category: 'admin_data_create',
        entityName: config.entityName,
        operation: 'create_success',
        result: typeof result === 'object' && result ? Object.keys(result) : !!result
      });

      if (result) {
        setSuccessMessage(`${config.entityName} created successfully!`);
        setTimeout(() => setSuccessMessage(''), 3000);
        return true;
      }
      return false;
    },
    [execute]
  );

  // Update item
  const updateItem = useCallback(
    async (id, itemData) => {
      const config = configRef.current;

      const result = await execute(
        async signal =>
          await config.apiMethodsConfig.update(id, itemData, signal),
        { errorMessage: `Failed to update ${config.entityName}` }
      );

      if (result) {
        setSuccessMessage(`${config.entityName} updated successfully!`);
        setTimeout(() => setSuccessMessage(''), 3000);
        return true;
      }
      return false;
    },
    [execute]
  );

  // Delete item
  const deleteItem = useCallback(
    async id => {
      const config = configRef.current;

      if (
        !window.confirm(
          `Are you sure you want to delete this ${config.entityName}?`
        )
      ) {
        return false;
      }

      const result = await execute(
        async signal => await config.apiMethodsConfig.delete(id, signal),
        { errorMessage: `Failed to delete ${config.entityName}` }
      );

      if (result) {
        setSuccessMessage(`${config.entityName} deleted successfully!`);
        setTimeout(() => setSuccessMessage(''), 3000);
        return true;
      }
      return false;
    },
    [execute]
  );

  // Execute action (for admin operations like backups, cleanup, etc.)
  const executeAction = useCallback(
    async (actionName, actionData = null) => {
      const config = configRef.current;

      logger.info('Executing admin action', {
        category: 'admin_data_action',
        entityName: config.entityName,
        actionName,
        operation: 'action_start',
        hasActionData: !!actionData
      });

      const result = await execute(
        async signal => {
          const actionMethod = config.apiMethodsConfig[actionName];
          if (!actionMethod) {
            throw new Error(
              `Action '${actionName}' not found in API configuration`
            );
          }

          return actionData
            ? await actionMethod(actionData, signal)
            : await actionMethod(signal);
        },
        { errorMessage: `Failed to execute ${actionName}` }
      );

      if (result) {
        setSuccessMessage(`${actionName} completed successfully!`);
        setTimeout(() => setSuccessMessage(''), 3000);
        return result;
      }
      return false;
    },
    [execute]
  );

  // Initialize data - run once on mount
  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const initializeData = async () => {
      if (isInitialized.current || !isMounted) return;

      logger.info('Initializing admin data', {
        category: 'admin_data_init',
        entityName: configRef.current.entityName,
        operation: 'init_start'
      });
      isInitialized.current = true;

      try {
        await loadData();
      } catch (error) {
        if (error.name !== 'AbortError' && isMounted) {
          logger.error('Error initializing admin data', {
            category: 'admin_data_error',
            entityName: configRef.current.entityName,
            operation: 'init_error',
            error: error.message,
            stack: error.stack
          });
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
  }, [loadData, cleanup]);

  // Auto-refresh setup
  useEffect(() => {
    const config = configRef.current;

    if (config.autoRefresh && config.refreshInterval > 0) {
      logger.info('Setting up auto-refresh for admin data', {
        category: 'admin_data_init',
        entityName: config.entityName,
        operation: 'auto_refresh_setup',
        refreshInterval: config.refreshInterval
      });

      refreshIntervalRef.current = setInterval(() => {
        loadData(true); // Silent refresh
      }, config.refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      };
    }
  }, [loadData]);

  // Refresh data function (alias for loadData)
  const refreshData = useCallback(
    async (silent = false) => {
      return await loadData(silent);
    },
    [loadData]
  );

  return {
    // Data
    data,

    // State
    loading,
    error,
    successMessage,

    // Actions
    loadData,
    refreshData,
    createItem,
    updateItem,
    deleteItem,
    executeAction,
    clearError,

    // Utilities
    setSuccessMessage,
    setError,
  };
};
