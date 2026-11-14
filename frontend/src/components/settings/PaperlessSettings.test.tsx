import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import render, { screen, fireEvent, waitFor } from '../../test-utils/render';
import PaperlessSettings from './PaperlessSettings';
import { testPaperlessConnection } from '../../services/api/paperlessApi.jsx';

vi.mock('../../services/api/paperlessApi.jsx', () => ({
  testPaperlessConnection: vi.fn(),
}));

const URL = 'http://paperless-container:8000';

type Prefs = Record<string, unknown>;

/** Holds preferences like the Settings page does, so selecting a method re-renders. */
const Harness = ({
  initial,
  onUpdate,
}: {
  initial: Prefs;
  onUpdate: ReturnType<typeof vi.fn>;
}) => {
  const [prefs, setPrefs] = useState<Prefs>(initial);
  return (
    <PaperlessSettings
      preferences={prefs}
      onPreferencesUpdate={(next: Prefs) => {
        onUpdate(next);
        setPrefs(next);
      }}
    />
  );
};

const renderSettings = (preferences: Prefs = {}) => {
  const onUpdate = vi.fn();
  render(
    <Harness
      initial={{
        paperless_enabled: true,
        paperless_url: URL,
        ...preferences,
      }}
      onUpdate={onUpdate}
    />
  );
  return { onUpdate };
};

const selectBasicAuth = () =>
  fireEvent.click(screen.getByLabelText('Username & Password'));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PaperlessSettings authentication fields', () => {
  it('shows only the API token field by default', () => {
    renderSettings();
    expect(screen.getByLabelText('API Token')).toBeInTheDocument();
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
  });

  it('places the API token field below the authentication method selector', () => {
    renderSettings();
    const radio = screen.getByLabelText('API Token (Recommended)');
    const tokenInput = screen.getByLabelText('API Token');
    expect(
      radio.compareDocumentPosition(tokenInput) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('hides the API token field and shows username/password when selected', () => {
    renderSettings();
    selectBasicAuth();
    expect(screen.queryByLabelText('API Token')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('restores the API token field when switching back to token auth', () => {
    renderSettings();
    selectBasicAuth();
    fireEvent.click(screen.getByLabelText('API Token (Recommended)'));
    expect(screen.getByLabelText('API Token')).toBeInTheDocument();
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();
  });

  it('reports the chosen method as a preference change', () => {
    const { onUpdate } = renderSettings({ paperless_auth_method: 'token' });
    selectBasicAuth();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0]).toMatchObject({
      paperless_auth_method: 'basic_auth',
    });
  });

  it('shows the saved method even when a token is also saved', () => {
    renderSettings({
      paperless_auth_method: 'basic_auth',
      paperless_has_token: true,
      paperless_has_credentials: true,
    });
    expect(screen.queryByLabelText('API Token')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
  });

  it.each(['none', 'sso', '', undefined])(
    'displays token auth for the unrecognised method %s',
    method => {
      renderSettings({ paperless_auth_method: method });
      expect(screen.getByLabelText('API Token')).toBeInTheDocument();
    }
  );

  it('hints when the selected method has no credentials yet', () => {
    renderSettings({ paperless_has_token: true });
    expect(screen.queryByText(/no saved credentials/i)).not.toBeInTheDocument();
    selectBasicAuth();
    expect(screen.getByText(/no saved credentials/i)).toBeInTheDocument();
  });
});

describe('PaperlessSettings test connection', () => {
  it('uses username/password, not a stale token, when basic auth is selected', async () => {
    vi.mocked(testPaperlessConnection).mockResolvedValue({
      status: 'connected',
    });
    renderSettings({
      paperless_auth_method: 'basic_auth',
      paperless_api_token: 'stale-token-value',
      paperless_username: 'alice',
      paperless_password: 'secret',
    });
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }));
    await waitFor(() =>
      expect(testPaperlessConnection).toHaveBeenCalledWith(
        URL,
        'alice',
        'secret',
        '',
        'basic_auth'
      )
    );
  });

  it('uses the API token when token auth is selected', async () => {
    vi.mocked(testPaperlessConnection).mockResolvedValue({
      status: 'connected',
    });
    renderSettings({
      paperless_api_token: 'a-valid-token-value',
      paperless_username: 'alice',
      paperless_password: 'secret',
    });
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }));
    await waitFor(() =>
      expect(testPaperlessConnection).toHaveBeenCalledWith(
        URL,
        '',
        '',
        'a-valid-token-value',
        'token'
      )
    );
  });

  it('tests the saved credentials of the selected method when nothing is typed', async () => {
    vi.mocked(testPaperlessConnection).mockResolvedValue({
      status: 'connected',
    });
    renderSettings({
      paperless_has_token: true,
      paperless_has_credentials: true,
    });
    selectBasicAuth();
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }));
    await waitFor(() =>
      expect(testPaperlessConnection).toHaveBeenCalledWith(
        URL,
        '',
        '',
        '',
        'basic_auth'
      )
    );
  });
});
