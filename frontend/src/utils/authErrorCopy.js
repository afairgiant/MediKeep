/**
 * Pick our copy for a server-supplied auth error code.
 *
 * Falls back to the server's own text for a code this build has no key for, so a
 * backend that gains a failure mode before the client does still says something
 * useful instead of rendering a raw key.
 *
 * @param {(...args: any[]) => string} t - from useTranslation('auth')
 * @param {string|null|undefined} code - `error_code`/`message_code` off the response
 * @param {string} fallback - the server's message, or local copy when there is none
 */
export function authErrorCopy(t, code, fallback) {
  return code ? t(`errors.${code}`, fallback) : fallback;
}

/**
 * authErrorCopy for an error thrown by apiService, which carries `errorCode`.
 *
 * @param {(...args: any[]) => string} t - from useTranslation('auth')
 * @param {unknown} error - the caught error
 * @param {string} fallback - shown when the error has neither a code nor a message
 */
export function authErrorText(t, error, fallback) {
  const { errorCode, message } =
    /** @type {{ errorCode?: string, message?: string }} */ (error || {});
  return authErrorCopy(t, errorCode, message || fallback);
}

/**
 * The warning for a refusal that leaves one try, else null.
 *
 * @param {(...args: any[]) => string} t - from useTranslation('auth')
 * @param {unknown} data - the refusal's `data`: `attempts_remaining` and `after_last`
 * @returns {string|null}
 */
export function lastAttemptWarning(t, data) {
  const { attempts_remaining: left, after_last: afterLast } =
    /** @type {{ attempts_remaining?: number, after_last?: string }} */ (
      data || {}
    );
  if (left !== 1) return null;
  return afterLast === 'sign_in_again'
    ? t('lastAttempt.signInAgain')
    : t('lastAttempt.wait');
}
