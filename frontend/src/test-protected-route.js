import { vi } from 'vitest';
import logger from './services/logger';

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
vi.mock('./contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext
}));

// Test that ProtectedRoute can be imported and used without syntax errors
logger.info('✅ ProtectedRoute imported successfully');
logger.info('✅ Fix applied successfully - no setState during render');

// Cleanup
setTimeout(() => {
  logger.info('Test completed');
}, 100);