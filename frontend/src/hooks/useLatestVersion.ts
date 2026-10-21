import { useEffect, useState } from 'react';

import { getReleaseNotes } from '../services/systemService';
import logger from '../services/logger';

// One request per page load, shared by every caller.
let pending: Promise<string | null> | null = null;

function fetchLatestVersion(): Promise<string | null> {
  if (!pending) {
    pending = getReleaseNotes(1)
      .then(
        data =>
          (data as { latest_version?: string | null }).latest_version ?? null
      )
      .catch(error => {
        pending = null;
        logger.warn('latest_version_check_failed', {
          component: 'useLatestVersion',
          error: (error as Error)?.message,
        });
        return null;
      });
  }
  return pending;
}

/** Test helper: forget the shared result so the next call fetches again. */
export function clearLatestVersionCache(): void {
  pending = null;
}

/**
 * Tag of a newer stable release, or null when up to date, unchecked or disabled by the admin.
 * Pass enabled=false to skip the request (for example before sign-in).
 */
export function useLatestVersion(enabled = true): string | null {
  const [latest, setLatest] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    fetchLatestVersion().then(tag => {
      if (!cancelled) setLatest(tag);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return enabled ? latest : null;
}
