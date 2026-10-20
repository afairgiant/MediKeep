export type NumberSettingKey =
  | 'trash_retention_days'
  | 'backup_retention_days'
  | 'backup_min_count'
  | 'backup_max_count';

export type SettingKey = 'allow_user_registration' | NumberSettingKey;

export type SettingValue = boolean | number;

export type SettingSource = 'saved' | 'env' | 'default';

export interface SettingState {
  value: SettingValue;
  source: SettingSource;
  fallback: SettingValue;
  fallback_source: 'env' | 'default';
  min: number | null;
  max: number | null;
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
  | 'every_6_hours'
  | 'every_12_hours'
  | 'daily'
  | 'weekly';

export interface ScheduleDraft {
  preset: SchedulePreset;
  time_of_day: string;
  day_of_week: string | null;
}

export interface ScheduleConfig extends ScheduleDraft {
  enabled: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_error: string | null;
  next_run_at: string | null;
}

export interface SsoConfig {
  enabled: boolean;
  provider_type?: string;
  registration_enabled?: boolean;
  sso_only?: boolean;
  auto_redirect?: boolean;
}

export type FieldError = { code: 'range' } | { code: 'minAboveMax' };
