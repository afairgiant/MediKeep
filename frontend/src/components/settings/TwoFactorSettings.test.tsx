import { describe, test, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import render from '../../test-utils/render';

vi.mock('../adapters/ResponsiveModal', () => ({
  ResponsiveModal: ({
    opened,
    title,
    children,
  }: {
    opened: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    opened ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

vi.mock('../../services/api/securityApi', () => ({
  getTwoFactorStatus: vi.fn(),
  startTotpSetup: vi.fn(),
  confirmTotpSetup: vi.fn(),
  disableTwoFactor: vi.fn(),
  regenerateBackupCodes: vi.fn(),
  revokeOtherSessions: vi.fn(),
}));

vi.mock('../../utils/notifyTranslated', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

import TwoFactorSettings from './TwoFactorSettings';
import OtherSessionsSetting from './OtherSessionsSetting';
import {
  confirmTotpSetup,
  disableTwoFactor,
  getTwoFactorStatus,
  regenerateBackupCodes,
  revokeOtherSessions,
  startTotpSetup,
} from '../../services/api/securityApi';
import { notifyError, notifySuccess } from '../../utils/notifyTranslated';

const OFF = {
  totp_enabled: false,
  backup_codes_remaining: 0,
  enrollment_allowed: true,
  blocked_reason: null,
};
const ON = { ...OFF, totp_enabled: true, backup_codes_remaining: 8 };
const CODES = ['AAAA-BBBB', 'CCCC-DDDD'];

const refusal = (message: string, errorCode: string) =>
  Object.assign(new Error(message), { status: 400, errorCode });

const dialog = (name: string) => screen.getByRole('dialog', { name });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getTwoFactorStatus).mockResolvedValue(OFF);
});

describe('TwoFactorSettings status', () => {
  test('offers to turn two-factor on when it is off', async () => {
    render(<TwoFactorSettings />);

    expect(
      await screen.findByRole('button', { name: 'security.twoFactor.enable' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('security.twoFactor.statusOff')
    ).toBeInTheDocument();
  });

  test('shows the remaining backup codes when it is on', async () => {
    vi.mocked(getTwoFactorStatus).mockResolvedValue(ON);
    render(<TwoFactorSettings />);

    expect(
      await screen.findByRole('button', { name: 'security.twoFactor.disable' })
    ).toBeInTheDocument();
    expect(screen.getByTestId('backup-codes-remaining')).toHaveTextContent(
      'security.twoFactor.codesRemaining'
    );
  });

  test('warns when two or fewer backup codes are left', async () => {
    vi.mocked(getTwoFactorStatus).mockResolvedValue({
      ...ON,
      backup_codes_remaining: 2,
    });
    render(<TwoFactorSettings />);

    expect(
      await screen.findByTestId('backup-codes-remaining')
    ).toHaveTextContent('security.twoFactor.lowCodes');
  });

  test('explains why it cannot be turned on, with no button', async () => {
    vi.mocked(getTwoFactorStatus).mockResolvedValue({
      ...OFF,
      enrollment_allowed: false,
      blocked_reason: 'secret_key_not_configured',
    });
    render(<TwoFactorSettings />);

    // The global t() mock returns defaultValue, which is the unknown-reason copy
    expect(
      await screen.findByText('security.twoFactor.blocked.unknown')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'security.twoFactor.enable' })
    ).not.toBeInTheDocument();
  });

  test('a failed status load can be retried', async () => {
    vi.mocked(getTwoFactorStatus).mockRejectedValueOnce(new Error('down'));
    render(<TwoFactorSettings />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'security.twoFactor.retry' })
    );

    expect(
      await screen.findByRole('button', { name: 'security.twoFactor.enable' })
    ).toBeInTheDocument();
    expect(getTwoFactorStatus).toHaveBeenCalledTimes(2);
  });
});

describe('TwoFactorSettings setup', () => {
  const openSetup = async () => {
    render(<TwoFactorSettings />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'security.twoFactor.enable' })
    );
    return screen.findByRole('dialog', {
      name: 'security.twoFactor.setup.title',
    });
  };

  const submitPassword = async (setup: HTMLElement, password: string) => {
    await userEvent.type(
      within(setup).getByLabelText(/security.password.currentPassword/),
      password
    );
    await userEvent.click(
      within(setup).getByRole('button', {
        name: 'security.twoFactor.setup.continue',
      })
    );
  };

  test('password, then QR and code, then the backup codes', async () => {
    vi.mocked(startTotpSetup).mockResolvedValue({
      secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
      otpauth_uri: 'otpauth://totp/MediKeep:jo?secret=JBSWY3DPEHPK3PXP',
    });
    vi.mocked(confirmTotpSetup).mockResolvedValue({ backup_codes: CODES });
    const setup = await openSetup();

    await submitPassword(setup, 'pw');

    expect(await screen.findByTestId('totp-secret')).toHaveTextContent(
      'JBSW Y3DP EHPK'
    );
    expect(startTotpSetup).toHaveBeenCalledWith('pw');

    await userEvent.type(within(setup).getAllByRole('textbox')[0], '123456');

    expect(
      await screen.findByRole('dialog', {
        name: 'security.twoFactor.backupCodes.title',
      })
    ).toBeInTheDocument();
    expect(confirmTotpSetup).toHaveBeenCalledWith('123456');
    expect(screen.getByText('AAAA-BBBB')).toBeInTheDocument();
    expect(notifySuccess).toHaveBeenCalledWith(
      'notifications:toasts.security.twoFactorEnabled'
    );
  });

  test('an expired setup goes back to the password step', async () => {
    vi.mocked(startTotpSetup).mockResolvedValue({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauth_uri: 'otpauth://totp/MediKeep:jo?secret=JBSWY3DPEHPK3PXP',
    });
    vi.mocked(confirmTotpSetup).mockRejectedValue(
      Object.assign(new Error('Two-factor setup expired.'), {
        status: 409,
        errorCode: 'two_factor_setup_not_started',
      })
    );
    const setup = await openSetup();
    await submitPassword(setup, 'pw');
    await screen.findByTestId('totp-secret');

    await userEvent.type(within(setup).getAllByRole('textbox')[0], '123456');

    expect(
      await within(setup).findByLabelText(/security.password.currentPassword/)
    ).toBeInTheDocument();
    expect(screen.queryByTestId('totp-secret')).not.toBeInTheDocument();
    expect(within(setup).getByRole('alert')).toHaveTextContent(
      'Two-factor setup expired.'
    );
  });

  test('a wrong password keeps the dialog open with the reason', async () => {
    vi.mocked(startTotpSetup).mockRejectedValue(
      refusal('Current password is incorrect', 'current_password_incorrect')
    );
    const setup = await openSetup();

    await submitPassword(setup, 'nope');

    expect(await within(setup).findByRole('alert')).toHaveTextContent(
      'Current password is incorrect'
    );
    expect(screen.queryByTestId('totp-secret')).not.toBeInTheDocument();
  });
});

describe('TwoFactorSettings changes that need the password and a code', () => {
  beforeEach(() => {
    vi.mocked(getTwoFactorStatus).mockResolvedValue(ON);
  });

  const open = async (button: string, title: string) => {
    render(<TwoFactorSettings />);
    await userEvent.click(await screen.findByRole('button', { name: button }));
    return dialog(title);
  };

  const confirmIn = async (modal: HTMLElement, submit: string) => {
    await userEvent.type(
      within(modal).getByLabelText(/security.password.currentPassword/),
      'pw'
    );
    await userEvent.type(
      within(modal).getByLabelText(
        /security.twoFactor.confirmIdentity.codeLabel/
      ),
      ' 123456 '
    );
    await userEvent.click(within(modal).getByRole('button', { name: submit }));
  };

  test('turning it off sends both and reloads the status', async () => {
    vi.mocked(disableTwoFactor).mockResolvedValue({});
    const modal = await open(
      'security.twoFactor.disable',
      'security.twoFactor.disableModal.title'
    );

    await confirmIn(modal, 'security.twoFactor.disable');

    await waitFor(() =>
      expect(disableTwoFactor).toHaveBeenCalledWith('pw', '123456')
    );
    await waitFor(() => expect(getTwoFactorStatus).toHaveBeenCalledTimes(2));
    expect(notifySuccess).toHaveBeenCalledWith(
      'notifications:toasts.security.twoFactorDisabled'
    );
  });

  test('a failed reload after a change hides the old controls', async () => {
    vi.mocked(disableTwoFactor).mockResolvedValue({});
    const modal = await open(
      'security.twoFactor.disable',
      'security.twoFactor.disableModal.title'
    );
    vi.mocked(getTwoFactorStatus).mockRejectedValueOnce(new Error('down'));

    await confirmIn(modal, 'security.twoFactor.disable');

    expect(
      await screen.findByText('security.twoFactor.loadFailed')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'security.twoFactor.disable' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('security.twoFactor.statusOn')
    ).not.toBeInTheDocument();
  });

  test('a wrong code is shown in the dialog', async () => {
    vi.mocked(disableTwoFactor).mockRejectedValue(
      refusal('That code is not valid.', 'mfa_code_invalid')
    );
    const modal = await open(
      'security.twoFactor.disable',
      'security.twoFactor.disableModal.title'
    );

    await confirmIn(modal, 'security.twoFactor.disable');

    expect(await within(modal).findByRole('alert')).toHaveTextContent(
      'That code is not valid.'
    );
  });

  test('new backup codes are shown once', async () => {
    vi.mocked(regenerateBackupCodes).mockResolvedValue({
      backup_codes: CODES,
    });
    const modal = await open(
      'security.twoFactor.regenerate',
      'security.twoFactor.regenerateModal.title'
    );

    await confirmIn(modal, 'security.twoFactor.regenerate');

    expect(await screen.findByText('CCCC-DDDD')).toBeInTheDocument();
  });
});

describe('OtherSessionsSetting', () => {
  const confirmSignOut = async () => {
    await userEvent.click(
      screen.getByRole('button', { name: 'security.sessions.button' })
    );
    await userEvent.click(
      within(dialog('security.sessions.confirmTitle')).getByRole('button', {
        name: 'security.sessions.button',
      })
    );
  };

  test('signs out other devices after confirming', async () => {
    vi.mocked(revokeOtherSessions).mockResolvedValue({});
    render(<OtherSessionsSetting />);

    await confirmSignOut();

    await waitFor(() =>
      expect(notifySuccess).toHaveBeenCalledWith(
        'notifications:toasts.security.otherSessionsSignedOut'
      )
    );
    expect(revokeOtherSessions).toHaveBeenCalledTimes(1);
  });

  test('a failure is reported', async () => {
    vi.mocked(revokeOtherSessions).mockRejectedValue(new Error('down'));
    render(<OtherSessionsSetting />);

    await confirmSignOut();

    await waitFor(() =>
      expect(notifyError).toHaveBeenCalledWith(
        'notifications:toasts.security.otherSessionsFailed'
      )
    );
  });
});
