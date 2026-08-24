import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  consumeAutoRedirectAttempt,
  clearAutoRedirectAttempts,
} from './autoRedirectGuard';
import {
  stubWorkingSessionStorage,
  withThrowingSessionStorage,
} from '../test-utils/browserStubs';

/**
 * The guard's whole job is to fail in the harmless direction.
 *
 * Suppression -- "a session just ended, do not bounce" -- lives in the URL and
 * is required to work with storage unavailable. This is a different question
 * ("has this browser bounced three times in a minute?") that no URL can answer,
 * because the loop's defining feature is a URL that comes back clean. So it is
 * allowed to depend on sessionStorage, but only as long as losing sessionStorage
 * degrades to "allow the redirect" and never to "refuse it".
 */

// The global setup stubs sessionStorage with vi.fn()s that store nothing, so a
// test asserting "the value persisted" can never fail without a real store.
let store: Map<string, string>;

beforeEach(() => {
  vi.clearAllMocks();
  store = stubWorkingSessionStorage();
});

describe('with storage working', () => {
  test('allows three bounces, refuses the fourth', () => {
    const now = 1_000_000;
    expect(consumeAutoRedirectAttempt(now)).toBe(true);
    expect(consumeAutoRedirectAttempt(now + 1000)).toBe(true);
    expect(consumeAutoRedirectAttempt(now + 2000)).toBe(true);
    expect(consumeAutoRedirectAttempt(now + 3000)).toBe(false);
  });

  test('stays refused for the rest of the window', () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i += 1) consumeAutoRedirectAttempt(now + i);
    expect(consumeAutoRedirectAttempt(now + 59_000)).toBe(false);
  });

  test('allows again once the window has passed', () => {
    // Someone who legitimately signs in again an hour later must not inherit a
    // spent count from a loop that has long since stopped.
    const now = 1_000_000;
    for (let i = 0; i < 3; i += 1) consumeAutoRedirectAttempt(now + i);
    expect(consumeAutoRedirectAttempt(now + 60_001)).toBe(true);
  });

  test('clearing resets the count', () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i += 1) consumeAutoRedirectAttempt(now + i);
    expect(consumeAutoRedirectAttempt(now + 100)).toBe(false);

    clearAutoRedirectAttempts();

    expect(consumeAutoRedirectAttempt(now + 200)).toBe(true);
  });

  test('a clock that jumps backwards starts a fresh window, not a locked one', () => {
    // NTP correction or a suspended laptop. Treating a negative elapsed time as
    // "inside the window" would keep a spent count alive indefinitely.
    const now = 1_000_000;
    for (let i = 0; i < 3; i += 1) consumeAutoRedirectAttempt(now + i);
    expect(consumeAutoRedirectAttempt(now - 500_000)).toBe(true);
  });
});

describe('when storage cannot be trusted', () => {
  test('a throwing sessionStorage still allows the redirect', () => {
    // Private browsing throws on the property itself, not just on getItem, so
    // this is stricter than "storage returns null". Refusing here would disable
    // auto-redirect entirely for those users.
    withThrowingSessionStorage(() => {
      expect(consumeAutoRedirectAttempt()).toBe(true);
      expect(consumeAutoRedirectAttempt()).toBe(true);
      expect(consumeAutoRedirectAttempt()).toBe(true);
      expect(consumeAutoRedirectAttempt()).toBe(true);
    });
  });

  test('clearing never throws when storage is unavailable', () => {
    withThrowingSessionStorage(() => {
      expect(() => clearAutoRedirectAttempts()).not.toThrow();
    });
  });

  test('unparseable JSON under our key is ignored, not fatal', () => {
    store.set('sso_auto_redirect_attempts', 'not json{');
    expect(consumeAutoRedirectAttempt()).toBe(true);
  });

  test('a well-formed value of the wrong shape is ignored', () => {
    // Another tab, an extension, or an older version of this code.
    store.set('sso_auto_redirect_attempts', JSON.stringify({ nope: true }));
    expect(consumeAutoRedirectAttempt()).toBe(true);
  });

  test('a full quota on write does not refuse the redirect', () => {
    vi.mocked(sessionStorage.setItem).mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });
    expect(consumeAutoRedirectAttempt()).toBe(true);
  });
});
