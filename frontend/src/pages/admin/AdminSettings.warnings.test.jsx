import { vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminSettings from './AdminSettings';
import render from '../../test-utils/render';

/**
 * Warnings the save response carries back.
 *
 * The sealed-instance case is the one that matters: turning registration off while
 * SSO-only mode is on leaves an instance no new user can enter by any route. The
 * boot-time warning cannot see a toggle, so this alert is the only thing that
 * reaches the admin at the moment they cause it.
 *
 * The server sends a code and the copy is ours, so it translates. setupTests.js
 * mocks react-i18next with a t() that always returns the default, which would make
 * "our copy" and "the server's copy" indistinguishable here - and this is the one
 * thing worth asserting. So this file overrides that mock with a German resource:
 * a known code must render German, an unknown one must fall back to the server text.
 */

const { SEALED_KEY, SEALED_DE } = vi.hoisted(() => ({
  SEALED_KEY: 'settings.warnings.sso_only_no_registration_route',
  SEALED_DE: 'Keine Selbstregistrierung mehr moeglich.',
}));

vi.mock('react-i18next', () => {
  const resources = { [SEALED_KEY]: SEALED_DE };
  return {
    useTranslation: () => ({
      t: (key, defaultValue) =>
        resources[key] ??
        (typeof defaultValue === 'string' ? defaultValue : key),
      i18n: { language: 'de', changeLanguage: () => Promise.resolve() },
    }),
    Trans: ({ children }) => children,
    I18nextProvider: ({ children }) => children,
    initReactI18next: { type: '3rdParty', init: () => {} },
  };
});

vi.mock('../../components/admin/AdminLayout', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

import { adminApiService } from '../../services/api/adminApi';
import { authService } from '../../services/auth/simpleAuthService';

vi.spyOn(adminApiService, 'getRetentionSettings');
vi.spyOn(adminApiService, 'updateRetentionSettings');
vi.spyOn(authService, 'getSSOConfig');

const SEALED = 'sso_only_no_registration_route';
const SERVER_COPY = 'English text the server sent';

const saveSettings = async () => {
  const user = userEvent.setup();
  const button = await screen.findByRole('button', {
    name: /save all changes/i,
  });
  await user.click(button);
};

const respondWith = warnings => {
  adminApiService.updateRetentionSettings.mockResolvedValue({
    message: 'Settings updated successfully',
    ...(warnings === undefined ? {} : { warnings }),
    current_settings: {
      trash_retention_days: 30,
      allow_user_registration: false,
    },
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  adminApiService.getRetentionSettings.mockResolvedValue({
    trash_retention_days: 30,
    allow_user_registration: true,
  });
  authService.getSSOConfig.mockResolvedValue({ enabled: false });
});

test('renders our translated copy, not the English the server sent', async () => {
  respondWith([{ code: SEALED, message: SERVER_COPY }]);

  render(<AdminSettings />);
  await saveSettings();

  expect(await screen.findByText(SEALED_DE)).toBeInTheDocument();
  expect(screen.queryByText(SERVER_COPY)).not.toBeInTheDocument();
});

test('falls back to the server message for a code it does not know', async () => {
  respondWith([
    { code: 'something_added_later', message: 'a warning from the future' },
  ]);

  render(<AdminSettings />);
  await saveSettings();

  expect(
    await screen.findByText('a warning from the future')
  ).toBeInTheDocument();
});

test('shows no warning when the save returned none', async () => {
  respondWith([]);

  render(<AdminSettings />);
  await saveSettings();

  await screen.findByText('Settings updated successfully');
  expect(screen.queryByText(SEALED_DE)).not.toBeInTheDocument();
});

test('tolerates a response with no warnings key', async () => {
  // Any other caller of this endpoint, and builds that predate the field.
  respondWith(undefined);

  render(<AdminSettings />);
  await saveSettings();

  expect(
    await screen.findByText('Settings updated successfully')
  ).toBeInTheDocument();
});

test('the warning outlives the success message', async () => {
  // The success message clears itself after 5s. A lockout notice that vanished
  // with it would be worse than not showing one.
  respondWith([{ code: SEALED, message: SERVER_COPY }]);

  render(<AdminSettings />);
  await saveSettings();
  await screen.findByText(SEALED_DE);

  await waitFor(
    () =>
      expect(
        screen.queryByText('Settings updated successfully')
      ).not.toBeInTheDocument(),
    { timeout: 8000 }
  );
  expect(screen.getByText(SEALED_DE)).toBeInTheDocument();
}, 15000);
