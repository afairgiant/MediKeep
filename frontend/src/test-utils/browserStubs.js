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
export const stubLocation = (
  pathname = '/dashboard',
  search = '',
  hash = ''
) => {
  const assign = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: {
      pathname,
      search,
      // Present and empty by default. currentInternalPath() concatenates it, so
      // leaving it undefined appends the string "undefined" to every return path.
      hash,
      origin: 'http://localhost',
      href: `http://localhost${pathname}${search}${hash}`,
      assign,
    },
  });
  return assign;
};

/**
 * Give sessionStorage a real in-memory backing store for the current test.
 *
 * `setupTests.js` replaces sessionStorage with bare `vi.fn()`s that store
 * nothing, so anything that writes a value and reads it back later silently sees
 * nothing and its test can never fail. Point those same spies at a Map when the
 * behavior under test is "the value persisted".
 *
 * Storage being *unavailable* is the other half of that story and has its own
 * helper below -- code that depends on storage generally has to work without it.
 *
 * @returns the backing Map, so a caller can seed or inspect it.
 */
export const stubWorkingSessionStorage = () => {
  const store = new Map();
  vi.mocked(sessionStorage.getItem).mockImplementation(
    key => store.get(key) ?? null
  );
  vi.mocked(sessionStorage.setItem).mockImplementation((key, value) => {
    store.set(key, String(value));
  });
  vi.mocked(sessionStorage.removeItem).mockImplementation(key => {
    store.delete(key);
  });
  return store;
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
    } else {
      // No own descriptor to restore: sessionStorage was inherited from the
      // prototype, so deleting the one we injected uncovers it again. Without
      // this the throwing getter outlives the call and every later test in the
      // file sees storage explode.
      delete window.sessionStorage;
    }
  }
};
