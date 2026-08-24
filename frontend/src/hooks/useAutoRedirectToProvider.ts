/**
 * SSO_AUTO_REDIRECT: send an unauthenticated visitor straight to the identity
 * provider, with no button to click.
 *
 * The policy lives here rather than in the login page because almost none of it
 * is rendering: it is guard ordering, one-shot accounting, a 429 branch, and a
 * hard navigation. The page needs only the resulting status to decide which
 * notice to show.
 *
 * `/login` is still the right place to *run* it. Every unauthenticated path in
 * the app converges there through buildLoginPath, so a bounce placed in a route
 * guard would both miss direct visits and need repeating per guard.
 */
import { useEffect, useRef, useState } from 'react';
import { authService } from '../services/auth/simpleAuthService';
import frontendLogger from '../services/frontendLogger';
import { storeSSOReturnUrl } from '../utils/ssoReturnUrl';
import { consumeAutoRedirectAttempt } from '../utils/autoRedirectGuard';

export type AutoRedirectStatus =
  | 'idle'
  | 'redirecting'
  | 'rate_limited'
  | 'failed';

export interface AutoRedirectState {
  status: AutoRedirectStatus;
  /**
   * Only meaningful while `rate_limited`, and optional even then -- a reverse
   * proxy can strip Retry-After. Carried in the same object as the status so the
   * two cannot be set out of step.
   */
  retryAfterSeconds: number | null;
}

export interface AutoRedirectOptions {
  /** True once the SSO config has been fetched *successfully*. */
  configReady: boolean;
  ssoEnabled: boolean;
  autoRedirectEnabled: boolean;
  isAuthenticated: boolean;
  /** Something ended this session, or an operator asked for the local page. */
  suppressed: boolean;
  /** Where to return after signing in; travels with the provider round trip. */
  returnPath: string;
}

const IDLE: AutoRedirectState = { status: 'idle', retryAfterSeconds: null };

export function useAutoRedirectToProvider({
  configReady,
  ssoEnabled,
  autoRedirectEnabled,
  isAuthenticated,
  suppressed,
  returnPath,
}: AutoRedirectOptions): AutoRedirectState {
  const [state, setState] = useState<AutoRedirectState>(IDLE);

  // One attempt per page load. A ref rather than the state above, because state
  // updates are async and this effect's dependencies change -- a state check can
  // be read stale and fire a second redirect. StrictMode is not enabled in this
  // app, so the dev double-invoke is not a live hazard; this also means turning
  // it on later cannot introduce one.
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;

    // Every guard is load-bearing:
    //  - configReady: never bounce on a guess. A failed config fetch has to
    //    reach the retry UI instead of the identity provider.
    //  - isAuthenticated: the login page is already navigating a signed-in user
    //    away; racing it would send them out to the provider and back.
    //  - suppressed: something ended this session. Bouncing here is the logout
    //    loop -- the provider still holds its session and re-authenticates
    //    silently, so the user can never leave.
    if (!configReady) return;
    if (!ssoEnabled || !autoRedirectEnabled) return;
    if (isAuthenticated) return;
    if (suppressed) return;

    firedRef.current = true;

    // A browser that keeps coming back gets an explanation instead of another
    // round trip.
    if (!consumeAutoRedirectAttempt()) {
      frontendLogger.logWarning(
        'Auto-redirect stopped after repeated attempts',
        { component: 'useAutoRedirectToProvider' }
      );
      setState({ status: 'failed', retryAfterSeconds: null });
      return;
    }

    setState({ status: 'redirecting', retryAfterSeconds: null });

    (async () => {
      try {
        // The same deep link the manual button carries, so the destination
        // survives whichever way the user ends up signing in.
        storeSSOReturnUrl(returnPath);
        const result = await authService.initiateSSOLogin(returnPath);
        window.location.assign(result.auth_url);
      } catch (err: any) {
        // Stop either way. Retrying into a rate limit is how a throttled
        // instance becomes a blank page with no way in.
        setState(
          err?.status === 429
            ? {
                status: 'rate_limited',
                retryAfterSeconds: err.retryAfterSeconds ?? null,
              }
            : { status: 'failed', retryAfterSeconds: null }
        );
        // Never err.message -- it is server-rendered text.
        frontendLogger.logError('Auto-redirect to identity provider failed', {
          status: err?.status ?? null,
          errorCode: err?.errorCode ?? null,
          component: 'useAutoRedirectToProvider',
        });
      }
    })();
  }, [
    configReady,
    ssoEnabled,
    autoRedirectEnabled,
    isAuthenticated,
    suppressed,
    returnPath,
  ]);

  return state;
}
