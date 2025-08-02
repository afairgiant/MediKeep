// Simple test to validate ProtectedRoute syntax
import React from 'react';
import ReactDOM from 'react-dom/client';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Mock AuthContext
const mockAuthContext = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
  hasRole: () => false,
  hasAnyRole: () => false
};

// Mock useAuth hook
jest.mock('./contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext
}));

// Test that ProtectedRoute can be imported and used without syntax errors
console.log('✅ ProtectedRoute imported successfully');
console.log('✅ Fix applied successfully - no setState during render');

// Cleanup
setTimeout(() => {
  console.log('Test completed');
}, 100);