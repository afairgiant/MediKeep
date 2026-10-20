import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { adminApiService } from '../../../../services/api/adminApi';
import { authService } from '../../../../services/auth/simpleAuthService';
import { makeResponse, makeSchedule } from './fixtures';
import { renderPage } from './renderPage';

/**
 * The read-only SSO flags and the registration switch.
 *
 * A badge that reads an absent field renders "Disabled" on an instance where the
 * flag is on, which is exactly the question an operator opens this card to answer.
 * SSO-only and auto-redirect are env-driven so a broken identity provider cannot be
 * made permanent from inside the app, which is why there is no toggle to test.
 */

vi.mock('../../../../components/admin/AdminLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const badgeFor = async (label: string) => {
  const el = await screen.findByText(label);
  // Label and badge are siblings inside a Group.
  return el.parentElement as HTMLElement;
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
});

const ssoConfig = (config: Record<string, unknown>) =>
  vi.spyOn(authService, 'getSSOConfig').mockResolvedValue(config);

describe('SSO flags', () => {
  test('both badges read Enabled when both flags are on', async () => {
    ssoConfig({
      enabled: true,
      provider_type: 'oidc',
      sso_only: true,
      auto_redirect: true,
    });
    renderPage();

    expect(await badgeFor('SSO-Only Mode')).toHaveTextContent('Enabled');
    expect(await badgeFor('Auto-Redirect to Provider')).toHaveTextContent(
      'Enabled'
    );
  });

  test('both badges read Disabled when both flags are off', async () => {
    ssoConfig({
      enabled: true,
      provider_type: 'oidc',
      sso_only: false,
      auto_redirect: false,
    });
    renderPage();

    expect(await badgeFor('SSO-Only Mode')).toHaveTextContent('Disabled');
    expect(await badgeFor('Auto-Redirect to Provider')).toHaveTextContent(
      'Disabled'
    );
  });

  test('each badge reads its own flag', async () => {
    // Rendering one badge from the other's value would pass the same-value tests.
    ssoConfig({ enabled: true, sso_only: false, auto_redirect: true });
    renderPage();

    expect(await badgeFor('SSO-Only Mode')).toHaveTextContent('Disabled');
    expect(await badgeFor('Auto-Redirect to Provider')).toHaveTextContent(
      'Enabled'
    );
  });

  test('missing fields render Disabled rather than blank', async () => {
    ssoConfig({ enabled: true, provider_type: 'oidc' });
    renderPage();

    expect(await badgeFor('SSO-Only Mode')).toHaveTextContent('Disabled');
    expect(await badgeFor('Auto-Redirect to Provider')).toHaveTextContent(
      'Disabled'
    );
  });

  test('says the flags cannot be changed here', async () => {
    ssoConfig({ enabled: true, provider_type: 'google' });
    renderPage();

    expect(await screen.findByText('Google')).toBeInTheDocument();
    expect(
      screen.getByText(
        'These are set by environment variable and cannot be changed here.'
      )
    ).toBeInTheDocument();
  });

  test('when SSO is off, points to the deployment section instead', async () => {
    ssoConfig({ enabled: false });
    renderPage();

    const link = await screen.findByRole('link', { name: 'How to turn it on' });
    expect(link).toHaveAttribute('href', '/admin/settings/deployment');
    expect(screen.queryByText('SSO-Only Mode')).not.toBeInTheDocument();
  });

  test('test connection shows the result', async () => {
    const user = userEvent.setup();
    ssoConfig({ enabled: true, provider_type: 'google' });
    vi.spyOn(authService, 'testSSOConnection').mockResolvedValue({
      success: true,
      message: 'Provider reachable',
    });
    renderPage();

    await user.click(
      await screen.findByRole('button', { name: 'Test SSO Connection' })
    );

    expect(await screen.findByText('Provider reachable')).toBeInTheDocument();
  });
});

describe('registration switch', () => {
  const PREVIEW =
    'SSO-only mode is on, so with this off nobody can create their own account. An admin will have to create every account.';

  test('warns before saving when turning registration off under SSO-only', async () => {
    const user = userEvent.setup();
    ssoConfig({ enabled: true, sso_only: true });
    renderPage();

    await user.click(
      await screen.findByRole('switch', {
        name: 'Allow new accounts from the login page',
      })
    );

    expect(screen.getByText(PREVIEW)).toBeInTheDocument();
    expect(adminApiService.updateAdminSettings).not.toHaveBeenCalled();
  });

  test('no preview warning when SSO-only is off', async () => {
    const user = userEvent.setup();
    ssoConfig({ enabled: true, sso_only: false });
    renderPage();

    await user.click(
      await screen.findByRole('switch', {
        name: 'Allow new accounts from the login page',
      })
    );

    expect(screen.queryByText(PREVIEW)).not.toBeInTheDocument();
  });
});
