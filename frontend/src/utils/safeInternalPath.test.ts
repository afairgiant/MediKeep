import { describe, test, expect } from 'vitest';
import {
  LOGIN_PATH,
  currentInternalPath,
  safeInternalPath,
} from './safeInternalPath';
import { stubLocation } from '../test-utils/browserStubs';

describe('safeInternalPath', () => {
  test('accepts a plain root-relative path', () => {
    expect(safeInternalPath('/dashboard')).toBe('/dashboard');
  });

  test('preserves query string and hash', () => {
    expect(safeInternalPath('/patients/42?edit=true#labs')).toBe(
      '/patients/42?edit=true#labs'
    );
  });

  // Each rejection is named rather than looped: the protocol-relative forms are
  // the ones a naive startsWith('/') check lets through, and a table-driven test
  // makes it too easy to delete the interesting case with the boring ones.
  test('rejects an absolute URL', () => {
    expect(safeInternalPath('https://evil.example/steal')).toBeNull();
  });

  test('rejects a protocol-relative URL', () => {
    expect(safeInternalPath('//evil.example')).toBeNull();
  });

  test('rejects a backslash protocol-relative URL', () => {
    expect(safeInternalPath('/\\evil.example')).toBeNull();
  });

  test('rejects a backslash anywhere in the path', () => {
    expect(safeInternalPath('/dashboard\\..\\admin')).toBeNull();
  });

  test('rejects a javascript: URL', () => {
    expect(safeInternalPath('javascript:alert(1)')).toBeNull();
  });

  test('rejects a path with an embedded control character', () => {
    expect(safeInternalPath('/\thttps://evil.example')).toBeNull();
  });

  test('rejects a relative path that does not start with a slash', () => {
    expect(safeInternalPath('../admin')).toBeNull();
  });

  test('rejects the login page itself, which would be a loop', () => {
    expect(safeInternalPath('/login')).toBeNull();
    expect(safeInternalPath('/login?local=1')).toBeNull();
  });

  test('rejects an over-long path', () => {
    expect(safeInternalPath(`/${'a'.repeat(3000)}`)).toBeNull();
  });

  test('rejects non-strings and empty values', () => {
    expect(safeInternalPath(null)).toBeNull();
    expect(safeInternalPath(undefined)).toBeNull();
    expect(safeInternalPath('')).toBeNull();
    expect(safeInternalPath('   ')).toBeNull();
    expect(safeInternalPath(42)).toBeNull();
    expect(safeInternalPath({ toString: () => '/dashboard' })).toBeNull();
  });

  test('normalizes traversal that stays on origin', () => {
    expect(safeInternalPath('/a/b/../c')).toBe('/a/c');
  });
});

describe('currentInternalPath', () => {
  test('returns the current path with its query string', () => {
    stubLocation('/lab-results', '?status=open');
    expect(currentInternalPath()).toBe('/lab-results?status=open');
  });

  test('returns null on the login page, which is not worth returning to', () => {
    stubLocation(LOGIN_PATH, '');
    expect(currentInternalPath()).toBeNull();
  });
});
