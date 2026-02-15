import { useCallback, useEffect, useState } from 'react';
import { useAppData } from '../contexts/AppDataContext';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import logger from '../services/logger';

/**
 * Hook for accessing current patient data with automatic caching
 * @param {boolean} autoFetch - Whether to automatically fetch data on mount
 * @returns {object} Patient data, loading state, error, and refresh function
 */
export function useCurrentPatient(autoFetch = true) {
  const { currentPatient, patientLoading, patientError, fetchCurrentPatient } =
    useAppData();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [initialFetchDone, setInitialFetchDone] = useState(false);

  // Auto-fetch patient data on mount if enabled
  useEffect(() => {
    if (autoFetch && !initialFetchDone && isAuthenticated && !authLoading) {
      logger.debug('useCurrentPatient auto-fetch starting', {
        component: 'useCurrentPatient',
        autoFetch,
        initialFetchDone,
        isAuthenticated,
        authLoading,
        timestamp: new Date().toISOString()
      });
      
      fetchCurrentPatient().then(() => {
        setInitialFetchDone(true);
      }).catch(error => {
        logger.warn('useCurrentPatient auto-fetch failed', {
          component: 'useCurrentPatient',
          error: error.message,
          isAuthenticated,
          authLoading,
          timestamp: new Date().toISOString()
        });
        setInitialFetchDone(true); // Mark as done to prevent infinite retries
      });
    } else if (!isAuthenticated || authLoading) {
      // Reset fetch status when auth state changes
      setInitialFetchDone(false);
    }
  }, [autoFetch, fetchCurrentPatient, initialFetchDone, isAuthenticated, authLoading]);

  // Refresh function that forces a new fetch
  const refreshPatient = useCallback(() => {
    return fetchCurrentPatient(true);
  }, [fetchCurrentPatient]);

  return {
    patient: currentPatient,
    loading: patientLoading,
    error: patientError,
    refresh: refreshPatient,
    hasData: !!currentPatient,
  };
}

/**
 * Hook for accessing practitioners list with automatic caching
 * @param {boolean} autoFetch - Whether to automatically fetch data on mount
 * @returns {object} Practitioners data, loading state, error, and refresh function
 */
export function usePractitioners(autoFetch = true) {
  const {
    practitioners,
    practitionersLoading,
    practitionersError,
    fetchPractitioners,
  } = useAppData();

  const [initialFetchDone, setInitialFetchDone] = useState(false);

  // Auto-fetch practitioners data on mount if enabled
  useEffect(() => {
    if (autoFetch && !initialFetchDone) {
      fetchPractitioners()
        .then(() => {
          setInitialFetchDone(true);
        })
        .catch(error => {
          logger.debug('practitioners_initial_fetch_error', 'Error in initial practitioners fetch', {
            error: error.message,
            component: 'useGlobalData'
          });
          setInitialFetchDone(true); // Still mark as done to prevent infinite retries
        });
    }
  }, [autoFetch, fetchPractitioners, initialFetchDone]);

  // Refresh function that forces a new fetch
  const refreshPractitioners = useCallback(() => {
    return fetchPractitioners(true);
  }, [fetchPractitioners]);

  return {
    // Ensure practitioners is always an array to prevent map errors
    practitioners: Array.isArray(practitioners) ? practitioners : [],
    loading: practitionersLoading,
    error: practitionersError,
    refresh: refreshPractitioners,
    hasData: Array.isArray(practitioners) && practitioners.length > 0,
  };
}

/**
 * Hook for accessing practices list with on-demand fetching.
 * Practices are not in the global AppDataContext since they're only needed
 * on the practitioners page and related forms.
 * @param {boolean} autoFetch - Whether to automatically fetch data on mount
 * @returns {object} Practices data, loading state, error, and refresh function
 */
export function usePractices(autoFetch = true) {
  const [practices, setPractices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [initialFetchDone, setInitialFetchDone] = useState(false);

  const fetchPractices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getPractices();
      const safePractices = Array.isArray(data) ? data : [];
      setPractices(safePractices);
      return safePractices;
    } catch (err) {
      logger.debug('practices_fetch_error', 'Error fetching practices', {
        error: err.message,
        component: 'usePractices',
      });
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch && !initialFetchDone) {
      fetchPractices().then(() => {
        setInitialFetchDone(true);
      }).catch(() => {
        setInitialFetchDone(true);
      });
    }
  }, [autoFetch, fetchPractices, initialFetchDone]);

  const refresh = useCallback(() => {
    return fetchPractices();
  }, [fetchPractices]);

  return {
    practices: Array.isArray(practices) ? practices : [],
    loading,
    error,
    refresh,
    hasData: Array.isArray(practices) && practices.length > 0,
  };
}

/**
 * Hook for accessing pharmacies list with automatic caching
 * @param {boolean} autoFetch - Whether to automatically fetch data on mount
 * @returns {object} Pharmacies data, loading state, error, and refresh function
 */
export function usePharmacies(autoFetch = true) {
  const { pharmacies, pharmaciesLoading, pharmaciesError, fetchPharmacies } =
    useAppData();

  const [initialFetchDone, setInitialFetchDone] = useState(false);

  // Auto-fetch pharmacies data on mount if enabled
  useEffect(() => {
    if (autoFetch && !initialFetchDone) {
      fetchPharmacies()
        .then(() => {
          setInitialFetchDone(true);
        })
        .catch(error => {
          logger.debug('pharmacies_initial_fetch_error', 'Error in initial pharmacy fetch', {
            error: error.message,
            component: 'useGlobalData'
          });
          setInitialFetchDone(true); // Still mark as done to prevent infinite retries
        });
    }
  }, [autoFetch, fetchPharmacies, initialFetchDone]);

  // Refresh function that forces a new fetch
  const refreshPharmacies = useCallback(() => {
    return fetchPharmacies(true);
  }, [fetchPharmacies]);

  return {
    // Ensure pharmacies is always an array to prevent map errors
    pharmacies: Array.isArray(pharmacies) ? pharmacies : [],
    loading: pharmaciesLoading,
    error: pharmaciesError,
    refresh: refreshPharmacies,
    hasData: Array.isArray(pharmacies) && pharmacies.length > 0,
  };
}

/**
 * Hook for accessing all static data (practitioners and pharmacies) at once
 * @param {boolean} autoFetch - Whether to automatically fetch data on mount
 * @returns {object} Combined static data with loading states and refresh functions
 */
export function useStaticData(autoFetch = true) {
  const practitionersData = usePractitioners(autoFetch);
  const pharmaciesData = usePharmacies(autoFetch);

  const refreshAll = useCallback(async () => {
    await Promise.all([practitionersData.refresh(), pharmaciesData.refresh()]);
  }, [practitionersData.refresh, pharmaciesData.refresh]);

  return {
    practitioners: practitionersData,
    pharmacies: pharmaciesData,
    loading: practitionersData.loading || pharmaciesData.loading,
    hasErrors: !!(practitionersData.error || pharmaciesData.error),
    errors: {
      practitioners: practitionersData.error,
      pharmacies: pharmaciesData.error,
    },
    refreshAll,
  };
}

/**
 * Hook for accessing patient data with all static data
 * This is perfect for pages that need both patient and static data
 * @param {boolean} autoFetch - Whether to automatically fetch data on mount
 * @returns {object} Combined patient and static data
 */
export function usePatientWithStaticData(autoFetch = true) {
  const patientData = useCurrentPatient(autoFetch);
  const staticData = useStaticData(autoFetch);

  const refreshAll = useCallback(async () => {
    await Promise.all([patientData.refresh(), staticData.refreshAll()]);
  }, [patientData.refresh, staticData.refreshAll]);

  return {
    patient: patientData,
    practitioners: staticData.practitioners,
    pharmacies: staticData.pharmacies,
    loading: patientData.loading || staticData.loading,
    hasErrors: !!(patientData.error || staticData.hasErrors),
    errors: {
      patient: patientData.error,
      ...staticData.errors,
    },
    refreshAll,
  };
}

/**
 * Hook for accessing patient list with automatic caching
 * @param {boolean} autoFetch - Whether to automatically fetch data on mount
 * @returns {object} Patient list data, loading state, error, and refresh function
 */
export function usePatientList(autoFetch = true) {
  const {
    patientList,
    patientListLoading,
    patientListError,
    fetchPatientList,
  } = useAppData();

  const [initialFetchDone, setInitialFetchDone] = useState(false);

  // Auto-fetch patient list data on mount if enabled
  useEffect(() => {
    if (autoFetch && !initialFetchDone) {
      fetchPatientList()
        .then(() => {
          setInitialFetchDone(true);
        })
        .catch(error => {
          logger.debug('patient_list_initial_fetch_error', 'Error in initial patient list fetch', {
            error: error.message,
            component: 'useGlobalData'
          });
          setInitialFetchDone(true); // Still mark as done to prevent infinite retries
        });
    }
  }, [autoFetch, fetchPatientList, initialFetchDone]);

  // Refresh function that forces a new fetch
  const refreshPatientList = useCallback(() => {
    return fetchPatientList(true);
  }, [fetchPatientList]);

  return {
    // Ensure patientList is always an array to prevent map errors
    patientList: Array.isArray(patientList) ? patientList : [],
    loading: patientListLoading,
    error: patientListError,
    refresh: refreshPatientList,
    hasData: Array.isArray(patientList) && patientList.length > 0,
  };
}

/**
 * Hook for cache management utilities
 * @returns {object} Cache management functions
 */
export function useCacheManager() {
  const {
    invalidateCache,
    updateCacheExpiry,
    isCacheValid,
    fetchPharmacies,
    fetchPractitioners,
    fetchCurrentPatient,
    fetchPatientList,
    setCurrentPatient,
  } = useAppData();

  const invalidateAll = useCallback(() => {
    return invalidateCache('all');
  }, [invalidateCache]);

  const invalidatePatient = useCallback(() => {
    return invalidateCache('patient');
  }, [invalidateCache]);

  const invalidatePractitioners = useCallback(() => {
    return invalidateCache('practitioners');
  }, [invalidateCache]);

  const invalidatePharmacies = useCallback(() => {
    return invalidateCache('pharmacies');
  }, [invalidateCache]);

  const invalidatePatientList = useCallback(() => {
    return invalidateCache('patientList');
  }, [invalidateCache]);

  const refreshPharmacies = useCallback(() => {
    return fetchPharmacies(true);
  }, [fetchPharmacies]);

  const refreshPractitioners = useCallback(() => {
    return fetchPractitioners(true);
  }, [fetchPractitioners]);

  const refreshPatient = useCallback(() => {
    return fetchCurrentPatient(true);
  }, [fetchCurrentPatient]);

  const refreshPatientList = useCallback(() => {
    return fetchPatientList(true);
  }, [fetchPatientList]);

  return {
    invalidateAll,
    invalidatePatient,
    invalidatePractitioners,
    invalidatePharmacies,
    invalidatePatientList,
    refreshPharmacies,
    refreshPractitioners,
    refreshPatient,
    refreshPatientList,
    setCurrentPatient,
    updateCacheExpiry,
    isCacheValid,
  };
}
