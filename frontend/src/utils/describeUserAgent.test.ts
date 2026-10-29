import { describe, expect, it } from 'vitest';
import { describeUserAgent } from './describeUserAgent';

describe('describeUserAgent', () => {
  it.each([
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Chrome',
      'Windows',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
      'Edge',
      'Windows',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      'Safari',
      'macOS',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'Safari',
      'iOS',
    ],
    [
      'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
      'Chrome',
      'Android',
    ],
    [
      'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
      'Firefox',
      'Linux',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0',
      'Opera',
      'Windows',
    ],
  ])('names the browser and system of %s', (ua, browser, os) => {
    expect(describeUserAgent(ua)).toEqual({ browser, os });
  });

  it.each([null, undefined, '', 'curl/8.0'])(
    'returns nulls for an unknown agent (%s)',
    ua => {
      expect(describeUserAgent(ua)).toEqual({ browser: null, os: null });
    }
  );
});
