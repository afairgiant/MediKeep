import { describe, test, expect } from 'vitest';
import {
  assertPaperlessAuthMethodUsable,
  getChangedKeys,
  isSameValue,
} from '../Settings';
import { isPaperlessSetting } from '../../constants/paperlessSettings';

describe('isSameValue', () => {
  test('treats primitives by === ', () => {
    expect(isSameValue(84, 84)).toBe(true);
    expect(isSameValue(84, 85)).toBe(false);
    expect(isSameValue(null, null)).toBe(true);
    expect(isSameValue(null, undefined)).toBe(false);
  });

  test('treats objects with equal content as equal regardless of reference', () => {
    const a = { whole_blood: 84, plasma: 14 };
    const b = { whole_blood: 84, plasma: 14 };
    expect(a).not.toBe(b);
    expect(isSameValue(a, b)).toBe(true);
  });

  test('treats objects with different content as different', () => {
    expect(isSameValue({ whole_blood: 84 }, { whole_blood: 85 })).toBe(false);
  });
});

describe('getChangedKeys', () => {
  test('does not report a change when an object value round-trips back to the server value', () => {
    const server = { blood_donation_intervals: { whole_blood: 84 } };
    // Simulates the user changing 84 -> 85 -> 84: a new object with the
    // same content as the server's, but a different reference.
    const local = { blood_donation_intervals: { whole_blood: 84 } };

    expect(getChangedKeys(local, server)).toEqual([]);
  });

  test('reports a change when the object value actually differs', () => {
    const server = { blood_donation_intervals: { whole_blood: 84 } };
    const local = { blood_donation_intervals: { whole_blood: 85 } };

    expect(getChangedKeys(local, server)).toEqual(['blood_donation_intervals']);
  });

  test('ignores the server-derived connection verified flags', () => {
    // A successful Test Connection flips the flag locally before the context
    // reloads; that must not look like an unsaved edit.
    const server = {
      paperless_connection_verified: false,
      papra_connection_verified: false,
    };
    const local = {
      paperless_connection_verified: true,
      papra_connection_verified: true,
    };

    expect(getChangedKeys(local, server)).toEqual([]);
  });

  test('still reports changes for plain scalar fields', () => {
    const server = { unit_system: 'imperial' };
    const local = { unit_system: 'metric' };

    expect(getChangedKeys(local, server)).toEqual(['unit_system']);
  });
});

describe('Paperless authentication method', () => {
  test('switching the method is a Paperless change that enables saving', () => {
    const server = { paperless_auth_method: 'token', unit_system: 'imperial' };
    const local = {
      paperless_auth_method: 'basic_auth',
      unit_system: 'imperial',
    };

    expect(getChangedKeys(local, server, isPaperlessSetting)).toEqual([
      'paperless_auth_method',
    ]);
    expect(
      getChangedKeys(local, server, key => !isPaperlessSetting(key))
    ).toEqual([]);
  });

  test('switching back to the saved method is no longer a change', () => {
    const server = { paperless_auth_method: 'token' };
    const local = { paperless_auth_method: 'token' };

    expect(getChangedKeys(local, server, isPaperlessSetting)).toEqual([]);
  });
});

describe('assertPaperlessAuthMethodUsable', () => {
  test('blocks selecting a method that has no credentials', () => {
    expect(() =>
      assertPaperlessAuthMethodUsable(
        { paperless_auth_method: 'basic_auth' },
        { paperless_auth_method: 'basic_auth', paperless_has_token: true }
      )
    ).toThrow('no credentials');
  });

  test('allows a method with saved credentials', () => {
    expect(() =>
      assertPaperlessAuthMethodUsable(
        { paperless_auth_method: 'basic_auth' },
        { paperless_has_credentials: true }
      )
    ).not.toThrow();
  });

  test('allows a method whose credentials are typed in the same save', () => {
    expect(() =>
      assertPaperlessAuthMethodUsable(
        { paperless_auth_method: 'basic_auth' },
        { paperless_username: 'admin', paperless_password: 'secret' }
      )
    ).not.toThrow();
  });

  test('ignores saves that do not change the method', () => {
    expect(() =>
      assertPaperlessAuthMethodUsable({ unit_system: 'metric' }, {})
    ).not.toThrow();
  });
});
