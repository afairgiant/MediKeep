/**
 * Narrowing untrusted values to same-origin, root-relative paths.
 *
 * Lives on its own rather than inside the login-redirect module because most of
 * its callers are not redirecting to login: the SSO callback validates a
 * successful return path with it, and the login page uses it to resolve where to
 * send someone after they sign in. It is the check standing between a
 * server-echoed `return_url` and an off-site bounce at the highest-trust moment
 * in the app, so it should be findable under a name that says what it does.
 */

export const LOGIN_PATH = '/login';

/** Longest path we will carry. Well past any real route. */
const MAX_PATH_LENGTH = 2048;

/**
 * Narrow an untrusted value to a same-origin, root-relative path.
 *
 * Returns null for anything else, and callers fall back to a known-safe route.
 *
 * This is load-bearing rather than hygiene. Carrying a return path in the URL -
 * which is necessary because several callers reach the login page through a full
 * page load, and router state does not survive that - makes it forgeable by a
 * link for the first time. Without this check,
 * `/login?next=https://evil.example` would bounce the user off-site immediately
 * after a successful authentication. The same value arrives from the SSO
 * callback's `return_url`, which the backend stores and echoes verbatim.
 *
 * Protocol-relative forms are the ones a naive `startsWith('/')` check misses:
 * `//evil.example` and `/\evil.example` are both absolute URLs to another host.
 */
export function safeInternalPath(candidate: unknown): string | null {
  if (typeof candidate !== 'string') {
    return null;
  }

  const value = candidate.trim();

  if (!value || value.length > MAX_PATH_LENGTH) {
    return null;
  }

  // Control characters, including the tab/newline browsers strip from URLs -
  // "/\thttps://evil.example" would otherwise be reinterpreted after stripping.
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return null;
    }
  }

  // Backslashes are treated as slashes by some parsers, so "/\evil.example"
  // resolves off-origin. Reject them anywhere rather than only at the front.
  if (value.includes('\\')) {
    return null;
  }

  let parsed: URL;
  try {
    // A fixed dummy origin, not window.location - this must give the same answer
    // in tests, in a worker, and during SSR. Resolving against it is also what
    // catches absolute and protocol-relative inputs: both change the origin.
    parsed = new URL(value, 'http://internal.invalid');
  } catch {
    return null;
  }

  if (parsed.origin !== 'http://internal.invalid') {
    return null;
  }

  // Relative inputs like "../admin" resolve on-origin, so the origin check alone
  // does not establish that the caller gave us a root-relative path.
  if (!value.startsWith('/')) {
    return null;
  }

  // Returning to the login page is not a return path; it is a loop.
  if (parsed.pathname === LOGIN_PATH) {
    return null;
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/**
 * The current location as a return path, or null if it is not worth carrying.
 * Used by the HTTP clients, which have no router context to ask.
 */
export function currentInternalPath(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return safeInternalPath(
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  );
}
