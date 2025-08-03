import React, { useEffect, useCallback } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Mantine
import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';

import { theme } from './theme';

// Authentication
import { AuthProvider } from './contexts/AuthContext';
import {
  MantineIntegratedThemeProvider,
  useTheme,
} from './contexts/ThemeContext';
import { AppDataProvider } from './contexts/AppDataContext';
import { UserPreferencesProvider } from './contexts/UserPreferencesContext';
import ProtectedRoute, {
  AdminRoute,
  PublicRoute,
} from './components/auth/ProtectedRoute';

// Pages
import Login from './pages/auth/Login';
import Dashboard from './pages/Dashboard';
import ExportPage from './pages/ExportPage';
import PatientInfo from './pages/medical/Patient-Info';
import Medication from './pages/medical/Medication';
import LabResults from './pages/medical/LabResults';
import Immunization from './pages/medical/Immunization';
import Insurance from './pages/medical/Insurance';
import Allergies from './pages/medical/Allergies';
import Treatments from './pages/medical/Treatments';
import Procedures from './pages/medical/Procedures';
import Conditions from './pages/medical/Conditions';
import Visits from './pages/medical/Visits';
import Vitals from './pages/medical/Vitals';
import Practitioners from './pages/medical/Practitioners';
import Pharmacies from './pages/medical/Pharmacies';
import EmergencyContacts from './pages/medical/EmergencyContacts';
import FamilyHistory from './pages/medical/FamilyHistory';
import PlaceholderPage from './pages/PlaceholderPage';
import Settings from './pages/Settings';
import AdminDashboard from './pages/admin/AdminDashboard';
import ModelManagement from './pages/admin/ModelManagement';
import ModelView from './pages/admin/ModelView';
import ModelEdit from './pages/admin/ModelEdit';
import ModelCreate from './pages/admin/ModelCreate';
import SystemHealth from './pages/admin/SystemHealth';
import BackupManagement from './pages/admin/BackupManagement';
import AdminSettings from './pages/admin/AdminSettings';
import DataModels from './pages/admin/DataModels';

// Components
import { ErrorBoundary } from './components';

import logger from './services/logger';
import { timezoneService } from './services/timezoneService';
import { ENTITY_TYPES } from './utils/entityRelationships';
import { useActivityTracker, useNavigationActivityTracker, useApiActivityTracker } from './hooks/useActivityTracker';
import { apiClient } from './services/apiClient';
import { useAuth } from './contexts/AuthContext';
import './App.css';

// Entity to component mapping for dynamic route generation
const ENTITY_COMPONENT_MAP = {
  [ENTITY_TYPES.MEDICATION]: Medication,
  [ENTITY_TYPES.LAB_RESULT]: LabResults,
  [ENTITY_TYPES.IMMUNIZATION]: Immunization,
  [ENTITY_TYPES.INSURANCE]: Insurance,
  [ENTITY_TYPES.PROCEDURE]: Procedures,
  [ENTITY_TYPES.ALLERGY]: Allergies,
  [ENTITY_TYPES.CONDITION]: Conditions,
  [ENTITY_TYPES.TREATMENT]: Treatments,
  [ENTITY_TYPES.ENCOUNTER]: Visits,
  [ENTITY_TYPES.VITALS]: Vitals,
  [ENTITY_TYPES.PRACTITIONER]: Practitioners,
  [ENTITY_TYPES.PHARMACY]: Pharmacies,
  [ENTITY_TYPES.EMERGENCY_CONTACT]: EmergencyContacts,
  [ENTITY_TYPES.FAMILY_MEMBER]: FamilyHistory,
};

// Entity to route path mapping
const ENTITY_ROUTE_MAP = {
  [ENTITY_TYPES.MEDICATION]: '/medications',
  [ENTITY_TYPES.LAB_RESULT]: '/lab-results',
  [ENTITY_TYPES.IMMUNIZATION]: '/immunizations',
  [ENTITY_TYPES.INSURANCE]: '/insurance',
  [ENTITY_TYPES.PROCEDURE]: '/procedures',
  [ENTITY_TYPES.ALLERGY]: '/allergies',
  [ENTITY_TYPES.CONDITION]: '/conditions',
  [ENTITY_TYPES.TREATMENT]: '/treatments',
  [ENTITY_TYPES.ENCOUNTER]: '/visits',
  [ENTITY_TYPES.VITALS]: '/vitals',
  [ENTITY_TYPES.PRACTITIONER]: '/practitioners',
  [ENTITY_TYPES.PHARMACY]: '/pharmacies',
  [ENTITY_TYPES.EMERGENCY_CONTACT]: '/emergency-contacts',
  [ENTITY_TYPES.FAMILY_MEMBER]: '/family-history',
};

// Helper function to generate entity routes
const generateEntityRoutes = () => {
  return Object.entries(ENTITY_COMPONENT_MAP).map(([entityType, Component]) => {
    const routePath = ENTITY_ROUTE_MAP[entityType];
    return (
      <Route
        key={entityType}
        path={routePath}
        element={
          <ProtectedRoute>
            <Component />
          </ProtectedRoute>
        }
      />
    );
  });
};

// Component to track navigation
function NavigationTracker() {
  const location = useLocation();
  const previousLocation = React.useRef(location.pathname);
  const { trackNavigationActivity } = useNavigationActivityTracker();

  useEffect(() => {
    const currentPath = location.pathname;
    const previousPath = previousLocation.current;
    if (currentPath !== previousPath) {
      // Track navigation as user activity (for session timeout)
      trackNavigationActivity({
        fromPath: previousPath,
        toPath: currentPath,
        search: location.search,
        hash: location.hash,
      });

      // Log navigation as a user interaction
      logger.userAction('navigation', 'App', {
        fromPath: previousPath,
        toPath: currentPath,
        search: location.search,
        hash: location.hash,
      });

      // Log page load as an event
      logger.info(`Page loaded: ${currentPath}`, {
        category: 'navigation',
        pathname: currentPath,
        search: location.search,
        hash: location.hash,
        component: 'App',
      });
    }

    previousLocation.current = currentPath;
  }, [location, trackNavigationActivity]);

  return null;
}

// Component to handle theme-aware toast notifications
function ThemedToastContainer() {
  const { theme } = useTheme();

  return (
    <ToastContainer
      position="top-right"
      autoClose={5000}
      hideProgressBar={false}
      newestOnTop={false}
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme={theme}
    />
  );
}

// Component to initialize global activity tracking with enhanced error handling
function ActivityTracker() {
  const { isTracking, isEnabled, getStats } = useActivityTracker({
    // Re-enable basic tracking but avoid clicks to prevent navigation interference
    trackMouseMove: false, // Keep disabled
    trackKeyboard: true,   // Safe for session management
    trackClicks: false,    // Keep disabled to avoid navigation interference
    trackTouch: true,      // Safe for mobile
    enabled: true,

  });
  
  // Create a working API activity tracker that heavily throttles updateActivity calls
  const { updateActivity } = useAuth();
  const trackApiActivity = useCallback((apiInfo = {}) => {
    // Only call updateActivity every 60 seconds to avoid navigation interference
    const now = Date.now();
    const lastUpdate = window._lastActivityUpdate || 0;
    if (now - lastUpdate > 60000) { // 1 minute throttle
      window._lastActivityUpdate = now;
      // Call updateActivity asynchronously to avoid blocking navigation
      setTimeout(() => {
        try {
          updateActivity();
        } catch (error) {
          // Activity update failed - this is expected during logout/navigation
          // No need to log as it's normal behavior
        }
      }, 0);
    }
  }, [updateActivity]);
  const getApiStats = () => ({});

  // Log activity tracking status changes
  useEffect(() => {
    if (isTracking) {
      const stats = getStats();
      logger.debug('Global activity tracking enabled', {
        category: 'activity_tracking',
        component: 'ActivityTracker',
        timestamp: new Date().toISOString(),
        stats,
      });
    }
  }, [isTracking, getStats]);

  // Set up API activity tracking with proper error handling  
  useEffect(() => {
    try {
      // Set the simplified activity tracker on the API client
      apiClient.setActivityTracker(trackApiActivity);
      
      logger.debug('API activity tracking configured with simplified tracker', {
        category: 'activity_tracking',
        component: 'ActivityTracker',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to configure API activity tracking', {
        category: 'activity_tracking_error',
        component: 'ActivityTracker',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }

    return () => {
      try {
        // Clean up API activity tracking
        apiClient.setActivityTracker(null);
      } catch (error) {
        logger.error('Failed to cleanup API activity tracking', {
          category: 'activity_tracking_error',
          component: 'ActivityTracker',
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    };
  }, [trackApiActivity]);

  // Performance monitoring for activity tracking
  useEffect(() => {
    const performanceTimer = setInterval(() => {
      if (isTracking) {
        const uiStats = getStats();
        const apiStats = getApiStats();
        
        logger.debug('Activity tracking performance', {
          category: 'activity_tracking_performance',
          component: 'ActivityTracker',
          uiStats,
          apiStats,
          timestamp: new Date().toISOString(),
        });
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => clearInterval(performanceTimer);
  }, [isTracking, getStats, getApiStats]);

  return null;
}

function App() {
  useEffect(() => {
    // Initialize frontend logging
    logger.info('Medical Records App initialized', {
      category: 'app_lifecycle',
      component: 'App',
      userAgent: navigator.userAgent,
      url: window.location.href,
    });

    // Initialize timezone service
    timezoneService.init().catch(error => {
      logger.warn('timezone_service_init_failed', 'Timezone service initialization failed', {
        error: error.message,
        component: 'App',
      });
    });

    // Set up performance monitoring
    const startTime = performance.now();

    return () => {
      const loadTime = performance.now() - startTime;
      logger.debug('App performance metrics', {
        category: 'performance',
        component: 'App',
        loadTime: loadTime,
      });
    };
  }, []);
  return (
    <ErrorBoundary componentName="App">
      <Router>
        <AuthProvider>
          <UserPreferencesProvider>
            <AppDataProvider>
              <MantineProvider theme={theme}>
                <Notifications />
                <DatesProvider settings={{ timezone: 'UTC' }}>
                  <MantineIntegratedThemeProvider>
                    <NavigationTracker />
                    {/* <ActivityTracker /> */}
                    <div className="App">
                      <Routes>
                        {/* Public Routes */}
                        <Route
                          path="/login"
                          element={
                            <PublicRoute>
                              <Login />
                            </PublicRoute>
                          }
                        />
                        {/* Protected Routes */}
                        <Route
                          path="/dashboard"
                          element={
                            <ProtectedRoute>
                              <Dashboard />
                            </ProtectedRoute>
                          }
                        />
                        {/* Medical Records Routes */}
                        <Route
                          path="/patients/me"
                          element={
                            <ProtectedRoute>
                              <PatientInfo />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/patients/:section?"
                          element={
                            <ProtectedRoute>
                              <PlaceholderPage />
                            </ProtectedRoute>
                          }
                        />
                        {/* Generated entity routes */}
                        {generateEntityRoutes()}
                        <Route
                          path="/export"
                          element={
                            <ProtectedRoute>
                              <ExportPage />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/settings"
                          element={
                            <ProtectedRoute>
                              <Settings />
                            </ProtectedRoute>
                          }
                        />
                        {/* Admin Routes - Require Admin Role */}
                        <Route
                          path="/admin"
                          element={
                            <AdminRoute>
                              <AdminDashboard />
                            </AdminRoute>
                          }
                        />
                        <Route
                          path="/admin/data-models"
                          element={
                            <AdminRoute>
                              <DataModels />
                            </AdminRoute>
                          }
                        />
                        <Route
                          path="/admin/backup"
                          element={
                            <AdminRoute>
                              <BackupManagement />
                            </AdminRoute>
                          }
                        />
                        <Route
                          path="/admin/models/:modelName"
                          element={
                            <AdminRoute>
                              <ModelManagement />
                            </AdminRoute>
                          }
                        />
                        <Route
                          path="/admin/models/:modelName/:recordId"
                          element={
                            <AdminRoute>
                              <ModelView />
                            </AdminRoute>
                          }
                        />
                        <Route
                          path="/admin/models/:modelName/:recordId/edit"
                          element={
                            <AdminRoute>
                              <ModelEdit />
                            </AdminRoute>
                          }
                        />
                        <Route
                          path="/admin/models/:modelName/create"
                          element={
                            <AdminRoute>
                              <ModelCreate />
                            </AdminRoute>
                          }
                        />
                        <Route
                          path="/admin/bulk-operations"
                          element={
                            <AdminRoute>
                              <PlaceholderPage />
                            </AdminRoute>
                          }
                        />
                        <Route
                          path="/admin/system-health"
                          element={
                            <AdminRoute>
                              <SystemHealth />
                            </AdminRoute>
                          }
                        />
                        <Route
                          path="/admin/settings"
                          element={
                            <AdminRoute>
                              <AdminSettings />
                            </AdminRoute>
                          }
                        />
                        {/* Development/Testing Routes */}
                        {/* Default redirect */}
                        <Route
                          path="/"
                          element={<Navigate to="/dashboard" />}
                        />
                      </Routes>
                    </div>

                    {/* Toast Notifications */}
                    <ThemedToastContainer />
                  </MantineIntegratedThemeProvider>
                </DatesProvider>
              </MantineProvider>
            </AppDataProvider>
          </UserPreferencesProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
