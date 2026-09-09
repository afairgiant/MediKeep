import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../logger', async () => {
  const { mockLogger } = await vi.importActual('../../test-utils/i18nKeyMock');
  return mockLogger();
});

import { authService } from './simpleAuthService';

/**
 * `login`, `completeSSOAuth` and `resolveSSOConflict` must read `message` and
 * `error_code`, not `detail` - only the 422 validation handler populates `detail`,
 * so reading it discards the server's explanation on every auth failure.
 */

import { errorResponse } from '../../test-utils/i18nKeyMock';

const authError = (status, message, error_code) =>
  errorResponse(status, {
    data: null,
    status: 'FAIL',
    message,
    error_code,
    description: 'whatever',
    // Present and null on every non-422 error - the field the old code read.
    detail: null,
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('login', () => {
  test('surfaces the server message and its code', async () => {
    fetch.mockResolvedValue(
      authError(401, 'Incorrect username or password', 'invalid_credentials')
    );

    const result = await authService.login({
      username: 'someone',
      password: 'wrong',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Incorrect username or password');
    expect(result.errorCode).toBe('invalid_credentials');
  });

  test('does not fall back to the HTTP status line', async () => {
    fetch.mockResolvedValue(
      authError(401, 'This account has been deactivated.', 'account_deactivated')
    );

    const result = await authService.login({
      username: 'someone',
      password: 'right',
    });

    // The regression: this used to be the only thing a user ever saw here.
    expect(result.error).not.toContain('HTTP 401');
    expect(result.errorCode).toBe('account_deactivated');
  });

  test('still reports something when the body carries no code', async () => {
    fetch.mockResolvedValue(errorResponse(500, {}));

    const result = await authService.login({
      username: 'someone',
      password: 'x',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.errorCode).toBeNull();
  });
});

describe('completeSSOAuth', () => {
  test('carries the code out to the caller instead of discarding it', async () => {
    fetch.mockResolvedValue(
      authError(403, 'Registration is currently disabled.', 'registration_disabled')
    );

    const result = await authService.completeSSOAuth('code', 'state');

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('registration_disabled');
  });

  test('does not depend on the message wording', async () => {
    fetch.mockResolvedValue(
      authError(400, 'Some entirely different phrasing', 'sso_state_expired')
    );

    const result = await authService.completeSSOAuth('code', 'state');

    expect(result.errorCode).toBe('sso_state_expired');
  });
});

describe('resolveSSOConflict', () => {
  test('reads message rather than detail', async () => {
    fetch.mockResolvedValue(
      authError(400, 'Conflict token expired', 'sso_conflict_token_expired')
    );

    const result = await authService.resolveSSOConflict('token', 'link');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Conflict token expired');
    expect(result.errorCode).toBe('sso_conflict_token_expired');
  });
});
