export type NumberSettingKey =
  | 'trash_retention_days'
  | 'backup_retention_days'
  | 'backup_min_count'
  | 'backup_max_count'
  | 'activity_log_retention_days'
  | 'notification_history_retention_days';

export type BoolSettingKey =
  | 'allow_user_registration'
  | 'backup_auto_cleanup_enabled'
  | 'release_check_enabled'
  | 'whats_new_popup_enabled';

export type SettingKey = BoolSettingKey | NumberSettingKey;

export type SettingValue = boolean | number;

export type SettingSource = 'saved' | 'env' | 'default';

export interface SettingState {
  value: SettingValue;
  source: SettingSource;
  fallback: SettingValue;
  fallback_source: 'env' | 'default';
  min: number | null;
  max: number | null;
  zero_means_forever: boolean;
}

export type SettingsMap = Record<SettingKey, SettingState>;

// Number fields hold '' while the input is empty.
export type DraftMap = Record<SettingKey, SettingValue | ''>;

export interface DeploymentValue {
  name: string;
  value: boolean | string;
}

export interface SettingWarning {
  code: string;
  message: string;
}

export interface AdminSettingsResponse {
  settings: SettingsMap;
  deployment: DeploymentValue[];
}

export interface AdminSettingsUpdateResponse {
  settings: SettingsMap;
  updated: SettingKey[];
  warnings: SettingWarning[];
}

export type SchedulePreset =
  | 'disabled'
  | 'interval'
  | 'daily'
  | 'weekly'
  | 'monthly';

export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

// Number fields hold '' while the input is empty.
export interface ScheduleDraft {
  preset: SchedulePreset;
  time_of_day: string;
  interval_hours: number | '';
  days_of_week: DayOfWeek[];
  day_of_month: number | '';
}

export interface ScheduleConfig extends ScheduleDraft {
  interval_hours: number;
  day_of_month: number;
  enabled: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_error: string | null;
  next_run_at: string | null;
  upcoming_runs: string[];
  timezone: string;
}

export interface SchedulePreview {
  upcoming_runs: string[];
  timezone: string;
  latest_backup_size_bytes: number | null;
  retained_count: number | null;
  estimated_bytes: number | null;
}

export interface SsoConfig {
  enabled: boolean;
  provider_type?: string;
  registration_enabled?: boolean;
  sso_only?: boolean;
  auto_redirect?: boolean;
}

export type FieldError = { code: 'range' } | { code: 'minAboveMax' };

export type ScheduleError =
  | { code: 'range'; min: number; max: number }
  | { code: 'noDays' };
