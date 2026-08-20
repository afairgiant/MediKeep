import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildLoginPath,
  isNonEjectingEndpoint,
  redirectToLogin,
  resetLoginRedirectGuard,
} from './loginRedirect';
import { LOGIN_PATH } from './safeInternalPath';
import { stubLocation } from '../test-utils/browserStubs';

vi.mock('../services/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('buildLoginPath', () => {
  test('with no options is the bare login path', () => {
    expect(buildLoginPath()).toBe(LOGIN_PATH);
    expect(buildLoginPath({})).toBe(LOGIN_PATH);
  });

  // The absence of a reason is the meaningful case: that is a visitor who asked
  // for a protected page, and under SSO_AUTO_REDIRECT they SHOULD reach the IdP.
  test('a fresh visitor with a deep link gets next but no suppression', () => {
    const path = buildLoginPath({ next: '/lab-results' });
    expect(path).not.toContain('local=1');
    expect(path).not.toContain('reason=');
    expect(new URLSearchParams(path.split('?')[1]).get('next')).toBe(
      '/lab-results'
    );
  });

  test.each([
    'logged_out',
    'session_expired',
    'sso_error',
    'account_changed',
    'registered',
  ] as const)('reason %s suppresses the auto-redirect', reason => {
    const params = new URLSearchParams(
      buildLoginPath({ reason }).split('?')[1]
    );
    expect(params.get('local')).toBe('1');
    expect(params.get('reason')).toBe(reason);
  });

  test('encodes a next that carries its own query string', () => {
    const path = buildLoginPath({
      reason: 'session_expired',
      next: '/lab-results?status=open&sort=date',
    });
    expect(path).toContain('next=%2Flab-results%3Fstatus%3Dopen%26sort%3Ddate');
    expect(new URLSearchParams(path.split('?')[1]).get('next')).toBe(
      '/lab-results?status=open&sort=date'
    );
  });

  test('drops an unsafe next rather than carrying it', () => {
    const path = buildLoginPath({
      reason: 'session_expired',
      next: 'https://evil.example',
    });
    expect(path).not.toContain('evil.example');
    expect(path).toBe('/login?local=1&reason=session_expired');
  });
});

describe('redirectToLogin', () => {
  let assign: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetLoginRedirectGuard();
    assign = stubLocation('/dashboard');
  });

  afterEach(() => {
    resetLoginRedirectGuard();
  });

  test('navigates to the built path', () => {
    redirectToLogin({ reason: 'session_expired', next: '/vitals' });
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith(
      '/login?local=1&reason=session_expired&next=%2Fvitals'
    );
  });

  // Six parallel requests against an expired session must produce one
  // navigation, not six.
  test('is idempotent across concurrent callers', () => {
    for (let i = 0; i < 6; i += 1) {
      redirectToLogin({ reason: 'session_expired' });
    }
    expect(assign).toHaveBeenCalledTimes(1);
  });

  // Otherwise a background poll that 401s while the user is sitting on the login
  // page reloads it in a loop - the same bug arriving from the other direction.
  test('does nothing when already on the login page', () => {
    const loginAssign = stubLocation(LOGIN_PATH, '?local=1');
    redirectToLogin({ reason: 'session_expired' });
    expect(loginAssign).not.toHaveBeenCalled();
  });

  test('does not log the next value, only whether one was present', async () => {
    const logger = (await import('../services/logger')).default;
    redirectToLogin({ reason: 'session_expired', next: '/patients/42' });
    expect(logger.info).toHaveBeenCalledWith(
      'login_redirect',
      expect.objectContaining({ hasNext: true })
    );
    const [, payload] = (logger.info as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.stringify(payload)).not.toContain('42');
  });
});

describe('isNonEjectingEndpoint', () => {
  // These are the URLs the API services actually build, basePath included -- the
  // admin ones are `/admin` + `/dashboard/system-health`, not
  // `/admin/system-health`. Asserting on a hand-written shape instead is what let
  // the first version of the list ship with two entries that never matched.
  test.each([
    '/api/v1/patients/recent-activity/',
    'http://localhost:8000/api/v1/invitations/pending?invitation_type=family',
    '/api/v1/paperless/sync-status',
    '/api/v1/admin/dashboard/system-health',
    '/api/v1/admin/dashboard/system-metrics',
  ])('%s is a background poll', url => {
    expect(isNonEjectingEndpoint(url)).toBe(true);
  });

  test.each(['/api/v1/admin/system-health', '/api/v1/admin/system-metrics'])(
    '%s does not match -- no client builds this shape',
    url => {
      expect(isNonEjectingEndpoint(url)).toBe(false);
    }
  );

  test.each([
    '/api/v1/patients/42',
    '/api/v1/medications',
    '/api/v1/admin/models/user/1',
    '/api/v1/users/me',
  ])('%s is user-initiated and ejects', url => {
    expect(isNonEjectingEndpoint(url)).toBe(false);
  });

  test('handles missing or non-string urls', () => {
    expect(isNonEjectingEndpoint(undefined)).toBe(false);
    expect(isNonEjectingEndpoint(null)).toBe(false);
    expect(isNonEjectingEndpoint('')).toBe(false);
  });
});
