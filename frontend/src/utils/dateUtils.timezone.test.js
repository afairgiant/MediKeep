/**
 * Timezone regression tests for the "today as YYYY-MM-DD" helpers.
 *
 * Guards against reintroducing `new Date().toISOString().split('T')[0]`, which
 * returns the *UTC* calendar date rather than the user's *local* one. Symptom
 * date fields auto-populated with that pattern handed users west of UTC a date
 * one day in the future, which then failed "cannot be in the future" validation
 * and blocked saving entirely during evening hours.
 *
 * Why these tests look the way they do
 * ------------------------------------
 * Vitest workers resolve the timezone once at startup, so `process.env.TZ` and
 * `vi.stubEnv('TZ', ...)` cannot switch it mid-run - a per-timezone matrix is
 * not achievable in-process. Instead every instant here is built with the
 * *local-time* Date constructor (`new Date(y, m, d, H, M)`), so the expected
 * calendar date is the same no matter which timezone CI happens to run in,
 * while the hour is chosen so local and UTC genuinely disagree.
 *
 * These tests assert observable behaviour rather than mocking Date's getters,
 * so they stay valid if the implementation is refactored (e.g. to
 * `toLocaleDateString('en-CA')`) and still fail if it regresses back to UTC.
 */
import { describe, test, expect, afterEach, vi } from 'vitest';
import { getTodayString, formatDateForAPI, isDateInFuture } from './dateUtils';

/** Minutes UTC is ahead of local time; positive west of UTC (e.g. 420 for PDT). */
const UTC_OFFSET_MINUTES = new Date(2026, 6, 30).getTimezoneOffset();
const IS_WEST_OF_UTC = UTC_OFFSET_MINUTES > 0;
const IS_EAST_OF_UTC = UTC_OFFSET_MINUTES < 0;
const DIVERGES_FROM_UTC = IS_WEST_OF_UTC || IS_EAST_OF_UTC;

/**
 * Local Thu 2026-07-30 at the edge of the day, in whatever timezone the test
 * runner is in. West of UTC, 23:30 local has already rolled over to Jul 31 in
 * UTC; east of UTC, 00:30 local is still Jul 29 in UTC. Either way the correct
 * local answer is 2026-07-30.
 */
const LOCAL_LATE_EVENING = new Date(2026, 6, 30, 23, 30, 0);
const LOCAL_EARLY_MORNING = new Date(2026, 6, 30, 0, 30, 0);

/** The instant most likely to expose a UTC-based implementation here. */
const DIVERGENT_INSTANT = IS_EAST_OF_UTC
  ? LOCAL_EARLY_MORNING
  : LOCAL_LATE_EVENING;

/** What the old, buggy implementation would have produced. */
const utcDateString = () => new Date().toISOString().split('T')[0];

/** Run `fn` with the system clock pinned to `instant`, restoring real timers after. */
function at(instant, fn) {
  vi.useFakeTimers();
  vi.setSystemTime(instant);
  return fn();
}

afterEach(() => {
  vi.useRealTimers();
});

describe('getTodayString - returns the local calendar date, never the UTC one', () => {
  test('at 23:30 local, still reports today rather than tomorrow', () => {
    at(LOCAL_LATE_EVENING, () => {
      expect(getTodayString()).toBe('2026-07-30');
    });
  });

  test('at 00:30 local, still reports today rather than yesterday', () => {
    at(LOCAL_EARLY_MORNING, () => {
      expect(getTodayString()).toBe('2026-07-30');
    });
  });

  test.runIf(DIVERGES_FROM_UTC)(
    'disagrees with the UTC date exactly when the two calendars differ',
    () => {
      at(DIVERGENT_INSTANT, () => {
        // Precondition: this instant really does straddle the date line.
        expect(utcDateString()).not.toBe('2026-07-30');

        expect(getTodayString()).toBe('2026-07-30');
        expect(getTodayString()).not.toBe(utcDateString());
      });
    }
  );

  test.runIf(!DIVERGES_FROM_UTC)(
    'agrees with the UTC date when the runner is in UTC',
    () => {
      at(LOCAL_LATE_EVENING, () => {
        expect(getTodayString()).toBe(utcDateString());
      });
    }
  );

  test('zero-pads single-digit months and days', () => {
    at(new Date(2026, 0, 5, 23, 30, 0), () => {
      expect(getTodayString()).toBe('2026-01-05');
    });
  });

  test('stays correct on a DST transition date', () => {
    // 2026-03-08 is the US spring-forward date. Midday avoids the skipped hour
    // so this is a valid wall-clock time in every timezone.
    at(new Date(2026, 2, 8, 12, 0, 0), () => {
      expect(getTodayString()).toBe('2026-03-08');
    });
  });
});

describe('getTodayString feeds validation without tripping it', () => {
  /**
   * The actual user-visible contract behind the bug: whatever the form
   * auto-fills must survive the "cannot be in the future" check. Under the old
   * UTC implementation this assertion failed for the whole evening.
   */
  test('the auto-filled value is never considered a future date', () => {
    at(DIVERGENT_INSTANT, () => {
      expect(isDateInFuture(getTodayString())).toBe(false);
    });
  });

  test('a genuinely future date is still rejected', () => {
    at(DIVERGENT_INSTANT, () => {
      expect(isDateInFuture('2026-08-15')).toBe(true);
    });
  });
});

describe('formatDateForAPI - formats a Date by its local parts', () => {
  test.runIf(DIVERGES_FROM_UTC)(
    'uses local date parts rather than the UTC ones',
    () => {
      at(DIVERGENT_INSTANT, () => {
        const now = new Date();

        expect(now.toISOString().split('T')[0]).not.toBe('2026-07-30');
        expect(formatDateForAPI(now)).toBe('2026-07-30');
      });
    }
  );

  test('passes through an existing YYYY-MM-DD string untouched', () => {
    expect(formatDateForAPI('2026-07-30')).toBe('2026-07-30');
  });

  test('returns null for empty input', () => {
    expect(formatDateForAPI(null)).toBeNull();
    expect(formatDateForAPI('')).toBeNull();
  });
});
