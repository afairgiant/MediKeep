import { vi } from 'vitest';
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute, { AdminRoute, RoleRoute, PublicRoute } from './ProtectedRoute';
import render from '../../test-utils/render';

// vi.hoisted ensures this fn is available when vi.mock() factories run (they are hoisted)
const mockNotificationsShow = vi.hoisted(() => vi.fn());

// Mock @mantine/notifications
vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: mockNotificationsShow,
  },
}));

// Mock LoadingSpinner
vi.mock('../ui/LoadingSpinner', () => ({
  default: function MockLoadingSpinner({ message }) {
    return <div data-testid="loading-spinner">{message}</div>;
  },
}));

// Mutable so individual tests can simulate different routes
let mockPathname = '/test';

// Mock react-router-dom hooks and Navigate
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useLocation: () => ({ pathname: mockPathname, state: null, search: '', hash: '' }),
  Navigate: ({ to, state, replace }) => (
    <div data-testid="navigate" data-to={to} data-replace={replace} />
  ),
}));

// Test components
const TestComponent = () => <div data-testid="protected-content">Protected Content</div>;
const PublicComponent = () => <div data-testid="public-content">Public Content</div>;

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotificationsShow.mockClear();
    mockPathname = '/test'; // reset before each test
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
    test('shows notification and does not render content when not authenticated', async () => {
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
      await waitFor(() => {
        expect(mockNotificationsShow).toHaveBeenCalled();
        const call = mockNotificationsShow.mock.calls[0][0];
        expect(call.color).toBe('orange');
      });
    });

    test('shows notification for custom redirect when not authenticated', async () => {
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
      await waitFor(() => {
        expect(mockNotificationsShow).toHaveBeenCalled();
        const call = mockNotificationsShow.mock.calls[0][0];
        expect(call.color).toBe('orange');
      });
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
            hasRole: vi.fn(() => true),
            hasAnyRole: vi.fn(() => true),
          },
        }
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });

  describe('Admin Access Control', () => {
    test('blocks non-admin users from admin-only routes', async () => {
      render(
        <ProtectedRoute adminOnly={true}>
          <TestComponent />
        </ProtectedRoute>,
        {
          authContextValue: {
            isLoading: false,
            isAuthenticated: true,
            user: { id: 1, username: 'testuser', isAdmin: false },
            hasRole: vi.fn(() => true),
            hasAnyRole: vi.fn(() => true),
          },
          skipRouter: true,
        }
      );

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(mockNotificationsShow).toHaveBeenCalled();
        const call = mockNotificationsShow.mock.calls[0][0];
        expect(call.color).toBe('red');
      });
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
            hasRole: vi.fn(() => true),
            hasAnyRole: vi.fn(() => true),
          },
        }
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });
  });

  describe('Role-based Access Control', () => {
    test('blocks users without required role', async () => {
      const mockHasRole = vi.fn(() => false);

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
            hasAnyRole: vi.fn(() => true),
          },
          skipRouter: true,
        }
      );

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(mockHasRole).toHaveBeenCalledWith('doctor');
      await waitFor(() => {
        expect(mockNotificationsShow).toHaveBeenCalled();
        const call = mockNotificationsShow.mock.calls[0][0];
        expect(call.color).toBe('red');
      });
    });

    test('allows users with required role', () => {
      const mockHasRole = vi.fn(() => true);
      
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
            hasAnyRole: vi.fn(() => true),
          },
        }
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      expect(mockHasRole).toHaveBeenCalledWith('doctor');
    });

    test('blocks users without any required roles', async () => {
      const mockHasAnyRole = vi.fn(() => false);

      render(
        <ProtectedRoute requiredRoles={['doctor', 'nurse']}>
          <TestComponent />
        </ProtectedRoute>,
        {
          authContextValue: {
            isLoading: false,
            isAuthenticated: true,
            user: { id: 1, username: 'testuser' },
            hasRole: vi.fn(() => true),
            hasAnyRole: mockHasAnyRole,
          },
          skipRouter: true,
        }
      );

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(mockHasAnyRole).toHaveBeenCalledWith(['doctor', 'nurse']);
      await waitFor(() => {
        expect(mockNotificationsShow).toHaveBeenCalled();
        const call = mockNotificationsShow.mock.calls[0][0];
        expect(call.color).toBe('red');
      });
    });

    test('allows users with any required role', () => {
      const mockHasAnyRole = vi.fn(() => true);
      
      render(
        <ProtectedRoute requiredRoles={['doctor', 'nurse']}>
          <TestComponent />
        </ProtectedRoute>,
        {
          authContextValue: {
            isLoading: false,
            isAuthenticated: true,
            user: { id: 1, username: 'testuser' },
            hasRole: vi.fn(() => true),
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
          hasRole: vi.fn(() => true),
          hasAnyRole: vi.fn(() => true),
        },
      }
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  test('blocks non-admin users', async () => {
    render(
      <AdminRoute>
        <TestComponent />
      </AdminRoute>,
      {
        authContextValue: {
          isLoading: false,
          isAuthenticated: true,
          user: { id: 1, username: 'testuser', isAdmin: false },
          hasRole: vi.fn(() => true),
          hasAnyRole: vi.fn(() => true),
        },
        skipRouter: true,
      }
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockNotificationsShow).toHaveBeenCalled();
      const call = mockNotificationsShow.mock.calls[0][0];
      expect(call.color).toBe('red');
    });
  });
});

describe('RoleRoute', () => {
  test('renders content for users with required role', () => {
    const mockHasRole = vi.fn(() => true);

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
          hasAnyRole: vi.fn(() => true),
        },
      }
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(mockHasRole).toHaveBeenCalledWith('doctor');
  });

  test('blocks users without required role', async () => {
    const mockHasRole = vi.fn(() => false);

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
          hasAnyRole: vi.fn(() => true),
        },
        skipRouter: true,
      }
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(mockHasRole).toHaveBeenCalledWith('doctor');
    await waitFor(() => {
      expect(mockNotificationsShow).toHaveBeenCalled();
      const call = mockNotificationsShow.mock.calls[0][0];
      expect(call.color).toBe('red');
    });
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

describe('ProtectedRoute — mustChangePassword guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotificationsShow.mockClear();
    mockPathname = '/test';
  });

  test('redirects to /change-password when mustChangePassword is true and not on /change-password', () => {
    render(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>,
      {
        authContextValue: {
          isLoading: false,
          isAuthenticated: true,
          user: { id: 1, username: 'admin' },
          mustChangePassword: true,
          hasRole: vi.fn(() => true),
          hasAnyRole: vi.fn(() => true),
        },
        skipRouter: true,
      }
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    const nav = screen.getByTestId('navigate');
    expect(nav).toHaveAttribute('data-to', '/change-password');
  });

  test('renders children when mustChangePassword is true but already on /change-password', () => {
    mockPathname = '/change-password';

    render(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>,
      {
        authContextValue: {
          isLoading: false,
          isAuthenticated: true,
          user: { id: 1, username: 'admin' },
          mustChangePassword: true,
          hasRole: vi.fn(() => true),
          hasAnyRole: vi.fn(() => true),
        },
      }
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  test('renders children normally when mustChangePassword is false', () => {
    render(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>,
      {
        authContextValue: {
          isLoading: false,
          isAuthenticated: true,
          user: { id: 1, username: 'testuser' },
          mustChangePassword: false,
          hasRole: vi.fn(() => true),
          hasAnyRole: vi.fn(() => true),
        },
      }
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  test('renders children when mustChangePassword is undefined (backwards compat)', () => {
    render(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>,
      {
        authContextValue: {
          isLoading: false,
          isAuthenticated: true,
          user: { id: 1, username: 'testuser' },
          hasRole: vi.fn(() => true),
          hasAnyRole: vi.fn(() => true),
          // mustChangePassword intentionally omitted
        },
      }
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });
});
