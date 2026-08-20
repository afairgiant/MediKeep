import { vi } from 'vitest';

/**
 * Browser globals that jsdom will not let you assign to directly, or that
 * `setupTests.js` has already replaced with mocks.
 */

/**
 * Replace `window.location` with a stub.
 *
 * jsdom's real location cannot be assigned to, and tests around redirects need to
 * observe the target rather than navigate to it.
 *
 * @returns the `assign` spy, so a caller can assert on where it was sent.
 */
export const stubLocation = (pathname = '/dashboard', search = '') => {
  const assign = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: {
      pathname,
      search,
      origin: 'http://localhost',
      href: `http://localhost${pathname}${search}`,
      assign,
    },
  });
  return assign;
};

/**
 * Run `fn` with sessionStorage throwing on access.
 *
 * This is the private-browsing case, and it is stricter than "storage returns
 * null": Safari's private mode throws on the property itself, so code that only
 * guards `getItem` still breaks. Restores the original descriptor afterwards even
 * if `fn` throws.
 */
export const withThrowingSessionStorage = fn => {
  const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    get() {
      throw new Error('storage disabled');
    },
  });
  try {
    return fn();
  } finally {
    if (original) {
      Object.defineProperty(window, 'sessionStorage', original);
    }
  }
};
