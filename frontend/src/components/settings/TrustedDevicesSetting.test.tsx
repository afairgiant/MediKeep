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
  getTrustedDevices: vi.fn(),
  forgetTrustedDevice: vi.fn(),
  forgetAllTrustedDevices: vi.fn(),
}));

vi.mock('../../utils/notifyTranslated', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock('../../hooks/useDateFormat', () => ({
  useDateFormat: () => ({ formatDateTime: (d: string) => d }),
}));

import TrustedDevicesSetting from './TrustedDevicesSetting';
import {
  forgetAllTrustedDevices,
  forgetTrustedDevice,
  getTrustedDevices,
} from '../../services/api/securityApi';
import { notifyError, notifySuccess } from '../../utils/notifyTranslated';

const CHROME = {
  id: 1,
  user_agent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  created_at: '2026-10-01T10:00:00',
  last_used_at: '2026-10-20T08:00:00',
  expires_at: '2026-10-31T10:00:00',
};
const UNKNOWN = {
  id: 2,
  user_agent: null,
  created_at: '2026-10-02T10:00:00',
  last_used_at: null,
  expires_at: '2026-11-01T10:00:00',
};

const openManage = async () => {
  await userEvent.click(
    await screen.findByRole('button', {
      name: 'security.trustedDevices.manage',
    })
  );
  return screen.getByRole('dialog', { name: 'security.trustedDevices.title' });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getTrustedDevices).mockResolvedValue([CHROME, UNKNOWN]);
  vi.mocked(forgetTrustedDevice).mockResolvedValue(null);
  vi.mocked(forgetAllTrustedDevices).mockResolvedValue(null);
});

describe('TrustedDevicesSetting', () => {
  test('summarises how many browsers skip the code', async () => {
    render(<TrustedDevicesSetting />);

    expect(
      await screen.findByText('security.trustedDevices.count')
    ).toBeInTheDocument();
  });

  test('says so when no browser is remembered, with nothing to manage', async () => {
    vi.mocked(getTrustedDevices).mockResolvedValue([]);
    render(<TrustedDevicesSetting />);

    expect(
      await screen.findByText('security.trustedDevices.none')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'security.trustedDevices.manage' })
    ).not.toBeInTheDocument();
  });

  test('offers a retry when the list cannot be loaded', async () => {
    vi.mocked(getTrustedDevices).mockRejectedValueOnce(new Error('offline'));
    render(<TrustedDevicesSetting />);

    await userEvent.click(
      await screen.findByRole('button', { name: 'security.twoFactor.retry' })
    );

    expect(
      await screen.findByText('security.trustedDevices.count')
    ).toBeInTheDocument();
    expect(getTrustedDevices).toHaveBeenCalledTimes(2);
  });

  test('reloads when other sessions are signed out', async () => {
    const { rerender } = render(<TrustedDevicesSetting sessionsRevision={0} />);
    expect(
      await screen.findByText('security.trustedDevices.count')
    ).toBeInTheDocument();
    vi.mocked(getTrustedDevices).mockResolvedValue([]);

    rerender(<TrustedDevicesSetting sessionsRevision={1} />);

    expect(
      await screen.findByText('security.trustedDevices.none')
    ).toBeInTheDocument();
    expect(getTrustedDevices).toHaveBeenCalledTimes(2);
  });

  test('names each browser from its user agent', async () => {
    render(<TrustedDevicesSetting />);

    const dialog = await openManage();

    expect(within(dialog).getByText('device.name')).toBeInTheDocument();
    expect(within(dialog).getByText('device.unknown')).toBeInTheDocument();
    expect(
      within(dialog).getByText('security.trustedDevices.lastUsed')
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('security.trustedDevices.added')
    ).toBeInTheDocument();
  });

  test('forgets one browser and drops it from the list', async () => {
    render(<TrustedDevicesSetting />);
    const dialog = await openManage();

    await userEvent.click(
      within(dialog).getAllByRole('button', {
        name: 'security.trustedDevices.forgetLabel',
      })[0]
    );

    await waitFor(() => expect(forgetTrustedDevice).toHaveBeenCalledWith(1));
    expect(notifySuccess).toHaveBeenCalledWith(
      'notifications:toasts.security.trustedDeviceForgotten'
    );
    await waitFor(() =>
      expect(within(dialog).queryByText('device.name')).not.toBeInTheDocument()
    );
    expect(within(dialog).getByText('device.unknown')).toBeInTheDocument();
    expect(getTrustedDevices).toHaveBeenCalledTimes(1);
  });

  test('forgets every browser and closes', async () => {
    render(<TrustedDevicesSetting />);
    const dialog = await openManage();
    vi.mocked(getTrustedDevices).mockResolvedValue([]);

    await userEvent.click(
      within(dialog).getByRole('button', {
        name: 'security.trustedDevices.forgetAll',
      })
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'security.trustedDevices.title' })
      ).not.toBeInTheDocument()
    );
    expect(forgetAllTrustedDevices).toHaveBeenCalledTimes(1);
    expect(notifySuccess).toHaveBeenCalledWith(
      'notifications:toasts.security.trustedDevicesForgotten'
    );
    expect(
      await screen.findByText('security.trustedDevices.none')
    ).toBeInTheDocument();
  });

  test('reports a failure to forget', async () => {
    vi.mocked(forgetTrustedDevice).mockRejectedValue(new Error('offline'));
    render(<TrustedDevicesSetting />);
    const dialog = await openManage();

    await userEvent.click(
      within(dialog).getAllByRole('button', {
        name: 'security.trustedDevices.forgetLabel',
      })[0]
    );

    await waitFor(() =>
      expect(notifyError).toHaveBeenCalledWith(
        'notifications:toasts.security.trustedDeviceForgetFailed'
      )
    );
    expect(dialog).toBeInTheDocument();
  });
});
