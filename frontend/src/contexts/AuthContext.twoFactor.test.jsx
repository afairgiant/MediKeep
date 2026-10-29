import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('../services/auth/simpleAuthService', () => ({
  authService: {
    getCurrentUser: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    verifyTwoFactor: vi.fn(),
  },
}));

vi.mock('../utils/notifyTranslated', () => ({
  notifySuccess: vi.fn(),
  notifyInfo: vi.fn(),
  notifyWarning: vi.fn(),
}));

vi.mock('../services/api/userPreferencesApi', () => ({
  getUserPreferences: vi.fn(),
}));

import { authService } from '../services/auth/simpleAuthService';
import { getUserPreferences } from '../services/api/userPreferencesApi';

const USER = { id: 3, username: 'jo', role: 'user' };

let lastResult;

function Harness() {
  const { login, completeTwoFactorLogin, isAuthenticated, isLoading, error } =
    useAuth();
  return (
    <div>
      <button
        onClick={async () => {
          lastResult = await login({ username: 'jo', password: 'pw' });
        }}
      >
        sign-in
      </button>
      <button
        onClick={async () => {
          lastResult = await completeTwoFactorLogin(
            'ticket-1',
            '123456',
            'totp'
          );
        }}
      >
        verify
      </button>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="error">{String(error)}</span>
    </div>
  );
}

const renderHarness = async () => {
  render(
    <AuthProvider>
      <Harness />
    </AuthProvider>
  );
  await waitFor(() =>
    expect(screen.getByTestId('loading')).toHaveTextContent('false')
  );
};

describe('AuthContext two-factor sign-in', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    lastResult = undefined;
    authService.getCurrentUser.mockResolvedValue(null);
    getUserPreferences.mockResolvedValue({ session_timeout_minutes: 120 });
    authService.login.mockResolvedValue({
      success: true,
      mfaRequired: true,
      mfaTicket: 'ticket-1',
      methods: ['totp', 'backup_code'],
    });
  });

  test('a password that needs a second factor does not sign in yet', async () => {
    await renderHarness();

    await userEvent.click(screen.getByText('sign-in'));

    await waitFor(() => expect(lastResult?.mfaRequired).toBe(true));
    expect(lastResult.mfaTicket).toBe('ticket-1');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    // Global loading would swap /login for a spinner and lose the challenge
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  test('a verified code signs in and reports the forced password change', async () => {
    authService.verifyTwoFactor.mockResolvedValue({
      success: true,
      user: USER,
      sessionTimeoutMinutes: 60,
      mustChangePassword: true,
      backupCodesRemaining: null,
    });
    await renderHarness();

    await userEvent.click(screen.getByText('verify'));

    await waitFor(() =>
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
    );
    expect(authService.verifyTwoFactor).toHaveBeenCalledWith(
      'ticket-1',
      '123456',
      'totp',
      false
    );
    expect(lastResult).toMatchObject({
      success: true,
      mustChangePassword: true,
    });
  });

  test('a session that cannot be saved locally is reported, not thrown', async () => {
    authService.verifyTwoFactor.mockResolvedValue({
      success: true,
      user: USER,
      sessionTimeoutMinutes: 60,
      mustChangePassword: false,
    });
    await renderHarness();
    const setItem = vi
      .spyOn(localStorage, 'setItem')
      .mockImplementationOnce(() => {
        throw new DOMException('blocked', 'SecurityError');
      });

    await userEvent.click(screen.getByText('verify'));

    await waitFor(() => expect(lastResult?.success).toBe(false));
    expect(lastResult.errorCode).toBeNull();
    setItem.mockRestore();
  });

  test('a rejected code is returned to the caller, not stored as the login error', async () => {
    authService.verifyTwoFactor.mockResolvedValue({
      success: false,
      error: 'That code is not valid.',
      errorCode: 'mfa_code_invalid',
    });
    await renderHarness();

    await userEvent.click(screen.getByText('verify'));

    await waitFor(() => expect(lastResult?.errorCode).toBe('mfa_code_invalid'));
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('error')).toHaveTextContent('null');
  });
});
