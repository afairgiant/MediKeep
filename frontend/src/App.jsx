import React, { useEffect, Suspense } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Import i18n configuration (initialized in index.js)
import './i18n';

// Mantine
import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';

import { theme, cssVariablesResolver } from './theme';

// Responsive System
import { ResponsiveProvider } from './providers/ResponsiveProvider';

// Authentication
import { AuthProvider } from './contexts/AuthContext';
import {
  ThemeProvider,
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
import UserCreation from './pages/auth/UserCreation';
import SSOCallback from './components/auth/SSOCallback';
import ForceChangePassword from './pages/auth/ForceChangePassword';
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
import Symptoms from './pages/medical/Symptoms';
import Injuries from './pages/medical/Injuries';
import MedicalEquipment from './pages/medical/MedicalEquipment';
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
import AdminUserCreate from './pages/admin/AdminUserCreate';
import SystemHealth from './pages/admin/SystemHealth';
import BackupManagement from './pages/admin/BackupManagement';
import AdminSettings from './pages/admin/AdminSettings';
import AuditLog from './pages/admin/AuditLog';
import TrashManagement from './pages/admin/TrashManagement';
import DataModels from './pages/admin/DataModels';
import UserManagement from './pages/admin/UserManagement';
import ToolsMaintenance from './pages/admin/ToolsMaintenance';
import Analytics from './pages/admin/Analytics';
import ReportBuilder from './pages/reports/ReportBuilder';
import TagManagement from './pages/tools/TagManagement';
import SearchResults from './pages/SearchResults';
import TestMedicationForm from './pages/TestMedicationForm';
import ResponsiveNavigationTest from './pages/test/ResponsiveNavigationTest';

// Components
import { ErrorBoundary } from './components';
import Footer from './components/shared/Footer';

import logger from './services/logger';
import { timezoneService } from './services/timezoneService';
import { ENTITY_TYPES } from './utils/entityRelationships';
import { useActivityTracker, useNavigationActivityTracker, useApiActivityTracker } from './hooks/useActivityTracker';
import { apiClient } from './services/apiClient';

import { useReleaseNotes } from './hooks/useReleaseNotes';
import WhatsNewModal from './components/settings/WhatsNewModal';
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
  [ENTITY_TYPES.INJURY]: Injuries,
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
  [ENTITY_TYPES.INJURY]: '/injuries',
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
      // Reset scroll position to top on route change
      window.scrollTo(0, 0);

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
    trackMouseMove: false,
    trackKeyboard: true,
    trackClicks: true,
    trackTouch: true,
    enabled: true,
  });
  
  // API calls (background polling, etc.) should NOT reset the inactivity timer.
  // Only real user interactions (mouse, keyboard, touch, scroll) count as activity.
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

  // Clean up API activity tracker (no longer used for inactivity tracking)
  useEffect(() => {
    return () => {
      try {
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
  }, []);

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

// What's New trigger: shows release notes modal on first login after version change
function WhatsNewTrigger() {
  const { showModal, dismissModal, unseenReleases, currentVersion } = useReleaseNotes();
  return (
    <WhatsNewModal
      opened={showModal}
      onClose={dismissModal}
      releases={unseenReleases}
      currentVersion={currentVersion}
    />
  );
}

// Bridge: reads theme from ThemeContext, passes forceColorScheme to MantineProvider
// so both CSS variables and Mantine switch in the same render - no flash.
function ThemedMantineProvider({ children }) {
  const { theme: colorScheme } = useTheme();
  return (
    <MantineProvider theme={theme} forceColorScheme={colorScheme} cssVariablesResolver={cssVariablesResolver}>
      <Notifications />
      <ResponsiveProvider>
        <DatesProvider settings={{}}>
          {children}
        </DatesProvider>
      </ResponsiveProvider>
    </MantineProvider>
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
      <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>}>
      <Router>
        <AuthProvider>
          <UserPreferencesProvider>
            <AppDataProvider>
              <ThemeProvider>
              <ThemedMantineProvider>
                    <NavigationTracker />
                    <WhatsNewTrigger />
                    {/* <ActivityTracker /> */}
                    <div className="App">
                      <div style={{ flex: 1 }}>
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
                        <Route
                          path="/user-creation"
                          element={
                            <PublicRoute>
                              <UserCreation />
                            </PublicRoute>
                          }
                        />
                        <Route
                          path="/auth/sso/callback"
                          element={
                            <PublicRoute>
                              <SSOCallback />
                            </PublicRoute>
                          }
                        />
                        {/* Forced password change — requires authentication but not full access */}
                        <Route
                          path="/change-password"
                          element={
                            <ProtectedRoute>
                              <ForceChangePassword />
                            </ProtectedRoute>
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
                        {/* Symptom Diary Route */}
                        <Route
                          path="/symptoms"
                          element={
                            <ProtectedRoute>
                              <Symptoms />
                            </ProtectedRoute>
                          }
                        />
                        {/* Medical Equipment Route */}
                        <Route
                          path="/medical-equipment"
                          element={
                            <ProtectedRoute>
                              <MedicalEquipment />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/reports/builder"
                          element={
                            <ProtectedRoute>
                              <ReportBuilder />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/tools/tags"
                          element={
                            <ProtectedRoute>
                              <TagManagement />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/tag-search"
                          element={<Navigate to="/search" replace />}
                        />
                        <Route
                          path="/search"
                          element={
                            <ProtectedRoute>
                              <SearchResults />
                            </ProtectedRoute>
                          }
                        />
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
                          path="/admin/analytics"
                          element={
                            <AdminRoute>
                              <Analytics />
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
                          path="/admin/create-user"
                          element={
                            <AdminRoute>
                              <AdminUserCreate />
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
                          path="/admin/users"
                          element={
                            <AdminRoute>
                              <UserManagement />
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
                        <Route
                          path="/admin/audit-log"
                          element={
                            <AdminRoute>
                              <AuditLog />
                            </AdminRoute>
                          }
                        />
                        <Route
                          path="/admin/trash"
                          element={
                            <AdminRoute>
                              <TrashManagement />
                            </AdminRoute>
                          }
                        />
                        <Route
                          path="/admin/tools"
                          element={
                            <AdminRoute>
                              <ToolsMaintenance />
                            </AdminRoute>
                          }
                        />
                        {/* Development/Testing Routes */}
                        <Route
                          path="/test/medication-form"
                          element={
                            <ProtectedRoute>
                              <TestMedicationForm />
                            </ProtectedRoute>
                          }
                        />
                        
                        {/* Navigation Test Page */}
                        <Route
                          path="/test/navigation"
                          element={
                            <ProtectedRoute>
                              <ResponsiveNavigationTest />
                            </ProtectedRoute>
                          }
                        />
                        {/* Emergency service worker cleanup route */}
                        <Route
                          path="/kill-sw"
                          element={<div style={{padding: '20px', textAlign: 'center'}}>
                            <h1>Service Worker Cleanup</h1>
                            <p>All service workers and caches have been cleared.</p>
                            <p>Please close this tab and restart your browser completely.</p>
                            <button onClick={() => window.location.href='/'} style={{padding: '10px 20px', margin: '10px'}}>
                              Go Back to App
                            </button>
                          </div>}
                        />
                        {/* Default redirect */}
                        <Route
                          path="/"
                          element={<Navigate to="/dashboard" />}
                        />
                      </Routes>
                      </div>

                      {/* Footer */}
                      <Footer />
                    </div>

                    {/* Toast Notifications */}
                    <ThemedToastContainer />
              </ThemedMantineProvider>
              </ThemeProvider>
            </AppDataProvider>
          </UserPreferencesProvider>
        </AuthProvider>
      </Router>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
