import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    apiError: vi.fn(),
  },
}));

import BaseApiService from './baseApi';
import { apiService } from './index';
import { resetLoginRedirectGuard } from '../../utils/loginRedirect';
import { stubLocation } from '../../test-utils/browserStubs';

/**
 * How an expired session behaves used to depend on which of the app's four HTTP
 * clients happened to make the request: baseApi redirected except on /admin/
 * URLs, apiClient redirected only for three hardcoded endpoints, and
 * services/api/index.js - which carries most of the traffic - did nothing at all.
 * These tests pin the one shared rule.
 */

const jsonResponse = (status, url, body = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  url,
  headers: { get: () => 'application/json' },
  json: async () => body,
  text: async () => JSON.stringify(body),
  blob: async () => new Blob(),
});

let assign;

beforeEach(() => {
  vi.clearAllMocks();
  resetLoginRedirectGuard();
  assign = stubLocation();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetLoginRedirectGuard();
});

const loginTarget = () => {
  expect(assign).toHaveBeenCalledTimes(1);
  const url = assign.mock.calls[0][0];
  return new URLSearchParams(url.split('?')[1]);
};

describe('baseApi 401 handling', () => {
  let api;

  beforeEach(() => {
    api = new BaseApiService('');
  });

  test('a 401 on a user-initiated request ejects with an explanation', async () => {
    assign = stubLocation('/lab-results', '?status=open');
    fetch.mockResolvedValue(jsonResponse(401, '/api/v1/medications'));

    await expect(api.get('/medications')).rejects.toThrow();

    const params = loginTarget();
    // The explanation travels in the URL, not as a toast: this ends in a full
    // page load, which discards any notification raised beforehand.
    expect(params.get('reason')).toBe('session_expired');
    expect(params.get('local')).toBe('1');
    expect(params.get('next')).toBe('/lab-results?status=open');
  });

  /**
   * Two separate defects lived here. The retry never threaded its counter, so
   * maxRetries never bound; and it re-entered the request queue while the queue
   * was still awaiting it, so the promise never settled at all. Verified against
   * main: an admin page with an expired session hung on its spinner forever -
   * no error, no redirect, nothing in the console.
   *
   * That this test completes at all is the deadlock regression; the fetch count
   * is the bound.
   */
  test('an admin 401 retries a bounded number of times, then ejects', async () => {
    fetch.mockResolvedValue(jsonResponse(401, '/api/v1/admin/models/user/1'));

    await expect(api.get('/admin/models/user/1')).rejects.toThrow();

    expect(fetch).toHaveBeenCalledTimes(3); // initial + maxRetries
    expect(assign).toHaveBeenCalledTimes(1);
  });

  test('a non-GET 401 is not replayed as a GET', async () => {
    fetch.mockResolvedValue(jsonResponse(401, '/api/v1/admin/models/user/1'));

    await expect(api.post('/admin/models/user/1', {})).rejects.toThrow();

    // One attempt only. Replaying a mutation as a GET, which the old retry did,
    // is worse than not retrying.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].method).toBe('POST');
    expect(assign).toHaveBeenCalledTimes(1);
  });

  test('a 401 from a background poll does not eject the user', async () => {
    fetch.mockResolvedValue(jsonResponse(401, '/api/v1/admin/dashboard/system-health'));

    await expect(api.get('/admin/dashboard/system-health')).rejects.toThrow();

    expect(assign).not.toHaveBeenCalled();
  });

  test('an exempt 401 followed by a user-initiated 401 does eject', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse(401, '/api/v1/admin/dashboard/system-health')
    );
    await expect(api.get('/admin/dashboard/system-health')).rejects.toThrow();
    expect(assign).not.toHaveBeenCalled();

    // The exemption keeps a timer from throwing an active user out; it does not
    // strand a logged-out user on a dead page.
    fetch.mockResolvedValue(jsonResponse(401, '/api/v1/medications'));
    await expect(api.get('/medications')).rejects.toThrow();
    expect(assign).toHaveBeenCalledTimes(1);
  });

  test('concurrent 401s produce exactly one navigation', async () => {
    fetch.mockResolvedValue(jsonResponse(401, '/api/v1/medications'));

    await Promise.allSettled([
      api.get('/medications'),
      api.get('/allergies'),
      api.get('/conditions'),
      api.get('/vitals'),
      api.get('/procedures'),
      api.get('/treatments'),
    ]);

    expect(assign).toHaveBeenCalledTimes(1);
  });

  test('a 401 while already on the login page does not reload it', async () => {
    assign = stubLocation('/login', '?local=1&reason=session_expired');
    fetch.mockResolvedValue(jsonResponse(401, '/api/v1/medications'));

    await expect(api.get('/medications')).rejects.toThrow();

    expect(assign).not.toHaveBeenCalled();
  });
});

describe('apiService (services/api/index.js) 401 handling', () => {
  test('ejects, where before it only logged', async () => {
    assign = stubLocation('/dashboard');
    fetch.mockResolvedValue(
      jsonResponse(401, '/api/v1/patients/me', { detail: 'Not authenticated' })
    );

    await expect(apiService.get('/patients/me')).rejects.toThrow();

    expect(loginTarget().get('reason')).toBe('session_expired');
  });

  test('does not eject on its own background poll', async () => {
    assign = stubLocation('/dashboard');
    fetch.mockResolvedValue(
      jsonResponse(401, '/api/v1/patients/recent-activity/')
    );

    await expect(
      apiService.get('/patients/recent-activity/')
    ).rejects.toThrow();

    expect(assign).not.toHaveBeenCalled();
  });

  test('ejects even when the error body is not JSON', async () => {
    assign = stubLocation('/dashboard');
    fetch.mockResolvedValue({
      ok: false,
      status: 401,
      url: '/api/v1/patients/me',
      headers: { get: () => 'text/html' },
      text: async () => '<html>nginx</html>',
    });

    await expect(apiService.get('/patients/me')).rejects.toThrow();

    // An expired session is just as expired when the body is not JSON.
    expect(assign).toHaveBeenCalledTimes(1);
  });
});
