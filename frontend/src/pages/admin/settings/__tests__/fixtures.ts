import type {
  AdminSettingsResponse,
  ScheduleConfig,
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
  ...overrides,
});

export const makeSettings = (
  overrides: Partial<Record<keyof SettingsMap, Partial<SettingState>>> = {}
): SettingsMap => ({
  allow_user_registration: state({
    value: true,
    fallback: true,
    min: null,
    max: null,
    ...overrides.allow_user_registration,
  }),
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
  day_of_week: 'sun',
  enabled: true,
  last_run_at: null,
  last_run_status: null,
  last_run_error: null,
  next_run_at: null,
  ...overrides,
});
