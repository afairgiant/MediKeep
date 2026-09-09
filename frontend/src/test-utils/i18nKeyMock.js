import { vi } from 'vitest';

/**
 * A `react-i18next` mock backed by a real key table, for tests asserting that our
 * copy renders rather than the server's.
 *
 * setupTests.js mocks `t()` to return its default argument, which makes
 * `t(key, serverMessage)` and the bare server message indistinguishable - so any test
 * of code-selected copy is vacuous under the global mock. This replaces it with a
 * lookup: a known key renders its value, an unknown one falls back to the default.
 *
 * Call from inside a `vi.mock('react-i18next', ...)` factory. The key table must come
 * from `vi.hoisted()`, because the factory is hoisted above module-level consts.
 *
 * @param {Record<string, string>} resources - full key path -> translated string
 * @param {string} [language] - what `i18n.language` reports
 */
export function i18nKeyMock(resources, language = 'de') {
  return {
    useTranslation: () => ({
      t: (key, defaultValue) =>
        resources[key] ??
        (typeof defaultValue === 'string' ? defaultValue : key),
      i18n: { language, changeLanguage: () => Promise.resolve() },
    }),
    Trans: ({ children }) => children,
    I18nextProvider: ({ children }) => children,
    initReactI18next: { type: '3rdParty', init: () => {} },
  };
}

/**
 * The error envelope `app/core/http/error_handling.py` actually produces, as a fake
 * `fetch` Response. `detail` is null on every non-422 error - reading it instead of
 * `message` is the defect these fixtures exist to pin.
 */
export const errorResponse = (status, body = {}, headers = {}) => {
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

/** Silences the logger import shared by every auth service test. */
export const mockLogger = () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
});
