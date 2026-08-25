/**
 * Stops an auto-redirect that keeps coming back.
 *
 * Suppression -- "something ended this session, do not bounce to the identity
 * provider" -- travels in the URL and is not this module's business. This
 * answers a different question: "have we already bounced this browser three
 * times in the last minute?" There is no URL to read for that one, because the
 * loop's defining feature is that the URL comes back clean. The provider
 * returns the user to /login with nothing attached, the page load resets every
 * in-memory guard, and the effect fires again.
 *
 * Non-load-bearing by construction. Every access is wrapped and a storage
 * failure returns "allowed", so losing this degrades to the behavior we would
 * have without it -- never to a page that refuses to redirect. That is what
 * keeps it compatible with the rule that suppression must survive
 * sessionStorage being unavailable: suppression does not live here.
 */

const KEY = 'sso_auto_redirect_attempts';

/** Bounces allowed inside the window before we stop and explain. */
const MAX_ATTEMPTS = 3;

/**
 * Deliberately short. This is measuring a loop -- a bounce, a provider round
 * trip and a return -- which takes seconds. A window of minutes would refuse a
 * legitimate second sign-in attempt by someone who mistyped a password at the
 * provider and came back.
 */
const WINDOW_MS = 60_000;

interface AttemptRecord {
  /** When the current window opened. */
  first: number;
  count: number;
}

/** Anything else under our key is someone else's data or a corrupted write. */
function readRecord(): AttemptRecord | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) {
    return null;
  }

  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as AttemptRecord).first !== 'number' ||
    typeof (parsed as AttemptRecord).count !== 'number'
  ) {
    return null;
  }
  return parsed as AttemptRecord;
}

/**
 * Record a bounce and report whether it may proceed.
 *
 * Returns false once the window's allowance is spent, at which point the caller
 * should stop and render an explanation rather than redirect again.
 */
export function consumeAutoRedirectAttempt(now: number = Date.now()): boolean {
  try {
    const record = readRecord();
    // A record from before the window, or one written by a clock that has since
    // moved backwards, starts a fresh window rather than banking its count.
    const withinWindow =
      record !== null && now >= record.first && now - record.first < WINDOW_MS;
    const count = withinWindow ? record.count : 0;

    if (count >= MAX_ATTEMPTS) {
      return false;
    }

    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        first: withinWindow ? record.first : now,
        count: count + 1,
      })
    );
    return true;
  } catch {
    // Storage unavailable (private browsing, storage disabled), full, or
    // holding something unparseable. Allow the redirect -- see the note above.
    return true;
  }
}

/**
 * Forget the bounces. Called on any successful authentication, so a loop that
 * happens later starts from a clean count rather than inheriting a spent one.
 */
export function clearAutoRedirectAttempts(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Storage unavailable.
  }
}
