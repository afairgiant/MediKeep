import { useEffect, useState } from 'react';
import notificationApi from '../services/api/notificationApi';

type PreferenceMatrix = {
  preferences?: Record<string, Record<string, boolean>>;
};

/**
 * Whether the current user has a notification channel on for ``eventType``.
 *
 * Checks while ``active`` and again when ``recheckKey`` changes. Stays true when
 * the check fails, so a transient error never shows a false warning.
 */
export const useReminderChannelStatus = (
  eventType: string,
  active: boolean,
  recheckKey?: unknown
) => {
  const [hasChannel, setHasChannel] = useState(true);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    notificationApi
      .getPreferenceMatrix()
      .then(matrix => {
        if (cancelled) return;
        const { preferences } = (matrix ?? {}) as PreferenceMatrix;
        setHasChannel(
          Object.values(preferences?.[eventType] || {}).some(Boolean)
        );
      })
      .catch(() => {
        if (!cancelled) setHasChannel(true);
      });
    return () => {
      cancelled = true;
    };
  }, [eventType, active, recheckKey]);

  return [hasChannel, setHasChannel] as const;
};

export default useReminderChannelStatus;
