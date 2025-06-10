import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/auth/Login';
import Dashboard from './pages/Dashboard';
import PatientInfo from './pages/medical/Patient-Info';
import Medication from './pages/medical/Medication';
import LabResults from './pages/medical/LabResults';
import Immunization from './pages/medical/Immunization';
import PlaceholderPage from './pages/PlaceholderPage';
import { LoggingTest, ProtectedRoute, ErrorBoundary } from './components';
import frontendLogger from './services/frontendLogger';
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
      frontendLogger.logUserInteraction('navigation', 'page', {
        fromPath: previousPath,
        toPath: currentPath,
        search: location.search,
        hash: location.hash
      });
      
      // Log page load as an event
      frontendLogger.logEvent({
        type: 'page_load',
        message: `Page loaded: ${currentPath}`,
        pathname: currentPath,
        search: location.search,
        hash: location.hash,
        timestamp: new Date().toISOString()
      });
    }

    previousLocation.current = currentPath;
  }, [location]);

  return null;
}

function App() {
  useEffect(() => {
    // Initialize frontend logging
    frontendLogger.logEvent({
      type: 'app_lifecycle',
      message: 'Medical Records App initialized',
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      url: window.location.href
    });

    // Set up performance monitoring
    const startTime = performance.now();
    
    return () => {
      const loadTime = performance.now() - startTime;
      frontendLogger.logPerformance({
        type: 'app_lifecycle',
        loadTime: loadTime,
        component: 'App',
        timestamp: new Date().toISOString()
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
          />
          <Route 
            path="/procedures" 
            element={
              <ProtectedRoute>
                <PlaceholderPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/allergies" 
            element={
              <ProtectedRoute>
                <PlaceholderPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/conditions" 
            element={
              <ProtectedRoute>
                <PlaceholderPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/treatments" 
            element={
              <ProtectedRoute>
                <PlaceholderPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/visits" 
            element={
              <ProtectedRoute>
                <PlaceholderPage />
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
