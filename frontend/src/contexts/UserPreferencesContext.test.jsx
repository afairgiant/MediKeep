import { vi, describe, test, expect, beforeEach } from 'vitest';
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  UserPreferencesProvider,
  useUserPreferences,
} from './UserPreferencesContext';
import * as userPrefsApi from '../services/api/userPreferencesApi';
import frontendLogger from '../services/frontendLogger';
import i18n from '../i18n';

vi.mock('../services/api/userPreferencesApi', () => ({
  getUserPreferences: vi.fn(),
  updateUserPreferences: vi.fn(),
}));

vi.mock('../services/frontendLogger', () => ({
  default: { logInfo: vi.fn(), logError: vi.fn() },
}));

vi.mock('../i18n', () => ({
  default: {
    language: 'en',
    changeLanguage: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mutable so a test can simulate one user signing out and another signing in
const authState = {
  isAuthenticated: true,
  user: { id: 1, username: 'testuser' },
  isLoading: false,
};

vi.mock('./AuthContext', () => ({
  useAuth: () => authState,
}));

const setAuthUser = id => {
  authState.user = { id, username: `testuser${id}` };
};

// The browser's language, which detection reads instead of i18next's current one
const setBrowserLanguage = lang => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue([lang]);
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(lang);
};

// Minimal preferences response covering all fields read by the context
const makePrefs = (overrides = {}) => ({
  unit_system: 'imperial',
  session_timeout_minutes: 30,
  language: 'en',
  date_format: 'mdy',
  paperless_enabled: false,
  paperless_url: null,
  paperless_auto_sync: false,
  paperless_sync_tags: true,
  default_storage_backend: 'local',
  ...overrides,
});

// Renders the provider and returns a consumer that exposes the loaded language.
// 'unset' distinguishes a loaded-but-null language from a still-loading provider.
const Consumer = () => {
  const { preferences, loading } = useUserPreferences();
  if (loading) return <div data-testid="lang">loading</div>;
  return <div data-testid="lang">{preferences?.language ?? 'unset'}</div>;
};

const renderProvider = () =>
  render(
    <UserPreferencesProvider>
      <Consumer />
    </UserPreferencesProvider>
  );

describe('UserPreferencesContext — language sync on load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset i18n.language to 'en' before each test
    i18n.language = 'en';
  });

  test('calls i18n.changeLanguage with backend language when it differs from current', async () => {
    vi.mocked(userPrefsApi.getUserPreferences).mockResolvedValue(
      makePrefs({ language: 'fr' })
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('lang').textContent).toBe('fr');
    });
    expect(i18n.changeLanguage).toHaveBeenCalledWith('fr');
  });

  test('does not call i18n.changeLanguage when backend language matches current', async () => {
    vi.mocked(userPrefsApi.getUserPreferences).mockResolvedValue(
      makePrefs({ language: 'en' })
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('lang').textContent).toBe('en');
    });
    expect(i18n.changeLanguage).not.toHaveBeenCalled();
  });

  test('logs error and still sets preferences when i18n.changeLanguage throws', async () => {
    vi.mocked(userPrefsApi.getUserPreferences).mockResolvedValue(
      makePrefs({ language: 'de' })
    );
    vi.mocked(i18n.changeLanguage).mockRejectedValueOnce(
      new Error('translation load failed')
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('lang').textContent).toBe('de');
    });
    expect(frontendLogger.logError).toHaveBeenCalledWith(
      'Failed to apply saved language preference',
      expect.objectContaining({
        language: 'de',
        error: 'translation load failed',
        component: 'UserPreferencesContext',
      })
    );
  });

  test('does not call i18n.changeLanguage when backend language is unsupported', async () => {
    vi.mocked(userPrefsApi.getUserPreferences).mockResolvedValue(
      makePrefs({ language: 'xx' })
    );

    renderProvider();

    await waitFor(() => {
      expect(userPrefsApi.getUserPreferences).toHaveBeenCalled();
    });
    expect(i18n.changeLanguage).not.toHaveBeenCalled();
    expect(userPrefsApi.updateUserPreferences).not.toHaveBeenCalled();
  });

  test('applies an explicit English choice over a non-English browser language', async () => {
    i18n.language = 'de';
    vi.mocked(userPrefsApi.getUserPreferences).mockResolvedValue(
      makePrefs({ language: 'en' })
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('lang').textContent).toBe('en');
    });
    expect(i18n.changeLanguage).toHaveBeenCalledWith('en');
    expect(userPrefsApi.updateUserPreferences).not.toHaveBeenCalled();
  });
});

describe('UserPreferencesContext — auto-detect when no language is stored', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    i18n.language = 'en';
    setAuthUser(1);
    setBrowserLanguage('en');
  });

  test('saves the detected language and keeps it in the UI', async () => {
    setBrowserLanguage('de');
    vi.mocked(userPrefsApi.getUserPreferences).mockResolvedValue(
      makePrefs({ language: null })
    );
    vi.mocked(userPrefsApi.updateUserPreferences).mockResolvedValue(
      makePrefs({ language: 'de' })
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('lang').textContent).toBe('de');
    });
    expect(userPrefsApi.updateUserPreferences).toHaveBeenCalledWith({
      language: 'de',
    });
    expect(i18n.changeLanguage).toHaveBeenCalledWith('de');
  });

  test('normalizes a regional browser locale before saving', async () => {
    setBrowserLanguage('de-AT');
    vi.mocked(userPrefsApi.getUserPreferences).mockResolvedValue(
      makePrefs({ language: null })
    );
    vi.mocked(userPrefsApi.updateUserPreferences).mockResolvedValue(
      makePrefs({ language: 'de' })
    );

    renderProvider();

    await waitFor(() => {
      expect(userPrefsApi.updateUserPreferences).toHaveBeenCalledWith({
        language: 'de',
      });
    });
  });

  test('does not save when the detected language is English', async () => {
    vi.mocked(userPrefsApi.getUserPreferences).mockResolvedValue(
      makePrefs({ language: null })
    );

    renderProvider();

    await waitFor(() => {
      expect(userPrefsApi.getUserPreferences).toHaveBeenCalled();
    });
    expect(userPrefsApi.updateUserPreferences).not.toHaveBeenCalled();
    expect(i18n.changeLanguage).not.toHaveBeenCalled();
  });

  test('does not save an unsupported browser language and logs it', async () => {
    setBrowserLanguage('xx');
    vi.mocked(userPrefsApi.getUserPreferences).mockResolvedValue(
      makePrefs({ language: null })
    );

    renderProvider();

    await waitFor(() => {
      expect(frontendLogger.logInfo).toHaveBeenCalledWith(
        'Browser language not supported, keeping default',
        expect.objectContaining({
          browserLanguage: 'xx',
          component: 'UserPreferencesContext',
        })
      );
    });
    expect(userPrefsApi.updateUserPreferences).not.toHaveBeenCalled();
  });

  test('still loads preferences when saving the detected language fails', async () => {
    setBrowserLanguage('fr');
    vi.mocked(userPrefsApi.getUserPreferences).mockResolvedValue(
      makePrefs({ language: null })
    );
    vi.mocked(userPrefsApi.updateUserPreferences).mockRejectedValueOnce(
      new Error('network down')
    );

    renderProvider();

    await waitFor(() => {
      expect(frontendLogger.logError).toHaveBeenCalledWith(
        'Failed to save auto-detected language',
        expect.objectContaining({
          language: 'fr',
          error: 'network down',
          component: 'UserPreferencesContext',
        })
      );
    });
    expect(screen.getByTestId('lang').textContent).toBe('unset');
  });
});

describe('UserPreferencesContext — auto-detect vs. manual write ordering', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    i18n.language = 'en';
    setAuthUser(1);
    setBrowserLanguage('en');
  });

  // A manual choice made while the auto-detect write is still in flight must be
  // the last write the server sees, whatever order the responses would resolve in.
  test('queues a manual language change behind the in-flight auto-detect write', async () => {
    setBrowserLanguage('de');
    vi.mocked(userPrefsApi.getUserPreferences).mockResolvedValue(
      makePrefs({ language: null })
    );

    let resolveAutoWrite;
    vi.mocked(userPrefsApi.updateUserPreferences)
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveAutoWrite = () => resolve(makePrefs({ language: 'de' }));
          })
      )
      .mockResolvedValueOnce(makePrefs({ language: 'fr' }));

    const { result } = renderHook(() => useUserPreferences(), {
      wrapper: UserPreferencesProvider,
    });

    await waitFor(() => {
      expect(userPrefsApi.updateUserPreferences).toHaveBeenCalledWith({
        language: 'de',
      });
    });

    const manualWrite = result.current.updatePreferences({ language: 'fr' });

    // The manual PUT must not be issued while the auto-detect write is pending
    await Promise.resolve();
    expect(userPrefsApi.updateUserPreferences).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveAutoWrite();
      await manualWrite;
    });

    expect(userPrefsApi.updateUserPreferences).toHaveBeenNthCalledWith(1, {
      language: 'de',
    });
    expect(userPrefsApi.updateUserPreferences).toHaveBeenNthCalledWith(2, {
      language: 'fr',
    });
    await waitFor(() => {
      expect(result.current.preferences.language).toBe('fr');
    });
  });
});

describe('UserPreferencesContext — one browser, successive users', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    i18n.language = 'en';
    setAuthUser(1);
    setBrowserLanguage('en');
  });

  // i18next still holds the first user's German after they sign out; the second
  // user's own browser must decide, not the leftover state.
  test('does not inherit the language of the previous user', async () => {
    vi.mocked(userPrefsApi.getUserPreferences).mockResolvedValue(
      makePrefs({ language: 'de' })
    );

    const { rerender } = renderHook(() => useUserPreferences(), {
      wrapper: UserPreferencesProvider,
    });

    await waitFor(() => {
      expect(i18n.changeLanguage).toHaveBeenCalledWith('de');
    });

    i18n.language = 'de';
    vi.mocked(userPrefsApi.getUserPreferences).mockResolvedValue(
      makePrefs({ language: null })
    );
    vi.mocked(userPrefsApi.updateUserPreferences).mockResolvedValue(
      makePrefs({ language: 'en' })
    );

    setAuthUser(2);
    rerender();

    await waitFor(() => {
      expect(userPrefsApi.getUserPreferences).toHaveBeenCalledTimes(2);
    });
    expect(userPrefsApi.updateUserPreferences).not.toHaveBeenCalled();
    expect(i18n.changeLanguage).not.toHaveBeenCalledWith('de-DE');
  });

  // Each login queues its own write; the first to settle must not clear a newer one
  test('keeps the newer auto-detect write pending when an older one settles', async () => {
    setBrowserLanguage('de');
    vi.mocked(userPrefsApi.getUserPreferences).mockResolvedValue(
      makePrefs({ language: null })
    );

    const resolvers = [];
    vi.mocked(userPrefsApi.updateUserPreferences).mockImplementation(
      () => new Promise(resolve => resolvers.push(resolve))
    );

    const { result, rerender } = renderHook(() => useUserPreferences(), {
      wrapper: UserPreferencesProvider,
    });

    await waitFor(() => {
      expect(userPrefsApi.updateUserPreferences).toHaveBeenCalledTimes(1);
    });

    setAuthUser(2);
    rerender();

    await waitFor(() => {
      expect(userPrefsApi.updateUserPreferences).toHaveBeenCalledTimes(2);
    });

    // The older write settles first
    await act(async () => {
      resolvers[0](makePrefs({ language: 'de' }));
    });

    const manualWrite = result.current.updatePreferences({ language: 'fr' });
    await act(async () => {});

    // The newer write is still pending, so the manual one must not have gone out
    expect(userPrefsApi.updateUserPreferences).toHaveBeenCalledTimes(2);

    // Once it settles, the manual write is released
    resolvers[1](makePrefs({ language: 'de' }));
    await waitFor(() => {
      expect(userPrefsApi.updateUserPreferences).toHaveBeenCalledTimes(3);
    });

    await act(async () => {
      resolvers[2](makePrefs({ language: 'fr' }));
      await manualWrite;
    });

    expect(userPrefsApi.updateUserPreferences).toHaveBeenNthCalledWith(3, {
      language: 'fr',
    });
  });
});

describe('UserPreferencesContext — obsolete session responses', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    i18n.language = 'en';
    setAuthUser(1);
    setBrowserLanguage('en');
  });

  // The first user's request completes after the second user has already loaded
  test('ignores a preferences response from a signed-out user', async () => {
    let resolveFirstLoad;
    vi.mocked(userPrefsApi.getUserPreferences)
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveFirstLoad = () => resolve(makePrefs({ language: 'de' }));
          })
      )
      .mockResolvedValueOnce(makePrefs({ language: 'fr' }));

    const { result, rerender } = renderHook(() => useUserPreferences(), {
      wrapper: UserPreferencesProvider,
    });

    await waitFor(() => {
      expect(userPrefsApi.getUserPreferences).toHaveBeenCalledTimes(1);
    });

    setAuthUser(2);
    rerender();

    await waitFor(() => {
      expect(result.current.preferences.language).toBe('fr');
    });

    await act(async () => {
      resolveFirstLoad();
    });

    expect(result.current.preferences.language).toBe('fr');
    expect(i18n.changeLanguage).not.toHaveBeenCalledWith('de');
    expect(userPrefsApi.updateUserPreferences).not.toHaveBeenCalled();
  });
});
