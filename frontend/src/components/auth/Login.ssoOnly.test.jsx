import { vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import Login from '../../pages/auth/Login';
import render from '../../test-utils/render';

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

import { authService } from '../../services/auth/simpleAuthService';

vi.spyOn(authService, 'checkRegistrationEnabled');
vi.spyOn(authService, 'getSSOConfig');
vi.spyOn(authService, 'initiateSSOLogin');

/**
 * What SSO_ONLY_MODE removes from the login page.
 *
 * Hiding the form is cosmetic -- the server returns 403 to POST /auth/login
 * regardless -- but showing a form the server refuses is a dead end for anyone
 * who does not already know the instance is SSO-only.
 */

const form = () => document.querySelector('form');
// t() returns the raw key in tests -- translations are not loaded. Asserting on
// the key is the convention the existing Login.test.jsx uses.
const createAccountButton = () => screen.queryByText('login.createAccount');

beforeEach(() => {
  vi.clearAllMocks();
  mockLocation = { search: '', state: null };
  authService.initiateSSOLogin.mockResolvedValue({
    auth_url: 'https://idp/authorize',
  });
});

describe('SSO-only mode', () => {
  const ssoOnlyConfig = {
    enabled: true,
    provider_type: 'oidc',
    sso_only: true,
    auto_redirect: false,
  };

  beforeEach(() => {
    // The server reports registration off under this flag, with its own message.
    authService.checkRegistrationEnabled.mockResolvedValue({
      registration_enabled: false,
      message: 'This instance uses single sign-on.',
    });
    authService.getSSOConfig.mockResolvedValue(ssoOnlyConfig);
  });

  test('hides the password form', async () => {
    render(<Login />);

    await screen.findByTestId('sso-section');
    expect(form()).not.toBeInTheDocument();
    expect(document.getElementById('username')).not.toBeInTheDocument();
    expect(document.getElementById('password')).not.toBeInTheDocument();
  });

  test('keeps the SSO button -- it is the only way in', async () => {
    render(<Login />);

    expect(await screen.findByTestId('sso-section')).toBeInTheDocument();
  });

  test('hides the create-account block and explains why in our own copy', async () => {
    render(<Login />);

    await screen.findByTestId('sso-only-notice');
    expect(createAccountButton()).not.toBeInTheDocument();
    // The server's English message must not be what the user reads.
    expect(
      screen.queryByText('This instance uses single sign-on.')
    ).not.toBeInTheDocument();
  });

  test('?local=1 does NOT bring the password form back', async () => {
    // The bypass test. `local=1` suppresses the redirect to the identity
    // provider and nothing else. If this ever passes with a form rendered,
    // the escape hatch has become an authentication bypass in a query string --
    // the server still refuses these credentials, so the form would only
    // mislead, but the coupling is the bug.
    mockLocation = { search: '?local=1', state: null };

    render(<Login />);

    await screen.findByTestId('sso-section');
    expect(form()).not.toBeInTheDocument();
  });

  test('?local=1&reason=logged_out still hides the form', async () => {
    mockLocation = { search: '?local=1&reason=logged_out', state: null };

    render(<Login />);

    await screen.findByTestId('sso-section');
    expect(form()).not.toBeInTheDocument();
  });
});

describe('without SSO-only mode', () => {
  test('the password form and create-account button are unchanged', async () => {
    authService.checkRegistrationEnabled.mockResolvedValue({
      registration_enabled: true,
    });
    authService.getSSOConfig.mockResolvedValue({
      enabled: true,
      sso_only: false,
      auto_redirect: false,
    });

    render(<Login />);

    await screen.findByTestId('sso-section');
    expect(form()).toBeInTheDocument();
    expect(createAccountButton()).toBeInTheDocument();
    expect(screen.queryByTestId('sso-only-notice')).not.toBeInTheDocument();
  });

  test('sso_only is ignored when SSO itself is off', async () => {
    // Incoherent payload -- startup validation refuses to boot on it. If it
    // ever reaches the client, trusting it would leave a login page with no
    // form and no SSO button.
    authService.checkRegistrationEnabled.mockResolvedValue({
      registration_enabled: true,
    });
    authService.getSSOConfig.mockResolvedValue({
      enabled: false,
      sso_only: true,
    });

    render(<Login />);

    await waitFor(() => expect(form()).toBeInTheDocument());
  });
});

describe('when the config fetch fails', () => {
  test('shows the retry notice AND keeps the password form', async () => {
    // We cannot know the instance is SSO-only when we could not ask. Hiding the
    // form on a guess is the blank page with no way in; showing it costs at
    // worst a rejected submit, since the server is the boundary either way.
    authService.checkRegistrationEnabled.mockResolvedValue({
      registration_enabled: false,
      error: true,
    });
    authService.getSSOConfig.mockResolvedValue({ enabled: false, error: true });

    render(<Login />);

    expect(await screen.findByTestId('config-error', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(form()).toBeInTheDocument();
    expect(screen.queryByTestId('sso-only-notice')).not.toBeInTheDocument();
    // And nothing was redirected anywhere off a failed read.
    expect(authService.initiateSSOLogin).not.toHaveBeenCalled();
  }, 15000);
});
