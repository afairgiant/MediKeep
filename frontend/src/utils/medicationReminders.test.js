import { describe, it, expect } from 'vitest';
import {
  getReminderBlockers,
  getReminderBlockerDescriptors,
  getWontFireWarning,
  REMINDER_BLOCKERS,
} from './medicationReminders';

// Minimal t() stand-in: returns the defaultValue with {{params}} interpolated.
const fakeT = (key, options = {}) => {
  if (typeof options === 'string') return options;
  let text = options.defaultValue ?? key;
  for (const [name, value] of Object.entries(options)) {
    if (name !== 'defaultValue') {
      text = text.replace(`{{${name}}}`, String(value));
    }
  }
  return text;
};

// Arbitrary fixed date for deterministic boundary tests
const TODAY = '2026-06-10';

describe('getReminderBlockers', () => {
  it('returns no blockers for an active in-period medication', () => {
    expect(
      getReminderBlockers(
        {
          status: 'active',
          effective_period_start: '2026-01-01',
          effective_period_end: '2026-12-31',
        },
        TODAY
      )
    ).toEqual([]);
  });

  it('treats missing dates as unbounded', () => {
    expect(getReminderBlockers({ status: 'active' }, TODAY)).toEqual([]);
    expect(
      getReminderBlockers(
        { status: 'active', effective_period_start: null, effective_period_end: '' },
        TODAY
      )
    ).toEqual([]);
  });

  it('still fires when the end date is today (inclusive bound)', () => {
    expect(
      getReminderBlockers(
        { status: 'active', effective_period_end: '2026-06-10' },
        TODAY
      )
    ).toEqual([]);
  });

  it('blocks when the end date was yesterday', () => {
    expect(
      getReminderBlockers(
        { status: 'active', effective_period_end: '2026-06-09' },
        TODAY
      )
    ).toEqual([REMINDER_BLOCKERS.PERIOD_ENDED]);
  });

  it('still fires when the start date is today (inclusive bound)', () => {
    expect(
      getReminderBlockers(
        { status: 'active', effective_period_start: '2026-06-10' },
        TODAY
      )
    ).toEqual([]);
  });

  it('blocks when the start date is tomorrow', () => {
    expect(
      getReminderBlockers(
        { status: 'active', effective_period_start: '2026-06-11' },
        TODAY
      )
    ).toEqual([REMINDER_BLOCKERS.NOT_STARTED]);
  });

  it('blocks any non-active status, including empty', () => {
    expect(getReminderBlockers({ status: 'stopped' }, TODAY)).toEqual([
      REMINDER_BLOCKERS.STATUS_NOT_ACTIVE,
    ]);
    expect(getReminderBlockers({ status: '' }, TODAY)).toEqual([
      REMINDER_BLOCKERS.STATUS_NOT_ACTIVE,
    ]);
    expect(getReminderBlockers({}, TODAY)).toEqual([
      REMINDER_BLOCKERS.STATUS_NOT_ACTIVE,
    ]);
  });

  it('reports multiple blockers together', () => {
    expect(
      getReminderBlockers(
        { status: 'stopped', effective_period_end: '2025-10-30' },
        TODAY
      )
    ).toEqual([
      REMINDER_BLOCKERS.PERIOD_ENDED,
      REMINDER_BLOCKERS.STATUS_NOT_ACTIVE,
    ]);
  });

  it('accepts full ISO datetime strings by using the date part', () => {
    expect(
      getReminderBlockers(
        { status: 'active', effective_period_end: '2025-10-30T00:00:00' },
        TODAY
      )
    ).toEqual([REMINDER_BLOCKERS.PERIOD_ENDED]);
  });

  it('handles a null medication without throwing', () => {
    expect(getReminderBlockers(null, TODAY)).toEqual([
      REMINDER_BLOCKERS.STATUS_NOT_ACTIVE,
    ]);
  });
});

describe('getReminderBlockerDescriptors', () => {
  it('returns translation key, params, and defaultValue per blocker', () => {
    const descriptors = getReminderBlockerDescriptors(
      { status: 'stopped', effective_period_end: '2025-10-30' },
      TODAY
    );
    expect(descriptors).toEqual([
      {
        blocker: REMINDER_BLOCKERS.PERIOD_ENDED,
        key: 'medications.reminders.notFiring.periodEnded',
        params: { date: '2025-10-30' },
        defaultValue:
          'This medication is marked as no longer taken as of {{date}}.',
      },
      {
        blocker: REMINDER_BLOCKERS.STATUS_NOT_ACTIVE,
        key: 'medications.reminders.notFiring.statusNotActive',
        params: { status: 'stopped' },
        defaultValue:
          'The medication status is "{{status}}" — reminders only fire for active medications.',
      },
    ]);
  });

  it('returns an empty array when nothing blocks', () => {
    expect(getReminderBlockerDescriptors({ status: 'active' }, TODAY)).toEqual([]);
  });
});

describe('getWontFireWarning', () => {
  it('returns null when reminders are disabled, even with blockers', () => {
    expect(
      getWontFireWarning(
        { reminder_enabled: false, status: 'stopped' },
        fakeT,
        TODAY
      )
    ).toBeNull();
  });

  it('returns null when reminders are enabled and nothing blocks', () => {
    expect(
      getWontFireWarning(
        { reminder_enabled: true, status: 'active' },
        fakeT,
        TODAY
      )
    ).toBeNull();
  });

  it('returns a title and all blocker reasons joined when blocked', () => {
    const warning = getWontFireWarning(
      {
        reminder_enabled: true,
        status: 'stopped',
        effective_period_end: '2025-10-30',
      },
      fakeT,
      TODAY
    );

    expect(warning.title).toBe("Reminders won't fire");
    expect(warning.message).toContain(
      'This medication is marked as no longer taken as of 2025-10-30.'
    );
    expect(warning.message).toContain(
      'The medication status is "stopped" — reminders only fire for active medications.'
    );
  });
});
