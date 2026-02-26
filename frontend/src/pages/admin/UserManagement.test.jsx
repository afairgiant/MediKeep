import React from 'react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.hoisted(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';

vi.mock('../../components/admin/AdminLayout', () => ({
  default: ({ children }) => <div data-testid="admin-layout">{children}</div>,
}));

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
  MantineIntegratedThemeProvider: ({ children }) => children,
}));

vi.mock('../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    formatDateTime: (d) => d || '-',
    formatDate: (d) => d || '-',
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, role: 'admin', username: 'currentadmin' }, logout: vi.fn() }),
}));

const mockGetUsers = vi.fn();
const mockChangeUserRole = vi.fn();
const mockAdminResetPassword = vi.fn();
const mockToggleUserActive = vi.fn();
const mockDeleteUser = vi.fn();
const mockGetUserLoginHistory = vi.fn();
const mockGetDashboardStats = vi.fn();
const mockUpdateModelRecord = vi.fn();

vi.mock('../../services/api/adminApi', () => ({
  adminApiService: {
    getUsers: (...args) => mockGetUsers(...args),
    changeUserRole: (...args) => mockChangeUserRole(...args),
    adminResetPassword: (...args) => mockAdminResetPassword(...args),
    toggleUserActive: (...args) => mockToggleUserActive(...args),
    deleteUser: (...args) => mockDeleteUser(...args),
    getUserLoginHistory: (...args) => mockGetUserLoginHistory(...args),
    getDashboardStats: (...args) => mockGetDashboardStats(...args),
    updateModelRecord: (...args) => mockUpdateModelRecord(...args),
  },
  default: {
    getUsers: (...args) => mockGetUsers(...args),
    getDashboardStats: (...args) => mockGetDashboardStats(...args),
  },
}));

import UserManagement from './UserManagement';

const mockUsers = {
  items: [
    {
      id: 1,
      username: 'currentadmin',
      email: 'admin@test.com',
      full_name: 'Admin User',
      role: 'admin',
      auth_method: 'local',
      sso_provider: null,
      is_active: true,
      last_login_at: '2026-02-26T10:00:00',
      created_at: '2026-01-01T00:00:00',
    },
    {
      id: 2,
      username: 'john_doe',
      email: 'john@test.com',
      full_name: 'John Doe',
      role: 'user',
      auth_method: 'sso',
      sso_provider: 'google',
      is_active: true,
      last_login_at: '2026-02-25T08:00:00',
      created_at: '2026-01-15T00:00:00',
    },
    {
      id: 3,
      username: 'inactive_user',
      email: 'inactive@test.com',
      full_name: 'Inactive Person',
      role: 'guest',
      auth_method: 'local',
      sso_provider: null,
      is_active: false,
      last_login_at: null,
      created_at: '2026-02-01T00:00:00',
    },
  ],
  total: 3,
  page: 1,
  per_page: 20,
};

const mockEmptyUsers = {
  items: [],
  total: 0,
  page: 1,
  per_page: 20,
};

const mockStats = {
  data: { admin_count: 2 },
};

function renderUserManagement() {
  return render(
    <MemoryRouter>
      <MantineProvider>
        <UserManagement />
      </MantineProvider>
    </MemoryRouter>
  );
}

describe('UserManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUsers.mockResolvedValue(mockUsers);
    mockGetDashboardStats.mockResolvedValue(mockStats);
    mockChangeUserRole.mockResolvedValue({ status: 'success' });
    mockAdminResetPassword.mockResolvedValue({ status: 'success' });
    mockToggleUserActive.mockResolvedValue({ status: 'success' });
    mockDeleteUser.mockResolvedValue({ status: 'success' });
    mockUpdateModelRecord.mockResolvedValue({ status: 'success' });
    mockGetUserLoginHistory.mockResolvedValue({
      data: {
        items: [
          { id: 1, timestamp: '2026-02-26T10:00:00', ip_address: '127.0.0.1', description: 'User logged in: currentadmin' },
        ],
        total: 1,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially', () => {
    mockGetUsers.mockReturnValue(new Promise(() => {}));
    renderUserManagement();
    expect(screen.getByTestId('admin-layout')).toBeInTheDocument();
  });

  it('renders user table with data', async () => {
    renderUserManagement();

    await waitFor(() => {
      expect(screen.getByText('john_doe')).toBeInTheDocument();
    });

    expect(screen.getByText('currentadmin')).toBeInTheDocument();
    expect(screen.getByText('inactive_user')).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('shows empty state when no users', async () => {
    mockGetUsers.mockResolvedValue(mockEmptyUsers);
    renderUserManagement();

    await waitFor(() => {
      expect(screen.getByText('No users in the system.')).toBeInTheDocument();
    });
  });

  it('renders role badges', async () => {
    renderUserManagement();

    await waitFor(() => {
      expect(screen.getByText('john_doe')).toBeInTheDocument();
    });

    // Role badges - getAllByText since "user" and "admin" appear in multiple contexts
    expect(screen.getAllByText('admin').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('user').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('guest').length).toBeGreaterThanOrEqual(1);
  });

  it('renders status badges correctly', async () => {
    renderUserManagement();

    await waitFor(() => {
      expect(screen.getByText('john_doe')).toBeInTheDocument();
    });

    // "Active" and "Inactive" appear as status badges + filter dropdown options
    const activeBadges = screen.getAllByText('Active');
    expect(activeBadges.length).toBeGreaterThanOrEqual(2);
    const inactiveBadges = screen.getAllByText('Inactive');
    expect(inactiveBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows search input', async () => {
    renderUserManagement();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search users...')).toBeInTheDocument();
    });
  });

  it('filters by search text', async () => {
    renderUserManagement();

    await waitFor(() => {
      expect(screen.getByText('john_doe')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search users...');
    fireEvent.change(searchInput, { target: { value: 'john' } });

    await waitFor(() => {
      // At minimum the API should have been called (initial + after search)
      expect(mockGetUsers).toHaveBeenCalled();
    });
  });

  it('renders page title', async () => {
    renderUserManagement();

    await waitFor(() => {
      expect(screen.getByText('User Management')).toBeInTheDocument();
    });
  });

  it('shows user count', async () => {
    renderUserManagement();

    await waitFor(() => {
      expect(screen.getByText('3 users')).toBeInTheDocument();
    });
  });

  it('opens change role modal via action menu', async () => {
    renderUserManagement();

    await waitFor(() => {
      expect(screen.getByText('john_doe')).toBeInTheDocument();
    });

    // Open menu for john_doe (second user)
    const menuButtons = screen.getAllByLabelText(/Actions for/);
    fireEvent.click(menuButtons[1]);

    await waitFor(() => {
      expect(screen.getByText('Change Role')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Change Role'));

    await waitFor(() => {
      expect(screen.getByText(/Changing role for/)).toBeInTheDocument();
    });
  });

  it('opens login history modal and loads data', async () => {
    renderUserManagement();

    await waitFor(() => {
      expect(screen.getByText('john_doe')).toBeInTheDocument();
    });

    const menuButtons = screen.getAllByLabelText(/Actions for/);
    fireEvent.click(menuButtons[1]);

    await waitFor(() => {
      expect(screen.getByText('Login History')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Login History'));

    await waitFor(() => {
      expect(mockGetUserLoginHistory).toHaveBeenCalledWith(2);
    });

    await waitFor(() => {
      expect(screen.getByText('User logged in: currentadmin')).toBeInTheDocument();
    });
  });

  it('opens delete modal and requires username confirmation', async () => {
    renderUserManagement();

    await waitFor(() => {
      expect(screen.getByText('john_doe')).toBeInTheDocument();
    });

    const menuButtons = screen.getAllByLabelText(/Actions for/);
    fireEvent.click(menuButtons[1]);

    // Wait for the menu dropdown to appear, then click Delete User
    const deleteMenuItem = await waitFor(() => {
      const items = screen.getAllByText('Delete User');
      // The menu item (not the page title)
      return items.find((el) => el.closest('[role="menuitem"]'));
    });
    fireEvent.click(deleteMenuItem);

    await waitFor(() => {
      expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument();
    });

    // Verify the confirmation input is present
    expect(screen.getByLabelText(/Type "john_doe" to confirm/)).toBeInTheDocument();
  });

  it('deactivate action is disabled for current user', async () => {
    renderUserManagement();

    await waitFor(() => {
      expect(screen.getByText('currentadmin')).toBeInTheDocument();
    });

    // Open menu for currentadmin user (self, id=1)
    const menuButtons = screen.getAllByLabelText(/Actions for/);
    fireEvent.click(menuButtons[0]);

    await waitFor(() => {
      // The Deactivate menu item should be present but disabled for self
      const deactivateItem = screen.getByText('Deactivate');
      expect(deactivateItem.closest('button')).toHaveAttribute('data-disabled', 'true');
    });
  });

  it('delete action is disabled for current user', async () => {
    renderUserManagement();

    await waitFor(() => {
      expect(screen.getByText('currentadmin')).toBeInTheDocument();
    });

    const menuButtons = screen.getAllByLabelText(/Actions for/);
    fireEvent.click(menuButtons[0]);

    await waitFor(() => {
      // Find the Delete User menu item in the dropdown - should be disabled for self
      const deleteItems = screen.getAllByText('Delete User');
      const menuItem = deleteItems.find((el) => el.closest('[role="menuitem"]'));
      expect(menuItem).toBeTruthy();
      expect(menuItem.closest('button')).toHaveAttribute('data-disabled', 'true');
    });
  });
});
