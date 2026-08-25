import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { authService } from './simpleAuthService';

/**
 * What a failed POST /auth/sso/initiate tells its caller.
 *
 * This used to be nothing at all. The error path read `errorData.detail`, and
 * this app's global handler renames `detail` to `message` before the response
 * leaves the server -- so every failure of this endpoint, the rate limit and the
 * return_url rejection alike, reached the user as one hardcoded string with the
 * status, the retry time and the server's own text all discarded.
 *
 * The auto-redirect effect has to tell "wait 45 seconds" apart from "your
 * identity provider is misconfigured", because under SSO_ONLY_MODE there is no
 * password form to fall back to and an unhandled throttle is a blank page.
 */

/** The envelope app/core/http/error_handling.py actually produces. */
const errorResponse = (status, body = {}, headers = {}) => {
  const lookup = new Map(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );
  return {
    ok: false,
    status,
    statusText: 'Error',
    headers: { get: name => lookup.get(name.toLowerCase()) ?? null },
    json: async () => body,
  };
};

const okResponse = body => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: { get: () => null },
  json: async () => body,
});

const rateLimited = (headers = {}) =>
  errorResponse(
    429,
    {
      message: 'Too many SSO sign-in attempts. Please wait 45 seconds.',
      error_code: 'RATE-429',
    },
    headers
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('initiateSSOLogin failure shape', () => {
  test('a 429 carries status, retry seconds and error code', async () => {
    fetch.mockResolvedValue(rateLimited({ 'Retry-After': '45' }));

    const error = await authService
      .initiateSSOLogin('/dashboard')
      .catch(e => e);

    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(429);
    expect(error.retryAfterSeconds).toBe(45);
    expect(error.errorCode).toBe('RATE-429');
  });

  test('the server message survives instead of the generic fallback', async () => {
    fetch.mockResolvedValue(rateLimited({ 'Retry-After': '45' }));

    const error = await authService.initiateSSOLogin().catch(e => e);

    expect(error.message).toContain('45 seconds');
  });

  test('a stripped Retry-After leaves the seconds null, not NaN', async () => {
    // A reverse proxy can drop the header, and it is invisible cross-origin
    // unless the API exposes it. NaN would render as "wait NaN seconds".
    fetch.mockResolvedValue(rateLimited());

    const error = await authService.initiateSSOLogin().catch(e => e);

    expect(error.status).toBe(429);
    expect(error.retryAfterSeconds).toBeNull();
  });

  test('a non-numeric Retry-After leaves the seconds null', async () => {
    // HTTP allows an HTTP-date here, which parseInt would turn into garbage.
    fetch.mockResolvedValue(
      rateLimited({ 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' })
    );

    const error = await authService.initiateSSOLogin().catch(e => e);

    expect(error.retryAfterSeconds).toBeNull();
  });

  test('`detail` is NOT read -- this app never sends it', async () => {
    // The regression that motivated all of the above. A body carrying only
    // `detail` must fall back to generic copy rather than appearing to work,
    // because anything relying on `detail` is reading a field that is not there.
    fetch.mockResolvedValue(
      errorResponse(400, { detail: 'should be ignored' })
    );

    const error = await authService
      .initiateSSOLogin('//evil.example')
      .catch(e => e);

    expect(error.message).toBe('Failed to start SSO authentication');
    expect(error.status).toBe(400);
  });

  test('a rejected return_url reports 400 with the server text', async () => {
    fetch.mockResolvedValue(
      errorResponse(400, { message: 'return_url must be an internal path' })
    );

    const error = await authService
      .initiateSSOLogin('//evil.example')
      .catch(e => e);

    expect(error.status).toBe(400);
    expect(error.message).toBe('return_url must be an internal path');
  });

  test('an unparseable body still yields a usable error', async () => {
    const broken = errorResponse(500);
    broken.json = async () => {
      throw new SyntaxError('Unexpected token < in JSON');
    };
    fetch.mockResolvedValue(broken);

    const error = await authService.initiateSSOLogin().catch(e => e);

    expect(error.status).toBe(500);
    expect(error.message).toBe('Failed to start SSO authentication');
    expect(error.retryAfterSeconds).toBeNull();
  });
});

describe('initiateSSOLogin success', () => {
  test('returns the payload and passes the return path through', async () => {
    fetch.mockResolvedValue(
      okResponse({ auth_url: 'https://idp/authorize', provider: 'keycloak' })
    );

    const data = await authService.initiateSSOLogin('/lab-results?status=open');

    expect(data.auth_url).toBe('https://idp/authorize');
    const requestedUrl = fetch.mock.calls[0][0];
    expect(requestedUrl).toContain(
      `return_url=${encodeURIComponent('/lab-results?status=open')}`
    );
  });

  test('omits return_url entirely when there is no deep link', async () => {
    // An empty string would be stored and echoed back to the callback as "",
    // where the consumer expects a path or null.
    fetch.mockResolvedValue(okResponse({ auth_url: 'https://idp/authorize' }));

    await authService.initiateSSOLogin();

    expect(fetch.mock.calls[0][0]).not.toContain('return_url');
  });
});
