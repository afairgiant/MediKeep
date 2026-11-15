import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { timezoneService } from './timezoneService';

describe('timezoneService.getTodayKey', () => {
  const original = {
    initialized: timezoneService.initialized,
    timezone: timezoneService.timezone,
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.assign(timezoneService, original);
  });

  it("uses the browser's date until the server timezone has loaded", () => {
    vi.setSystemTime(new Date(2026, 10, 15, 23, 30));
    timezoneService.initialized = false;
    expect(timezoneService.getTodayKey()).toBe('2026-11-15');
  });

  it("uses the server's date once its timezone is known", () => {
    // Noon UTC is already Nov 16 at UTC+14 and still Nov 15 at UTC-11
    vi.setSystemTime(new Date(Date.UTC(2026, 10, 15, 12, 0)));
    timezoneService.initialized = true;
    timezoneService.timezone = 'Pacific/Kiritimati';
    expect(timezoneService.getTodayKey()).toBe('2026-11-16');
    timezoneService.timezone = 'Pacific/Pago_Pago';
    expect(timezoneService.getTodayKey()).toBe('2026-11-15');
  });
});
