import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { notifyError } from '../../utils/notifyTranslated';
import { authService } from '../../services/auth/simpleAuthService';
import frontendLogger from '../../services/frontendLogger';
import { safeInternalPath } from '../../utils/safeInternalPath';
import { storeSSOReturnUrl } from '../../utils/ssoReturnUrl';
import { IconUser, IconLock, IconEye, IconEyeOff } from '@tabler/icons-react';
import styles from '../../styles/pages/Login.module.css';

/**
 * Copy for each `reason` the redirect helper can attach.
 *
 * An unknown reason renders nothing rather than a fallback message - the value
 * comes from the URL and anyone can put anything there, so it must not be able to
 * put arbitrary text on the login page.
 */
const REDIRECT_REASON_KEYS = {
  logged_out: 'login.redirectReason.loggedOut',
  session_expired: 'login.redirectReason.sessionExpired',
  sso_error: 'login.redirectReason.ssoError',
  account_changed: 'login.redirectReason.accountChanged',
  registered: 'login.redirectReason.registered',
};

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState('');
  const [ssoConfig, setSSOConfig] = useState({ enabled: false });
  const [ssoLoading, setSSOLoading] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [configError, setConfigError] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login, error, clearError, isAuthenticated } = useAuth();
  const { t } = useTranslation(['auth', 'common', 'shared']);

  // Where to go after signing in, and why the user is here at all.
  //
  // The URL wins over router state. Several callers reach this page through a
  // full page load, which discards state entirely; `?next=` survives that, and
  // survives private browsing and disabled storage too. `from` stays as the
  // fallback for soft navigations, but a stale `from` must not beat a fresh
  // `next`. Both are untrusted - `next` is attacker-supplied in a link - so both
  // go through safeInternalPath. See SSO_ONLY_MODE_SPEC.md 8.11.
  //
  // The reason is rendered below so a session that expired mid-use is
  // distinguishable from a random failure - the toast the HTTP clients used to
  // raise was discarded by the page load that followed it.
  //
  // Memoized because this page re-renders on every keystroke, and each pass
  // would otherwise re-parse the query string and re-validate both candidates.
  const { returnPath, redirectReason } = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return {
      returnPath:
        safeInternalPath(params.get('next')) ||
        safeInternalPath(location.state?.from?.pathname) ||
        '/dashboard',
      redirectReason: params.get('reason'),
    };
  }, [location.search, location.state]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(returnPath, { replace: true });
    }
  }, [isAuthenticated, navigate, returnPath]);

  // One-shot environment snapshot. If a later auth fetch fails, pairing this
  // log with the failure tells us whether a stale service worker, insecure
  // context, mixed protocol, or cookies-disabled state was already in play.
  useEffect(() => {
    frontendLogger.logInfo('Login page environment snapshot', {
      category: 'login_env_snapshot',
      hasServiceWorker:
        typeof navigator !== 'undefined' &&
        !!navigator.serviceWorker?.controller,
      swScriptUrl:
        typeof navigator !== 'undefined'
          ? navigator.serviceWorker?.controller?.scriptURL
          : null,
      isSecureContext:
        typeof window !== 'undefined' ? window.isSecureContext : null,
      origin: typeof window !== 'undefined' ? window.location.origin : null,
      protocol: typeof window !== 'undefined' ? window.location.protocol : null,
      cookieEnabled:
        typeof navigator !== 'undefined' ? navigator.cookieEnabled : null,
    });
  }, []);

  // Retry generation counter: a new generation supersedes any pending
  // backoff timer or in-flight fetch from a previous attempt (e.g. when
  // `window.online` fires mid-backoff, or the user clicks Retry).
  const attemptRef = useRef(0);
  const abortRef = useRef(null);

  // Check registration status and SSO config, with silent exponential-backoff
  // retry so a transient network blip or cookie-clear race during auto-logout
  // recovers invisibly. Only shows the Retry button once all attempts exhaust.
  const loadConfig = useCallback(async () => {
    attemptRef.current += 1;
    const thisAttempt = attemptRef.current;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    // Reset UI to the pre-load state. configLoaded stays false through the
    // auto-retry window so neither SSO nor the error notice render yet.
    setConfigLoaded(false);
    setConfigError(false);

    // First attempt is immediate; three retries at 0.5s, 1.5s, 3s (~5s total).
    const delays = [0, 500, 1500, 3000];
    for (const delay of delays) {
      if (thisAttempt !== attemptRef.current || ac.signal.aborted) return;
      if (delay > 0) {
        try {
          await new Promise((resolve, reject) => {
            const handleAbort = () => {
              clearTimeout(timer);
              const err = new Error('aborted');
              err.name = 'AbortError';
              reject(err);
            };
            const timer = setTimeout(() => {
              ac.signal.removeEventListener('abort', handleAbort);
              resolve();
            }, delay);
            ac.signal.addEventListener('abort', handleAbort, { once: true });
          });
        } catch {
          return; // backoff was aborted -- superseded or unmounted
        }
      }
      if (thisAttempt !== attemptRef.current || ac.signal.aborted) return;

      try {
        const [status, config] = await Promise.all([
          authService.checkRegistrationEnabled({ signal: ac.signal }),
          authService.getSSOConfig({ signal: ac.signal }),
        ]);
        if (thisAttempt !== attemptRef.current || ac.signal.aborted) return;

        // error:true means the fetch itself failed -- do not confuse that
        // with "backend returned SSO/registration disabled", which is valid.
        const failed = status.error === true || config.error === true;
        if (!failed) {
          setRegistrationEnabled(status.registration_enabled);
          setRegistrationMessage(status.message || '');
          setSSOConfig(config);
          setConfigError(false);
          setConfigLoaded(true);
          return;
        }
        // Soft failure -- fall through to next backoff delay.
      } catch (err) {
        if (err.name === 'AbortError') return;
        // Any other unexpected error: treat as soft failure and keep retrying.
      }
    }

    if (thisAttempt !== attemptRef.current || ac.signal.aborted) return;
    setConfigError(true);
    setConfigLoaded(true);
  }, []);

  // Initial load + unmount cleanup. Kept separate from the online-listener
  // effect so adding configLoaded/configError as deps there can't accidentally
  // re-trigger loadConfig (which would loop, since loadConfig writes both).
  useEffect(() => {
    loadConfig();
    return () => {
      abortRef.current?.abort();
    };
  }, [loadConfig]);

  // If the OS reports connectivity is back, short-circuit any in-progress
  // backoff and re-fetch immediately. Skip when config has already loaded
  // successfully -- otherwise a stray WiFi flap on a working page would
  // briefly hide the SSO/registration UI and fire two redundant requests.
  useEffect(() => {
    const onOnline = () => {
      if (!configLoaded || configError) loadConfig();
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [loadConfig, configLoaded, configError]);

  const handleChange = e => {
    clearError(); // Clear any existing errors
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await login(formData);
      if (result.success) {
        // Add a small delay to ensure auth state is fully saved before navigation
        await new Promise(resolve => setTimeout(resolve, 500));

        if (result.mustChangePassword) {
          navigate('/change-password', { replace: true });
        } else {
          navigate(returnPath, { replace: true });
        }
      } else {
        notifyError('notifications:toasts.auth.loginFailed');
      }
    } catch (error) {
      frontendLogger.logError('Login failed', {
        error: error && error.message ? error.message : String(error),
        component: 'Login',
      });
      notifyError('notifications:toasts.auth.loginFailed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUserNavigation = () => {
    navigate('/user-creation');
  };

  const handleSSOLogin = async () => {
    setSSOLoading(true);
    try {
      // The same resolved return path the password flow uses, so a deep link
      // survives whichever way the user signs in. It goes to the backend, which
      // stores it against the OAuth state parameter and hands it back on the
      // callback; the sessionStorage copy is the fallback for flows that predate
      // that.
      storeSSOReturnUrl(returnPath);

      const result = await authService.initiateSSOLogin(returnPath);
      // Redirect to SSO provider
      window.location.href = result.auth_url;
    } catch (error) {
      frontendLogger.logError('SSO login initiation failed', {
        error: error.message,
        component: 'Login',
      });
      notifyError('notifications:toasts.auth.ssoFailed');
    } finally {
      setSSOLoading(false);
    }
  };
  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginForm}>
        <div className={styles.loginHeader}>
          <h1>
            <img
              src="/medikeep-icon.svg"
              alt=""
              width={40}
              height={40}
              style={{ verticalAlign: 'middle', marginRight: '8px' }}
            />
            {/* eslint-disable-next-line i18next/no-literal-string -- brand name */}
            {'MediKeep'}
          </h1>
        </div>

        <div className={styles.loginDivider}>
          <span>{t('login.title')}</span>
        </div>

        {redirectReason && REDIRECT_REASON_KEYS[redirectReason] && (
          <div className={styles.redirectNotice} role="status">
            {t(REDIRECT_REASON_KEYS[redirectReason])}
          </div>
        )}

        {error && <div className={styles.errorMessage}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="username">{t('shared:labels.username')}</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIconPrefix}>
                <IconUser size={18} />
              </span>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder={t('login.usernamePlaceholder')}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">{t('shared:labels.password')}</label>
            <div className={styles.inputWrapper}>
              <span className={styles.inputIconPrefix}>
                <IconLock size={18} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={t('login.passwordPlaceholder')}
                required
                disabled={isLoading}
              />
              <span
                className={styles.inputIconSuffix}
                onClick={() => setShowPassword(prev => !prev)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowPassword(prev => !prev);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={
                  showPassword
                    ? t('login.hidePassword')
                    : t('login.showPassword')
                }
              >
                {showPassword ? (
                  <IconEyeOff size={18} />
                ) : (
                  <IconEye size={18} />
                )}
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={styles.submitBtn}
          >
            {isLoading ? t('login.submitting') : t('login.submit')}
          </button>
        </form>

        {/* Config-fetch failed -- show retry instead of silently hiding SSO */}
        {configLoaded && configError && (
          <div
            className={styles.configWarning}
            data-testid="config-error"
            role="status"
          >
            <span>{t('login.configLoadFailed')}</span>
            <button
              type="button"
              className={styles.retryBtn}
              onClick={loadConfig}
            >
              {t('login.retry')}
            </button>
          </div>
        )}

        {/* SSO Login Option -- only when config loaded successfully AND backend says SSO is on */}
        {configLoaded && !configError && ssoConfig.enabled && (
          <div className={styles.ssoSection} data-testid="sso-section">
            <div className={styles.divider}>
              <span>{t('login.or')}</span>
            </div>
            <button
              type="button"
              className={styles.ssoBtn}
              onClick={handleSSOLogin}
              disabled={isLoading || ssoLoading}
            >
              {ssoLoading
                ? t('common:labels.loading')
                : t('login.continueWith', {
                    provider:
                      ssoConfig.provider_type === 'google'
                        ? 'Google'
                        : ssoConfig.provider_type === 'github'
                          ? 'GitHub'
                          : 'SSO',
                  })}
            </button>
          </div>
        )}

        {configLoaded && !configError && (
          <div className={styles.loginActions}>
            {registrationEnabled ? (
              <button
                type="button"
                className={styles.createUserBtn}
                onClick={handleCreateUserNavigation}
                disabled={isLoading}
              >
                {t('login.createAccount')}
              </button>
            ) : (
              <div className={styles.registrationDisabledMessage}>
                {registrationMessage || t('login.registrationDisabled')}
              </div>
            )}
          </div>
        )}

        {/* When config fails, we don't actually know whether registration is on --
            show a neutral notice instead of a misleading "disabled" message */}
        {configLoaded && configError && (
          <div className={styles.loginActions}>
            <div className={styles.registrationDisabledMessage}>
              {t('login.registrationStatusUnavailable')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
