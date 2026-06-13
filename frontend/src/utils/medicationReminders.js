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
 * Builds a save-time warning for a medication whose enabled reminders cannot
 * fire. Returns null when reminders are disabled or nothing blocks them,
 * otherwise { title, message } with all blocker reasons joined, resolved
 * through the provided t(). Keys are explicitly "medical:"-prefixed so this
 * works regardless of the caller's default namespace.
 */
export function getWontFireWarning(medication, t, today = todayLocalIso()) {
  if (!medication?.reminder_enabled) return null;

  const descriptors = getReminderBlockerDescriptors(medication, today);
  if (descriptors.length === 0) return null;

  return {
    title: t(
      'medical:medications.reminders.notFiring.title',
      "Reminders won't fire"
    ),
    message: descriptors
      .map(d =>
        t(`medical:${d.key}`, { ...d.params, defaultValue: d.defaultValue })
      )
      .join(' '),
  };
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
          defaultValue:
            'This medication is marked as no longer taken as of {{date}}.',
        };
      case REMINDER_BLOCKERS.NOT_STARTED:
        return {
          blocker,
          key: 'medications.reminders.notFiring.notStarted',
          params: { date: toIsoDateString(medication?.effective_period_start) },
          defaultValue:
            "This medication isn't scheduled to start until {{date}}.",
        };
      default:
        return {
          blocker,
          key: 'medications.reminders.notFiring.statusNotActive',
          params: { status: medication?.status || '' },
          defaultValue:
            'The medication status is "{{status}}" — reminders only fire for active medications.',
        };
    }
  });
}
