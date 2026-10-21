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

const RELEASE_CHECK = 'Check for updates';
const POPUP = 'Show release notes after an upgrade';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(adminApiService, 'getAdminSettings').mockResolvedValue(
    makeResponse()
  );
  vi.spyOn(adminApiService, 'getAutoBackupSchedule').mockResolvedValue(
    makeSchedule()
  );
  vi.spyOn(authService, 'getSSOConfig').mockResolvedValue({ enabled: false });
});

test('shows both release switches, on by default', async () => {
  renderPage('/admin/settings/general');

  expect(await screen.findByLabelText(RELEASE_CHECK)).toBeChecked();
  expect(screen.getByLabelText(POPUP)).toBeChecked();
});

test('the two switches are independent', async () => {
  renderPage('/admin/settings/general');

  await userEvent.click(await screen.findByLabelText(RELEASE_CHECK));

  expect(screen.getByLabelText(RELEASE_CHECK)).not.toBeChecked();
  expect(screen.getByLabelText(POPUP)).toBeChecked();
});

test('saves the changed release settings', async () => {
  const update = vi
    .spyOn(adminApiService, 'updateAdminSettings')
    .mockResolvedValue({
      settings: makeResponse({
        whats_new_popup_enabled: { value: false, source: 'saved' },
      }).settings,
      updated: ['whats_new_popup_enabled'],
      warnings: [],
    });
  renderPage('/admin/settings/general');

  await userEvent.click(await screen.findByLabelText(POPUP));
  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  await waitFor(() =>
    expect(update).toHaveBeenCalledWith({ whats_new_popup_enabled: false })
  );
});
