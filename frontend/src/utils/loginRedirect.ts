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
 * bar when a user reports a problem. See SSO_ONLY_MODE_SPEC.md section 6.
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
  | 'registered';

export interface LoginRedirectOptions {
  reason?: LoginRedirectReason | null;
  /** Where to return after a successful login. Validated; invalid values are dropped. */
  next?: string | null;
}

/**
 * Requests whose 401 must not eject an active user.
 *
 * These paths are polled on a timer while the user is doing something else, so a
 * transient auth blip on one of them would throw someone out of a form they are
 * in the middle of filling. A user-initiated request that 401s still ejects
 * normally, so nobody is stranded on a dead page - they are ejected by their next
 * click instead of by a background timer.
 *
 * **This matches on the URL, so it exempts every call to these paths, not only
 * the polled ones.** Two of the five are also fetched on mount
 * (`Dashboard.jsx` calls `getRecentActivity` from both its interval and its
 * patient-change effect), so those loads are exempt too. That is tolerable
 * because some other request on the same screen will eject the user, but it is
 * not what "unattended" means, and the right fix is for callers to declare
 * `{ background: true }` at the call site where the knowledge actually lives.
 * Tracked in TECHNICAL_DEBT.md.
 *
 * These are matched against the URL the client actually builds, which includes
 * each service's basePath -- `adminApiService` is `/admin` + `/dashboard/...`,
 * so the admin entries below are NOT `/admin/system-health`. Getting that wrong
 * is silent: the exemption simply never fires. Keep them in step with
 * `services/api/adminApi.js`.
 *
 * Derived from an audit of every setInterval-driven request in the app, not from
 * either client's previous hardcoded list - those were a "critical endpoints"
 * allowlist in apiClient and an "/admin/" carve-out in baseApi, and neither
 * covered any of the real pollers.
 */
const NON_EJECTING_ENDPOINTS: readonly string[] = [
  '/patients/recent-activity', // Dashboard.jsx - every 30s
  '/invitations/pending', // InvitationNotifications.jsx - every 2 min
  '/paperless/sync-status', // DocumentManagerCore.jsx - every 5 min
  '/admin/dashboard/system-health', // SystemHealth.jsx - every 30s
  '/admin/dashboard/system-metrics', // SystemHealth.jsx - every 30s
];

/**
 * True when a 401 from this URL should be logged and swallowed rather than
 * ejecting the user. Accepts absolute or relative URLs.
 */
export function isNonEjectingEndpoint(url: unknown): boolean {
  if (typeof url !== 'string' || !url) {
    return false;
  }
  return NON_EJECTING_ENDPOINTS.some(endpoint => url.includes(endpoint));
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
 * most of the traffic. See SSO_ONLY_MODE_SPEC.md 8.10.
 *
 * `simpleAuthService` is the deliberate exception and must stay one: its 401s
 * ARE the auth state rather than a symptom of it. A rejected login, a missing
 * session on the boot-time /users/me probe, or an SSO config fetch must be
 * interpreted by AuthContext, not turned into a redirect underneath it.
 *
 * Returns true when the user was ejected, so a caller can skip its own error
 * handling for a request whose page is already being torn down.
 */
export function handleUnauthorized(url: unknown): boolean {
  if (isNonEjectingEndpoint(url)) {
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
