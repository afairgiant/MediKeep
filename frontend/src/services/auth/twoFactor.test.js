import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../logger', async () => {
  const { mockLogger } = await vi.importActual('../../test-utils/i18nKeyMock');
  return mockLogger();
});

import { authService } from './simpleAuthService';
import { errorResponse } from '../../test-utils/i18nKeyMock';

const okJson = body => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: { get: () => 'application/json' },
  json: async () => body,
});

const tokenFor = claims =>
  `x.${btoa(JSON.stringify({ exp: 9999999999, ...claims }))}.y`;

const LOGIN_BODY = {
  access_token: tokenFor({ sub: 'jo', user_id: 3, role: 'user' }),
  token_type: 'bearer',
  session_timeout_minutes: 60,
  must_change_password: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('login with two-factor on', () => {
  test('returns the challenge instead of failing on the missing token', async () => {
    fetch.mockResolvedValue(
      okJson({
        mfa_required: true,
        mfa_ticket: 'ticket-1',
        methods: ['totp', 'backup_code'],
        expires_in: 300,
      })
    );

    const result = await authService.login({ username: 'jo', password: 'pw' });

    expect(result).toEqual({
      success: true,
      mfaRequired: true,
      mfaTicket: 'ticket-1',
      methods: ['totp', 'backup_code'],
    });
  });

  test('a login without two-factor is unchanged', async () => {
    fetch.mockResolvedValue(okJson(LOGIN_BODY));

    const result = await authService.login({ username: 'jo', password: 'pw' });

    expect(result.success).toBe(true);
    expect(result.mfaRequired).toBeUndefined();
    expect(result.user).toMatchObject({ id: 3, username: 'jo' });
    expect(result.sessionTimeoutMinutes).toBe(60);
  });
});

describe('verifyTwoFactor', () => {
  test('sends the ticket, code and method and returns the signed-in user', async () => {
    fetch.mockResolvedValue(
      okJson({ ...LOGIN_BODY, backup_codes_remaining: 2 })
    );

    const result = await authService.verifyTwoFactor(
      'ticket-1',
      'ABCD-EFGH',
      'backup_code'
    );

    const [url, init] = fetch.mock.calls[0];
    expect(url).toContain('/auth/two-factor/verify');
    expect(JSON.parse(init.body)).toEqual({
      mfa_ticket: 'ticket-1',
      code: 'ABCD-EFGH',
      method: 'backup_code',
    });
    expect(result.success).toBe(true);
    expect(result.user.username).toBe('jo');
    expect(result.backupCodesRemaining).toBe(2);
  });

  test('a refusal carries the server code', async () => {
    fetch.mockResolvedValue(
      errorResponse(401, {
        message: 'That code is not valid.',
        error_code: 'mfa_code_invalid',
      })
    );

    const result = await authService.verifyTwoFactor('t', '000000', 'totp');

    expect(result).toMatchObject({
      success: false,
      error: 'That code is not valid.',
      errorCode: 'mfa_code_invalid',
    });
  });

  // A second URL would resend a code the server may already have used up
  test('a network failure is not retried on the fallback URL', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await authService.verifyTwoFactor('t', '123456', 'totp');

    const verifyCalls = fetch.mock.calls.filter(([url]) =>
      String(url).includes('/auth/two-factor/verify')
    );
    expect(verifyCalls).toHaveLength(1);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBeNull();
  });

  test('goes to the URL that answered the password step', async () => {
    authService.workingBaseURL = null;
    fetch
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(
        okJson({ mfa_required: true, mfa_ticket: 't', methods: ['totp'] })
      );
    await authService.login({ username: 'jo', password: 'pw' });
    // The first URL failed, so the second one served the password step
    const servedBy = String(fetch.mock.calls[1][0]);
    fetch.mockClear();
    fetch.mockResolvedValue(okJson(LOGIN_BODY));

    await authService.verifyTwoFactor('t', '123456', 'totp');

    expect(String(fetch.mock.calls[0][0])).toBe(
      servedBy.replace('/auth/login', '/auth/two-factor/verify')
    );
  });
});
