/**
 * The single place that decides how the app sends someone to the login page.
 *
 * Every redirect to /login routes through here so that one question - "did
 * something just end this session, or is this a visitor who wants in?" - has one
 * answer. Under SSO_AUTO_REDIRECT (issue #721) the login page stops being a page
 * and becomes a bounce to the identity provider, at which point that distinction
 * is the difference between logging out and a redirect loop: the IdP still holds
 * its own session, so it re-authenticates silently and returns the user to the
 * app they just left.
 *
 * The answer travels in the URL rather than in sessionStorage or router state.
 * The URL survives a full page load (two of the HTTP clients hard-navigate),
 * survives private browsing and disabled storage, and is visible in the address
 * bar when a user reports a problem.
 *
 * Importable from non-React modules - the HTTP clients are plain singletons with
 * no access to react-router's navigate.
 */
import logger from '../services/logger';
import {
  LOGIN_PATH,
  currentInternalPath,
  safeInternalPath,
} from './safeInternalPath';

/**
 * Why the user is being sent to the login page.
 *
 * Every reason means "a session just ended or an attempt just failed", and every
 * reason therefore suppresses the auto-redirect to the IdP. The absence of a
 * reason is the meaningful case: that is a visitor who asked for a protected page
 * and should be sent to the IdP, which is the feature working as intended.
 */
export type LoginRedirectReason =
  | 'logged_out'
  | 'session_expired'
  | 'sso_error'
  | 'account_changed'
  | 'registered'
  // We could not establish whether a session exists -- the startup probe failed
  // to reach the server at all. Distinct from 'session_expired', which means the
  // server answered and said no. Suppresses the redirect for the same reason
  // every other reason does: bouncing to the identity provider on a network
  // blip hides the failure behind a round trip.
  | 'auth_unavailable';

export interface LoginRedirectOptions {
  reason?: LoginRedirectReason | null;
  /** Where to return after a successful login. Validated; invalid values are dropped. */
  next?: string | null;
}

export interface HandleUnauthorizedOptions {
  /**
   * Unattended request - a timer, not a person. Its 401 is logged and swallowed
   * rather than ejecting whoever is mid-form. Declare it at the request site:
   * one function often serves both a mount and an interval, so it cannot be
   * inferred here.
   */
  background?: boolean;
}

/**
 * Build the login URL. Pure - performs no navigation.
 *
 * This is the half ProtectedRoute uses: it renders <Navigate>, so it needs a
 * path rather than a side effect.
 *
 * `local=1` means "do not auto-redirect to the IdP on this page load". It is the
 * same parameter documented as the operator escape hatch, deliberately: one
 * parameter, one meaning, whether an operator typed it or the app attached it.
 *
 * IMPORTANT: `local=1` suppresses only the redirect. It does NOT re-enable
 * password login when SSO_ONLY_MODE is set - that guard is server-side and is not
 * reachable from a query string. Collapsing the two behaviors into one flag would
 * turn this into an authentication bypass in a URL.
 */
export function buildLoginPath({
  reason = null,
  next = null,
}: LoginRedirectOptions = {}): string {
  const params = new URLSearchParams();

  if (reason) {
    // Every reason means the session ended or an attempt failed, so every reason
    // suppresses. There is deliberately no reason that means "session ended, but
    // bounce to the IdP anyway"; if one is ever wanted it should be an explicit
    // option rather than a silent default.
    params.set('local', '1');
    params.set('reason', reason);
  }

  const safeNext = safeInternalPath(next);
  if (safeNext) {
    params.set('next', safeNext);
  }

  const query = params.toString();
  return query ? `${LOGIN_PATH}?${query}` : LOGIN_PATH;
}

/**
 * Read back what buildLoginPath wrote: should the login page stay put rather
 * than bouncing to the identity provider?
 *
 * The decoder lives next to the encoder deliberately. This is one contract with
 * two halves, and the rule that "every reason suppresses" is stated once, here,
 * where the code that attaches a reason can be seen alongside the code that acts
 * on it. Spelling the same condition out at the reading end means a future
 * non-suppressing reason has to be discovered in two files instead of one.
 *
 * Accepts a bare `reason` with no `local=1` as well: the two are always written
 * together today, but a hand-edited or older link may carry only one, and the
 * safe reading of an ambiguous URL is "do not bounce" -- a skipped redirect
 * costs a click, an unwanted one is the logout loop.
 */
export function shouldSuppressAutoRedirect(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get('local') === '1' || Boolean(params.get('reason'));
}

/**
 * Guards against redirect storms. Once a hard navigation is committed the page is
 * being torn down, so this is never reset in production - see
 * resetLoginRedirectGuard for the test hook.
 */
let redirectInFlight = false;

/**
 * Send the user to the login page via a full page load.
 *
 * For callers that have no router: the HTTP clients, and anything that must
 * survive a full reload. Components with router access should prefer
 * `navigate(buildLoginPath(...))`, which keeps the soft navigation.
 *
 * Idempotent within a page lifetime. A dashboard firing six parallel requests
 * against an expired session must produce one navigation, not six; and a
 * background poll that 401s while the user is already sitting on the login page
 * must produce none, or it reloads that page in a loop.
 */
export function redirectToLogin(options: LoginRedirectOptions = {}): void {
  if (typeof window === 'undefined' || redirectInFlight) {
    return;
  }

  if (window.location.pathname === LOGIN_PATH) {
    return;
  }

  // Validated here only to produce `hasNext` for the log below; buildLoginPath
  // validates its own input and does not trust this one.
  const safeNext = safeInternalPath(options.next);
  const target = buildLoginPath({ reason: options.reason, next: safeNext });
  redirectInFlight = true;

  // Never log the `next` value itself. It is a path inside a medical records app
  // and routinely names a record id (/patients/42, /lab-results/117).
  logger.info('login_redirect', {
    category: 'auth_redirect',
    reason: options.reason || 'unauthenticated',
    hasNext: Boolean(safeNext),
  });

  window.location.assign(target);
}

/**
 * The single answer to "the server said 401 - now what?"
 *
 * Every HTTP client that carries app traffic calls this, so an expired session
 * behaves the same way whichever one happened to make the request. Before this
 * existed the app had four independent request paths and four different answers:
 * one redirected except on /admin/ URLs, one redirected only for three hardcoded
 * endpoints, and two did nothing at all - and the two that did nothing carried
 * most of the traffic.
 *
 * `simpleAuthService` is the deliberate exception and must stay one: its 401s
 * ARE the auth state rather than a symptom of it. A rejected login, a missing
 * session on the boot-time /users/me probe, or an SSO config fetch must be
 * interpreted by AuthContext, not turned into a redirect underneath it.
 *
 * Returns true when the user was ejected, so a caller can skip its own error
 * handling for a request whose page is already being torn down.
 *
 * `url` is for the log line only and decides nothing. Whether a 401 ejects is
 * `options.background`, which the request site declares.
 */
export function handleUnauthorized(
  url: unknown,
  { background = false }: HandleUnauthorizedOptions = {}
): boolean {
  if (background) {
    // Deliberately swallowed. The user stays where they are and is ejected by
    // their next real interaction instead of by a timer firing under them.
    logger.warn('api_auth_error_background', {
      category: 'auth_redirect',
      message: 'Session rejected a background request; not ejecting the user',
      url: typeof url === 'string' ? url : null,
    });
    return false;
  }

  redirectToLogin({
    reason: 'session_expired',
    next: currentInternalPath(),
  });
  return true;
}

/**
 * @internal Test-only. Clears the redirect-storm guard between cases.
 *
 * Production never needs this: the guard is set immediately before a navigation
 * that discards the JavaScript context. Tests share one module instance across
 * cases and would otherwise see the first redirect suppress every later one.
 */
export function resetLoginRedirectGuard(): void {
  redirectInFlight = false;
}
