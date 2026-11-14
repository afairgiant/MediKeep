import { describe, it, expect, vi } from 'vitest';
import render, { screen, fireEvent } from '../../test-utils/render';
import PaperlessSettings from './PaperlessSettings';

/**
 * #1230: while "Username & Password" is the selected auth method the API Token
 * input stayed on screen, so the form showed two competing credentials.
 */
const withCredentials = {
  paperless_enabled: true,
  paperless_url: 'https://paperless.example.com',
  paperless_has_credentials: true,
  paperless_username: 'mike',
  paperless_password: 'secret',
};

const withToken = {
  paperless_enabled: true,
  paperless_url: 'https://paperless.example.com',
  paperless_has_token: true,
  paperless_api_token: '0123456789abcdef',
};

describe('PaperlessSettings auth method', () => {
  it('hides the API token field when username/password is selected', () => {
    render(
      <PaperlessSettings
        preferences={withCredentials}
        onPreferencesUpdate={vi.fn()}
      />
    );

    expect(screen.queryByLabelText('API Token')).toBeNull();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('shows the API token field for the token method', () => {
    render(
      <PaperlessSettings preferences={withToken} onPreferencesUpdate={vi.fn()} />
    );

    expect(screen.getByLabelText('API Token')).toBeInTheDocument();
    expect(screen.queryByLabelText('Username')).toBeNull();
  });

  it('switches the field when the other method is picked', () => {
    render(
      <PaperlessSettings preferences={withToken} onPreferencesUpdate={vi.fn()} />
    );

    fireEvent.click(screen.getByLabelText('Username & Password'));

    expect(screen.queryByLabelText('API Token')).toBeNull();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
  });
});
