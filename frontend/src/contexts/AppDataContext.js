import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from 'react';
import { apiService } from '../services/api';
import { useAuth } from './AuthContext';
import { toast } from 'react-toastify';

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
        state.currentPatient &&
        isCacheValid(state.patientLastFetch, 'patient')
      ) {
        return state.currentPatient;
      }

      try {
        dispatch({ type: APP_DATA_ACTIONS.SET_PATIENT_LOADING, payload: true });
        const patient = await apiService.getCurrentPatient();
        dispatch({
          type: APP_DATA_ACTIONS.SET_PATIENT_SUCCESS,
          payload: patient,
        });
        return patient;
      } catch (error) {
        console.error('Error fetching current patient:', error);
        dispatch({
          type: APP_DATA_ACTIONS.SET_PATIENT_ERROR,
          payload: error.message,
        });
        return null;
      }
    },
    [
      isAuthenticated,
      state.currentPatient,
      state.patientLastFetch,
      isCacheValid,
    ]
  );

  // Fetch practitioners list
  const fetchPractitioners = useCallback(
    async (forceRefresh = false) => {
      // Check if we have valid cached data and don't force refresh
      if (
        !forceRefresh &&
        state.practitioners.length > 0 &&
        isCacheValid(state.practitionersLastFetch, 'practitioners')
      ) {
        return state.practitioners;
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
        console.error('Error fetching practitioners:', error);
        dispatch({
          type: APP_DATA_ACTIONS.SET_PRACTITIONERS_ERROR,
          payload: error.message,
        });

        // Return existing data if available, otherwise empty array
        return Array.isArray(state.practitioners) ? state.practitioners : [];
      }
    },
    [state.practitioners, state.practitionersLastFetch, isCacheValid]
  );

  // Fetch pharmacies list
  const fetchPharmacies = useCallback(
    async (forceRefresh = false) => {
      // Check if we have valid cached data and don't force refresh
      if (
        !forceRefresh &&
        state.pharmacies.length > 0 &&
        isCacheValid(state.pharmaciesLastFetch, 'pharmacies')
      ) {
        return state.pharmacies;
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
        console.error('Error fetching pharmacies:', error);
        dispatch({
          type: APP_DATA_ACTIONS.SET_PHARMACIES_ERROR,
          payload: error.message,
        });

        // Return existing data if available, otherwise empty array
        return Array.isArray(state.pharmacies) ? state.pharmacies : [];
      }
    },
    [state.pharmacies, state.pharmaciesLastFetch, isCacheValid]
  );

  // Initialize app data when user logs in
  useEffect(() => {
    if (isAuthenticated && user) {
      // Add timeout to prevent rapid fire requests in production
      const timeoutId = setTimeout(
        () => {
          // Fetch patient data immediately on login
          fetchCurrentPatient();

          // Fetch static lists in parallel
          Promise.all([fetchPractitioners(), fetchPharmacies()]).catch(
            error => {
              console.error('Error initializing app data:', error);
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
          console.warn(`Unknown cache type: ${cacheType}`);
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
