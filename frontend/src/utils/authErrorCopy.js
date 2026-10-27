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
