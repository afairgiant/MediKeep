import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { adminApiService } from '../../../../services/api/adminApi';
import { authService } from '../../../../services/auth/simpleAuthService';
import { makeResponse, makeSchedule } from './fixtures';
import { renderPage } from './renderPage';

vi.mock('../../../../components/admin/AdminLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const ACTIVITY = 'Keep activity history for';
const NOTIFICATIONS = 'Keep notification history for';

const foreverBoxes = () =>
  screen.getAllByRole('checkbox', { name: 'Keep forever' });

const mockLoad = (overrides: Parameters<typeof makeResponse>[0] = {}) =>
  vi
    .spyOn(adminApiService, 'getAdminSettings')
    .mockResolvedValue(makeResponse(overrides));

beforeEach(() => {
  vi.restoreAllMocks();
  mockLoad();
  vi.spyOn(adminApiService, 'getAutoBackupSchedule').mockResolvedValue(
    makeSchedule()
  );
  vi.spyOn(authService, 'getSSOConfig').mockResolvedValue({ enabled: false });
});

test('both retention rows start on keep forever with the input disabled', async () => {
  renderPage('/admin/settings/data');

  expect(await screen.findByLabelText(ACTIVITY)).toBeDisabled();
  expect(screen.getByLabelText(NOTIFICATIONS)).toBeDisabled();
  foreverBoxes().forEach(box => expect(box).toBeChecked());
});

test('unticking keep forever fills in a starting number', async () => {
  renderPage('/admin/settings/data');
  await screen.findByLabelText(ACTIVITY);

  const [activityBox, notificationBox] = foreverBoxes();
  await userEvent.click(activityBox);
  await userEvent.click(notificationBox);

  expect(screen.getByLabelText(ACTIVITY)).toHaveValue('365 days');
  expect(screen.getByLabelText(NOTIFICATIONS)).toHaveValue('90 days');
  expect(screen.getByLabelText(ACTIVITY)).toBeEnabled();
});

test('ticking keep forever saves 0', async () => {
  mockLoad({
    activity_log_retention_days: { value: 180, source: 'saved' },
  });
  const update = vi
    .spyOn(adminApiService, 'updateAdminSettings')
    .mockResolvedValue({
      settings: makeResponse().settings,
      updated: ['activity_log_retention_days'],
      warnings: [],
    });
  renderPage('/admin/settings/data');
  await screen.findByLabelText(ACTIVITY);

  await userEvent.click(foreverBoxes()[0]);
  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() =>
    expect(update).toHaveBeenCalledWith({ activity_log_retention_days: 0 })
  );
});

test('a value below the minimum blocks saving', async () => {
  mockLoad({
    notification_history_retention_days: { value: 30, source: 'saved' },
  });
  renderPage('/admin/settings/data');

  const input = await screen.findByLabelText(NOTIFICATIONS);
  await userEvent.clear(input);
  await userEvent.type(input, '1');

  expect(
    await screen.findByText('Enter a whole number from 2 to 3650.')
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
});
