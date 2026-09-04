import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

vi.mock('./AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: 1, username: 'testuser' },
    isLoading: false,
  }),
}));

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
    vi.clearAllMocks();
    i18n.language = 'en';
  });

  test('saves the detected language and keeps it in the UI', async () => {
    i18n.language = 'de';
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
    expect(i18n.changeLanguage).not.toHaveBeenCalled();
  });

  test('normalizes a regional browser locale before saving', async () => {
    i18n.language = 'de-AT';
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
    i18n.language = 'xx';
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
    i18n.language = 'fr';
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
