import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { adminApiService } from '../../../../services/api/adminApi';
import { authService } from '../../../../services/auth/simpleAuthService';
import { makeResponse, makeSchedule, makeSettings } from './fixtures';
import { renderPage } from './renderPage';

vi.mock('../../../../components/admin/AdminLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const api = adminApiService as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(adminApiService, 'getAdminSettings').mockResolvedValue(
    makeResponse()
  );
  vi.spyOn(adminApiService, 'getAutoBackupSchedule').mockResolvedValue(
    makeSchedule()
  );
  vi.spyOn(adminApiService, 'updateAdminSettings');
  vi.spyOn(adminApiService, 'updateAutoBackupSchedule');
  vi.spyOn(authService, 'getSSOConfig').mockResolvedValue({ enabled: false });
});

describe('routing', () => {
  test('a bare settings URL redirects to the first section', async () => {
    renderPage('/admin/settings');

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/admin/settings/users'
      )
    );
  });

  test('an unknown section redirects to the first section', async () => {
    renderPage('/admin/settings/nope');

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/admin/settings/users'
      )
    );
  });

  test('the URL picks the section', async () => {
    renderPage('/admin/settings/data');

    expect(
      await screen.findByText('Keep deleted files in trash for')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Allow new accounts from the login page')
    ).not.toBeInTheDocument();
  });

  test('choosing a tab changes the URL', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('tab', { name: /Backups/ }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      '/admin/settings/backups'
    );
  });
});

describe('save bar', () => {
  test('is hidden until something changes', async () => {
    renderPage('/admin/settings/data');
    await screen.findByText('Keep deleted files in trash for');

    expect(
      screen.queryByRole('button', { name: /Save changes/ })
    ).not.toBeInTheDocument();
  });

  test('counts changes and marks the section tab', async () => {
    const user = userEvent.setup();
    renderPage('/admin/settings/data');

    const input = await screen.findByLabelText(
      'Keep deleted files in trash for'
    );
    await user.clear(input);
    await user.type(input, '14');

    expect(await screen.findByText('1 unsaved changes')).toBeInTheDocument();
    const dataTab = screen.getByRole('tab', { name: /Data and storage/ });
    expect(dataTab.querySelector('[role="img"]')).not.toBeNull();
  });

  test('an out-of-range value shows an error and disables Save', async () => {
    const user = userEvent.setup();
    renderPage('/admin/settings/data');

    const input = await screen.findByLabelText(
      'Keep deleted files in trash for'
    );
    await user.clear(input);
    await user.type(input, '400');

    expect(
      await screen.findByText('Enter a whole number from 1 to 365.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save changes/ })).toBeDisabled();
  });

  test('saving sends the change and shows the new source', async () => {
    const user = userEvent.setup();
    api.updateAdminSettings.mockResolvedValue({
      settings: makeSettings({
        trash_retention_days: { value: 14, source: 'saved' },
      }),
      updated: ['trash_retention_days'],
      warnings: [],
    });
    renderPage('/admin/settings/data');

    const input = await screen.findByLabelText(
      'Keep deleted files in trash for'
    );
    await user.clear(input);
    await user.type(input, '14');
    await user.click(screen.getByRole('button', { name: /Save changes/ }));

    expect(api.updateAdminSettings).toHaveBeenCalledWith({
      trash_retention_days: 14,
    });
    expect(await screen.findByText('Saved here')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Save changes/ })
    ).not.toBeInTheDocument();
  });

  test('discard puts the saved value back', async () => {
    const user = userEvent.setup();
    renderPage('/admin/settings/data');

    const input = await screen.findByLabelText(
      'Keep deleted files in trash for'
    );
    await user.clear(input);
    await user.type(input, '14');
    await user.click(screen.getByRole('button', { name: 'Discard' }));

    expect(input).toHaveValue('30 days');
  });

  test('a failed schedule save says the other changes were kept', async () => {
    const user = userEvent.setup();
    api.updateAdminSettings.mockResolvedValue({
      settings: makeSettings({
        backup_retention_days: { value: 14, source: 'saved' },
      }),
      updated: ['backup_retention_days'],
      warnings: [],
    });
    api.updateAutoBackupSchedule.mockRejectedValue(new Error('Request failed'));
    renderPage('/admin/settings/backups');

    const input = await screen.findByLabelText('Delete backups older than');
    await user.clear(input);
    await user.type(input, '14');
    await user.click(
      await screen.findByRole('textbox', { name: 'Backup Frequency' })
    );
    await user.click(
      await screen.findByRole('option', { name: 'Every 6 hours', hidden: true })
    );
    await user.click(screen.getByRole('button', { name: /Save changes/ }));

    expect(
      await screen.findByText(
        /Your other changes were saved, but the backup schedule was not/
      )
    ).toBeInTheDocument();
  });

  test('a failed schedule-only save shows the error alone', async () => {
    const user = userEvent.setup();
    api.updateAutoBackupSchedule.mockRejectedValue(new Error('Request failed'));
    renderPage('/admin/settings/backups');

    await user.click(
      await screen.findByRole('textbox', { name: 'Backup Frequency' })
    );
    await user.click(
      await screen.findByRole('option', { name: 'Every 6 hours', hidden: true })
    );
    await user.click(screen.getByRole('button', { name: /Save changes/ }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(api.updateAdminSettings).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/Your other changes were saved/)
    ).not.toBeInTheDocument();
  });
});

describe('value source', () => {
  test('a saved value offers a reset, which stages the fallback', async () => {
    const user = userEvent.setup();
    api.getAdminSettings.mockResolvedValue(
      makeResponse({
        trash_retention_days: { value: 9, source: 'saved', fallback: 30 },
      })
    );
    renderPage('/admin/settings/data');

    await user.click(
      await screen.findByRole('button', { name: 'Reset to default' })
    );

    expect(
      screen.getByLabelText('Keep deleted files in trash for')
    ).toHaveValue('30 days');
    expect(screen.getAllByText('Default')).toHaveLength(3);
    expect(screen.getByText('1 unsaved changes')).toBeInTheDocument();
  });

  test('says when a saved value overrides compose', async () => {
    api.getAdminSettings.mockResolvedValue(
      makeResponse({
        trash_retention_days: {
          value: 9,
          source: 'saved',
          fallback: 14,
          fallback_source: 'env',
        },
      })
    );
    renderPage('/admin/settings/data');

    expect(
      await screen.findByText(
        'Compose sets 14 days; the saved value is used instead.'
      )
    ).toBeInTheDocument();
  });

  test('a compose value is labelled as such', async () => {
    api.getAdminSettings.mockResolvedValue(
      makeResponse({
        trash_retention_days: { source: 'env', fallback_source: 'env' },
      })
    );
    renderPage('/admin/settings/data');

    expect(await screen.findByText('From compose')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Reset to default' })
    ).not.toBeInTheDocument();
  });
});

describe('load states', () => {
  test('a failed load offers a retry', async () => {
    const user = userEvent.setup();
    api.getAdminSettings.mockRejectedValueOnce(new Error('Request failed'));
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(
      await screen.findByText('Allow new accounts from the login page')
    ).toBeInTheDocument();
  });
});

describe('backups section', () => {
  test('shows time for daily and adds the day for weekly', async () => {
    const user = userEvent.setup();
    renderPage('/admin/settings/backups');

    expect(await screen.findByLabelText('Time of Day')).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Day of Week' })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('textbox', { name: 'Backup Frequency' }));
    await user.click(
      await screen.findByRole('option', { name: 'Weekly', hidden: true })
    );

    expect(
      screen.getByRole('textbox', { name: 'Day of Week' })
    ).toBeInTheDocument();
  });

  test('a minimum above the maximum is refused', async () => {
    const user = userEvent.setup();
    renderPage('/admin/settings/backups');

    const min = await screen.findByLabelText('Always keep at least');
    await user.clear(min);
    await user.type(min, '60');

    expect(
      await screen.findByText('Must be no more than the maximum backup count.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save changes/ })).toBeDisabled();
  });

  test('links to the backup page for backup operations', async () => {
    renderPage('/admin/settings/backups');

    const link = await screen.findByRole('link', {
      name: /Create, download and restore backups/,
    });
    expect(link).toHaveAttribute('href', '/admin/backup');
  });

  test('says when the schedule could not be loaded', async () => {
    api.getAutoBackupSchedule.mockRejectedValue(new Error('Request failed'));
    renderPage('/admin/settings/backups');

    expect(
      await screen.findByText('The backup schedule could not be loaded.')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Always keep at least')).toBeInTheDocument();
  });
});

describe('deployment section', () => {
  test('lists the deployment values read-only', async () => {
    renderPage('/admin/settings/deployment');

    expect(await screen.findByText('LOG_LEVEL=INFO')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  test('explains how to enable SSO when it is off', async () => {
    renderPage('/admin/settings/deployment');

    expect(await screen.findByText('SSO_ENABLED=true')).toBeInTheDocument();
  });
});
