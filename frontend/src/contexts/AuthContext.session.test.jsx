import { vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
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
  notifyWarning: vi.fn(),
}));

vi.mock('../services/api/userPreferencesApi', () => ({
  getUserPreferences: vi.fn(),
}));

vi.mock('../config/activityConfig', () => ({
  getActivityConfig: () => ({ SESSION_CHECK_INTERVAL: 1000 }),
}));

import { authService } from '../services/auth/simpleAuthService';
import { getUserPreferences } from '../services/api/userPreferencesApi';
import { notifyWarning } from '../utils/notifyTranslated';

const USER = { id: 3, username: 'jo', role: 'user' };

function Harness() {
  const { login, logout, isAuthenticated, sessionEndedReason } = useAuth();

  return (
    <div>
      <button onClick={() => login({ username: 'jo', password: 'pw' })}>
        sign-in
      </button>
      <button onClick={() => logout()}>sign-out</button>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="reason">{String(sessionEndedReason)}</span>
    </div>
  );
}

/**
 * These cover the difference between "this session ended" and "there was never a
 * session", which is the whole basis of redirect suppression. Get it wrong in one
 * direction and logging out bounces the user to an IdP that signs them straight
 * back in; get it wrong in the other and a visitor who wants to sign in is
 * stranded on a login form under SSO_AUTO_REDIRECT.
 */
describe('AuthContext session teardown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    authService.getCurrentUser.mockResolvedValue(null);
    authService.logout.mockResolvedValue(undefined);
    authService.login.mockResolvedValue({
      success: true,
      user: USER,
      sessionTimeoutMinutes: 120,
    });
    getUserPreferences.mockResolvedValue({ session_timeout_minutes: 120 });
  });

  const renderHarness = async () => {
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(authService.getCurrentUser).toHaveBeenCalledTimes(1)
    );
  };

  const signIn = async user => {
    await user.click(screen.getByText('sign-in'));
    await waitFor(() =>
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
    );
  };

  test('no session at startup records no reason', async () => {
    await renderHarness();

    // A visitor who simply is not signed in. Under SSO_AUTO_REDIRECT this
    // redirect SHOULD reach the identity provider.
    expect(screen.getByTestId('reason')).toHaveTextContent('null');
  });

  test('logging out records logged_out', async () => {
    const user = userEvent.setup();
    await renderHarness();
    await signIn(user);

    await user.click(screen.getByText('sign-out'));

    await waitFor(() =>
      expect(screen.getByTestId('reason')).toHaveTextContent('logged_out')
    );
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(authService.logout).toHaveBeenCalledTimes(1);
  });

  test('signing back in clears the reason', async () => {
    const user = userEvent.setup();
    await renderHarness();
    await signIn(user);
    await user.click(screen.getByText('sign-out'));
    await waitFor(() =>
      expect(screen.getByTestId('reason')).toHaveTextContent('logged_out')
    );

    await signIn(user);

    // Otherwise the next redirect for any reason would still claim the user had
    // been signed out.
    expect(screen.getByTestId('reason')).toHaveTextContent('null');
  });

  /**
   * The inactivity timeout tears the session down directly rather than calling
   * logout(). Suppression placed inside logout() would miss it entirely, and
   * under SSO_AUTO_REDIRECT an idle-timed-out user would be bounced to an IdP
   * that still holds a live session and signed straight back in - the timeout
   * disabled for the whole deployment.
   */
  test('the inactivity timeout records session_expired', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({
        advanceTimers: vi.advanceTimersByTime.bind(vi),
      });
      await renderHarness();
      await signIn(user);

      // Past the 120-minute default, then far enough for the check interval.
      await act(async () => {
        vi.advanceTimersByTime(121 * 60 * 1000);
      });

      await waitFor(() =>
        expect(screen.getByTestId('reason')).toHaveTextContent(
          'session_expired'
        )
      );
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * simpleAuthService.logout() used to swallow a non-2xx from POST /auth/logout,
   * so the client cleared its state while the HttpOnly cookie stayed valid - a
   * logged-out UI over a live session. It now throws; this is what the app does
   * with that.
   */
  test('a failed server logout still tears down locally, and says so', async () => {
    const user = userEvent.setup();
    authService.logout.mockRejectedValue(new Error('Logout failed with status 500'));
    await renderHarness();
    await signIn(user);

    await user.click(screen.getByText('sign-out'));

    await waitFor(() =>
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false')
    );
    // Refusing to tear down would leave someone who clicked "log out" holding an
    // authenticated session, which is worse on a shared workstation.
    expect(screen.getByTestId('reason')).toHaveTextContent('logged_out');
    // But the cookie may still be live, so the user has to be told.
    expect(notifyWarning).toHaveBeenCalledWith(
      'notifications:toasts.auth.logoutIncomplete'
    );
  });
});
