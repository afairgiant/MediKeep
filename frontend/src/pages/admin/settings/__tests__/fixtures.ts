import type {
  AdminSettingsResponse,
  ScheduleConfig,
  SchedulePreview,
  SettingState,
  SettingsMap,
} from '../types';

const state = (overrides: Partial<SettingState>): SettingState => ({
  value: 1,
  source: 'default',
  fallback: 1,
  fallback_source: 'default',
  min: 1,
  max: 365,
  zero_means_forever: false,
  ...overrides,
});

const boolState = (overrides: Partial<SettingState> = {}): SettingState =>
  state({ value: true, fallback: true, min: null, max: null, ...overrides });

export const makeSettings = (
  overrides: Partial<Record<keyof SettingsMap, Partial<SettingState>>> = {}
): SettingsMap => ({
  allow_user_registration: boolState(overrides.allow_user_registration),
  trash_retention_days: state({
    value: 30,
    fallback: 30,
    ...overrides.trash_retention_days,
  }),
  backup_retention_days: state({
    value: 7,
    fallback: 7,
    ...overrides.backup_retention_days,
  }),
  backup_min_count: state({
    value: 5,
    fallback: 5,
    max: 100,
    ...overrides.backup_min_count,
  }),
  backup_max_count: state({
    value: 50,
    fallback: 50,
    max: 500,
    ...overrides.backup_max_count,
  }),
  backup_auto_cleanup_enabled: boolState({
    value: false,
    fallback: false,
    ...overrides.backup_auto_cleanup_enabled,
  }),
  release_check_enabled: boolState(overrides.release_check_enabled),
  whats_new_popup_enabled: boolState(overrides.whats_new_popup_enabled),
  activity_log_retention_days: state({
    value: 0,
    fallback: 0,
    max: 3650,
    zero_means_forever: true,
    ...overrides.activity_log_retention_days,
  }),
  notification_history_retention_days: state({
    value: 0,
    fallback: 0,
    min: 2,
    max: 3650,
    zero_means_forever: true,
    ...overrides.notification_history_retention_days,
  }),
});

export const makeResponse = (
  overrides: Parameters<typeof makeSettings>[0] = {}
): AdminSettingsResponse => ({
  settings: makeSettings(overrides),
  deployment: [
    { name: 'SSO_ONLY_MODE', value: false },
    { name: 'SSO_AUTO_REDIRECT', value: false },
    { name: 'ALLOW_PRIVATE_INTEGRATION_URLS', value: true },
    { name: 'LOG_LEVEL', value: 'INFO' },
  ],
});

export const makeSchedule = (
  overrides: Partial<ScheduleConfig> = {}
): ScheduleConfig => ({
  preset: 'daily',
  time_of_day: '02:00',
  interval_hours: 12,
  days_of_week: ['sun'],
  day_of_month: 1,
  enabled: true,
  last_run_at: null,
  last_run_status: null,
  last_run_error: null,
  next_run_at: null,
  upcoming_runs: [],
  timezone: 'America/New_York',
  ...overrides,
});

export const makePreview = (
  overrides: Partial<SchedulePreview> = {}
): SchedulePreview => ({
  upcoming_runs: [
    '2026-11-02T02:00:00-05:00',
    '2026-11-03T02:00:00-05:00',
    '2026-11-04T02:00:00-05:00',
  ],
  timezone: 'America/New_York',
  latest_backup_size_bytes: 1024 * 1024,
  retained_count: 7,
  estimated_bytes: 7 * 1024 * 1024,
  ...overrides,
});
