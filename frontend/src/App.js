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

// Authentication
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
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
import PlaceholderPage from './pages/PlaceholderPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import ModelManagement from './pages/admin/ModelManagement';
import ModelView from './pages/admin/ModelView';
import ModelEdit from './pages/admin/ModelEdit';
import ModelCreate from './pages/admin/ModelCreate';
import SystemHealth from './pages/admin/SystemHealth';

// Components
import { LoggingTest, ErrorBoundary } from './components';
import logger from './services/logger';
import './App.css';

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

function App() {
  useEffect(() => {
    // Initialize frontend logging
    logger.info('Medical Records App initialized', {
      category: 'app_lifecycle',
      component: 'App',
      userAgent: navigator.userAgent,
      url: window.location.href,
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
          <ThemeProvider>
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
                <Route
                  path="/lab-results"
                  element={
                    <ProtectedRoute>
                      <LabResults />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/medications"
                  element={
                    <ProtectedRoute>
                      <Medication />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/immunizations"
                  element={
                    <ProtectedRoute>
                      <Immunization />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/procedures"
                  element={
                    <ProtectedRoute>
                      <Procedures />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/allergies"
                  element={
                    <ProtectedRoute>
                      <Allergies />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/conditions"
                  element={
                    <ProtectedRoute>
                      <Conditions />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/treatments"
                  element={
                    <ProtectedRoute>
                      <Treatments />
                    </ProtectedRoute>
                  }
                />{' '}
                <Route
                  path="/visits"
                  element={
                    <ProtectedRoute>
                      <Visits />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/vitals"
                  element={
                    <ProtectedRoute>
                      <Vitals />
                    </ProtectedRoute>
                  }
                />{' '}
                <Route
                  path="/practitioners"
                  element={
                    <ProtectedRoute>
                      <Practitioners />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pharmacies"
                  element={
                    <ProtectedRoute>
                      <Pharmacies />
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
                {/* Development/Testing Routes */}
                <Route path="/logging-test" element={<LoggingTest />} />
                {/* Default redirect */}
                <Route path="/" element={<Navigate to="/dashboard" />} />
              </Routes>
            </div>

            {/* Toast Notifications */}
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
              theme="light"
            />
          </ThemeProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
