import { vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { notifications } from '@mantine/notifications';
import render from '../../../test-utils/render';
import BackupManagement from '../BackupManagement';
import { adminApiService } from '../../../services/api/adminApi';

vi.mock('../../../components/admin/AdminLayout', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

const { mockExecuteAction } = vi.hoisted(() => ({
  mockExecuteAction: vi.fn(),
}));

vi.mock('../../../hooks/useAdminData', () => ({
  useAdminData: () => ({
    data: { backups: [] },
    loading: false,
    error: null,
    refreshData: vi.fn(),
    executeAction: mockExecuteAction,
  }),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(adminApiService, 'getAutoBackupSchedule').mockResolvedValue(
    schedule()
  );
});

const schedule = (overrides = {}) => ({
  preset: 'weekly',
  time_of_day: '03:30',
  interval_hours: 12,
  days_of_week: ['mon', 'fri'],
  day_of_month: 1,
  enabled: true,
  last_run_at: null,
  last_run_status: null,
  last_run_error: null,
  next_run_at: null,
  upcoming_runs: [],
  timezone: 'America/New_York',
  ...overrides,
});

test('has no settings tab; schedule and retention live on the settings page', async () => {
  render(<BackupManagement />);

  expect(await screen.findByText('Mon, Fri at 03:30')).toBeInTheDocument();
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: /Change schedule and retention/ })
  ).toHaveAttribute('href', '/admin/settings/backups');
});

test.each([
  [{ preset: 'interval', interval_hours: 6 }, 'Every 6 hours'],
  [{ preset: 'interval', interval_hours: 1 }, 'Every hour'],
  [{ preset: 'daily' }, 'Daily at 03:30'],
  [{ preset: 'monthly', day_of_month: 28 }, 'Monthly on day 28 at 03:30'],
])('summarises the %o schedule', async (overrides, summary) => {
  adminApiService.getAutoBackupSchedule.mockResolvedValue(schedule(overrides));

  render(<BackupManagement />);

  expect(await screen.findByText(summary)).toBeInTheDocument();
});

test('a disabled schedule shows as disabled without a summary line', async () => {
  adminApiService.getAutoBackupSchedule.mockResolvedValue(
    schedule({ preset: 'disabled', enabled: false })
  );

  render(<BackupManagement />);

  expect(await screen.findByText('Auto-Backup Schedule')).toBeInTheDocument();
  expect(screen.getAllByText('Disabled').length).toBeGreaterThan(0);
});

test('a failed backup shows an error notification with the server message', async () => {
  mockExecuteAction.mockRejectedValueOnce(new Error('Database dump failed'));
  const show = vi.spyOn(notifications, 'show');
  render(<BackupManagement />);

  await userEvent.click(
    await screen.findByRole('button', { name: /Create Full Backup/ })
  );

  expect(show).toHaveBeenCalledWith(
    expect.objectContaining({
      color: 'red',
      message: expect.stringContaining('Database dump failed'),
    })
  );
});
