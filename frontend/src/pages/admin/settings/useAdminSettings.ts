import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApiService } from '../../../services/api/adminApi';
import { authService } from '../../../services/auth/simpleAuthService';
import { getUserFriendlyError } from '../../../constants/errorMessages';
import logger from '../../../services/logger';
import type {
  AdminSettingsResponse,
  AdminSettingsUpdateResponse,
  DeploymentValue,
  DraftMap,
  FieldError,
  ScheduleConfig,
  ScheduleDraft,
  SettingKey,
  SettingsMap,
  SettingValue,
  SettingWarning,
  SsoConfig,
} from './types';
import { isTimedPreset } from './useScheduleLabels';

// 'schedule' means settings were saved first; 'scheduleOnly' means nothing else was sent.
export type SaveError = {
  scope: 'settings' | 'schedule' | 'scheduleOnly';
  message: string;
};

/** Logs a failed request and returns the message to show the admin. */
const describeFailure = (event: string, action: string, error: unknown) => {
  logger.error(event, {
    component: 'AdminSettingsPage',
    error: (error as Error)?.message,
  });
  return getUserFriendlyError(error as Error, action);
};

const toDraft = (settings: SettingsMap): DraftMap =>
  Object.fromEntries(
    Object.entries(settings).map(([key, state]) => [key, state.value])
  ) as DraftMap;

const toScheduleDraft = (schedule: ScheduleConfig): ScheduleDraft => ({
  preset: schedule.preset,
  time_of_day: schedule.time_of_day,
  day_of_week: schedule.day_of_week,
});

export const isScheduleChanged = (
  saved: ScheduleDraft,
  draft: ScheduleDraft
): boolean => {
  if (saved.preset !== draft.preset) return true;
  if (isTimedPreset(draft.preset) && saved.time_of_day !== draft.time_of_day)
    return true;
  return draft.preset === 'weekly' && saved.day_of_week !== draft.day_of_week;
};

const validate = (
  settings: SettingsMap,
  draft: DraftMap
): Partial<Record<SettingKey, FieldError>> => {
  const errors: Partial<Record<SettingKey, FieldError>> = {};
  (Object.keys(settings) as SettingKey[]).forEach(key => {
    const { min, max } = settings[key];
    const value = draft[key];
    if (typeof settings[key].value !== 'number') return;
    if (
      typeof value !== 'number' ||
      (min !== null && value < min) ||
      (max !== null && value > max)
    ) {
      errors[key] = { code: 'range' };
    }
  });
  const minCount = draft.backup_min_count;
  const maxCount = draft.backup_max_count;
  if (
    !errors.backup_min_count &&
    !errors.backup_max_count &&
    typeof minCount === 'number' &&
    typeof maxCount === 'number' &&
    minCount > maxCount
  ) {
    errors.backup_min_count = { code: 'minAboveMax' };
  }
  return errors;
};

/** State and save logic for the admin settings page. */
export const useAdminSettings = () => {
  const [settings, setSettings] = useState<SettingsMap | null>(null);
  const [draft, setDraft] = useState<DraftMap | null>(null);
  const [resets, setResets] = useState<Set<SettingKey>>(new Set());
  const [deployment, setDeployment] = useState<DeploymentValue[]>([]);
  const [schedule, setSchedule] = useState<ScheduleConfig | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft | null>(
    null
  );
  const [sso, setSso] = useState<SsoConfig>({ enabled: false });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  const [warnings, setWarnings] = useState<SettingWarning[]>([]);

  const applySettings = useCallback((next: SettingsMap) => {
    setSettings(next);
    setDraft(toDraft(next));
    setResets(new Set());
  }, []);

  const applySchedule = useCallback((next: ScheduleConfig) => {
    setSchedule(next);
    setScheduleDraft(toScheduleDraft(next));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [settingsResult, scheduleResult, ssoResult] =
        await Promise.allSettled([
          adminApiService.getAdminSettings() as Promise<AdminSettingsResponse>,
          adminApiService.getAutoBackupSchedule() as Promise<ScheduleConfig>,
          authService.getSSOConfig() as Promise<SsoConfig>,
        ]);
      if (settingsResult.status === 'rejected') throw settingsResult.reason;
      applySettings(settingsResult.value.settings);
      setDeployment(settingsResult.value.deployment);
      // The schedule and SSO status are optional extras; the page still works without them.
      if (scheduleResult.status === 'fulfilled') {
        applySchedule(scheduleResult.value);
      } else {
        describeFailure(
          'admin_settings_schedule_load_failed',
          'load schedule',
          scheduleResult.reason
        );
      }
      if (ssoResult.status === 'fulfilled') setSso(ssoResult.value);
    } catch (error) {
      setLoadError(
        describeFailure('admin_settings_load_failed', 'load settings', error)
      );
    } finally {
      setLoading(false);
    }
  }, [applySettings, applySchedule]);

  useEffect(() => {
    load();
  }, [load]);

  const dirtyKeys = useMemo<SettingKey[]>(() => {
    if (!settings || !draft) return [];
    return (Object.keys(settings) as SettingKey[]).filter(
      key => resets.has(key) || draft[key] !== settings[key].value
    );
  }, [settings, draft, resets]);

  const scheduleDirty =
    !!schedule && !!scheduleDraft && isScheduleChanged(schedule, scheduleDraft);

  const errors = useMemo(
    () => (settings && draft ? validate(settings, draft) : {}),
    [settings, draft]
  );

  const setValue = useCallback((key: SettingKey, value: SettingValue | '') => {
    setDraft(prev => (prev ? { ...prev, [key]: value } : prev));
    setResets(prev => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const reset = useCallback(
    (key: SettingKey) => {
      if (!settings) return;
      setDraft(prev =>
        prev ? { ...prev, [key]: settings[key].fallback } : prev
      );
      setResets(prev => new Set(prev).add(key));
    },
    [settings]
  );

  const updateSchedule = useCallback((patch: Partial<ScheduleDraft>) => {
    setScheduleDraft(prev => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const discard = useCallback(() => {
    if (settings) setDraft(toDraft(settings));
    setResets(new Set());
    if (schedule) setScheduleDraft(toScheduleDraft(schedule));
    setSaveError(null);
  }, [settings, schedule]);

  /** Saves settings first, then the schedule; resolves true when both succeeded. */
  const save = useCallback(async (): Promise<boolean> => {
    if (!draft || Object.keys(errors).length > 0) return false;
    setSaving(true);
    setSaveError(null);
    try {
      if (dirtyKeys.length > 0) {
        const changes = Object.fromEntries(
          dirtyKeys.map(key => [key, resets.has(key) ? null : draft[key]])
        );
        try {
          const response = (await adminApiService.updateAdminSettings(
            changes
          )) as AdminSettingsUpdateResponse;
          applySettings(response.settings);
          // Only a successful save replaces warnings, so an unread lockout notice survives a failure.
          setWarnings(response.warnings ?? []);
        } catch (error) {
          setSaveError({
            scope: 'settings',
            message: describeFailure(
              'admin_settings_save_failed',
              'save settings',
              error
            ),
          });
          return false;
        }
      }
      if (scheduleDirty && scheduleDraft && schedule) {
        const payload: Partial<ScheduleDraft> = {
          preset: scheduleDraft.preset,
          time_of_day: scheduleDraft.time_of_day,
        };
        if (scheduleDraft.preset === 'weekly') {
          payload.day_of_week = scheduleDraft.day_of_week;
        }
        try {
          const response = (await adminApiService.updateAutoBackupSchedule(
            payload
          )) as { schedule?: Partial<ScheduleConfig> };
          applySchedule({
            ...schedule,
            ...scheduleDraft,
            ...response.schedule,
          });
        } catch (error) {
          setSaveError({
            scope: dirtyKeys.length > 0 ? 'schedule' : 'scheduleOnly',
            message: describeFailure(
              'admin_settings_schedule_save_failed',
              'save schedule',
              error
            ),
          });
          return false;
        }
      }
      return true;
    } finally {
      setSaving(false);
    }
  }, [
    draft,
    errors,
    dirtyKeys,
    resets,
    scheduleDirty,
    scheduleDraft,
    schedule,
    applySettings,
    applySchedule,
  ]);

  const dismissWarning = useCallback((code: string) => {
    setWarnings(prev => prev.filter(w => w.code !== code));
  }, []);

  return {
    settings,
    draft,
    resets,
    deployment,
    schedule,
    scheduleDraft,
    sso,
    loading,
    loadError,
    saving,
    saveError,
    warnings,
    dirtyKeys,
    scheduleDirty,
    errors,
    unsavedCount: dirtyKeys.length + (scheduleDirty ? 1 : 0),
    load,
    setValue,
    reset,
    updateSchedule,
    discard,
    save,
    dismissWarning,
    setSaveError,
  };
};

export type AdminSettingsState = ReturnType<typeof useAdminSettings>;

export interface SectionProps {
  state: AdminSettingsState;
}
