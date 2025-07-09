import React, { useEffect } from 'react';
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
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';

import { theme } from './theme';

// Authentication
import { AuthProvider } from './contexts/AuthContext';
import {
  MantineIntegratedThemeProvider,
  useTheme,
} from './contexts/ThemeContext';
import { AppDataProvider } from './contexts/AppDataContext';
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
import Allergies from './pages/medical/Allergies';
import Treatments from './pages/medical/Treatments';
import Procedures from './pages/medical/Procedures';
import Conditions from './pages/medical/Conditions';
import Visits from './pages/medical/Visits';
import Vitals from './pages/medical/Vitals';
import Practitioners from './pages/medical/Practitioners';
import Pharmacies from './pages/medical/Pharmacies';
import EmergencyContacts from './pages/medical/EmergencyContacts';
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
import { LoggingTest, ErrorBoundary } from './components';
import GlobalStateDemo from './components/common/GlobalStateDemo';

import logger from './services/logger';
import { timezoneService } from './services/timezoneService';
import { ENTITY_TYPES } from './utils/entityRelationships';
import './App.css';

// Entity to component mapping for dynamic route generation
const ENTITY_COMPONENT_MAP = {
  [ENTITY_TYPES.MEDICATION]: Medication,
  [ENTITY_TYPES.LAB_RESULT]: LabResults,
  [ENTITY_TYPES.IMMUNIZATION]: Immunization,
  [ENTITY_TYPES.PROCEDURE]: Procedures,
  [ENTITY_TYPES.ALLERGY]: Allergies,
  [ENTITY_TYPES.CONDITION]: Conditions,
  [ENTITY_TYPES.TREATMENT]: Treatments,
  [ENTITY_TYPES.ENCOUNTER]: Visits,
  [ENTITY_TYPES.VITALS]: Vitals,
  [ENTITY_TYPES.PRACTITIONER]: Practitioners,
  [ENTITY_TYPES.PHARMACY]: Pharmacies,
  [ENTITY_TYPES.EMERGENCY_CONTACT]: EmergencyContacts,
};

// Entity to route path mapping
const ENTITY_ROUTE_MAP = {
  [ENTITY_TYPES.MEDICATION]: '/medications',
  [ENTITY_TYPES.LAB_RESULT]: '/lab-results',
  [ENTITY_TYPES.IMMUNIZATION]: '/immunizations',
  [ENTITY_TYPES.PROCEDURE]: '/procedures',
  [ENTITY_TYPES.ALLERGY]: '/allergies',
  [ENTITY_TYPES.CONDITION]: '/conditions',
  [ENTITY_TYPES.TREATMENT]: '/treatments',
  [ENTITY_TYPES.ENCOUNTER]: '/visits',
  [ENTITY_TYPES.VITALS]: '/vitals',
  [ENTITY_TYPES.PRACTITIONER]: '/practitioners',
  [ENTITY_TYPES.PHARMACY]: '/pharmacies',
  [ENTITY_TYPES.EMERGENCY_CONTACT]: '/emergency-contacts',
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

  useEffect(() => {
    const currentPath = location.pathname;
    const previousPath = previousLocation.current;
    if (currentPath !== previousPath) {
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
  }, [location]);

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
      console.warn('Timezone service initialization failed:', error);
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
          <AppDataProvider>
            <MantineProvider theme={theme}>
              <DatesProvider settings={{ timezone: 'UTC' }}>
                <MantineIntegratedThemeProvider>
                  <NavigationTracker />
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
                      <Route path="/logging-test" element={<LoggingTest />} />
                      <Route
                        path="/global-state-demo"
                        element={<GlobalStateDemo />}
                      />
                      {/* Default redirect */}
                      <Route path="/" element={<Navigate to="/dashboard" />} />
                    </Routes>
                  </div>

                  {/* Toast Notifications */}
                  <ThemedToastContainer />
                </MantineIntegratedThemeProvider>
              </DatesProvider>
            </MantineProvider>
          </AppDataProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
