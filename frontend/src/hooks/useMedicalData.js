import { useState, useEffect, useCallback } from 'react';
import { useApi } from './useApi';
import { apiMethods } from '../config/apiMethods';

export const useMedicalData = (config) => {
  const {
    entityName,
    apiMethodsConfig,
    requiresPatient = true,
    loadFilesCounts = false
  } = config;

  const [items, setItems] = useState([]);
  const [currentPatient, setCurrentPatient] = useState(null);
  const [filesCounts, setFilesCounts] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  
  const { loading, error, execute, clearError, setError, cleanup } = useApi();
  
  // Fetch current patient
  const fetchCurrentPatient = useCallback(async () => {
    if (!requiresPatient) return null;
    
    console.log('Fetching current patient...');
    
    const result = await execute(
      async (signal) => {
        const patient = await apiMethods.patients.getCurrent(signal);
        console.log('Patient API response:', patient);
        return patient;
      },
      { errorMessage: 'Failed to load patient data' }
    );
    
    console.log('fetchCurrentPatient result:', result);
    return result;
  }, [execute, requiresPatient]);

  // Fetch main data
  const fetchData = useCallback(async (patientId = null) => {
    const patient = patientId || currentPatient?.id;
    
    console.log(`Fetching ${entityName} data for patient:`, patient);
    
    return await execute(
      async (signal) => {
        if (requiresPatient && patient) {
          return await apiMethodsConfig.getByPatient(patient, signal);
        } else if (!requiresPatient) {
          return await apiMethodsConfig.getAll(signal);
        }
        return [];
      },
      { errorMessage: `Failed to load ${entityName} data` }
    );
  }, [execute, currentPatient?.id, requiresPatient, apiMethodsConfig, entityName]);

  // Load file counts (for entities that support files)
  const loadFilesCountsData = useCallback(async (itemsList) => {
    if (!loadFilesCounts || !itemsList?.length || !apiMethodsConfig.getFiles) return;

    const counts = {};
    
    for (const item of itemsList) {
      try {
        const files = await execute(
          async (signal) => await apiMethodsConfig.getFiles(item.id, signal)
        );
        counts[item.id] = files?.length || 0;
      } catch (error) {
        console.warn(`Failed to load file count for ${entityName} ${item.id}:`, error);
        counts[item.id] = 0;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    setFilesCounts(counts);
  }, [loadFilesCounts, apiMethodsConfig, entityName, execute]);

  // Create item
  const createItem = useCallback(async (data) => {
    const result = await execute(
      async (signal) => await apiMethodsConfig.create(data, signal),
      { errorMessage: `Failed to create ${entityName}` }
    );
    
    if (result) {
      setSuccessMessage(`${entityName} created successfully!`);
      setTimeout(() => setSuccessMessage(''), 3000);
      return true;
    }
    return false;
  }, [execute, apiMethodsConfig, entityName]);

  // Update item
  const updateItem = useCallback(async (id, data) => {
    const result = await execute(
      async (signal) => await apiMethodsConfig.update(id, data, signal),
      { errorMessage: `Failed to update ${entityName}` }
    );
    
    if (result) {
      setSuccessMessage(`${entityName} updated successfully!`);
      setTimeout(() => setSuccessMessage(''), 3000);
      return true;
    }
    return false;
  }, [execute, apiMethodsConfig, entityName]);

  // Delete item
  const deleteItem = useCallback(async (id) => {
    if (!window.confirm(`Are you sure you want to delete this ${entityName}?`)) {
      return false;
    }

    const result = await execute(
      async (signal) => await apiMethodsConfig.delete(id, signal),
      { errorMessage: `Failed to delete ${entityName}` }
    );
    
    if (result) {
      setSuccessMessage(`${entityName} deleted successfully!`);
      setTimeout(() => setSuccessMessage(''), 3000);
      return true;
    }
    return false;
  }, [execute, apiMethodsConfig, entityName]);

  // Initialize data
  const initializeData = useCallback(async () => {
    console.log('Initializing data...');
    let patient = currentPatient;
    
    if (requiresPatient && !patient) {
      patient = await fetchCurrentPatient();
      if (patient) {
        console.log('Setting currentPatient:', patient);
        setCurrentPatient(patient);
      } else {
        console.warn('No patient data received');
        return;
      }
    }
    
    const data = await fetchData(patient?.id);
    if (data) {
      setItems(data);
      
      if (loadFilesCounts && data.length <= 20) {
        await loadFilesCountsData(data);
      }
    }
  }, [currentPatient, requiresPatient, fetchCurrentPatient, fetchData, loadFilesCounts, loadFilesCountsData]);

  // Refresh data
  const refreshData = useCallback(async () => {
    const data = await fetchData();
    if (data) {
      setItems(data);
      
      if (loadFilesCounts && data.length <= 20) {
        await loadFilesCountsData(data);
      }
    }
  }, [fetchData, loadFilesCounts, loadFilesCountsData]);

  useEffect(() => {
    initializeData();
    
    return cleanup;
  }, [initializeData, cleanup]);

  return {
    // Data
    items,
    currentPatient,
    filesCounts,
    
    // State
    loading,
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
    setError
  };
};