import { vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
  getActivityConfig: () => ({ SESSION_CHECK_INTERVAL: 100000 }),
}));

import { authService } from '../services/auth/simpleAuthService';
import { getUserPreferences } from '../services/api/userPreferencesApi';

/**
 * Two startup failures that are not the same failure.
 *
 * "The server answered, and the answer is no session" is a visitor who should
 * reach the identity provider under SSO_AUTO_REDIRECT -- that is the feature
 * working. "We never got an answer" is a network blip, and bouncing on it hides
 * the failure behind a round trip the user cannot interpret. Under
 * SSO_ONLY_MODE that round trip is the only way in, so the two cases look
 * identical from the outside unless we distinguish them here.
 *
 * getCurrentUser used to swallow every error and return null, which collapsed
 * them into one. Both assertions below are needed: covering only the throwing
 * case would pass even if the code suppressed unconditionally, which would
 * disable auto-redirect for genuinely-unauthenticated visitors.
 */

function Harness() {
  const { isAuthenticated, isLoading, sessionEndedReason } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="reason">{String(sessionEndedReason)}</span>
    </div>
  );
}

const renderApp = () =>
  render(
    <AuthProvider>
      <Harness />
    </AuthProvider>
  );

const settled = async () =>
  waitFor(() =>
    expect(screen.getByTestId('loading')).toHaveTextContent('false')
  );

beforeEach(() => {
  vi.clearAllMocks();
  getUserPreferences.mockResolvedValue({ session_timeout_minutes: 30 });
});

describe('when the server says there is no session', () => {
  test('records no reason, so the visitor still reaches the provider', async () => {
    authService.getCurrentUser.mockResolvedValue(null);

    renderApp();
    await settled();

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    // null, not a reason: a fresh visitor is exactly the auto-redirect case.
    expect(screen.getByTestId('reason')).toHaveTextContent('null');
  });
});

describe('when the probe could not reach the server', () => {
  test('records auth_unavailable, which suppresses the bounce', async () => {
    authService.getCurrentUser.mockRejectedValue(
      new TypeError('Failed to fetch')
    );

    renderApp();
    await settled();

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('reason')).toHaveTextContent('auth_unavailable');
  });

  test('a timeout is treated the same way', async () => {
    // makeRequest races a timeout and throws a plain Error on expiry.
    authService.getCurrentUser.mockRejectedValue(new Error('Request timeout'));

    renderApp();
    await settled();

    expect(screen.getByTestId('reason')).toHaveTextContent('auth_unavailable');
  });

  test('startup still finishes -- the app does not hang on a spinner', async () => {
    authService.getCurrentUser.mockRejectedValue(new Error('boom'));

    renderApp();

    await settled();
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });
});

describe('when the session is valid', () => {
  test('no reason is recorded', async () => {
    authService.getCurrentUser.mockResolvedValue({
      id: 1,
      username: 'jo',
      role: 'user',
    });

    renderApp();
    await settled();

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('reason')).toHaveTextContent('null');
  });

  test('a preferences failure does not become a session failure', async () => {
    // getUserPreferences has its own inner catch. If that ever leaked out, a
    // signed-in user would be torn down at startup by a non-auth request.
    authService.getCurrentUser.mockResolvedValue({
      id: 1,
      username: 'jo',
      role: 'user',
    });
    getUserPreferences.mockRejectedValue(new Error('prefs down'));

    renderApp();
    await settled();

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('reason')).toHaveTextContent('null');
  });
});
