import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { adminApiService } from '../../../../services/api/adminApi';
import { authService } from '../../../../services/auth/simpleAuthService';
import {
  makePreview,
  makeResponse,
  makeSchedule,
  makeSettings,
} from './fixtures';
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
  vi.spyOn(adminApiService, 'previewAutoBackupSchedule').mockResolvedValue(
    makePreview()
  );
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
      await screen.findByRole('option', { name: 'Every N hours', hidden: true })
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
      await screen.findByRole('option', { name: 'Every N hours', hidden: true })
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
  const choosePreset = async (
    user: ReturnType<typeof userEvent.setup>,
    name: string
  ) => {
    await user.click(
      await screen.findByRole('textbox', { name: 'Backup Frequency' })
    );
    await user.click(await screen.findByRole('option', { name, hidden: true }));
  };

  test.each([
    ['Every N hours', ['Run every'], ['Time of Day', 'Day of Month']],
    ['Daily', ['Time of Day'], ['Run every', 'Day of Month']],
    ['Monthly', ['Day of Month', 'Time of Day'], ['Run every']],
  ])('%s shows only its own fields', async (preset, shown, hidden) => {
    const user = userEvent.setup();
    renderPage('/admin/settings/backups');

    await choosePreset(user, preset);

    shown.forEach(label =>
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    );
    hidden.forEach(label =>
      expect(screen.queryByLabelText(label)).not.toBeInTheDocument()
    );
    expect(
      screen.queryByRole('group', { name: 'Days of Week' })
    ).not.toBeInTheDocument();
  });

  test('weekly picks several days and needs at least one', async () => {
    const user = userEvent.setup();
    renderPage('/admin/settings/backups');

    await choosePreset(user, 'Weekly');
    const days = screen.getByRole('group', { name: 'Days of Week' });
    expect(screen.getByLabelText('Time of Day')).toBeInTheDocument();

    await user.click(within(days).getByRole('checkbox', { name: 'Wed' }));
    expect(within(days).getByRole('checkbox', { name: 'Wed' })).toBeChecked();

    await user.click(within(days).getByRole('checkbox', { name: 'Wed' }));
    await user.click(within(days).getByRole('checkbox', { name: 'Sun' }));
    expect(screen.getByText('Pick at least one day.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save changes/ })).toBeDisabled();
  });

  test('an interval outside 1 to 168 hours is refused', async () => {
    const user = userEvent.setup();
    renderPage('/admin/settings/backups');

    await choosePreset(user, 'Every N hours');
    const hours = screen.getByLabelText('Run every');
    await user.clear(hours);
    await user.type(hours, '200');

    expect(
      screen.getByText('Enter a whole number from 1 to 168.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save changes/ })).toBeDisabled();
  });

  test('previews the draft schedule with run times and disk estimate', async () => {
    renderPage('/admin/settings/backups');

    const preview = await screen.findByTestId('schedule-preview');
    expect(within(preview).getByText('Daily at 02:00')).toBeInTheDocument();
    expect(await within(preview).findByText(/^Next runs:/)).toBeInTheDocument();
    expect(
      within(preview).getByText(
        /Clean-up keeps about 7 scheduled backups, roughly 7 MB\./
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Time zone: America\/New_York/)
    ).toBeInTheDocument();
    expect(api.previewAutoBackupSchedule).toHaveBeenLastCalledWith({
      preset: 'daily',
      time_of_day: '02:00',
      backup_retention_days: 7,
      backup_min_count: 5,
    });
  });

  test('the preview follows draft edits, including retention', async () => {
    const user = userEvent.setup();
    renderPage('/admin/settings/backups');
    await screen.findByTestId('schedule-preview');

    await choosePreset(user, 'Monthly');
    const retention = screen.getByLabelText('Delete backups older than');
    await user.clear(retention);
    await user.type(retention, '30');

    await waitFor(() =>
      expect(api.previewAutoBackupSchedule).toHaveBeenLastCalledWith({
        preset: 'monthly',
        time_of_day: '02:00',
        day_of_month: 1,
        backup_retention_days: 30,
        backup_min_count: 5,
      })
    );
  });

  test('says old backups add up while automatic clean-up is off', async () => {
    renderPage('/admin/settings/backups');

    expect(
      await screen.findByText(/Automatic clean-up is off/)
    ).toBeInTheDocument();
  });

  test('hides the estimate until a backup exists', async () => {
    api.previewAutoBackupSchedule.mockResolvedValue(
      makePreview({ latest_backup_size_bytes: null, estimated_bytes: null })
    );
    renderPage('/admin/settings/backups');

    expect(await screen.findByText(/^Next runs:/)).toBeInTheDocument();
    expect(screen.queryByText(/Clean-up keeps about/)).not.toBeInTheDocument();
  });

  test('says when the preview fails', async () => {
    api.previewAutoBackupSchedule.mockRejectedValue(
      new Error('Request failed')
    );
    renderPage('/admin/settings/backups');

    expect(
      await screen.findByText('The preview could not be loaded.')
    ).toBeInTheDocument();
  });

  test('a disabled schedule asks for no preview', async () => {
    api.getAutoBackupSchedule.mockResolvedValue(
      makeSchedule({ preset: 'disabled', enabled: false })
    );
    renderPage('/admin/settings/backups');

    await screen.findByRole('textbox', { name: 'Backup Frequency' });
    expect(screen.queryByTestId('schedule-preview')).not.toBeInTheDocument();
    expect(api.previewAutoBackupSchedule).not.toHaveBeenCalled();
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

  test('automatic clean-up starts off and saves when turned on', async () => {
    const user = userEvent.setup();
    api.updateAdminSettings.mockResolvedValue({
      settings: makeSettings({
        backup_auto_cleanup_enabled: { value: true, source: 'saved' },
      }),
      updated: ['backup_auto_cleanup_enabled'],
      warnings: [],
    });
    renderPage('/admin/settings/backups');

    const toggle = await screen.findByRole('switch', {
      name: 'Delete old backups automatically',
    });
    expect(toggle).not.toBeChecked();

    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: /Save changes/ }));

    expect(api.updateAdminSettings).toHaveBeenCalledWith({
      backup_auto_cleanup_enabled: true,
    });
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
