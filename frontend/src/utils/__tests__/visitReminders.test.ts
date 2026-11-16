import { describe, expect, it } from 'vitest';

import {
  MAX_REMINDER_OFFSETS,
  MAX_REMINDER_OFFSET_MINUTES,
  describeReminderOffset,
  getOffsetProblem,
  splitOffset,
  usableOffsets,
} from '../visitReminders';

describe('visitReminders', () => {
  describe('splitOffset', () => {
    it.each([
      [2880, { amount: 2, unit: 'days' }],
      [120, { amount: 2, unit: 'hours' }],
      [90, { amount: 90, unit: 'minutes' }],
      [0, { amount: 0, unit: 'minutes' }],
    ])('splits %i minutes into its largest whole unit', (minutes, expected) => {
      expect(splitOffset(minutes)).toEqual(expected);
    });
  });

  describe('describeReminderOffset', () => {
    it('names the day of the visit', () => {
      expect(describeReminderOffset(0).key).toBe(
        'medical:visits.reminders.offsets.dayOf'
      );
    });

    it('pluralises by unit', () => {
      expect(describeReminderOffset(7 * 1440)).toEqual({
        key: 'medical:visits.reminders.offsets.daysBefore',
        options: { count: 7, defaultValue: '7 days before' },
      });
      expect(describeReminderOffset(30).key).toBe(
        'medical:visits.reminders.offsets.minutesBefore'
      );
    });
  });

  describe('getOffsetProblem', () => {
    it('accepts a new offset', () => {
      expect(getOffsetProblem(60, [1440], true)).toBeNull();
    });

    it('rejects a duplicate', () => {
      expect(getOffsetProblem(1440, [1440], true)).toBe('duplicate');
    });

    it('rejects an offset past the limit', () => {
      expect(
        getOffsetProblem(MAX_REMINDER_OFFSET_MINUTES + 1440, [], true)
      ).toBe('tooFar');
    });

    it('rejects more than the maximum', () => {
      const full = Array.from({ length: MAX_REMINDER_OFFSETS }, (_, i) => i);
      expect(getOffsetProblem(500, full, true)).toBe('tooMany');
    });

    it('needs a start time for hour offsets', () => {
      expect(getOffsetProblem(120, [], false)).toBe('needsTime');
      expect(getOffsetProblem(2880, [], false)).toBeNull();
    });
  });

  describe('usableOffsets', () => {
    it('drops hour offsets from an all-day visit and sorts', () => {
      expect(usableOffsets([1440, 60, 0], false)).toEqual([0, 1440]);
    });

    it('keeps every offset when the visit has a time', () => {
      expect(usableOffsets([1440, 60], true)).toEqual([60, 1440]);
    });
  });
});
