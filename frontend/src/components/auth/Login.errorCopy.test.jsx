import { vi } from 'vitest';
import { screen } from '@testing-library/react';
import render from '../../test-utils/render';

/**
 * The login page must render our copy, not the server's.
 *
 * setupTests.js mocks react-i18next with a t() that always returns the default,
 * which would make "our copy" and "the server's copy" indistinguishable - the one
 * thing worth asserting here. This file overrides that mock with a German resource:
 * a known code renders German, an unknown one falls back to the server's text.
 *
 * Auth state is supplied directly because the render harness owns AuthContext; that
 * the code survives the service is covered in services/auth/errorCodes.test.js.
 */

const { KEYS } = vi.hoisted(() => ({
  KEYS: {
    'errors.invalid_credentials': 'Benutzername oder Passwort ist falsch.',
    'errors.account_deactivated': 'Dieses Konto wurde deaktiviert.',
    'errors.registration_disabled': 'Registrierung ist deaktiviert.',
  },
}));

vi.mock('react-i18next', async () => {
  const { i18nKeyMock } = await vi.importActual('../../test-utils/i18nKeyMock');
  return i18nKeyMock(KEYS);
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: '', state: null }),
}));

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import Login from '../../pages/auth/Login';
import { authService } from '../../services/auth/simpleAuthService';

vi.spyOn(authService, 'checkRegistrationEnabled');
vi.spyOn(authService, 'getSSOConfig');

const SERVER_COPY = 'Incorrect username or password';

const renderWithAuthError = (error, errorCode) =>
  render(<Login />, { authContextValue: { error, errorCode } });

beforeEach(() => {
  vi.clearAllMocks();
  authService.checkRegistrationEnabled.mockResolvedValue({
    registration_enabled: true,
  });
  authService.getSSOConfig.mockResolvedValue({ enabled: false });
});

describe('Login error copy', () => {
  test('a known code renders our translated copy, not the server text', async () => {
    renderWithAuthError(SERVER_COPY, 'invalid_credentials');

    expect(
      await screen.findByText(KEYS['errors.invalid_credentials'])
    ).toBeInTheDocument();
    expect(screen.queryByText(SERVER_COPY)).not.toBeInTheDocument();
  });

  /**
   * Both are 401s and only the code separates them, so this is the assertion that
   * would fail if the backend ever collapsed them back to a shared AUTH-401.
   */
  test('a deactivated account renders different copy from a bad password', async () => {
    renderWithAuthError(
      'This account has been deactivated.',
      'account_deactivated'
    );

    expect(
      await screen.findByText(KEYS['errors.account_deactivated'])
    ).toBeInTheDocument();
  });

  test('an unknown code falls back to the server text', async () => {
    renderWithAuthError(
      'a failure added after this build',
      'something_added_later'
    );

    expect(
      await screen.findByText('a failure added after this build')
    ).toBeInTheDocument();
  });

  test('registration-status copy comes from its message_code', async () => {
    authService.checkRegistrationEnabled.mockResolvedValue({
      registration_enabled: false,
      message_code: 'registration_disabled',
      message: 'Registration is currently disabled. Contact an administrator.',
    });

    render(<Login />);

    expect(
      await screen.findByText(KEYS['errors.registration_disabled'])
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Registration is currently disabled. Contact an administrator.'
      )
    ).not.toBeInTheDocument();
  });

  test('registration-status with no code falls back to the server text', async () => {
    authService.checkRegistrationEnabled.mockResolvedValue({
      registration_enabled: false,
      message: 'Some other reason entirely',
    });

    render(<Login />);

    expect(
      await screen.findByText('Some other reason entirely')
    ).toBeInTheDocument();
  });
});
