import { useCallback, useEffect, useState } from 'react';
import {
  getTwoFactorStatus,
  type TwoFactorStatus,
} from '../services/api/securityApi';
import logger from '../services/logger';

interface UseTwoFactorStatus {
  status: TwoFactorStatus | null;
  loading: boolean;
  error: boolean;
  reload: () => Promise<void>;
}

/** The signed-in user's two-factor status, loaded on mount. */
export function useTwoFactorStatus(): UseTwoFactorStatus {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(false);
    try {
      setStatus(await getTwoFactorStatus(signal));
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      logger.error('two_factor_status_load_failed', {
        component: 'useTwoFactorStatus',
        error: (e as Error)?.message,
      });
      // A stale status would offer controls for a state that may have changed
      setStatus(null);
      setError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const reload = useCallback(() => load(), [load]);

  return { status, loading, error, reload };
}
