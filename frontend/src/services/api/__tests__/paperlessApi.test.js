import { vi } from 'vitest';

import { testPaperlessConnection } from '../paperlessApi';
import { apiService } from '../index';

vi.mock('../index', () => ({
  apiService: {
    post: vi.fn(),
  },
}));

vi.mock('../../logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('testPaperlessConnection', () => {
  const url = 'http://paperless.local:8000';

  beforeEach(() => {
    vi.clearAllMocks();
    apiService.post.mockResolvedValue({ status: 'connected' });
  });

  it('sends only the URL when no credentials are provided (saved credentials)', async () => {
    await testPaperlessConnection(url, '', '', '');

    expect(apiService.post).toHaveBeenCalledWith('/paperless/test-connection', {
      paperless_url: url,
    });
  });

  it('sends only the URL when credentials are undefined', async () => {
    await testPaperlessConnection(url);

    expect(apiService.post).toHaveBeenCalledWith('/paperless/test-connection', {
      paperless_url: url,
    });
  });

  it('sends the API token and ignores username and password', async () => {
    await testPaperlessConnection(url, 'admin', 'secret', 'token-1234567890');

    expect(apiService.post).toHaveBeenCalledWith('/paperless/test-connection', {
      paperless_url: url,
      paperless_api_token: 'token-1234567890',
    });
  });

  it('sends username and password when no token is provided', async () => {
    await testPaperlessConnection(url, 'admin', 'secret');

    expect(apiService.post).toHaveBeenCalledWith('/paperless/test-connection', {
      paperless_url: url,
      paperless_username: 'admin',
      paperless_password: 'secret',
    });
  });

  it('sends the auth method so the right saved credentials are tested', async () => {
    await testPaperlessConnection(url, '', '', '', 'basic_auth');

    expect(apiService.post).toHaveBeenCalledWith('/paperless/test-connection', {
      paperless_url: url,
      paperless_auth_method: 'basic_auth',
    });
  });

  it('omits the auth method when none is given', async () => {
    await testPaperlessConnection(url, '', '', '');

    const payload = apiService.post.mock.calls[0][1];
    expect(payload).not.toHaveProperty('paperless_auth_method');
  });
});
