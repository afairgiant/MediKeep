import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import render from '../../test-utils/render';
import TwoFactorChallenge from './TwoFactorChallenge';

const onVerify = vi.fn();
const onExpired = vi.fn();
const onCancel = vi.fn();

const renderChallenge = (
  methods: ('totp' | 'backup_code')[] = ['totp', 'backup_code'],
  rememberDeviceDays?: number
) =>
  render(
    <TwoFactorChallenge
      methods={methods}
      rememberDeviceDays={rememberDeviceDays}
      onVerify={onVerify}
      onExpired={onExpired}
      onCancel={onCancel}
    />
  );

const pinInputs = () => screen.getAllByRole('textbox');

beforeEach(() => {
  vi.clearAllMocks();
  onVerify.mockResolvedValue({ success: true });
});

describe('TwoFactorChallenge', () => {
  test('offers to remember the browser only when the server allows it', () => {
    renderChallenge(['totp'], 0);

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  test('sends the remember choice with the code', async () => {
    renderChallenge(['totp'], 30);

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'login.twoFactor.rememberDevice' })
    );
    await userEvent.type(pinInputs()[0], '123456');

    await waitFor(() =>
      expect(onVerify).toHaveBeenCalledWith('123456', 'totp', true)
    );
  });

  test('puts the remember choice before the code, which submits on its last digit', () => {
    renderChallenge(['totp'], 30);

    const checkbox = screen.getByRole('checkbox', {
      name: 'login.twoFactor.rememberDevice',
    });
    expect(
      checkbox.compareDocumentPosition(pinInputs()[0]) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  test('asks for an authenticator code first and submits once six digits are in', async () => {
    renderChallenge();

    expect(screen.getByText('login.twoFactor.totpPrompt')).toBeInTheDocument();
    await userEvent.type(pinInputs()[0], '123456');

    await waitFor(() =>
      expect(onVerify).toHaveBeenCalledWith('123456', 'totp', false)
    );
    expect(onVerify).toHaveBeenCalledTimes(1);
  });

  test('the verify button stays disabled until the code is complete', async () => {
    renderChallenge();

    await userEvent.type(pinInputs()[0], '123');

    expect(
      screen.getByRole('button', { name: 'login.twoFactor.verify' })
    ).toBeDisabled();
  });

  test('switches to a backup code', async () => {
    renderChallenge();

    await userEvent.click(
      screen.getByRole('button', { name: 'login.twoFactor.useBackupCode' })
    );
    await userEvent.type(
      screen.getByLabelText('login.twoFactor.backupCodeLabel'),
      'abcd-efgh'
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'login.twoFactor.verify' })
    );

    expect(onVerify).toHaveBeenCalledWith('abcd-efgh', 'backup_code', false);
  });

  test('a rejected code shows the error and clears the input', async () => {
    onVerify.mockResolvedValue({
      success: false,
      error: 'That code is not valid.',
      errorCode: 'mfa_code_invalid',
    });
    renderChallenge();

    await userEvent.type(pinInputs()[0], '000000');

    expect(await screen.findByTestId('two-factor-error')).toBeInTheDocument();
    expect(pinInputs()[0]).toHaveValue('');
    expect(onExpired).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId('last-attempt-warning')
    ).not.toBeInTheDocument();
  });

  test.each([
    ['sign_in_again', 'lastAttempt.signInAgain'],
    ['wait', 'lastAttempt.wait'],
  ])('warns when one try is left before %s', async (afterLast, warning) => {
    onVerify.mockResolvedValue({
      success: false,
      error: 'That code is incorrect.',
      errorCode: 'mfa_code_invalid',
      data: { attempts_remaining: 1, after_last: afterLast },
    });
    renderChallenge();

    await userEvent.type(pinInputs()[0], '000000');

    expect(await screen.findByTestId('last-attempt-warning')).toHaveTextContent(
      warning
    );
  });

  test('a reused code gets its own message', async () => {
    onVerify.mockResolvedValue({
      success: false,
      error: 'That code was already used.',
      errorCode: 'mfa_code_reused',
      data: { attempts_remaining: 3, after_last: 'sign_in_again' },
    });
    renderChallenge();

    await userEvent.type(pinInputs()[0], '123456');

    expect(await screen.findByTestId('two-factor-error')).toHaveTextContent(
      'That code was already used.'
    );
    expect(
      screen.queryByTestId('last-attempt-warning')
    ).not.toBeInTheDocument();
  });

  test('an expired ticket sends the user back to the password', async () => {
    onVerify.mockResolvedValue({
      success: false,
      error: 'This sign-in has expired.',
      errorCode: 'mfa_ticket_invalid',
    });
    renderChallenge();

    await userEvent.type(pinInputs()[0], '123456');

    await waitFor(() => expect(onExpired).toHaveBeenCalledTimes(1));
  });

  test('an unreadable secret moves the user to a backup code', async () => {
    onVerify.mockResolvedValue({
      success: false,
      error: 'Use one of your backup codes.',
      errorCode: 'mfa_secret_unavailable',
    });
    renderChallenge();

    await userEvent.type(pinInputs()[0], '123456');

    expect(
      await screen.findByLabelText('login.twoFactor.backupCodeLabel')
    ).toBeInTheDocument();
    expect(screen.getByTestId('two-factor-error')).toBeInTheDocument();
  });

  test('back returns to the password form', async () => {
    renderChallenge();

    await userEvent.click(
      screen.getByRole('button', { name: 'login.twoFactor.back' })
    );

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  test('offers no switch when only backup codes are allowed', () => {
    renderChallenge(['backup_code']);

    expect(
      screen.getByLabelText('login.twoFactor.backupCodeLabel')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'login.twoFactor.useAuthenticator' })
    ).not.toBeInTheDocument();
  });

  test('an error without a code shows our copy, not the raw message', async () => {
    onVerify.mockResolvedValue({
      success: false,
      error: 'Failed to fetch',
      errorCode: null,
    });
    renderChallenge();

    await userEvent.type(pinInputs()[0], '123456');

    expect(await screen.findByTestId('two-factor-error')).toHaveTextContent(
      'login.twoFactor.failed'
    );
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
  });
});
