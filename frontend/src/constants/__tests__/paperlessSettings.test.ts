import { describe, test, expect } from 'vitest';
import settingsTranslations from '../../../public/locales/en/settings.json';
import {
  PAPERLESS_AUTH_METHODS,
  hasPaperlessCredentials,
  resolvePaperlessAuthMethod,
} from '../paperlessSettings';

describe('paperless auth method setting', () => {
  test('labels are translation keys that exist in the settings namespace', () => {
    const lookup = (key: string) =>
      key
        .split('.')
        .reduce<unknown>(
          (node, part) => (node as Record<string, unknown> | undefined)?.[part],
          settingsTranslations
        );

    for (const method of PAPERLESS_AUTH_METHODS) {
      expect(lookup(method.labelKey)).toBe(method.defaultLabel);
    }
  });
});

describe('resolvePaperlessAuthMethod', () => {
  test.each([
    ['token', 'token'],
    ['basic_auth', 'basic_auth'],
    ['none', 'token'],
    ['sso', 'token'],
    ['', 'token'],
    [undefined, 'token'],
    [null, 'token'],
  ])('%s displays as %s', (stored, expected) => {
    expect(resolvePaperlessAuthMethod(stored)).toBe(expected);
  });
});

describe('hasPaperlessCredentials', () => {
  test('token: saved or typed', () => {
    expect(hasPaperlessCredentials({}, 'token')).toBe(false);
    expect(
      hasPaperlessCredentials({ paperless_has_token: true }, 'token')
    ).toBe(true);
    expect(
      hasPaperlessCredentials({ paperless_api_token: 'abc' }, 'token')
    ).toBe(true);
    expect(
      hasPaperlessCredentials({ paperless_api_token: '   ' }, 'token')
    ).toBe(false);
  });

  test('basic_auth: saved pair, or both typed', () => {
    expect(hasPaperlessCredentials({}, 'basic_auth')).toBe(false);
    expect(
      hasPaperlessCredentials({ paperless_has_credentials: true }, 'basic_auth')
    ).toBe(true);
    expect(
      hasPaperlessCredentials(
        { paperless_username: 'admin', paperless_password: 'secret' },
        'basic_auth'
      )
    ).toBe(true);
    expect(
      hasPaperlessCredentials({ paperless_username: 'admin' }, 'basic_auth')
    ).toBe(false);
  });

  test('a saved token does not count for username/password', () => {
    expect(
      hasPaperlessCredentials({ paperless_has_token: true }, 'basic_auth')
    ).toBe(false);
  });

  test('an unknown method is left for the server to judge', () => {
    expect(hasPaperlessCredentials({}, 'sso')).toBe(true);
  });
});
