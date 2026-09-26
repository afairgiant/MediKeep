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
