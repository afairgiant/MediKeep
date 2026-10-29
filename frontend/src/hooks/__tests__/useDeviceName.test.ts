import { describe, test, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}(${vars.browser}, ${vars.os})` : key,
  }),
}));

import { useDeviceName } from '../useDeviceName';

const FIREFOX_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0';

describe('useDeviceName', () => {
  const name = () => renderHook(() => useDeviceName()).result.current;

  test('names the browser and system together', () => {
    expect(name()(FIREFOX_WINDOWS)).toBe('device.name(Firefox, Windows)');
  });

  test('falls back to whichever part it recognises', () => {
    expect(name()('SomeBot/1.0 (Linux)')).toBe('Linux');
  });

  test('says unknown when nothing is recognised or there is no user agent', () => {
    expect(name()('curl/8.4.0')).toBe('device.unknown');
    expect(name()(null)).toBe('device.unknown');
  });
});
