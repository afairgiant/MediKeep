/**
 * The sessionStorage half of SSO deep-link preservation.
 *
 * The durable copy of the return path is the one the backend keys to the OAuth
 * `state` parameter and hands back on the callback. This is the fallback for
 * flows that started before that existed, kept deliberately rather than removed.
 *
 * Every access is guarded: sessionStorage does not merely return null when
 * unavailable, it throws on access in some private-browsing modes - which is
 * precisely the case the server-side copy exists to cover, so failing here must
 * be a non-event.
 */

const SSO_RETURN_URL_KEY = 'sso_return_url';

/** Best-effort write. A failure is fine; the server-side copy is authoritative. */
export function storeSSOReturnUrl(path: string): void {
  try {
    sessionStorage.setItem(SSO_RETURN_URL_KEY, path);
  } catch {
    // Storage unavailable.
  }
}

/**
 * Read and clear in one step.
 *
 * Clearing is unconditional so a stale value cannot outlive the login that
 * superseded it, even on the branches that end up discarding what it returns.
 */
export function takeSSOReturnUrl(): string | null {
  try {
    const stored = sessionStorage.getItem(SSO_RETURN_URL_KEY);
    if (stored) {
      sessionStorage.removeItem(SSO_RETURN_URL_KEY);
    }
    return stored;
  } catch {
    return null;
  }
}
