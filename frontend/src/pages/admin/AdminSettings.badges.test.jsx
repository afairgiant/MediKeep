import { vi } from 'vitest';
import { screen } from '@testing-library/react';
import AdminSettings from './AdminSettings';
import render from '../../test-utils/render';

vi.mock('../../components/admin/AdminLayout', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

import { adminApiService } from '../../services/api/adminApi';
import { authService } from '../../services/auth/simpleAuthService';

vi.spyOn(adminApiService, 'getRetentionSettings');
vi.spyOn(authService, 'getSSOConfig');

/**
 * The two read-only flag badges on the SSO card.
 *
 * Low-risk to render and easy to get quietly wrong: a badge that reads an absent
 * field renders "Disabled" on an instance where the flag is on, which is exactly
 * the question an operator opens this card to answer.
 *
 * Read-only by design. SSO_ONLY_MODE and SSO_AUTO_REDIRECT are env-driven
 * precisely so that a broken identity provider cannot be made permanent from
 * inside the app, which is why there is no toggle here to test.
 */

// Unlike Login.jsx, this page passes default values to t() -- i18next returns
// the default when no translation is loaded, so tests assert on the English
// string rather than the key.
const badgeFor = async label => {
  const el = await screen.findByText(label);
  // Label and badge are siblings inside a Group.
  return el.parentElement;
};

beforeEach(() => {
  vi.clearAllMocks();
  adminApiService.getRetentionSettings.mockResolvedValue({
    trash_retention_days: 30,
    allow_user_registration: true,
  });
});

describe('with both flags on', () => {
  beforeEach(() => {
    authService.getSSOConfig.mockResolvedValue({
      enabled: true,
      provider_type: 'oidc',
      sso_only: true,
      auto_redirect: true,
    });
  });

  test('both badges read Enabled', async () => {
    render(<AdminSettings />);

    expect(await badgeFor('SSO-Only Mode')).toHaveTextContent(
      'Enabled'
    );
    expect(await badgeFor('Auto-Redirect to Provider')).toHaveTextContent(
      'Enabled'
    );
  });

  test('says the flags cannot be changed here', async () => {
    render(<AdminSettings />);

    expect(await screen.findByText('These are set by environment variable and cannot be changed here.')).toBeInTheDocument();
  });
});

describe('with both flags off', () => {
  test('both badges read Disabled', async () => {
    authService.getSSOConfig.mockResolvedValue({
      enabled: true,
      provider_type: 'oidc',
      sso_only: false,
      auto_redirect: false,
    });

    render(<AdminSettings />);

    expect(await badgeFor('SSO-Only Mode')).toHaveTextContent(
      'Disabled'
    );
    expect(await badgeFor('Auto-Redirect to Provider')).toHaveTextContent(
      'Disabled'
    );
  });
});

describe('with the flags reported independently', () => {
  test('auto-redirect on, SSO-only off', async () => {
    // The combination an operator uses to keep a landing page while defaulting
    // people to the provider. Rendering one badge from the other's value would
    // pass every same-value test above.
    authService.getSSOConfig.mockResolvedValue({
      enabled: true,
      sso_only: false,
      auto_redirect: true,
    });

    render(<AdminSettings />);

    expect(await badgeFor('SSO-Only Mode')).toHaveTextContent(
      'Disabled'
    );
    expect(await badgeFor('Auto-Redirect to Provider')).toHaveTextContent(
      'Enabled'
    );
  });
});

describe('when the payload omits the fields', () => {
  test('renders Disabled rather than blank', async () => {
    // An older backend, or the failure shape. `undefined` must not render as an
    // empty badge or crash the card.
    authService.getSSOConfig.mockResolvedValue({
      enabled: true,
      provider_type: 'oidc',
    });

    render(<AdminSettings />);

    expect(await badgeFor('SSO-Only Mode')).toHaveTextContent(
      'Disabled'
    );
    expect(await badgeFor('Auto-Redirect to Provider')).toHaveTextContent(
      'Disabled'
    );
  });
});

describe('when SSO is off entirely', () => {
  test('neither badge renders -- they live inside the enabled branch', async () => {
    authService.getSSOConfig.mockResolvedValue({ enabled: false });

    render(<AdminSettings />);

    // Wait for the card itself before asserting absence.
    await screen.findByText('Single Sign-On (SSO)');
    expect(screen.queryByText('SSO-Only Mode')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Auto-Redirect to Provider')
    ).not.toBeInTheDocument();
  });
});
