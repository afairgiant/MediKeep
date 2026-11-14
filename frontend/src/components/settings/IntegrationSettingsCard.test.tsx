import { describe, it, expect, vi } from 'vitest';
import render, { screen, fireEvent } from '../../test-utils/render';
import IntegrationSettingsCard from './IntegrationSettingsCard';

const renderCard = (props = {}) => {
  const onTestConnection = vi.fn();
  render(
    <IntegrationSettingsCard
      name="Paperless"
      enabled
      onEnabledChange={vi.fn()}
      url=""
      onUrlChange={vi.fn()}
      token="token"
      onTokenChange={vi.fn()}
      onTestConnection={onTestConnection}
      {...props}
    />
  );
  return { onTestConnection };
};

const urlInput = () => screen.getByLabelText('Server URL');

const typeUrl = (value: string) =>
  fireEvent.change(urlInput(), { target: { value } });

describe('IntegrationSettingsCard URL validation', () => {
  it.each([
    'http://paperless-container:8000',
    'http://nas.lan',
    'http://192.168.1.10:8000',
    'https://paperless.example.com',
  ])('accepts %s', url => {
    renderCard();
    typeUrl(url);
    expect(urlInput()).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('leaves plain HTTP to a public host for the backend to reject', () => {
    renderCard();
    typeUrl('http://paperless.example.com');
    expect(urlInput()).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('rejects a non-HTTP scheme', () => {
    renderCard();
    typeUrl('ftp://paperless.example.com');
    expect(urlInput()).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText('URL must start with http:// or https://')
    ).toBeInTheDocument();
  });

  it('rejects an unparseable URL', () => {
    renderCard();
    typeUrl('not a url');
    expect(screen.getByText('Invalid URL format')).toBeInTheDocument();
  });

  it('calls onTestConnection for a Docker service name over HTTP', () => {
    const { onTestConnection } = renderCard({
      url: 'http://paperless-container:8000',
    });
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }));
    expect(onTestConnection).toHaveBeenCalledTimes(1);
  });
});

describe('IntegrationSettingsCard token field', () => {
  it('renders the API token field by default', () => {
    renderCard();
    expect(screen.getByLabelText('API Token')).toBeInTheDocument();
  });

  it('hides the API token field when showTokenField is false', () => {
    renderCard({ showTokenField: false });
    expect(screen.queryByLabelText('API Token')).not.toBeInTheDocument();
  });

  it('renders auth extras above the token field', () => {
    renderCard({
      renderAuthExtras: () => <div data-testid="auth-extras" />,
    });
    const extras = screen.getByTestId('auth-extras');
    const tokenInput = screen.getByLabelText('API Token');
    expect(
      extras.compareDocumentPosition(tokenInput) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('requires a token to test when the field is shown and none is saved', () => {
    const { onTestConnection } = renderCard({
      url: 'http://paperless-container:8000',
      token: '',
    });
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }));
    expect(onTestConnection).not.toHaveBeenCalled();
    expect(screen.getByText('API token is required')).toBeInTheDocument();
  });

  it('does not require a token to test when the field is hidden', () => {
    const { onTestConnection } = renderCard({
      url: 'http://paperless-container:8000',
      token: '',
      showTokenField: false,
    });
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }));
    expect(onTestConnection).toHaveBeenCalledTimes(1);
  });
});
