import { useCallback, useEffect, useState } from 'react';
import { useAppData } from '../contexts/AppDataContext';

/**
 * Hook for accessing current patient data with automatic caching
 * @param {boolean} autoFetch - Whether to automatically fetch data on mount
 * @returns {object} Patient data, loading state, error, and refresh function
 */
export function useCurrentPatient(autoFetch = true) {
  const {
    currentPatient,
    patientLoading,
    patientError,
    fetchCurrentPatient,
  } = useAppData();

  const [initialFetchDone, setInitialFetchDone] = useState(false);

  // Auto-fetch patient data on mount if enabled
  useEffect(() => {
    if (autoFetch && !initialFetchDone) {
      fetchCurrentPatient().then(() => {
        setInitialFetchDone(true);
      });
    }
  }, [autoFetch, fetchCurrentPatient, initialFetchDone]);

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
      fetchPractitioners().then(() => {
        setInitialFetchDone(true);
      });
    }
  }, [autoFetch, fetchPractitioners, initialFetchDone]);

  // Refresh function that forces a new fetch
  const refreshPractitioners = useCallback(() => {
    return fetchPractitioners(true);
  }, [fetchPractitioners]);

  return {
    practitioners,
    loading: practitionersLoading,
    error: practitionersError,
    refresh: refreshPractitioners,
    hasData: practitioners.length > 0,
  };
}

/**
 * Hook for accessing pharmacies list with automatic caching
 * @param {boolean} autoFetch - Whether to automatically fetch data on mount
 * @returns {object} Pharmacies data, loading state, error, and refresh function
 */
export function usePharmacies(autoFetch = true) {
  const {
    pharmacies,
    pharmaciesLoading,
    pharmaciesError,
    fetchPharmacies,
  } = useAppData();

  const [initialFetchDone, setInitialFetchDone] = useState(false);

  // Auto-fetch pharmacies data on mount if enabled
  useEffect(() => {
    if (autoFetch && !initialFetchDone) {
      fetchPharmacies().then(() => {
        setInitialFetchDone(true);
      });
    }
  }, [autoFetch, fetchPharmacies, initialFetchDone]);

  // Refresh function that forces a new fetch
  const refreshPharmacies = useCallback(() => {
    return fetchPharmacies(true);
  }, [fetchPharmacies]);

  return {
    pharmacies,
    loading: pharmaciesLoading,
    error: pharmaciesError,
    refresh: refreshPharmacies,
    hasData: pharmacies.length > 0,
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
    await Promise.all([
      practitionersData.refresh(),
      pharmaciesData.refresh(),
    ]);
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
    await Promise.all([
      patientData.refresh(),
      staticData.refreshAll(),
    ]);
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
 * Hook for cache management utilities
 * @returns {object} Cache management functions
 */
export function useCacheManager() {
  const { invalidateCache, updateCacheExpiry, isCacheValid } = useAppData();

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

  return {
    invalidateAll,
    invalidatePatient,
    invalidatePractitioners,
    invalidatePharmacies,
    updateCacheExpiry,
    isCacheValid,
  };
} 