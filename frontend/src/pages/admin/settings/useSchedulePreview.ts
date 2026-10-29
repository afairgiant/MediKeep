import { useEffect, useState } from 'react';
import { adminApiService } from '../../../services/api/adminApi';
import logger from '../../../services/logger';
import { useDebounce } from '../../../hooks/useDebounce';
import type { SchedulePreview } from './types';

const PREVIEW_DELAY_MS = 500;
const RETRY_DELAY_MS = 30_000;
// Floor so a client clock ahead of the server cannot cause a refetch loop.
const MIN_REFRESH_MS = 60_000;
const MAX_REFRESH_MS = 24 * 60 * 60 * 1000;

/** Server preview of a draft schedule, fetched PREVIEW_DELAY_MS after the last change.
 *
 * Pass null to clear it. A response for an older request is dropped. It fetches again
 * when saved changes identity, after the first listed run passes, and after a failure.
 */
export const useSchedulePreview = (
  request: Record<string, unknown> | null,
  saved: unknown
) => {
  const key = request ? JSON.stringify(request) : null;
  const debouncedKey = useDebounce(key, PREVIEW_DELAY_MS) as string | null;
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    preview: SchedulePreview | null;
  } | null>(null);

  useEffect(() => {
    if (!debouncedKey) return undefined;
    let current = true;
    (
      adminApiService.previewAutoBackupSchedule(
        JSON.parse(debouncedKey)
      ) as Promise<SchedulePreview>
    )
      .then(preview => {
        if (current) setResult({ key: debouncedKey, preview });
      })
      .catch(error => {
        if (!current) return;
        logger.error('admin_settings_schedule_preview_failed', {
          component: 'AdminSettingsPage',
          error: (error as Error)?.message,
        });
        setResult({ key: debouncedKey, preview: null });
      });
    return () => {
      current = false;
    };
  }, [debouncedKey, saved, refresh]);

  useEffect(() => {
    if (!result) return undefined;
    const firstRun = result.preview?.upcoming_runs[0];
    if (result.preview && !firstRun) return undefined;
    const delay = firstRun
      ? Math.min(
          Math.max(Date.parse(firstRun) - Date.now(), MIN_REFRESH_MS),
          MAX_REFRESH_MS
        )
      : RETRY_DELAY_MS;
    const timer = setTimeout(() => setRefresh(n => n + 1), delay);
    return () => clearTimeout(timer);
  }, [result]);

  const settled = !!key && result?.key === key;
  return {
    preview: settled ? result.preview : null,
    loading: !!key && !settled,
    failed: settled && result.preview === null,
  };
};
