/**
 * Whether this instance will accept a new self-service account right now.
 *
 * Asks `/auth/registration-status`, which reports the *effective* answer: it
 * folds SSO_ONLY_MODE in, so one condition covers both "the instance is
 * SSO-only" and "registration is simply switched off". Reading
 * `/auth/sso/config.sso_only` instead would answer only the first and leave the
 * second hole open -- and that payload's `registration_enabled` means something
 * different again (whether SSO may provision accounts).
 *
 * Opt-in per route. `/login` and the SSO callback render through the same
 * PublicRoute and must not pay for a request they have no use for.
 */
import { useEffect, useState } from 'react';
import { authService } from '../services/auth/simpleAuthService';

export interface RegistrationAvailability {
  loading: boolean;
  /** False only when the server said so. A failed lookup leaves this true. */
  available: boolean;
}

/**
 * Shared across mounts so moving between /login and /user-creation does not
 * refetch. Not a cache with a TTL: the answer is env-driven and an admin toggle
 * takes effect on the next full load, which is when this resets anyway.
 */
let cached: Promise<boolean> | null = null;

function load(): Promise<boolean> {
  if (!cached) {
    cached = authService
      .checkRegistrationEnabled()
      .then(status =>
        // `error: true` means we could not ask. Fail open: the server refuses
        // the POST regardless (403), so guessing wrong costs a rejected form,
        // while bouncing on a network blip strands someone who legitimately
        // can register and gives them nowhere to go.
        status.error === true ? true : status.registration_enabled !== false
      )
      .catch(() => true);
  }
  return cached;
}

/** @internal Test-only. The module-level cache otherwise leaks between cases. */
export function resetRegistrationAvailability(): void {
  cached = null;
}

export function useRegistrationAvailable(
  enabled: boolean
): RegistrationAvailability {
  const [state, setState] = useState<RegistrationAvailability>({
    loading: enabled,
    available: true,
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let active = true;
    load().then(available => {
      if (active) {
        setState({ loading: false, available });
      }
    });
    return () => {
      active = false;
    };
  }, [enabled]);

  return state;
}
