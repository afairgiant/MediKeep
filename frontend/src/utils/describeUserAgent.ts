export interface DeviceDescription {
  browser: string | null;
  os: string | null;
}

// Order matters: Edge and Opera also say Chrome, and Chrome also says Safari
const BROWSERS: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

// iOS and Android before macOS and Linux, which their user agents also mention
const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/CrOS/, 'ChromeOS'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux/, 'Linux'],
];

const firstMatch = (ua: string, patterns: [RegExp, string][]) =>
  patterns.find(([pattern]) => pattern.test(ua))?.[1] ?? null;

/** Browser and operating system names from a user agent string; null where unknown. */
export function describeUserAgent(
  userAgent: string | null | undefined
): DeviceDescription {
  const ua = userAgent ?? '';
  return { browser: firstMatch(ua, BROWSERS), os: firstMatch(ua, SYSTEMS) };
}
