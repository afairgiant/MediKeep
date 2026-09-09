import { vi } from 'vitest';
import { screen } from '@testing-library/react';
import render from '../../test-utils/render';

/**
 * The SSO error page must render our copy, not the server's.
 *
 * setupTests.js mocks react-i18next with a t() that always returns the default,
 * which would make "our copy" and "the server's copy" indistinguishable - and that
 * is the one thing worth asserting here. So this file overrides that mock with a
 * German resource: a known code renders German, an unknown one falls back to the
 * server text rather than to a missing-key placeholder.
 *
 * error_description reaches this page as a URL parameter, so anyone who can hand a
 * user a link controls it. It must never reach the rendered page.
 */

const { KEYS } = vi.hoisted(() => ({
  KEYS: {
    'errors.registration_disabled': 'Registrierung ist deaktiviert.',
    'errors.sso_state_expired': 'Diese Anmeldung ist abgelaufen.',
    'errors.sso_provider_rejected': 'Ihr Anbieter hat die Anmeldung abgelehnt.',
  },
}));

vi.mock('react-i18next', async () => {
  const { i18nKeyMock } = await vi.importActual('../../test-utils/i18nKeyMock');
  return i18nKeyMock(KEYS);
});

let searchParams = new URLSearchParams();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
  useSearchParams: () => [searchParams, vi.fn()],
}));

vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => ({ login: vi.fn(), isAuthenticated: false }),
  };
});

import SSOCallback from './SSOCallback';
import { authService } from '../../services/auth/simpleAuthService';

const SERVER_COPY = 'Registration is currently disabled. Contact an admin.';

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams({ code: 'abc', state: 'xyz' });
  vi.spyOn(authService, 'completeSSOAuth');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SSO callback error copy', () => {
  test('a known code renders our translated copy, not the server text', async () => {
    authService.completeSSOAuth.mockResolvedValue({
      success: false,
      error: SERVER_COPY,
      errorCode: 'registration_disabled',
    });

    render(<SSOCallback />);

    expect(
      await screen.findByText(KEYS['errors.registration_disabled'])
    ).toBeInTheDocument();
    expect(screen.queryByText(SERVER_COPY)).not.toBeInTheDocument();
  });

  test('a different code renders its own copy', async () => {
    authService.completeSSOAuth.mockResolvedValue({
      success: false,
      error: 'State parameter expired',
      errorCode: 'sso_state_expired',
    });

    render(<SSOCallback />);

    expect(
      await screen.findByText(KEYS['errors.sso_state_expired'])
    ).toBeInTheDocument();
  });

  test('an unknown code falls back to the server text', async () => {
    authService.completeSSOAuth.mockResolvedValue({
      success: false,
      error: 'a failure added after this build',
      errorCode: 'something_added_later',
    });

    render(<SSOCallback />);

    expect(
      await screen.findByText('a failure added after this build')
    ).toBeInTheDocument();
  });

  test('an error with no code at all still renders something', async () => {
    authService.completeSSOAuth.mockResolvedValue({
      success: false,
      error: 'no code supplied',
      errorCode: null,
    });

    render(<SSOCallback />);

    expect(await screen.findByText('no code supplied')).toBeInTheDocument();
  });

  test('url-supplied error_description never reaches the page', async () => {
    searchParams = new URLSearchParams({
      error: 'access_denied',
      error_description: 'Call 555-0100 to verify your account',
    });

    render(<SSOCallback />);

    expect(
      await screen.findByText(KEYS['errors.sso_provider_rejected'])
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Call 555-0100 to verify your account')
    ).not.toBeInTheDocument();
  });

  test('provider rejection renders our copy with no description present', async () => {
    searchParams = new URLSearchParams({ error: 'access_denied' });

    render(<SSOCallback />);

    expect(
      await screen.findByText(KEYS['errors.sso_provider_rejected'])
    ).toBeInTheDocument();
  });
});
