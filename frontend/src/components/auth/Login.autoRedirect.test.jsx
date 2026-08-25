import { vi } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import Login from '../../pages/auth/Login';
import render from '../../test-utils/render';
import { clearAutoRedirectAttempts } from '../../utils/autoRedirectGuard';
import {
  stubLocation,
  stubWorkingSessionStorage,
} from '../../test-utils/browserStubs';

const mockNavigate = vi.fn();
let mockLocation = { search: '', state: null };
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}));

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// isAuthenticated is the one guard that cannot be driven through props, and the
// real provider would need a working session probe to flip it.
let mockAuth = {
  login: vi.fn(),
  error: null,
  clearError: vi.fn(),
  isAuthenticated: false,
  sessionEndedReason: null,
};
vi.mock('../../contexts/AuthContext', async () => ({
  ...(await vi.importActual('../../contexts/AuthContext')),
  useAuth: () => mockAuth,
}));

import { authService } from '../../services/auth/simpleAuthService';

vi.spyOn(authService, 'checkRegistrationEnabled');
vi.spyOn(authService, 'getSSOConfig');
vi.spyOn(authService, 'initiateSSOLogin');

/**
 * SSO_AUTO_REDIRECT: an unauthenticated visitor reaches the identity provider
 * without touching anything.
 *
 * Most of these are negative cases, and they are the point. A redirect that
 * fires when it should not is the logout loop this whole design exists to
 * prevent -- the provider still holds its session, re-authenticates silently,
 * and the user can never leave.
 */

const AUTO_REDIRECT_CONFIG = {
  enabled: true,
  provider_type: 'oidc',
  sso_only: false,
  auto_redirect: true,
};

/**
 * Let any in-flight effect promise settle, without burning wall-clock time.
 *
 * The effect fires synchronously on commit, so by the time an awaited element
 * has rendered, a redirect that was going to happen has already called
 * initiateSSOLogin. This just drains the microtask queue so its `.then` runs
 * before we assert it did not.
 */
const flushEffects = async () => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
  });
};

const rateLimitError = retryAfterSeconds => {
  const error = new Error('Too many SSO sign-in attempts.');
  error.status = 429;
  error.errorCode = 'RATE-429';
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
};

let assign;

beforeEach(() => {
  vi.clearAllMocks();
  clearAutoRedirectAttempts();
  mockLocation = { search: '', state: null };
  mockAuth = {
    login: vi.fn(),
    error: null,
    clearError: vi.fn(),
    isAuthenticated: false,
    sessionEndedReason: null,
  };

  assign = stubLocation('/login');

  authService.checkRegistrationEnabled.mockResolvedValue({
    registration_enabled: true,
  });
  authService.getSSOConfig.mockResolvedValue(AUTO_REDIRECT_CONFIG);
  authService.initiateSSOLogin.mockResolvedValue({
    auth_url: 'https://idp/authorize?state=abc',
  });
});

describe('the redirect fires', () => {
  test('sends an unauthenticated visitor to the provider with no interaction', async () => {
    render(<Login />);

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith('https://idp/authorize?state=abc')
    );
    expect(authService.initiateSSOLogin).toHaveBeenCalledTimes(1);
  });

  test('shows a redirecting notice instead of the form it is leaving', async () => {
    render(<Login />);

    expect(await screen.findByTestId('auto-redirect')).toBeInTheDocument();
    expect(document.querySelector('form')).not.toBeInTheDocument();
  });

  test('carries the deep link so the destination survives the round trip', async () => {
    mockLocation = {
      search: '?next=%2Flab-results%3Fstatus%3Dopen',
      state: null,
    };

    render(<Login />);

    await waitFor(() =>
      expect(authService.initiateSSOLogin).toHaveBeenCalledWith(
        '/lab-results?status=open'
      )
    );
  });

  test('fires exactly once even as config state settles', async () => {
    render(<Login />);

    await waitFor(() => expect(assign).toHaveBeenCalled());
    await flushEffects();
    expect(authService.initiateSSOLogin).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledTimes(1);
  });
});

describe('the redirect is suppressed', () => {
  const expectNoRedirect = async () => {
    // Wait on a rendered signal that only appears after config has loaded --
    // the effect's own precondition -- then drain microtasks.
    await screen.findByTestId('sso-section');
    await flushEffects();
    expect(authService.initiateSSOLogin).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  };

  test('by ?local=1 -- the operator escape hatch', async () => {
    mockLocation = { search: '?local=1', state: null };
    render(<Login />);
    await expectNoRedirect();
  });

  test('by a logout reason -- otherwise the provider signs them back in', async () => {
    mockLocation = { search: '?local=1&reason=logged_out', state: null };
    render(<Login />);
    await expectNoRedirect();
  });

  test('by a bare reason, with no local flag', async () => {
    mockLocation = { search: '?reason=session_expired', state: null };
    render(<Login />);
    await expectNoRedirect();
  });

  test('by the inactivity timeout reason (criterion 19)', async () => {
    // If this ever redirects, the session timeout has been silently disabled
    // deployment-wide: idle out, bounce, silent re-auth, back where you were.
    mockLocation = { search: '?local=1&reason=session_expired', state: null };
    render(<Login />);
    await expectNoRedirect();
  });

  test('by a failed startup probe (auth_unavailable)', async () => {
    mockLocation = { search: '?local=1&reason=auth_unavailable', state: null };
    render(<Login />);
    await expectNoRedirect();
  });

  test('by sessionEndedReason alone, with a completely clean URL', async () => {
    // The carrier that is NOT the URL, and the case that made it necessary.
    //
    // A reason reaches the URL only when ProtectedRoute runs, and ProtectedRoute
    // does not run for someone already sitting on /login. So a visitor parked on
    // the login page whose startup probe fails has a clean URL and a reason that
    // exists only in reducer state. Reading the URL alone bounced them to the
    // identity provider -- exactly the silent round trip auth_unavailable was
    // introduced to prevent.
    mockLocation = { search: '', state: null };
    mockAuth.sessionEndedReason = 'auth_unavailable';

    render(<Login />);

    await expectNoRedirect();
  });

  test('by sessionEndedReason after a logout, clean URL', async () => {
    // Same mechanism, the more common trigger: logout tears the session down
    // without navigating, and the redirect that follows must not undo it.
    mockLocation = { search: '', state: null };
    mockAuth.sessionEndedReason = 'logged_out';

    render(<Login />);

    await expectNoRedirect();
  });

  test('when the visitor is already authenticated', async () => {
    mockAuth.isAuthenticated = true;
    render(<Login />);
    await flushEffects();
    expect(authService.initiateSSOLogin).not.toHaveBeenCalled();
  });

  test('when auto_redirect is off', async () => {
    authService.getSSOConfig.mockResolvedValue({
      ...AUTO_REDIRECT_CONFIG,
      auto_redirect: false,
    });
    render(<Login />);
    await expectNoRedirect();
  });

  test('when SSO itself is off', async () => {
    authService.getSSOConfig.mockResolvedValue({
      enabled: false,
      auto_redirect: true,
    });
    render(<Login />);
    await flushEffects();
    expect(authService.initiateSSOLogin).not.toHaveBeenCalled();
  });

  test('when the config fetch failed -- never bounce on a guess', async () => {
    authService.checkRegistrationEnabled.mockResolvedValue({
      registration_enabled: false,
      error: true,
    });
    authService.getSSOConfig.mockResolvedValue({ enabled: false, error: true });

    render(<Login />);

    await screen.findByTestId('config-error', {}, { timeout: 8000 });
    expect(authService.initiateSSOLogin).not.toHaveBeenCalled();
  }, 15000);
});

describe('when the provider call fails', () => {
  test('a 429 explains the wait and does not retry into the limit', async () => {
    authService.initiateSSOLogin.mockRejectedValue(rateLimitError(45));

    render(<Login />);

    const notice = await screen.findByTestId('auto-redirect-throttled');
    expect(notice).toHaveTextContent('login.autoRedirect.rateLimited');
    expect(authService.initiateSSOLogin).toHaveBeenCalledTimes(1);
    expect(assign).not.toHaveBeenCalled();
  });

  test('a 429 with no Retry-After falls back to generic copy', async () => {
    // The header is strippable by a proxy, so the seconds are optional. The
    // alternative is rendering "wait null seconds".
    authService.initiateSSOLogin.mockRejectedValue(rateLimitError(null));

    render(<Login />);

    const notice = await screen.findByTestId('auto-redirect-throttled');
    expect(notice).toHaveTextContent('login.autoRedirect.rateLimitedGeneric');
  });

  test('a non-429 failure stops and says so', async () => {
    authService.initiateSSOLogin.mockRejectedValue(
      Object.assign(new Error('boom'), { status: 500 })
    );

    render(<Login />);

    expect(
      await screen.findByTestId('auto-redirect-failed')
    ).toBeInTheDocument();
    expect(authService.initiateSSOLogin).toHaveBeenCalledTimes(1);
  });

  test('a 200 with no auth_url is a failure, not a navigation', async () => {
    // Assigning an empty value navigates relative to the current page, which
    // reloads /login having spent the one-shot guard -- no notice, no way in.
    authService.initiateSSOLogin.mockResolvedValue({ provider: 'oidc' });

    render(<Login />);

    expect(
      await screen.findByTestId('auto-redirect-failed')
    ).toBeInTheDocument();
    await flushEffects();
    expect(assign).not.toHaveBeenCalled();
  });

  test('the SSO button stays available as the manual way in', async () => {
    // Under SSO_ONLY_MODE there is no password form behind this. If the button
    // went too, a throttled instance would be a blank page.
    authService.getSSOConfig.mockResolvedValue({
      ...AUTO_REDIRECT_CONFIG,
      sso_only: true,
    });
    authService.initiateSSOLogin.mockRejectedValue(rateLimitError(45));

    render(<Login />);

    await screen.findByTestId('auto-redirect-throttled');
    expect(screen.getByTestId('sso-section')).toBeInTheDocument();
  });
});

describe('the loop breaker', () => {
  // The global setup stubs sessionStorage with vi.fn()s that store nothing, so
  // the guard would fail open forever and this case could never fail. Give it a
  // real in-memory store: what is under test here is the integration when
  // storage works. The fail-open behavior when it does not is covered directly
  // in autoRedirectGuard.test.ts.
  beforeEach(() => {
    stubWorkingSessionStorage();
    clearAutoRedirectAttempts();
  });

  test('stops redirecting once the browser keeps coming back', async () => {
    // Three page loads that each bounce, then a fourth that must not. This is
    // the case the URL cannot cover: the provider returns the user to a clean
    // /login, so every in-memory guard resets with the document.
    for (let i = 0; i < 3; i += 1) {
      const { unmount } = render(<Login />);
      await waitFor(() => expect(assign).toHaveBeenCalledTimes(i + 1));
      unmount();
    }

    render(<Login />);

    expect(
      await screen.findByTestId('auto-redirect-failed')
    ).toBeInTheDocument();
    expect(assign).toHaveBeenCalledTimes(3);
  });
});
