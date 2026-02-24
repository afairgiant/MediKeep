import React from 'react';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';

// ─── Router mocks ─────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
  useParams: () => ({ modelName: 'user', recordId: '1' }),
}));

// ─── secureStorage mock ───────────────────────────────────────────────────────

const mockGetJSON = vi.fn();

vi.mock('../../../utils/secureStorage', () => ({
  secureStorage: {
    getJSON: (...args) => mockGetJSON(...args),
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  legacyMigration: { migrate: vi.fn() },
}));

// ─── AuthContext mock ─────────────────────────────────────────────────────────

const mockLogout = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    logout: mockLogout,
  }),
}));

// ─── ThemeContext mock (required by AdminLayout) ──────────────────────────────

vi.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }),
  MantineIntegratedThemeProvider: ({ children }) => children,
}));

// ─── adminApiService mock ─────────────────────────────────────────────────────

const mockUpdateModelRecord = vi.fn().mockResolvedValue({});
const mockGetModelMetadata = vi.fn().mockResolvedValue({
  display_name: 'User',
  fields: [
    { name: 'id', type: 'integer', primary_key: true, nullable: false },
    { name: 'username', type: 'string', primary_key: false, nullable: false, max_length: 100 },
    { name: 'email', type: 'string', primary_key: false, nullable: false, max_length: 200 },
    { name: 'role', type: 'string', primary_key: false, nullable: false, max_length: 50 },
  ],
});
const mockGetModelRecord = vi.fn().mockResolvedValue({
  id: 1,
  username: 'admin',
  email: 'admin@test.com',
  role: 'admin',
});

vi.mock('../../../services/api/adminApi', () => ({
  adminApiService: {
    updateModelRecord: (...args) => mockUpdateModelRecord(...args),
    getModelMetadata: (...args) => mockGetModelMetadata(...args),
    getModelRecord: (...args) => mockGetModelRecord(...args),
  },
}));

// ─── Miscellaneous dependency mocks ──────────────────────────────────────────

vi.mock('../../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../components/admin/AdminLayout', () => ({
  default: ({ children }) => <div data-testid="admin-layout">{children}</div>,
}));

vi.mock('../../../components/auth', () => ({
  AdminResetPasswordModal: () => null,
}));

vi.mock('../../../components', () => ({
  Loading: ({ message }) => <div data-testid="loading">{message}</div>,
}));

vi.mock('../../../components/ui', () => ({
  Button: ({ children, onClick, disabled, loading: _loading, ...props }) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../../../constants/validationConstants', () => ({
  EDIT_EXCLUDED_FIELDS: ['password', 'hashed_password'],
}));

vi.mock('../../../hooks/useFieldHandlers', () => ({
  useFieldHandlers: (setFormData, setValidationErrors) => ({
    handleFieldChange: (fieldName, value) => {
      setFormData(prev => ({ ...prev, [fieldName]: value }));
      setValidationErrors(prev => (prev[fieldName] ? { ...prev, [fieldName]: null } : prev));
    },
  }),
}));

vi.mock('../../../utils/fieldValidation', () => ({
  validateForm: vi.fn(() => ({ hasErrors: false, errors: {} })),
}));

vi.mock('../../../utils/formatters', () => ({
  formatFieldLabel: (name) => name.charAt(0).toUpperCase() + name.slice(1),
}));

vi.mock('../../../components/admin/FieldRenderer', () => ({
  default: ({ field, value, onFieldChange }) => (
    <input
      data-testid={`field-${field.name}`}
      value={value || ''}
      onChange={(e) => onFieldChange(field.name, e.target.value)}
    />
  ),
}));

vi.mock('../ModelEdit.css', () => ({}));

// ─── Component import (after all mocks) ──────────────────────────────────────

import ModelEdit from '../ModelEdit';

// ─── Render helper ────────────────────────────────────────────────────────────

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={['/admin/models/user/1']}>
      <MantineProvider>
        <ModelEdit />
      </MantineProvider>
    </MemoryRouter>
  );

// ─── Shared wait helper ───────────────────────────────────────────────────────

const waitForLoad = () =>
  waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument());

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ModelEdit security', () => {
  let originalConfirm;
  let originalAlert;
  let localStorageGetItemSpy;
  let localStorageRemoveItemSpy;

  beforeEach(() => {
    vi.clearAllMocks();

    originalConfirm = window.confirm;
    originalAlert = window.alert;
    window.confirm = vi.fn().mockReturnValue(true);
    window.alert = vi.fn();

    localStorageGetItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    localStorageRemoveItemSpy = vi.spyOn(Storage.prototype, 'removeItem');

    // Default: current user matches the record being edited (own-account scenario)
    mockGetJSON.mockResolvedValue({ username: 'admin', role: 'admin' });
  });

  afterEach(() => {
    window.confirm = originalConfirm;
    window.alert = originalAlert;
    localStorageGetItemSpy.mockRestore();
    localStorageRemoveItemSpy.mockRestore();
  });

  test('uses secureStorage.getJSON instead of localStorage.getItem when saving a user record', async () => {
    renderComponent();
    await waitForLoad();

    const usernameInput = screen.getByTestId('field-username');
    await act(async () => {
      fireEvent.change(usernameInput, { target: { value: 'newadmin' } });
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mockGetJSON).toHaveBeenCalledWith('user');
    });

    // localStorage.getItem must never be called with 'user' directly by the component
    const userDirectCalls = localStorageGetItemSpy.mock.calls.filter(
      ([key]) => key === 'user'
    );
    expect(userDirectCalls).toHaveLength(0);
  });

  test('calls logout() from AuthContext instead of localStorage.removeItem when own username changes', async () => {
    renderComponent();
    await waitForLoad();

    const usernameInput = screen.getByTestId('field-username');
    await act(async () => {
      fireEvent.change(usernameInput, { target: { value: 'newadmin' } });
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });

    // localStorage.removeItem must not have been called with 'user' (or any auth key)
    const authRemoveCalls = localStorageRemoveItemSpy.mock.calls.filter(([key]) =>
      ['user', 'token', 'tokenExpiry'].includes(key)
    );
    expect(authRemoveCalls).toHaveLength(0);
  });

  test('calls navigate("/login") instead of window.location.href after logout on own username change', async () => {
    const hrefSetter = vi.fn();
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: {
        ...window.location,
        get href() {
          return window.location._href || '';
        },
        set href(val) {
          hrefSetter(val);
        },
      },
    });

    renderComponent();
    await waitForLoad();

    const usernameInput = screen.getByTestId('field-username');
    await act(async () => {
      fireEvent.change(usernameInput, { target: { value: 'newadmin' } });
    });

    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    // window.location.href must not have been assigned '/login' (or any login path)
    const loginHrefCalls = hrefSetter.mock.calls.filter(([val]) =>
      typeof val === 'string' && val.includes('login')
    );
    expect(loginHrefCalls).toHaveLength(0);

    // Restore window.location
    if (originalDescriptor) {
      Object.defineProperty(window, 'location', originalDescriptor);
    }
  });
});
