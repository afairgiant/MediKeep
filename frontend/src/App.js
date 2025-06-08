import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PlaceholderPage from './pages/PlaceholderPage';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

function App() {
  return (
    <ErrorBoundary>
      <Router>
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
                <PlaceholderPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/medications" 
            element={
              <ProtectedRoute>
                <PlaceholderPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/immunizations" 
            element={
              <ProtectedRoute>
                <PlaceholderPage />
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
          
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </div>
    </Router>
    </ErrorBoundary>
  );
}

export default App;
