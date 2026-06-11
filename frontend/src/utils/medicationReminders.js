/**
 * Determines why a medication's reminders will not fire.
 *
 * Mirrors the scheduler's discovery filters in
 * app/services/medication_reminder_scheduler.py (_discover_candidates):
 * status must be "active" and today must fall inside the effective period,
 * inclusive on both ends; missing dates are unbounded. Keep the two in sync.
 *
 * Dates are YYYY-MM-DD strings compared lexicographically against the
 * browser-local date. The scheduler uses the facility timezone (TZ env var),
 * so around midnight the two can disagree by one day — acceptable for a
 * non-blocking warning.
 */

export const REMINDER_BLOCKERS = {
  PERIOD_ENDED: 'period_ended',
  NOT_STARTED: 'not_started',
  STATUS_NOT_ACTIVE: 'status_not_active',
};

function toIsoDateString(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${month}-${day}`;
  }
  return null;
}

function todayLocalIso() {
  return toIsoDateString(new Date());
}

/**
 * @param {{status?: string, effective_period_start?: string|Date|null,
 *          effective_period_end?: string|Date|null}} medication
 * @param {string} [today] - YYYY-MM-DD, injectable for tests
 * @returns {string[]} REMINDER_BLOCKERS values; empty means reminders fire
 */
export function getReminderBlockers(medication, today = todayLocalIso()) {
  const blockers = [];

  const end = toIsoDateString(medication?.effective_period_end);
  if (end && today > end) {
    blockers.push(REMINDER_BLOCKERS.PERIOD_ENDED);
  }

  const start = toIsoDateString(medication?.effective_period_start);
  if (start && today < start) {
    blockers.push(REMINDER_BLOCKERS.NOT_STARTED);
  }

  if (medication?.status !== 'active') {
    blockers.push(REMINDER_BLOCKERS.STATUS_NOT_ACTIVE);
  }

  return blockers;
}

/**
 * Maps each blocker to its i18n key (medical namespace, unprefixed),
 * interpolation params, and English defaultValue. Callers render with
 * t(key, { ...params, defaultValue }) — prefix "medical:" when the
 * component's default namespace isn't medical.
 */
export function getReminderBlockerDescriptors(
  medication,
  today = todayLocalIso()
) {
  return getReminderBlockers(medication, today).map(blocker => {
    switch (blocker) {
      case REMINDER_BLOCKERS.PERIOD_ENDED:
        return {
          blocker,
          key: 'medications.reminders.notFiring.periodEnded',
          params: { date: toIsoDateString(medication?.effective_period_end) },
          defaultValue: 'The effective period ended on {{date}}.',
        };
      case REMINDER_BLOCKERS.NOT_STARTED:
        return {
          blocker,
          key: 'medications.reminders.notFiring.notStarted',
          params: { date: toIsoDateString(medication?.effective_period_start) },
          defaultValue: "The effective period doesn't start until {{date}}.",
        };
      default:
        return {
          blocker,
          key: 'medications.reminders.notFiring.statusNotActive',
          params: { status: medication?.status || '' },
          defaultValue: 'The medication status is "{{status}}", not active.',
        };
    }
  });
}
