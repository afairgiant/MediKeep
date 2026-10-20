import { vi } from 'vitest';
import { screen } from '@testing-library/react';
import render from '../../../test-utils/render';
import BackupManagement from '../BackupManagement';
import { adminApiService } from '../../../services/api/adminApi';

vi.mock('../../../components/admin/AdminLayout', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

vi.mock('../../../hooks/useAdminData', () => ({
  useAdminData: () => ({
    data: { backups: [] },
    loading: false,
    error: null,
    refreshData: vi.fn(),
    executeAction: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(adminApiService, 'getAutoBackupSchedule').mockResolvedValue({
    preset: 'weekly',
    time_of_day: '03:30',
    day_of_week: 'mon',
    enabled: true,
    last_run_at: null,
    last_run_status: null,
    last_run_error: null,
    next_run_at: null,
  });
});

test('has no settings tab; schedule and retention live on the settings page', async () => {
  render(<BackupManagement />);

  expect(
    await screen.findByText('Weekly · Monday · 03:30')
  ).toBeInTheDocument();
  expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: /Change schedule and retention/ })
  ).toHaveAttribute('href', '/admin/settings/backups');
});

test('a disabled schedule shows as disabled without a summary line', async () => {
  adminApiService.getAutoBackupSchedule.mockResolvedValue({
    preset: 'disabled',
    time_of_day: '02:00',
    day_of_week: null,
    enabled: false,
    last_run_at: null,
    last_run_status: null,
    last_run_error: null,
    next_run_at: null,
  });

  render(<BackupManagement />);

  expect(await screen.findByText('Auto-Backup Schedule')).toBeInTheDocument();
  expect(screen.getAllByText('Disabled').length).toBeGreaterThan(0);
});
