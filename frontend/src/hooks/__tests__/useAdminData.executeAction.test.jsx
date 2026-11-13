import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAdminData } from '../useAdminData';

vi.mock('../../services/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('useAdminData executeAction', () => {
  const setup = actions =>
    renderHook(() =>
      useAdminData({
        entityName: 'Test Entity',
        apiMethodsConfig: {
          load: vi.fn(() => Promise.resolve({ ok: true })),
          ...actions,
        },
      })
    );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns the action result on success', async () => {
    const { result } = setup({
      createBackup: vi.fn(() => Promise.resolve({ id: 7 })),
    });
    await waitFor(() => expect(result.current.data).not.toBeNull());

    await expect(
      result.current.executeAction('createBackup', 'desc')
    ).resolves.toEqual({ id: 7 });
  });

  test('rethrows the API error so the caller can report it', async () => {
    const apiError = new Error('Database dump failed');
    const { result } = setup({
      createBackup: vi.fn(() => Promise.reject(apiError)),
    });
    await waitFor(() => expect(result.current.data).not.toBeNull());

    await expect(
      result.current.executeAction('createBackup', 'desc')
    ).rejects.toBe(apiError);
  });

  test('rethrows when the action is not configured', async () => {
    const { result } = setup({});
    await waitFor(() => expect(result.current.data).not.toBeNull());

    await expect(result.current.executeAction('missing')).rejects.toThrow(
      "Action 'missing' not found"
    );
  });

  test('does not throw for an aborted request', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    const { result } = setup({
      createBackup: vi.fn(() => Promise.reject(abortError)),
    });
    await waitFor(() => expect(result.current.data).not.toBeNull());

    await expect(
      result.current.executeAction('createBackup', 'desc')
    ).resolves.toBe(false);
  });

  const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  test('rethrows a failure even after a newer request superseded it', async () => {
    const pending = deferred();
    const { result } = setup({ createBackup: vi.fn(() => pending.promise) });
    await waitFor(() => expect(result.current.data).not.toBeNull());

    const action = result.current.executeAction('createBackup', 'desc');
    await result.current.refreshData();
    pending.reject(new Error('Database dump failed'));

    await expect(action).rejects.toThrow('Database dump failed');
  });

  test('returns the result even after a newer request superseded it', async () => {
    const pending = deferred();
    const { result } = setup({ createBackup: vi.fn(() => pending.promise) });
    await waitFor(() => expect(result.current.data).not.toBeNull());

    const action = result.current.executeAction('createBackup', 'desc');
    await result.current.refreshData();
    pending.resolve({ id: 9 });

    await expect(action).resolves.toEqual({ id: 9 });
  });

  test('passes no payload when actionData is omitted', async () => {
    const cleanup = vi.fn(() => Promise.resolve({ total_deleted: 0 }));
    const { result } = setup({ cleanup });
    await waitFor(() => expect(result.current.data).not.toBeNull());

    await result.current.executeAction('cleanup');

    expect(cleanup).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
});
