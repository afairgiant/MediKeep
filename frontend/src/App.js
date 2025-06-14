import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/auth/Login';
import Dashboard from './pages/Dashboard';
import PatientInfo from './pages/medical/Patient-Info';
import Medication from './pages/medical/Medication';
import LabResults from './pages/medical/LabResults';
import Immunization from './pages/medical/Immunization';
import Allergies from './pages/medical/Allergies';
import Treatments from './pages/medical/Treatments';
import Procedures from './pages/medical/Procedures';
import Conditions from './pages/medical/Conditions';
import Visits from './pages/medical/Visits';
import Practitioners from './pages/medical/Practitioners';
import PlaceholderPage from './pages/PlaceholderPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import ModelManagement from './pages/admin/ModelManagement';
import ModelView from './pages/admin/ModelView';
import ModelEdit from './pages/admin/ModelEdit';
import ModelCreate from './pages/admin/ModelCreate';
import SystemHealth from './pages/admin/SystemHealth';
import { LoggingTest, ProtectedRoute, ErrorBoundary } from './components';
import logger from './services/logger';
import './App.css';

// Component to track navigation
function NavigationTracker() {
  const location = useLocation();
  const previousLocation = React.useRef(location.pathname);

  useEffect(() => {
    const currentPath = location.pathname;
    const previousPath = previousLocation.current;    if (currentPath !== previousPath) {
      // Log navigation as a user interaction
      logger.userAction('navigation', 'App', {
        fromPath: previousPath,
        toPath: currentPath,
        search: location.search,
        hash: location.hash
      });
      
      // Log page load as an event
      logger.info(`Page loaded: ${currentPath}`, {
        category: 'navigation',        pathname: currentPath,
        search: location.search,
        hash: location.hash,
        component: 'App'
      });
    }

    previousLocation.current = currentPath;
  }, [location]);

  return null;
}

function App() {
  useEffect(() => {    // Initialize frontend logging
    logger.info('Medical Records App initialized', {
      category: 'app_lifecycle',
      component: 'App',
      userAgent: navigator.userAgent,
      url: window.location.href
    });

    // Set up performance monitoring
    const startTime = performance.now();
    
    return () => {
      const loadTime = performance.now() - startTime;
      logger.debug('App performance metrics', {
        category: 'performance',
        component: 'App',
        loadTime: loadTime
      });
    };
  }, []);

  return (
    <ErrorBoundary componentName="App">
      <Router>
        <NavigationTracker />
        <div className="App">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          
          {/* Protected routes for all medical sections */}
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
          />          <Route 
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
          />
          <Route 
            path="/visits" 
            element={
              <ProtectedRoute>
                <Visits />
              </ProtectedRoute>
            }          />
          <Route 
            path="/practitioners" 
            element={
              <ProtectedRoute>
                <Practitioners />
              </ProtectedRoute>
            } 
          />
          
          {/* Admin Routes */}
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/models/:modelName" 
            element={
              <ProtectedRoute>
                <ModelManagement />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/models/:modelName/:recordId" 
            element={
              <ProtectedRoute>
                <ModelView />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/models/:modelName/:recordId/edit" 
            element={
              <ProtectedRoute>
                <ModelEdit />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/models/:modelName/create" 
            element={
              <ProtectedRoute>
                <ModelCreate />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/bulk-operations" 
            element={
              <ProtectedRoute>
                <PlaceholderPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin/system-health" 
            element={
              <ProtectedRoute>
                <SystemHealth />
              </ProtectedRoute>
            } 
          />
          
          {/* Logging Test Page - Development/Testing only */}
          <Route 
            path="/logging-test" 
            element={<LoggingTest />} 
          />
          
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </div>
    </Router>
    </ErrorBoundary>
  );
}

export default App;
