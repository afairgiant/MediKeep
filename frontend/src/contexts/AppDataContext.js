import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { apiService } from '../services/api';
import patientApi from '../services/api/patientApi';
import { useAuth } from './AuthContext';
import { toast } from 'react-toastify';
import logger from '../services/logger';

// Initial state for application data
const initialState = {
  // Patient data
  currentPatient: null,
  patientLoading: false,
  patientError: null,
  patientLastFetch: null,

  // Static lists (cached for better performance)
  practitioners: [],
  practitionersLoading: false,
  practitionersError: null,
  practitionersLastFetch: null,

  pharmacies: [],
  pharmaciesLoading: false,
  pharmaciesError: null,
  pharmaciesLastFetch: null,

  // Cache expiry times (in minutes)
  cacheExpiry: {
    patient: 15, // Patient data expires after 15 minutes
    practitioners: 60, // Practitioners list expires after 1 hour
    pharmacies: 60, // Pharmacies list expires after 1 hour
  },
};

// Action types
const APP_DATA_ACTIONS = {
  // Patient actions
  SET_PATIENT_LOADING: 'SET_PATIENT_LOADING',
  SET_PATIENT_SUCCESS: 'SET_PATIENT_SUCCESS',
  SET_PATIENT_ERROR: 'SET_PATIENT_ERROR',
  CLEAR_PATIENT: 'CLEAR_PATIENT',

  // Practitioners actions
  SET_PRACTITIONERS_LOADING: 'SET_PRACTITIONERS_LOADING',
  SET_PRACTITIONERS_SUCCESS: 'SET_PRACTITIONERS_SUCCESS',
  SET_PRACTITIONERS_ERROR: 'SET_PRACTITIONERS_ERROR',

  // Pharmacies actions
  SET_PHARMACIES_LOADING: 'SET_PHARMACIES_LOADING',
  SET_PHARMACIES_SUCCESS: 'SET_PHARMACIES_SUCCESS',
  SET_PHARMACIES_ERROR: 'SET_PHARMACIES_ERROR',

  // General actions
  CLEAR_ALL_DATA: 'CLEAR_ALL_DATA',
  UPDATE_CACHE_EXPIRY: 'UPDATE_CACHE_EXPIRY',
};

// Reducer function
function appDataReducer(state, action) {
  switch (action.type) {
    // Patient actions
    case APP_DATA_ACTIONS.SET_PATIENT_LOADING:
      return {
        ...state,
        patientLoading: action.payload,
        patientError: action.payload ? null : state.patientError,
      };

    case APP_DATA_ACTIONS.SET_PATIENT_SUCCESS:
      return {
        ...state,
        currentPatient: action.payload,
        patientLoading: false,
        patientError: null,
        patientLastFetch: Date.now(),
      };

    case APP_DATA_ACTIONS.SET_PATIENT_ERROR:
      return {
        ...state,
        patientError: action.payload,
        patientLoading: false,
      };

    case APP_DATA_ACTIONS.CLEAR_PATIENT:
      return {
        ...state,
        currentPatient: null,
        patientError: null,
        patientLastFetch: null,
      };

    // Practitioners actions
    case APP_DATA_ACTIONS.SET_PRACTITIONERS_LOADING:
      return {
        ...state,
        practitionersLoading: action.payload,
        practitionersError: action.payload ? null : state.practitionersError,
      };

    case APP_DATA_ACTIONS.SET_PRACTITIONERS_SUCCESS:
      return {
        ...state,
        practitioners: action.payload,
        practitionersLoading: false,
        practitionersError: null,
        practitionersLastFetch: Date.now(),
      };

    case APP_DATA_ACTIONS.SET_PRACTITIONERS_ERROR:
      return {
        ...state,
        practitionersError: action.payload,
        practitionersLoading: false,
      };

    // Pharmacies actions
    case APP_DATA_ACTIONS.SET_PHARMACIES_LOADING:
      return {
        ...state,
        pharmaciesLoading: action.payload,
        pharmaciesError: action.payload ? null : state.pharmaciesError,
      };

    case APP_DATA_ACTIONS.SET_PHARMACIES_SUCCESS:
      return {
        ...state,
        pharmacies: action.payload,
        pharmaciesLoading: false,
        pharmaciesError: null,
        pharmaciesLastFetch: Date.now(),
      };

    case APP_DATA_ACTIONS.SET_PHARMACIES_ERROR:
      return {
        ...state,
        pharmaciesError: action.payload,
        pharmaciesLoading: false,
      };

    // General actions
    case APP_DATA_ACTIONS.CLEAR_ALL_DATA:
      return {
        ...initialState,
        cacheExpiry: state.cacheExpiry, // Preserve cache expiry settings
      };

    case APP_DATA_ACTIONS.UPDATE_CACHE_EXPIRY:
      return {
        ...state,
        cacheExpiry: { ...state.cacheExpiry, ...action.payload },
      };

    default:
      return state;
  }
}

// Create context
const AppDataContext = createContext(null);

// App Data Provider Component
export function AppDataProvider({ children }) {
  const [state, dispatch] = useReducer(appDataReducer, initialState);
  const { isAuthenticated, user } = useAuth();

  // Use ref to access current state without dependency loops
  const stateRef = useRef(state);
  stateRef.current = state;

  // Helper function to check if cached data is still valid
  const isCacheValid = useCallback(
    (lastFetch, cacheKey) => {
      if (!lastFetch) return false;
      const expiryTime = state.cacheExpiry[cacheKey] * 60 * 1000; // Convert minutes to milliseconds
      return Date.now() - lastFetch < expiryTime;
    },
    [state.cacheExpiry]
  );

  // Fetch current patient data
  const fetchCurrentPatient = useCallback(
    async (forceRefresh = false) => {
      // Don't fetch if not authenticated
      if (!isAuthenticated) {
        dispatch({ type: APP_DATA_ACTIONS.CLEAR_PATIENT });
        return null;
      }

      // Check if we have valid cached data and don't force refresh
      if (
        !forceRefresh &&
        stateRef.current.currentPatient &&
        isCacheValid(stateRef.current.patientLastFetch, 'patient')
      ) {
        return stateRef.current.currentPatient;
      }

      try {
        dispatch({ type: APP_DATA_ACTIONS.SET_PATIENT_LOADING, payload: true });
        
        // Use Phase 1 API to get the active patient instead of just /patients/me
        try {
          const activePatientData = await patientApi.getActivePatient();
          if (activePatientData) {
            dispatch({
              type: APP_DATA_ACTIONS.SET_PATIENT_SUCCESS,
              payload: activePatientData,
            });
            return activePatientData;
          }
        } catch (e) {
          // Fall back to old API if Phase 1 fails
          console.warn('Phase 1 active patient API failed, falling back to /patients/me', e);
        }
        
        // Fallback to original API
        const patient = await apiService.getCurrentPatient();
        dispatch({
          type: APP_DATA_ACTIONS.SET_PATIENT_SUCCESS,
          payload: patient,
        });
        return patient;
      } catch (error) {
        logger.error('Failed to fetch current patient data', {
          category: 'app_data_fetch_error',
          entityType: 'patient',
          error: error.message,
          stack: error.stack,
          userId: user?.id,
          timestamp: new Date().toISOString()
        });
        dispatch({
          type: APP_DATA_ACTIONS.SET_PATIENT_ERROR,
          payload: error.message,
        });
        return null;
      }
    },
    [isCacheValid, isAuthenticated]
  );

  // Fetch practitioners list
  const fetchPractitioners = useCallback(
    async (forceRefresh = false) => {
      // Check if we have valid cached data and don't force refresh
      if (
        !forceRefresh &&
        stateRef.current.practitioners.length > 0 &&
        isCacheValid(stateRef.current.practitionersLastFetch, 'practitioners')
      ) {
        return stateRef.current.practitioners;
      }

      try {
        dispatch({
          type: APP_DATA_ACTIONS.SET_PRACTITIONERS_LOADING,
          payload: true,
        });
        const practitioners = await apiService.getPractitioners();

        // Ensure we always have an array, even if API returns null/undefined
        const safePractitioners = Array.isArray(practitioners)
          ? practitioners
          : [];

        dispatch({
          type: APP_DATA_ACTIONS.SET_PRACTITIONERS_SUCCESS,
          payload: safePractitioners,
        });
        return safePractitioners;
      } catch (error) {
        logger.error('Failed to fetch practitioners data', {
          category: 'app_data_fetch_error',
          entityType: 'practitioners',
          error: error.message,
          stack: error.stack,
          cachedCount: stateRef.current.practitioners?.length || 0,
          timestamp: new Date().toISOString()
        });
        dispatch({
          type: APP_DATA_ACTIONS.SET_PRACTITIONERS_ERROR,
          payload: error.message,
        });

        // Return existing data if available, otherwise empty array
        return Array.isArray(stateRef.current.practitioners)
          ? stateRef.current.practitioners
          : [];
      }
    },
    [isCacheValid]
  );

  // Fetch pharmacies list
  const fetchPharmacies = useCallback(
    async (forceRefresh = false) => {
      // Check if we have valid cached data and don't force refresh
      if (
        !forceRefresh &&
        stateRef.current.pharmacies.length > 0 &&
        isCacheValid(stateRef.current.pharmaciesLastFetch, 'pharmacies')
      ) {
        return stateRef.current.pharmacies;
      }

      try {
        dispatch({
          type: APP_DATA_ACTIONS.SET_PHARMACIES_LOADING,
          payload: true,
        });
        const pharmacies = await apiService.getPharmacies();

        // Ensure we always have an array, even if API returns null/undefined
        const safePharmacies = Array.isArray(pharmacies) ? pharmacies : [];

        dispatch({
          type: APP_DATA_ACTIONS.SET_PHARMACIES_SUCCESS,
          payload: safePharmacies,
        });
        return safePharmacies;
      } catch (error) {
        logger.error('Failed to fetch pharmacies data', {
          category: 'app_data_fetch_error',
          entityType: 'pharmacies',
          error: error.message,
          stack: error.stack,
          cachedCount: stateRef.current.pharmacies?.length || 0,
          timestamp: new Date().toISOString()
        });
        dispatch({
          type: APP_DATA_ACTIONS.SET_PHARMACIES_ERROR,
          payload: error.message,
        });

        // Return existing data if available, otherwise empty array
        return Array.isArray(stateRef.current.pharmacies)
          ? stateRef.current.pharmacies
          : [];
      }
    },
    [isCacheValid]
  );

  // Initialize app data when user logs in
  useEffect(() => {
    if (isAuthenticated && user) {
      // Clear cache and fetch fresh data on login
      dispatch({ type: APP_DATA_ACTIONS.CLEAR_ALL_DATA });
      
      // Add timeout to prevent rapid fire requests in production
      const timeoutId = setTimeout(
        () => {
          // Fetch fresh patient data immediately on login
          fetchCurrentPatient(true);

          // Fetch fresh static lists in parallel
          Promise.all([fetchPractitioners(true), fetchPharmacies(true)]).catch(
            error => {
              logger.error('Failed to initialize application data', {
                category: 'app_data_init_error',
                error: error.message,
                stack: error.stack,
                userId: user?.id,
                isAuthenticated,
                timestamp: new Date().toISOString()
              });
            }
          );
        },
        process.env.NODE_ENV === 'production' ? 100 : 0
      ); // Small delay in production

      return () => clearTimeout(timeoutId);
    } else {
      // Clear all data when user logs out
      dispatch({ type: APP_DATA_ACTIONS.CLEAR_ALL_DATA });
    }
  }, [
    isAuthenticated,
    user,
    fetchCurrentPatient,
    fetchPractitioners,
    fetchPharmacies,
  ]);

  // Update patient data (after patient profile changes)
  const updatePatientData = useCallback(async updatedPatient => {
    dispatch({
      type: APP_DATA_ACTIONS.SET_PATIENT_SUCCESS,
      payload: updatedPatient,
    });
  }, []);

  // Set current patient to a specific patient (Phase 1 support)
  const setCurrentPatient = useCallback(async (patient) => {
    if (patient) {
      dispatch({
        type: APP_DATA_ACTIONS.SET_PATIENT_SUCCESS,
        payload: patient,
      });
      logger.debug('Current patient context updated', {
        category: 'app_data_patient_switch',
        patientId: patient.id,
        patientName: `${patient.first_name} ${patient.last_name}`,
        timestamp: new Date().toISOString()
      });
    } else {
      dispatch({ type: APP_DATA_ACTIONS.CLEAR_PATIENT });
    }
  }, []);

  // Invalidate specific cache
  const invalidateCache = useCallback(
    async cacheType => {
      switch (cacheType) {
        case 'patient':
          await fetchCurrentPatient(true);
          break;
        case 'practitioners':
          await fetchPractitioners(true);
          break;
        case 'pharmacies':
          await fetchPharmacies(true);
          break;
        case 'all':
          dispatch({ type: APP_DATA_ACTIONS.CLEAR_ALL_DATA });
          if (isAuthenticated) {
            await Promise.all([
              fetchCurrentPatient(true),
              fetchPractitioners(true),
              fetchPharmacies(true),
            ]);
          }
          break;
        default:
          logger.warn('Unknown cache type specified', {
            category: 'app_data_cache_warning',
            cacheType,
            validTypes: ['patient', 'practitioners', 'pharmacies', 'all'],
            timestamp: new Date().toISOString()
          });
      }
    },
    [fetchCurrentPatient, fetchPractitioners, fetchPharmacies, isAuthenticated]
  );

  // Update cache expiry settings
  const updateCacheExpiry = useCallback(newSettings => {
    dispatch({
      type: APP_DATA_ACTIONS.UPDATE_CACHE_EXPIRY,
      payload: newSettings,
    });
  }, []);

  // Context value
  const contextValue = {
    // State
    ...state,

    // Actions
    fetchCurrentPatient,
    fetchPractitioners,
    fetchPharmacies,
    updatePatientData,
    setCurrentPatient,
    invalidateCache,
    updateCacheExpiry,

    // Helpers
    isCacheValid: (lastFetch, cacheKey) => isCacheValid(lastFetch, cacheKey),
  };

  return (
    <AppDataContext.Provider value={contextValue}>
      {children}
    </AppDataContext.Provider>
  );
}

// Custom hook to use the App Data context
export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
}

// Export the context for advanced usage
export { AppDataContext };
