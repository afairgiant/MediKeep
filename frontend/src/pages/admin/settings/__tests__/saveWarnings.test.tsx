import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { adminApiService } from '../../../../services/api/adminApi';
import { authService } from '../../../../services/auth/simpleAuthService';
import { makeResponse, makeSchedule, makeSettings } from './fixtures';
import { renderPage } from './renderPage';

/**
 * Warnings the save response carries back.
 *
 * The server sends a code and the copy is ours, so it translates. setupTests mocks
 * t() to return the default, which would make "our copy" and "the server's copy"
 * indistinguishable, so this file maps the known code to a German string.
 */

const { SEALED_KEY, SEALED_DE } = vi.hoisted(() => ({
  SEALED_KEY: 'settings.warnings.sso_only_no_registration_route',
  SEALED_DE: 'Keine Selbstregistrierung mehr moeglich.',
}));

vi.mock('react-i18next', () => {
  const resources: Record<string, string> = { [SEALED_KEY]: SEALED_DE };
  return {
    useTranslation: () => ({
      t: (
        key: string,
        defaultValue?: unknown,
        options?: Record<string, unknown>
      ) => {
        const text =
          resources[key] ??
          (typeof defaultValue === 'string' ? defaultValue : key);
        return text.replace(/\{\{(\w+)\}\}/g, (match, name) =>
          options && options[name] !== undefined ? String(options[name]) : match
        );
      },
      i18n: { language: 'de', changeLanguage: () => Promise.resolve() },
    }),
    Trans: ({ children }: { children: ReactNode }) => children,
    I18nextProvider: ({ children }: { children: ReactNode }) => children,
    initReactI18next: { type: '3rdParty', init: () => {} },
  };
});

vi.mock('../../../../components/admin/AdminLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const SEALED = 'sso_only_no_registration_route';
const SERVER_COPY = 'English text the server sent';
const api = adminApiService as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;

const respondWith = (warnings?: { code: string; message: string }[]) => {
  api.updateAdminSettings.mockResolvedValue({
    settings: makeSettings({
      allow_user_registration: { value: false, source: 'saved' },
    }),
    updated: ['allow_user_registration'],
    ...(warnings === undefined ? {} : { warnings }),
  });
};

const turnOffAndSave = async () => {
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('switch', {
      name: 'Allow new accounts from the login page',
    })
  );
  await user.click(screen.getByRole('button', { name: /Save changes/ }));
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(adminApiService, 'getAdminSettings').mockResolvedValue(
    makeResponse()
  );
  vi.spyOn(adminApiService, 'getAutoBackupSchedule').mockResolvedValue(
    makeSchedule()
  );
  vi.spyOn(adminApiService, 'updateAdminSettings');
  vi.spyOn(authService, 'getSSOConfig').mockResolvedValue({ enabled: false });
});

test('renders our translated copy, not the English the server sent', async () => {
  respondWith([{ code: SEALED, message: SERVER_COPY }]);
  renderPage();

  await turnOffAndSave();

  expect(await screen.findByText(SEALED_DE)).toBeInTheDocument();
  expect(screen.queryByText(SERVER_COPY)).not.toBeInTheDocument();
});

test('falls back to the server message for a code it does not know', async () => {
  respondWith([
    { code: 'something_added_later', message: 'a warning from the future' },
  ]);
  renderPage();

  await turnOffAndSave();

  expect(
    await screen.findByText('a warning from the future')
  ).toBeInTheDocument();
});

test('tolerates a response with no warnings key', async () => {
  respondWith(undefined);
  renderPage();

  await turnOffAndSave();

  expect(await screen.findByText('Saved here')).toBeInTheDocument();
  expect(screen.queryByText(SEALED_DE)).not.toBeInTheDocument();
});

test('a failed save does not discard a warning already on screen', async () => {
  const user = userEvent.setup();
  respondWith([{ code: SEALED, message: SERVER_COPY }]);
  renderPage();
  await turnOffAndSave();
  await screen.findByText(SEALED_DE);

  api.updateAdminSettings.mockRejectedValue(new Error('network down'));
  await user.click(
    screen.getByRole('switch', {
      name: 'Allow new accounts from the login page',
    })
  );
  await user.click(screen.getByRole('button', { name: /Save changes/ }));

  await waitFor(() => expect(api.updateAdminSettings).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /Save changes/ })).toBeEnabled()
  );
  expect(screen.getByText(SEALED_DE)).toBeInTheDocument();
});

test('the warning can be dismissed', async () => {
  const user = userEvent.setup();
  respondWith([{ code: SEALED, message: SERVER_COPY }]);
  renderPage();
  await turnOffAndSave();
  const warning = await screen.findByText(SEALED_DE);

  const alert = warning.closest('[role="alert"]') as HTMLElement;
  await user.click(alert.querySelector('button') as HTMLElement);

  expect(screen.queryByText(SEALED_DE)).not.toBeInTheDocument();
});
