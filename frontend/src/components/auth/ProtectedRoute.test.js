import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute, { AdminRoute, RoleRoute, PublicRoute } from './ProtectedRoute';
import render from '../../test-utils/render';

// Mock react-toastify
jest.mock('react-toastify', () => ({
  toast: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock LoadingSpinner
jest.mock('../ui/LoadingSpinner', () => {
  return function MockLoadingSpinner({ message }) {
    return <div data-testid="loading-spinner">{message}</div>;
  };
});

// Mock react-router-dom hooks and Navigate
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: () => ({ pathname: '/test', state: null, search: '', hash: '' }),
  Navigate: ({ to, state, replace }) => (
    <div data-testid="navigate" data-to={to} data-replace={replace} />
  ),
}));

// Test components
const TestComponent = () => <div data-testid="protected-content">Protected Content</div>;
const PublicComponent = () => <div data-testid="public-content">Public Content</div>;

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    test('shows loading spinner when authentication is loading', () => {
      render(
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>,
        {
          authContextValue: {
            isLoading: true,
            isAuthenticated: false,
            user: null,
          },
        }
      );

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Verifying authentication...')).toBeInTheDocument();
    });

    test('shows custom fallback when provided during loading', () => {
      const CustomFallback = () => <div data-testid="custom-fallback">Custom Loading</div>;
      
      render(
        <ProtectedRoute fallback={<CustomFallback />}>
          <TestComponent />
        </ProtectedRoute>,
        {
          authContextValue: {
            isLoading: true,
            isAuthenticated: false,
            user: null,
          },
        }
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    });
  });

  describe('Authentication Check', () => {
    test('shows toast and does not render content when not authenticated', () => {
      const { toast } = require('react-toastify');
      
      render(
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>,
        {
          authContextValue: {
            isLoading: false,
            isAuthenticated: false,
            user: null,
          },
          skipRouter: true,
        }
      );

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(toast.warn).toHaveBeenCalledWith('Please log in to access this page');
    });

    test('shows toast for custom redirect when not authenticated', () => {
      const { toast } = require('react-toastify');
      
      render(
        <ProtectedRoute redirectTo="/custom-login">
          <TestComponent />
        </ProtectedRoute>,
        {
          authContextValue: {
            isLoading: false,
            isAuthenticated: false,
            user: null,
          },
          skipRouter: true,
        }
      );

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(toast.warn).toHaveBeenCalledWith('Please log in to access this page');
    });

    test('renders protected content when authenticated', () => {
      render(
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>,
        {
          authContextValue: {
            isLoading: false,
            isAuthenticated: true,
            user: { id: 1, username: 'testuser' },
            hasRole: jest.fn(() => true),
            hasAnyRole: jest.fn(() => true),
          },
        }
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });

  describe('Admin Access Control', () => {
    test('blocks non-admin users from admin-only routes', () => {
      const { toast } = require('react-toastify');
      
      render(
        <ProtectedRoute adminOnly={true}>
          <TestComponent />
        </ProtectedRoute>,
        {
          authContextValue: {
            isLoading: false,
            isAuthenticated: true,
            user: { id: 1, username: 'testuser', isAdmin: false },
            hasRole: jest.fn(() => true),
            hasAnyRole: jest.fn(() => true),
          },
          skipRouter: true,
        }
      );

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(toast.error).toHaveBeenCalledWith('Access denied: Administrator privileges required');
    });

    test('allows admin users to access admin-only routes', () => {
      render(
        <ProtectedRoute adminOnly={true}>
          <TestComponent />
        </ProtectedRoute>,
        {
          authContextValue: {
            isLoading: false,
            isAuthenticated: true,
            user: { id: 1, username: 'admin', isAdmin: true },
            hasRole: jest.fn(() => true),
            hasAnyRole: jest.fn(() => true),
          },
        }
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });

  describe('Role-based Access Control', () => {
    test('blocks users without required role', () => {
      const { toast } = require('react-toastify');
      const mockHasRole = jest.fn(() => false);
      
      render(
        <ProtectedRoute requiredRole="doctor">
          <TestComponent />
        </ProtectedRoute>,
        {
          authContextValue: {
            isLoading: false,
            isAuthenticated: true,
            user: { id: 1, username: 'testuser' },
            hasRole: mockHasRole,
            hasAnyRole: jest.fn(() => true),
          },
          skipRouter: true,
        }
      );

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(mockHasRole).toHaveBeenCalledWith('doctor');
      expect(toast.error).toHaveBeenCalledWith('Access denied: doctor role required');
    });

    test('allows users with required role', () => {
      const mockHasRole = jest.fn(() => true);
      
      render(
        <ProtectedRoute requiredRole="doctor">
          <TestComponent />
        </ProtectedRoute>,
        {
          authContextValue: {
            isLoading: false,
            isAuthenticated: true,
            user: { id: 1, username: 'testuser' },
            hasRole: mockHasRole,
            hasAnyRole: jest.fn(() => true),
          },
        }
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      expect(mockHasRole).toHaveBeenCalledWith('doctor');
    });

    test('blocks users without any required roles', () => {
      const { toast } = require('react-toastify');
      const mockHasAnyRole = jest.fn(() => false);
      
      render(
        <ProtectedRoute requiredRoles={['doctor', 'nurse']}>
          <TestComponent />
        </ProtectedRoute>,
        {
          authContextValue: {
            isLoading: false,
            isAuthenticated: true,
            user: { id: 1, username: 'testuser' },
            hasRole: jest.fn(() => true),
            hasAnyRole: mockHasAnyRole,
          },
          skipRouter: true,
        }
      );

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(mockHasAnyRole).toHaveBeenCalledWith(['doctor', 'nurse']);
      expect(toast.error).toHaveBeenCalledWith('Access denied: One of these roles required: doctor, nurse');
    });

    test('allows users with any required role', () => {
      const mockHasAnyRole = jest.fn(() => true);
      
      render(
        <ProtectedRoute requiredRoles={['doctor', 'nurse']}>
          <TestComponent />
        </ProtectedRoute>,
        {
          authContextValue: {
            isLoading: false,
            isAuthenticated: true,
            user: { id: 1, username: 'testuser' },
            hasRole: jest.fn(() => true),
            hasAnyRole: mockHasAnyRole,
          },
        }
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      expect(mockHasAnyRole).toHaveBeenCalledWith(['doctor', 'nurse']);
    });
  });
});

describe('AdminRoute', () => {
  test('renders admin-only content for admin users', () => {
    render(
      <AdminRoute>
        <TestComponent />
      </AdminRoute>,
      {
        authContextValue: {
          isLoading: false,
          isAuthenticated: true,
          user: { id: 1, username: 'admin', isAdmin: true },
          hasRole: jest.fn(() => true),
          hasAnyRole: jest.fn(() => true),
        },
      }
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  test('blocks non-admin users', () => {
    const { toast } = require('react-toastify');
    
    render(
      <AdminRoute>
        <TestComponent />
      </AdminRoute>,
      {
        authContextValue: {
          isLoading: false,
          isAuthenticated: true,
          user: { id: 1, username: 'testuser', isAdmin: false },
          hasRole: jest.fn(() => true),
          hasAnyRole: jest.fn(() => true),
        },
        skipRouter: true,
      }
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('Access denied: Administrator privileges required');
  });
});

describe('RoleRoute', () => {
  test('renders content for users with required role', () => {
    const mockHasRole = jest.fn(() => true);
    
    render(
      <RoleRoute role="doctor">
        <TestComponent />
      </RoleRoute>,
      {
        authContextValue: {
          isLoading: false,
          isAuthenticated: true,
          user: { id: 1, username: 'testuser' },
          hasRole: mockHasRole,
          hasAnyRole: jest.fn(() => true),
        },
      }
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(mockHasRole).toHaveBeenCalledWith('doctor');
  });

  test('blocks users without required role', () => {
    const { toast } = require('react-toastify');
    const mockHasRole = jest.fn(() => false);
    
    render(
      <RoleRoute role="doctor">
        <TestComponent />
      </RoleRoute>,
      {
        authContextValue: {
          isLoading: false,
          isAuthenticated: true,
          user: { id: 1, username: 'testuser' },
          hasRole: mockHasRole,
          hasAnyRole: jest.fn(() => true),
        },
        skipRouter: true,
      }
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(mockHasRole).toHaveBeenCalledWith('doctor');
    expect(toast.error).toHaveBeenCalledWith('Access denied: doctor role required');
  });
});

describe('PublicRoute', () => {
  test('renders public content when not authenticated', () => {
    render(
      <PublicRoute>
        <PublicComponent />
      </PublicRoute>,
      {
        authContextValue: {
          isLoading: false,
          isAuthenticated: false,
          user: null,
        },
      }
    );

    expect(screen.getByTestId('public-content')).toBeInTheDocument();
  });

  test('does not render public content when authenticated', () => {
    render(
      <PublicRoute>
        <PublicComponent />
      </PublicRoute>,
      {
        authContextValue: {
          isLoading: false,
          isAuthenticated: true,
          user: { id: 1, username: 'testuser' },
        },
        skipRouter: true,
      }
    );

    expect(screen.queryByTestId('public-content')).not.toBeInTheDocument();
  });

  test('does not render public content with custom redirect when authenticated', () => {
    render(
      <PublicRoute redirectTo="/custom-redirect">
        <PublicComponent />
      </PublicRoute>,
      {
        authContextValue: {
          isLoading: false,
          isAuthenticated: true,
          user: { id: 1, username: 'testuser' },
        },
        skipRouter: true,
      }
    );

    expect(screen.queryByTestId('public-content')).not.toBeInTheDocument();
  });

  test('shows loading spinner when authentication is loading', () => {
    render(
      <PublicRoute>
        <PublicComponent />
      </PublicRoute>,
      {
        authContextValue: {
          isLoading: true,
          isAuthenticated: false,
          user: null,
        },
      }
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});