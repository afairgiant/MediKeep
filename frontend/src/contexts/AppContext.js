/**
 * Application Context for global state management
 */

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { apiService } from '../services/api';
import { secureStorage } from '../utils/secureStorage';

// Initial state
const initialState = {
  user: null,
  patient: null,
  isAuthenticated: false,
  loading: true,
  error: null,
  notifications: [],
};

// Action types
export const ACTION_TYPES = {
  SET_LOADING: 'SET_LOADING',
  SET_USER: 'SET_USER',
  SET_PATIENT: 'SET_PATIENT',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  ADD_NOTIFICATION: 'ADD_NOTIFICATION',
  REMOVE_NOTIFICATION: 'REMOVE_NOTIFICATION',
  LOGOUT: 'LOGOUT',
};

// Reducer
const appReducer = (state, action) => {
  switch (action.type) {
    case ACTION_TYPES.SET_LOADING:
      return { ...state, loading: action.payload };

    case ACTION_TYPES.SET_USER:
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        loading: false,
      };

    case ACTION_TYPES.SET_PATIENT:
      return { ...state, patient: action.payload };

    case ACTION_TYPES.SET_ERROR:
      return { ...state, error: action.payload, loading: false };

    case ACTION_TYPES.CLEAR_ERROR:
      return { ...state, error: null };

    case ACTION_TYPES.ADD_NOTIFICATION:
      return {
        ...state,
        notifications: [...state.notifications, action.payload],
      };

    case ACTION_TYPES.REMOVE_NOTIFICATION:
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload),
      };

    case ACTION_TYPES.LOGOUT:
      return {
        ...initialState,
        loading: false,
      };

    default:
      return state;
  }
};

// Create context
const AppContext = createContext();

// Provider component
export const AppProvider = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Initialize app state
  useEffect(() => {
    const initializeApp = async () => {
      const token = await secureStorage.getItem('token');

      if (!token) {
        dispatch({ type: ACTION_TYPES.SET_LOADING, payload: false });
        return;
      }

      try {
        // Verify token and get user data
        const userData = await apiService.getCurrentPatient();
        dispatch({ type: ACTION_TYPES.SET_USER, payload: userData });
        dispatch({ type: ACTION_TYPES.SET_PATIENT, payload: userData });
      } catch (error) {
        // Failed to initialize app - session will be cleared
        await secureStorage.removeItem('token');
        dispatch({ type: ACTION_TYPES.SET_ERROR, payload: 'Session expired' });
      }
    };

    initializeApp();
  }, []);

  // Action creators
  const actions = {
    setLoading: loading => {
      dispatch({ type: ACTION_TYPES.SET_LOADING, payload: loading });
    },

    setUser: user => {
      dispatch({ type: ACTION_TYPES.SET_USER, payload: user });
    },

    setPatient: patient => {
      dispatch({ type: ACTION_TYPES.SET_PATIENT, payload: patient });
    },

    setError: error => {
      dispatch({ type: ACTION_TYPES.SET_ERROR, payload: error });
    },

    clearError: () => {
      dispatch({ type: ACTION_TYPES.CLEAR_ERROR });
    },

    addNotification: notification => {
      const id = Date.now().toString();
      dispatch({
        type: ACTION_TYPES.ADD_NOTIFICATION,
        payload: { id, ...notification },
      });

      // Auto-remove notification after 5 seconds
      setTimeout(() => {
        dispatch({ type: ACTION_TYPES.REMOVE_NOTIFICATION, payload: id });
      }, 5000);
    },

    removeNotification: id => {
      dispatch({ type: ACTION_TYPES.REMOVE_NOTIFICATION, payload: id });
    },

    logout: async () => {
      await secureStorage.removeItem('token');
      dispatch({ type: ACTION_TYPES.LOGOUT });
    },
  };

  const value = {
    ...state,
    ...actions,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

// Custom hook to use the context
export const useApp = () => {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }

  return context;
};
