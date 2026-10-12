import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import logger from '../../services/logger';
import { savePendingLinks } from '../pendingLinks';

const failure = {
  event: 'pending_links_failed',
  message: 'Failed to link',
  component: 'test',
  context: { recordId: 9 },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('savePendingLinks', () => {
  it('starts every call before any of them finishes', async () => {
    const resolvers: Array<() => void> = [];
    const create = vi.fn(
      () => new Promise<void>(resolve => resolvers.push(resolve))
    );

    const pending = savePendingLinks([1, 2, 3], create, failure);

    expect(create).toHaveBeenCalledTimes(3);
    resolvers.forEach(resolve => resolve());
    expect(await pending).toBe(0);
  });

  it('keeps going after a failure and counts the failed calls', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce('plain failure');

    expect(await savePendingLinks([1, 2, 3], create, failure)).toBe(2);
    expect(create).toHaveBeenCalledTimes(3);
  });

  it('logs each failure with the owner ids and no record content', async () => {
    const create = vi.fn().mockRejectedValue(new Error('boom'));

    await savePendingLinks([1], create, failure);

    expect(logger.error).toHaveBeenCalledWith('pending_links_failed', {
      message: 'Failed to link',
      recordId: 9,
      error: 'boom',
      component: 'test',
    });
  });

  it('does nothing without items', async () => {
    const create = vi.fn();
    expect(await savePendingLinks([], create, failure)).toBe(0);
    expect(create).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
