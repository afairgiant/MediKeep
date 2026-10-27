import { vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import render from '../../test-utils/render';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: '?next=/lab-results', state: null }),
}));

vi.mock('../../utils/notifyTranslated', () => ({
  notifyError: vi.fn(),
  notifyWarning: vi.fn(),
  notifySuccess: vi.fn(),
  notifyInfo: vi.fn(),
}));

import Login from '../../pages/auth/Login';
import { authService } from '../../services/auth/simpleAuthService';
import { notifyWarning } from '../../utils/notifyTranslated';

vi.spyOn(authService, 'checkRegistrationEnabled');
vi.spyOn(authService, 'getSSOConfig');

const CHALLENGE = {
  success: true,
  mfaRequired: true,
  mfaTicket: 'ticket-1',
  methods: ['totp', 'backup_code'],
};

const login = vi.fn();
const completeTwoFactorLogin = vi.fn();

const renderLogin = () =>
  render(<Login />, {
    authContextValue: { login, completeTwoFactorLogin, clearError: vi.fn() },
  });

const signInWithPassword = async () => {
  await userEvent.type(screen.getByLabelText('shared:labels.username'), 'jo');
  await userEvent.type(screen.getByLabelText('shared:labels.password'), 'pw');
  await userEvent.click(screen.getByRole('button', { name: 'login.submit' }));
};

// The challenge replaces the form, so its PIN cells are the only text boxes
const typeCode = async code => {
  await screen.findByText('login.twoFactor.title');
  await userEvent.type(screen.getAllByRole('textbox')[0], code);
};

beforeEach(() => {
  vi.clearAllMocks();
  authService.checkRegistrationEnabled.mockResolvedValue({
    registration_enabled: true,
  });
  authService.getSSOConfig.mockResolvedValue({ enabled: false });
  login.mockResolvedValue(CHALLENGE);
});

describe('Login with two-factor', () => {
  test('a password that needs a code shows the challenge instead of the form', async () => {
    renderLogin();

    await signInWithPassword();

    expect(
      await screen.findByText('login.twoFactor.title')
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText('shared:labels.password')
    ).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('a verified code signs in and goes where the user was headed', async () => {
    completeTwoFactorLogin.mockResolvedValue({
      success: true,
      mustChangePassword: false,
      backupCodesRemaining: null,
    });
    renderLogin();
    await signInWithPassword();

    await typeCode('123456');

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/lab-results', {
        replace: true,
      })
    );
    expect(completeTwoFactorLogin).toHaveBeenCalledWith(
      'ticket-1',
      '123456',
      'totp'
    );
    expect(notifyWarning).not.toHaveBeenCalled();
  });

  test('a forced password change still comes after the code', async () => {
    completeTwoFactorLogin.mockResolvedValue({
      success: true,
      mustChangePassword: true,
    });
    renderLogin();
    await signInWithPassword();

    await typeCode('123456');

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/change-password', {
        replace: true,
      })
    );
  });

  test('signing in with one of the last backup codes warns the user', async () => {
    completeTwoFactorLogin.mockResolvedValue({
      success: true,
      mustChangePassword: false,
      backupCodesRemaining: 1,
    });
    renderLogin();
    await signInWithPassword();

    await typeCode('123456');

    await waitFor(() =>
      expect(notifyWarning).toHaveBeenCalledWith(
        'notifications:toasts.security.backupCodesLow',
        expect.objectContaining({ interpolation: { count: 1 } })
      )
    );
  });

  test('an expired ticket returns to the password form with an explanation', async () => {
    completeTwoFactorLogin.mockResolvedValue({
      success: false,
      error: 'This sign-in has expired.',
      errorCode: 'mfa_ticket_invalid',
    });
    renderLogin();
    await signInWithPassword();

    await typeCode('123456');

    expect(
      await screen.findByText('errors.mfa_ticket_invalid')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('shared:labels.password')).toHaveValue('');
    expect(screen.getByLabelText('shared:labels.username')).toHaveValue('jo');
  });

  test('back returns to the password form without an error', async () => {
    renderLogin();
    await signInWithPassword();

    await userEvent.click(
      await screen.findByRole('button', { name: 'login.twoFactor.back' })
    );

    expect(screen.getByLabelText('shared:labels.password')).toBeInTheDocument();
    expect(
      screen.queryByText('errors.mfa_ticket_invalid')
    ).not.toBeInTheDocument();
  });
});
