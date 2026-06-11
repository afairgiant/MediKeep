import { describe, it, expect } from 'vitest';
import {
  getReminderBlockers,
  getReminderBlockerDescriptors,
  REMINDER_BLOCKERS,
} from './medicationReminders';

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
        defaultValue: 'The effective period ended on {{date}}.',
      },
      {
        blocker: REMINDER_BLOCKERS.STATUS_NOT_ACTIVE,
        key: 'medications.reminders.notFiring.statusNotActive',
        params: { status: 'stopped' },
        defaultValue: 'The medication status is "{{status}}", not active.',
      },
    ]);
  });

  it('returns an empty array when nothing blocks', () => {
    expect(getReminderBlockerDescriptors({ status: 'active' }, TODAY)).toEqual([]);
  });
});
