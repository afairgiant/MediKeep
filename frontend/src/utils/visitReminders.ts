/**
 * Visit reminder offsets: minutes before the visit start.
 * Limits mirror app/core/utils/visit_reminders.py.
 */

export const MINUTES_PER_DAY = 1440;
export const MAX_REMINDER_OFFSETS = 10;
export const MAX_REMINDER_OFFSET_MINUTES = 30 * MINUTES_PER_DAY;
export const DEFAULT_REMINDER_OFFSETS = [MINUTES_PER_DAY];
/** When whole-day reminders go out, facility local. */
export const DAY_REMINDER_TIME = '09:00';

export const REMINDER_PRESETS = [
  7 * MINUTES_PER_DAY,
  2 * MINUTES_PER_DAY,
  MINUTES_PER_DAY,
  0,
  120,
  60,
  30,
];

export type OffsetUnit = 'minutes' | 'hours' | 'days';

export const UNIT_MINUTES: Record<OffsetUnit, number> = {
  minutes: 1,
  hours: 60,
  days: MINUTES_PER_DAY,
};

export const isDayOffset = (minutes: number): boolean =>
  minutes % MINUTES_PER_DAY === 0;

/** Largest unit that divides the offset evenly, for display. */
export const splitOffset = (
  minutes: number
): { amount: number; unit: OffsetUnit } => {
  if (minutes !== 0 && isDayOffset(minutes)) {
    return { amount: minutes / MINUTES_PER_DAY, unit: 'days' };
  }
  if (minutes !== 0 && minutes % 60 === 0) {
    return { amount: minutes / 60, unit: 'hours' };
  }
  return { amount: minutes, unit: 'minutes' };
};

export interface OffsetLabel {
  key: string;
  options: { count?: number; defaultValue: string };
}

/** Translation key and options for "Day of visit", "2 days before", "1 hour before"... */
export const describeReminderOffset = (minutes: number): OffsetLabel => {
  if (minutes === 0) {
    return {
      key: 'medical:visits.reminders.offsets.dayOf',
      options: { defaultValue: 'Day of visit' },
    };
  }
  const { amount, unit } = splitOffset(minutes);
  const unitWord = amount === 1 ? unit.slice(0, -1) : unit;
  return {
    key: `medical:visits.reminders.offsets.${unit}Before`,
    options: { count: amount, defaultValue: `${amount} ${unitWord} before` },
  };
};

type Translate = (_key: string, _options: OffsetLabel['options']) => string;

/** Translated label for an offset. */
export const formatReminderOffset = (
  minutes: number,
  translate: Translate
): string => {
  const { key, options } = describeReminderOffset(minutes);
  return translate(key, options);
};

export type OffsetProblem = 'duplicate' | 'tooFar' | 'tooMany' | 'needsTime';

/** Why ``offset`` can't be added to ``current``, or null when it can. */
export const getOffsetProblem = (
  offset: number,
  current: number[],
  hasTime: boolean
): OffsetProblem | null => {
  if (current.includes(offset)) return 'duplicate';
  if (offset > MAX_REMINDER_OFFSET_MINUTES) return 'tooFar';
  if (current.length >= MAX_REMINDER_OFFSETS) return 'tooMany';
  if (!hasTime && !isDayOffset(offset)) return 'needsTime';
  return null;
};

/** Offsets that can fire for a visit with or without a start time, sorted. */
export const usableOffsets = (offsets: number[], hasTime: boolean): number[] =>
  offsets.filter(o => hasTime || isDayOffset(o)).sort((a, b) => a - b);
