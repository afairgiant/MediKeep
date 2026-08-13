import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('../services/auth/simpleAuthService', () => ({
  authService: {
    getCurrentUser: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock('../utils/notifyTranslated', () => ({
  notifySuccess: vi.fn(),
  notifyInfo: vi.fn(),
}));

vi.mock('../services/api/userPreferencesApi', () => ({
  getUserPreferences: vi.fn(),
}));

import { authService } from '../services/auth/simpleAuthService';
import { getUserPreferences } from '../services/api/userPreferencesApi';

const SSO_USER = {
  id: 7,
  username: 'ssouser',
  email: 'ssouser@example.com',
  role: 'user',
  authMethod: 'hybrid',
};

/**
 * Drives login() the way SSOCallback does and exposes the resulting state.
 */
function LoginHarness({ ssoOptions }) {
  const { login, mustChangePassword, isAuthenticated } = useAuth();

  return (
    <div>
      <button onClick={() => login(SSO_USER, ssoOptions)}>sso-login</button>
      <span data-testid="must-change">{String(mustChangePassword)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
    </div>
  );
}

/**
 * These tests guard the regression where the SSO branch of login() hardcoded
 * mustChangePassword to false, letting flagged SSO users reach a dashboard where
 * every API call returned 403 with no path forward.
 */
describe('AuthContext login - SSO mustChangePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // No existing session - the provider's init effect resolves to logged out
    authService.getCurrentUser.mockResolvedValue(null);
    getUserPreferences.mockResolvedValue({ session_timeout_minutes: 120 });
  });

  const renderHarness = async ssoOptions => {
    render(
      <AuthProvider>
        <LoginHarness ssoOptions={ssoOptions} />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(authService.getCurrentUser).toHaveBeenCalledTimes(1)
    );
  };

  test('carries mustChangePassword through from the SSO login response', async () => {
    const user = userEvent.setup();
    await renderHarness({ sso: true, mustChangePassword: true });

    await user.click(screen.getByText('sso-login'));

    await waitFor(() =>
      expect(screen.getByTestId('must-change')).toHaveTextContent('true')
    );
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
  });

  test('leaves mustChangePassword false when the SSO response does not set it', async () => {
    const user = userEvent.setup();
    await renderHarness({ sso: true, mustChangePassword: false });

    await user.click(screen.getByText('sso-login'));

    await waitFor(() =>
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
    );
    expect(screen.getByTestId('must-change')).toHaveTextContent('false');
  });

  test('defaults to false when the SSO caller omits the flag', async () => {
    const user = userEvent.setup();
    await renderHarness({ sso: true });

    await user.click(screen.getByText('sso-login'));

    await waitFor(() =>
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
    );
    expect(screen.getByTestId('must-change')).toHaveTextContent('false');
  });

  test('SSO login and session restore agree on the flag', async () => {
    // Session restore reads must_change_password off /users/me. Before the fix
    // the login path hardcoded false, so the two disagreed and a page refresh
    // changed the app's behavior.
    authService.getCurrentUser.mockResolvedValue({
      ...SSO_USER,
      must_change_password: true,
    });

    render(
      <AuthProvider>
        <LoginHarness ssoOptions={{ sso: true, mustChangePassword: true }} />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('must-change')).toHaveTextContent('true')
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('sso-login'));

    await waitFor(() =>
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
    );
    expect(screen.getByTestId('must-change')).toHaveTextContent('true');
  });

  test('password login still reads the flag from the login result', async () => {
    authService.login.mockResolvedValue({
      success: true,
      user: { id: 1, username: 'localuser', role: 'user' },
      sessionTimeoutMinutes: 60,
      mustChangePassword: true,
    });

    function PasswordLoginHarness() {
      const { login, mustChangePassword } = useAuth();
      return (
        <div>
          <button
            onClick={() =>
              login({ username: 'localuser', password: 'password123' })
            }
          >
            password-login
          </button>
          <span data-testid="must-change">{String(mustChangePassword)}</span>
        </div>
      );
    }

    render(
      <AuthProvider>
        <PasswordLoginHarness />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(authService.getCurrentUser).toHaveBeenCalledTimes(1)
    );

    const user = userEvent.setup();
    await user.click(screen.getByText('password-login'));

    await waitFor(() =>
      expect(screen.getByTestId('must-change')).toHaveTextContent('true')
    );
  });
});
