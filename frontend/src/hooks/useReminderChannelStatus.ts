import { useEffect, useRef, useState } from 'react';
import notificationApi from '../services/api/notificationApi';

type PreferenceMatrix = {
  preferences?: Record<string, Record<string, boolean>>;
};

/**
 * Whether the current user has a notification channel on for ``eventType``.
 *
 * Checks while ``active``, again when ``recheckKey`` changes, and, while no
 * channel is on, whenever the window regains focus. A failed check reports true,
 * so a transient error never shows a false warning; a failed focus recheck
 * leaves the current value unchanged.
 */
export const useReminderChannelStatus = (
  eventType: string,
  active: boolean,
  recheckKey?: unknown
) => {
  const [hasChannel, setHasChannel] = useState(true);
  const [focusCount, setFocusCount] = useState(0);
  const checkedFocusCount = useRef(0);

  // The settings link opens in another tab; returning here should clear a fixed warning
  useEffect(() => {
    if (!active || hasChannel) return undefined;
    const onFocus = () => setFocusCount(count => count + 1);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [active, hasChannel]);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    const fromFocus = focusCount !== checkedFocusCount.current;
    checkedFocusCount.current = focusCount;
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
        // A failed focus retry keeps the shown warning and its listener, so the next focus retries
        if (!cancelled && !fromFocus) setHasChannel(true);
      });
    return () => {
      cancelled = true;
    };
  }, [eventType, active, recheckKey, focusCount]);

  return [hasChannel, setHasChannel] as const;
};

export default useReminderChannelStatus;
