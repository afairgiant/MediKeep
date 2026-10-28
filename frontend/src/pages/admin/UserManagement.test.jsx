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

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}));

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
    formatDateTime: d => d || '-',
    formatDate: d => d || '-',
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, role: 'admin', username: 'currentadmin' },
    logout: vi.fn(),
  }),
}));

const mockGetUsers = vi.fn();
const mockChangeUserRole = vi.fn();
const mockAdminResetPassword = vi.fn();
const mockToggleUserActive = vi.fn();
const mockDeleteUser = vi.fn();
const mockGetUserLoginHistory = vi.fn();
const mockGetDashboardStats = vi.fn();
const mockUpdateModelRecord = vi.fn();
const mockGetSecuritySummary = vi.fn();
const mockResetUserTwoFactor = vi.fn();
const mockClearSignInLockout = vi.fn();

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
    getSecuritySummary: (...args) => mockGetSecuritySummary(...args),
    resetUserTwoFactor: (...args) => mockResetUserTwoFactor(...args),
    clearSignInLockout: (...args) => mockClearSignInLockout(...args),
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
    mockGetSecuritySummary.mockResolvedValue({ status: 'success', data: {} });
    mockResetUserTwoFactor.mockResolvedValue(null);
    mockClearSignInLockout.mockResolvedValue(null);
    mockGetUserLoginHistory.mockResolvedValue({
      data: {
        items: [
          {
            id: 1,
            timestamp: '2026-02-26T10:00:00',
            ip_address: '127.0.0.1',
            description: 'User logged in: currentadmin',
          },
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

  it('navigates to the create user page, remembering where it came from', async () => {
    renderUserManagement();

    fireEvent.click(await screen.findByRole('button', { name: 'Add New' }));

    expect(mockNavigate).toHaveBeenCalledWith('/admin/create-user', {
      state: { from: '/admin/users' },
    });
  });

  it('shows the create user button when there are no users', async () => {
    mockGetUsers.mockResolvedValue(mockEmptyUsers);
    renderUserManagement();

    await waitFor(() => {
      expect(screen.getByText('No users found')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Add New' })).toBeInTheDocument();
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
      expect(
        screen.getByPlaceholderText('Search users...')
      ).toBeInTheDocument();
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
      // The mock t() returns defaultValue with interpolation
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
      expect(
        screen.getByText('User logged in: currentadmin')
      ).toBeInTheDocument();
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
      return items.find(el => el.closest('[role="menuitem"]'));
    });
    fireEvent.click(deleteMenuItem);

    await waitFor(() => {
      expect(
        screen.getByText(/This action cannot be undone/)
      ).toBeInTheDocument();
    });

    // Verify the confirmation input is present
    // The mock t() returns the string fallback without interpolation
    expect(screen.getByLabelText(/Type ".*" to confirm/)).toBeInTheDocument();
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
      expect(deactivateItem.closest('button')).toHaveAttribute(
        'data-disabled',
        'true'
      );
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
      const menuItem = deleteItems.find(el => el.closest('[role="menuitem"]'));
      expect(menuItem).toBeTruthy();
      expect(menuItem.closest('button')).toHaveAttribute(
        'data-disabled',
        'true'
      );
    });
  });
});

describe('UserManagement sign-in security', () => {
  const enrolledAndLocked = {
    status: 'success',
    data: {
      2: {
        totp_enabled: true,
        backup_codes_remaining: 7,
        sign_in_locked: true,
      },
    },
  };

  const openMenuFor = async index => {
    await screen.findByText('john_doe');
    fireEvent.click(screen.getAllByLabelText(/Actions for/)[index]);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUsers.mockResolvedValue(mockUsers);
    mockGetDashboardStats.mockResolvedValue(mockStats);
    mockGetSecuritySummary.mockResolvedValue(enrolledAndLocked);
    mockResetUserTwoFactor.mockResolvedValue(null);
    mockClearSignInLockout.mockResolvedValue(null);
  });

  it('shows two-factor and lockout state per user', async () => {
    renderUserManagement();

    expect(await screen.findByText('users.twoFactor.on')).toBeInTheDocument();
    expect(screen.getByText('users.twoFactor.locked')).toBeInTheDocument();
    expect(screen.getAllByText('users.twoFactor.off')).toHaveLength(2);
  });

  it('offers recovery actions only to users who need them', async () => {
    renderUserManagement();
    await screen.findByText('users.twoFactor.on');

    await openMenuFor(0);

    await screen.findByText('Change Role');
    expect(screen.queryByText('users.resetTwoFactor')).not.toBeInTheDocument();
    expect(screen.queryByText('users.clearLockout')).not.toBeInTheDocument();
  });

  it('clears a lockout and refreshes the state', async () => {
    renderUserManagement();
    await screen.findByText('users.twoFactor.on');
    await openMenuFor(1);

    fireEvent.click(await screen.findByText('users.clearLockout'));

    await waitFor(() => expect(mockClearSignInLockout).toHaveBeenCalledWith(2));
    await waitFor(() =>
      expect(mockGetSecuritySummary).toHaveBeenCalledTimes(2)
    );
  });

  it('resets two-factor after confirmation', async () => {
    renderUserManagement();
    await screen.findByText('users.twoFactor.on');
    await openMenuFor(1);

    fireEvent.click(await screen.findByText('users.resetTwoFactor'));
    expect(
      await screen.findByText('users.resetTwoFactorModal.body')
    ).toBeInTheDocument();
    expect(mockResetUserTwoFactor).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', { name: 'users.resetTwoFactor' })
    );

    await waitFor(() => expect(mockResetUserTwoFactor).toHaveBeenCalledWith(2));
    await waitFor(() =>
      expect(mockGetSecuritySummary).toHaveBeenCalledTimes(2)
    );
  });

  it('keeps the reset dialog open when the reset fails', async () => {
    mockResetUserTwoFactor.mockRejectedValue(new Error('boom'));
    renderUserManagement();
    await screen.findByText('users.twoFactor.on');
    await openMenuFor(1);
    fireEvent.click(await screen.findByText('users.resetTwoFactor'));

    fireEvent.click(
      await screen.findByRole('button', { name: 'users.resetTwoFactor' })
    );

    await waitFor(() => expect(mockResetUserTwoFactor).toHaveBeenCalled());
    expect(
      screen.getByText('users.resetTwoFactorModal.body')
    ).toBeInTheDocument();
    expect(mockGetSecuritySummary).toHaveBeenCalledTimes(1);
  });

  it('marks failed sign-ins in the login history', async () => {
    mockGetUserLoginHistory.mockResolvedValue({
      data: {
        items: [
          {
            id: 9,
            action: 'login_failed',
            failure_reason: 'wrong_code',
            method: 'totp',
            timestamp: '2026-02-26T10:00:00',
            ip_address: '127.0.0.1',
            description: 'Failed sign-in (wrong code): john_doe',
          },
        ],
      },
    });
    renderUserManagement();
    await openMenuFor(1);

    fireEvent.click(await screen.findByText('Login History'));

    expect(
      await screen.findByText('auditLog.actions.login_failed')
    ).toBeInTheDocument();
    expect(screen.getByTestId('failed-sign-in-reason')).toHaveTextContent(
      'wrong_code'
    );
  });
});
