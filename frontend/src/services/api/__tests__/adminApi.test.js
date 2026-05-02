import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import adminApiService from '../adminApi';
import BaseApiService from '../baseApi';

describe('adminApiService.getModelRecords', () => {
  let getSpy;

  beforeEach(() => {
    getSpy = vi
      .spyOn(BaseApiService.prototype, 'get')
      .mockResolvedValue({ items: [], total: 0, page: 1, per_page: 25, total_pages: 0 });
  });

  afterEach(() => {
    getSpy.mockRestore();
  });

  it('forwards page, per_page, and search inside an options.params object', async () => {
    await adminApiService.getModelRecords('user', {
      page: 2,
      per_page: 50,
      search: 'foo',
    });

    expect(getSpy).toHaveBeenCalledWith('/models/user/', {
      params: { page: 2, per_page: 50, search: 'foo' },
    });
  });

  it('omits search from params when it is falsy', async () => {
    await adminApiService.getModelRecords('medication', {
      page: 1,
      per_page: 25,
      search: null,
    });

    expect(getSpy).toHaveBeenCalledWith('/models/medication/', {
      params: { page: 1, per_page: 25 },
    });
  });

  it('uses defaults (page=1, per_page=25, no search) when no params are provided', async () => {
    await adminApiService.getModelRecords('user');

    expect(getSpy).toHaveBeenCalledWith('/models/user/', {
      params: { page: 1, per_page: 25 },
    });
  });
});
