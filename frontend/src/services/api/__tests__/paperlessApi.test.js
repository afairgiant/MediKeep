import { vi } from 'vitest';

import {
  testPaperlessConnection,
  pollPaperlessTaskStatus,
} from '../paperlessApi';
import { apiService } from '../index';

vi.mock('../index', () => ({
  apiService: {
    post: vi.fn(),
    get: vi.fn(),
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

describe('pollPaperlessTaskStatus', () => {
  const taskUuid = '3f1c7a52-9e0b-4d0e-8c1a-0b6f5d2a7e11';
  const FOREGROUND_ATTEMPTS = 30;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns as soon as the task reports a terminal status', async () => {
    apiService.get
      .mockResolvedValueOnce({ status: 'PENDING' })
      .mockResolvedValueOnce({ status: 'SUCCESS', result: { document_id: 7 } });
    const onBackground = vi.fn();

    const promise = pollPaperlessTaskStatus(taskUuid, 300, 1000, onBackground);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toMatchObject({ status: 'SUCCESS' });
    expect(apiService.get).toHaveBeenCalledTimes(2);
    expect(onBackground).not.toHaveBeenCalled();
  });

  it('hands off to the background after the foreground window while the task stays pending', async () => {
    apiService.get.mockResolvedValue({ status: 'PENDING' });
    const onBackground = vi.fn();

    const promise = pollPaperlessTaskStatus(taskUuid, 300, 1000, onBackground);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toMatchObject({
      status: 'PROCESSING_BACKGROUND',
      task_uuid: taskUuid,
    });
    expect(apiService.get).toHaveBeenCalledTimes(FOREGROUND_ATTEMPTS);
    expect(onBackground).toHaveBeenCalledWith(taskUuid);
  });

  it('hands off to the background when every status check fails instead of waiting out all attempts', async () => {
    apiService.get.mockRejectedValue(new Error('Task not found'));
    const onBackground = vi.fn();

    const promise = pollPaperlessTaskStatus(taskUuid, 300, 1000, onBackground);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toMatchObject({
      status: 'PROCESSING_BACKGROUND',
    });
    expect(apiService.get).toHaveBeenCalledTimes(FOREGROUND_ATTEMPTS);
    expect(onBackground).toHaveBeenCalledTimes(1);
  });

  it('keeps polling through transient errors and returns the task result', async () => {
    apiService.get
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ status: 'FAILURE', result: 'boom' });

    const promise = pollPaperlessTaskStatus(taskUuid, 300, 1000, vi.fn());
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toMatchObject({ status: 'FAILURE' });
    expect(apiService.get).toHaveBeenCalledTimes(3);
  });

  it('throws the last error when no background handler is given and attempts run out', async () => {
    apiService.get.mockRejectedValue(new Error('Task not found'));

    const promise = pollPaperlessTaskStatus(taskUuid, 3, 1000);
    const assertion = expect(promise).rejects.toThrow(
      'Task status polling failed: Task not found'
    );
    await vi.runAllTimersAsync();

    await assertion;
    expect(apiService.get).toHaveBeenCalledTimes(3);
  });
});
